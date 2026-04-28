import { useRef, useCallback, useEffect } from 'react';
import { useStore } from '../store/index.js';
import { saveWords } from '../services/db.js';

const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || '3001';
const BACKEND_HOST = import.meta.env.VITE_BACKEND_HOST || location.hostname;
const WS_PROTOCOL  = location.protocol === 'https:' ? 'wss' : 'ws';
const WS_URL       = `${WS_PROTOCOL}://${BACKEND_HOST}:${BACKEND_PORT}/ws/transcribe`;
const API_BASE     = `${location.protocol}

const WORDS_FOR_NOTES = 200;
const WORDS_FOR_QUIZ  = 150;
const CHUNK_MS        = 5000;
const _dk = () => new Date().toDateString();
export const rateLimiter = {
  calls: [], MAX_PER_MIN: 20, MAX_PER_DAY: 500,
  _dk: _dk(), _dc: parseInt(localStorage.getItem('es_dc') || '0'),
  canCall() {
    if (_dk() !== this._dk) { this._dk = _dk(); this._dc = 0; localStorage.setItem('es_dc', '0'); }
    if (this._dc >= this.MAX_PER_DAY) return false;
    this.calls = this.calls.filter(t => Date.now() - t < 60000);
    return this.calls.length < this.MAX_PER_MIN;
  },
  record() {
    this.calls.push(Date.now());
    this._dc++;
    localStorage.setItem('es_dc', String(this._dc));
  },
  remaining() {
    this.calls = this.calls.filter(t => Date.now() - t < 60000);
    return {
      perMin: Math.max(0, this.MAX_PER_MIN - this.calls.length),
      perDay: Math.max(0, this.MAX_PER_DAY - this._dc),
    };
  },
};
function makeDedup() {
  const ring = [];
  return {
    isDup(text) {
      const key = text.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!key || key.length < 3) return true;
      if (ring[ring.length - 1] === key) return true;
      ring.push(key);
      if (ring.length > 10) ring.shift();
      return false;
    },
    reset() { ring.length = 0; },
  };
}
function makeSpeakerDet() {
  let idx = 1, silentFrames = 0, wasLoud = false;
  let analyser = null, buf = null;
  const THRESH = 0.006, FRAMES = 20;
  return {
    init(ctx, source) {
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      buf = new Float32Array(analyser.frequencyBinCount);
      source.connect(analyser);
    },
    tick() {
      if (!analyser) return `SPEAKER_0${idx}`;
      analyser.getFloatTimeDomainData(buf);
      const energy = buf.reduce((s, v) => s + v * v, 0) / buf.length;
      const isLoud = energy > THRESH;
      if (!isLoud) silentFrames++;
      else {
        if (silentFrames >= FRAMES && wasLoud) idx = Math.min(idx + 1, 5);
        silentFrames = 0;
      }
      wasLoud = isLoud;
      return `SPEAKER_0${idx}`;
    },
    current() { return `SPEAKER_0${idx}`; },
    reset()   { idx = 1; silentFrames = 0; wasLoud = false; },
  };
}
export function useTranscription() {
  const wsRef           = useRef(null);
  const mrRef           = useRef(null);
  const audioCtxRef     = useRef(null);
  const streamRef       = useRef(null);
  const speakerDet      = useRef(makeSpeakerDet());
  const dedup           = useRef(makeDedup());
  const pingRef         = useRef(null);
  const energyFrame     = useRef(null);
  const chunkTimer      = useRef(null);
  const isActiveRef     = useRef(false);
  const chunkQueue      = useRef([]);
  const isProcessingRef = useRef(false);
  const sendBuffer      = useRef([]);
  const wSinceNotes     = useRef(0);
  const wSinceQuiz      = useRef(0);
  const askedQs         = useRef([]);
  const langRef         = useRef('en');

  const store = useStore;

  function safeSend(payload) {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(payload);
    else sendBuffer.current.push(payload);
  }

  function flushBuffer() {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    sendBuffer.current.splice(0).forEach(p => { try { ws.send(p); } catch {} });
  }

  function commitText(text, confidence) {
    const speaker = speakerDet.current.current();
    safeSend(JSON.stringify({
      type: 'transcript_text',
      text,
      isFinal: true,
      confidence,
      speakerLabel: speaker,
    }));
  }

  function maybeNotes(n) {
    wSinceNotes.current += n;
    if (wSinceNotes.current < WORDS_FOR_NOTES || !rateLimiter.canCall()) return;
    wSinceNotes.current = 0;
    rateLimiter.record();
    setTimeout(async () => {
      try {
        const { api } = await import('../services/api.js');
        const r = await api.generateNotes(store.getState().getRecentTranscript(8000));
        if (r.notes) store.getState().addNotes(r.notes);
      } catch (e) { console.warn('[Notes]', e.message); }
    }, 0);
  }

  function maybeQuiz(n) {
    wSinceQuiz.current += n;
    if (wSinceQuiz.current < WORDS_FOR_QUIZ || !rateLimiter.canCall()) return;
    wSinceQuiz.current = 0;
    rateLimiter.record();
    setTimeout(async () => {
      try {
        const { api } = await import('../services/api.js');
        const r = await api.generateQuiz(
          store.getState().getRecentTranscript(6000), '',
          askedQs.current.slice(-8),
        );
        if (r.questions?.length) {
          askedQs.current.push(...r.questions.map(q => q.question));
          store.getState().addQuizQuestions(r.questions);
        }
      } catch (e) { console.warn('[Quiz]', e.message); }
    }, 0);
  }

  function connectWS() {
    const ex = wsRef.current;
    if (ex) {
      ex.onopen = ex.onmessage = ex.onerror = ex.onclose = null;
      try { if (ex.readyState <= 1) ex.close(); } catch {}
    }
    wsRef.current = null;
    clearInterval(pingRef.current);

    let ws;
    try { ws = new WebSocket(WS_URL); }
    catch (e) {
      console.warn('[WS] create failed:', e.message);
      if (isActiveRef.current) setTimeout(connectWS, 2000);
      return;
    }

    ws.onopen = () => {
      store.getState().setConnected(true);
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'pong' }));
      }, 20000);
      flushBuffer();
      console.log('[WS] connected');
    };

    ws.onmessage = async (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'transcript_chunk' && msg.words?.length) {
          const s = store.getState();
          s.appendWords(msg.words);
          if (s.sessionId) saveWords(s.sessionId, msg.words).catch(() => {});
          maybeNotes(msg.words.length);
          maybeQuiz(msg.words.length);
        }
      } catch {}
    };

    ws.onerror = () => store.getState().setConnected(false);
    ws.onclose = () => {
      store.getState().setConnected(false);
      clearInterval(pingRef.current);
      if (isActiveRef.current) setTimeout(connectWS, 1500);
    };

    wsRef.current = ws;
  }

  async function _sendOneChunk(blob, mimeType) {
    try {
      const base64 = await blobToBase64(blob);
      const res = await fetch(`${API_BASE}/api/transcribe-chunk`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio:    base64,
          mimeType,
          language: langRef.current !== 'auto' ? langRef.current : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('[Whisper] API error:', err.error || res.status);
        return;
      }

      const { text } = await res.json();
      const trimmed = text?.trim();
      if (trimmed && !dedup.current.isDup(trimmed)) {
        console.log('[Whisper] ✓', trimmed.slice(0, 80));
        store.getState().setInterimText('');
        commitText(trimmed, 0.92);
      }
    } catch (e) {
      console.warn('[Whisper] fetch error:', e.message);
    }
  }
  async function processQueue() {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    while (chunkQueue.current.length > 0) {
      const item = chunkQueue.current.shift();
      await _sendOneChunk(item.blob, item.mimeType);
    }
    isProcessingRef.current = false;
  }

  function enqueueChunk(blob, mimeType) {
    if (!blob || blob.size < 1000) return;
    chunkQueue.current.push({ blob, mimeType });
    console.log(`[Queue] +1 chunk (queue depth: ${chunkQueue.current.length})`);
    processQueue();
  }

  function startMediaRecorder(stream) {
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
      .find(m => MediaRecorder.isTypeSupported(m)) || '';

    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    mrRef.current = mr;

    const chunks = [];

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    mr.onstop = () => {
      if (!isActiveRef.current) return;
      const blob = new Blob(chunks.splice(0), { type: mime || 'audio/webm' });
      enqueueChunk(blob, mime || 'audio/webm');
      if (isActiveRef.current && mr === mrRef.current) {
        try { mr.start(); } catch {}
      }
    };

    mr.onerror = (e) => {
      console.warn('[MR] error:', e.error);
    };

    mr.start();
    function scheduleChunk() {
      chunkTimer.current = setTimeout(() => {
        if (!isActiveRef.current) return;
        try { mr.stop(); } catch {}
        scheduleChunk();
      }, CHUNK_MS);
    }
    scheduleChunk();

    console.log('[MR] started, chunk interval:', CHUNK_MS, 'ms, mime:', mime || 'browser default');
  }

  function startEnergyLoop() {
    const tick = () => {
      speakerDet.current.tick();
      energyFrame.current = requestAnimationFrame(tick);
    };
    energyFrame.current = requestAnimationFrame(tick);
  }

  const startRecording = useCallback(async () => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;

    store.getState().startSession();
    store.getState().setRecordingError('');
    store.getState().setInterimText('');
    dedup.current.reset();
    speakerDet.current.reset();
    sendBuffer.current    = [];
    chunkQueue.current    = [];
    isProcessingRef.current = false;
    wSinceNotes.current   = 0;
    wSinceQuiz.current    = 0;
    askedQs.current       = [];
    const storeState = store.getState();
    const lang = storeState.recognitionLang || 'en-US';
    langRef.current = lang.split('-')[0];
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      console.log('[Mic] acquired:', stream.getAudioTracks()[0]?.label);
    } catch (err) {
      isActiveRef.current = false;
      throw err;
    }
    streamRef.current = stream;
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    audioCtxRef.current = ctx;
    speakerDet.current.init(ctx, ctx.createMediaStreamSource(stream));
    startEnergyLoop();

    store.getState().setRecording(true);
    store.getState().setBrowserMode('Whisper AI');
    connectWS();
    startMediaRecorder(stream);
    store.getState().setInterimText('Listening… first words in ~5s');
    setTimeout(() => {
      if (isActiveRef.current) store.getState().setInterimText('');
    }, 5000);

  }, []);

  const stopRecording = useCallback(() => {
    isActiveRef.current   = false;
    isProcessingRef.current = false;
    chunkQueue.current    = [];

    clearTimeout(chunkTimer.current);

    store.getState().setInterimText('');
    store.getState().setRecording(false);
    store.getState().setConnected(false);
    const mr = mrRef.current;
    mrRef.current = null;
    try { mr?.stop(); } catch {}

    cancelAnimationFrame(energyFrame.current);

    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;

    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    clearInterval(pingRef.current);
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try { ws.close(1000); } catch {}
    }

    sendBuffer.current = [];
    console.log('[Recording] stopped cleanly');
  }, []);

  useEffect(() => () => { if (isActiveRef.current) stopRecording(); }, []);

  return { startRecording, stopRecording, rateLimiter };
}

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
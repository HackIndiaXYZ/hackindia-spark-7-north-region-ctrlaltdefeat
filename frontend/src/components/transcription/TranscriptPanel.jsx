import { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store/index.js';
import { exportSRT, exportJSON, downloadFile } from '../../utils/export.js';

const SPEAKER_COLORS = {
  SPEAKER_01: { text: '#7ab3ff', bg: 'rgba(79,142,247,0.12)',  border: 'rgba(79,142,247,0.25)'  },
  SPEAKER_02: { text: '#34d399', bg: 'rgba(34,211,160,0.12)',  border: 'rgba(34,211,160,0.25)'  },
  SPEAKER_03: { text: '#f7b731', bg: 'rgba(247,183,49,0.12)',  border: 'rgba(247,183,49,0.25)'  },
  SPEAKER_04: { text: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.25)' },
  SPEAKER_05: { text: '#fb7185', bg: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.25)' },
};

function ConfidenceDot({ confidence }) {
  const color = confidence >= 0.9 ? 'var(--green)' : confidence >= 0.7 ? 'var(--amber)' : 'var(--red)';
  return (
    <span
      title={`${Math.round(confidence * 100)}% confidence`}
      style={{ display:'inline-block', width:5, height:5, borderRadius:'50%', background:color, marginRight:4, verticalAlign:'middle', flexShrink:0, boxShadow:`0 0 4px ${color}` }}
    />
  );
}

export default function TranscriptPanel() {
  const { words, isRecording, sessionId, notes, interimText, recognitionLang, setRecognitionLang } = useStore();
  const bottomRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [words.length, interimText, autoScroll]);

  const segments = [];
  let cur = null;
  for (const w of words) {
    if (!cur || cur.speaker !== w.speaker) { cur = { speaker: w.speaker, words: [w] }; segments.push(cur); }
    else cur.words.push(w);
  }

  function handleExportSRT()  { downloadFile(exportSRT(words), `eduscript-${sessionId || 'session'}.srt`, 'text/plain'); }
  function handleExportJSON() { downloadFile(exportJSON(words, notes, sessionId), `eduscript-${sessionId || 'session'}.json`, 'application/json'); }

  const uniqueSpeakers = [...new Set(words.map(w => w.speaker))];

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.title}>Live Transcript</span>
          {isRecording && (
            <span style={S.liveChip}>
              <span style={S.liveDot} />
              LIVE
            </span>
          )}
          <span style={S.meta}>{words.length} words</span>
          {uniqueSpeakers.length > 1 && (
            <span style={S.meta}>{uniqueSpeakers.length} speakers</span>
          )}
        </div>

        <div style={S.headerRight}>
          <select
            value={recognitionLang}
            onChange={e => setRecognitionLang(e.target.value)}
            style={S.langSelect}
            title="Recognition language"
            aria-label="Select recognition language"
          >
            <option value="en-US">🇺🇸 EN-US</option>
            <option value="en-GB">🇬🇧 EN-GB</option>
            <option value="hi-IN">🇮🇳 HI</option>
            <option value="es-ES">🇪🇸 ES</option>
            <option value="fr-FR">🇫🇷 FR</option>
            <option value="de-DE">🇩🇪 DE</option>
            <option value="zh-CN">🇨🇳 ZH</option>
            <option value="ar-SA">🇸🇦 AR</option>
            <option value="pt-BR">🇧🇷 PT</option>
            <option value="ja-JP">🇯🇵 JA</option>
          </select>
          <button className="btn btn-ghost" style={{ fontSize:11, padding:'5px 12px' }} onClick={handleExportSRT} disabled={!words.length}>↓ SRT</button>
          <button className="btn btn-ghost" style={{ fontSize:11, padding:'5px 12px' }} onClick={handleExportJSON} disabled={!words.length}>↓ JSON</button>
        </div>
      </div>

      {isRecording && (
        <div style={S.listeningBar}>
          <span style={S.listeningDot} />
          <span style={S.listeningText}>Whisper AI is listening — speak clearly</span>
          <span style={S.listeningPulse} />
        </div>
      )}

      <div style={S.body} onScroll={e => {
        const el = e.currentTarget;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        setAutoScroll(atBottom);
      }}>
        {words.length === 0 && !interimText ? (
          <div style={S.empty} className="fade-in">
            <div style={S.emptyIcon}>🎙</div>
            <p style={S.emptyTitle}>
              {isRecording ? 'Listening…' : 'Ready to Transcribe'}
            </p>
            <p style={S.emptySubtitle}>
              {isRecording
                ? 'Speech will appear here. First words arrive in ~5 seconds.'
                : 'Click Record to start capturing your lecture audio.'}
            </p>
          </div>
        ) : (
          <>
            {segments.map((seg, i) => {
              const colors = SPEAKER_COLORS[seg.speaker] || { text: '#94a3c4', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' };
              return (
                <div key={i} style={{ ...S.segment, borderLeftColor: colors.text }} className="fade-up">
                  <div style={S.segHeader}>
                    <span style={{ ...S.speakerLabel, color: colors.text, background: colors.bg, border: `1px solid ${colors.border}` }}>
                      {seg.speaker}
                    </span>
                    <span style={S.timestamp}>{fmtMs(seg.words[0]?.startMs)}</span>
                  </div>
                  <p style={S.segText}>
                    {seg.words.map(w => (
                      <span key={w.id} title={`${fmtMs(w.startMs)} · ${Math.round(w.confidence * 100)}%`}>
                        <ConfidenceDot confidence={w.confidence} />{w.word}{' '}
                      </span>
                    ))}
                  </p>
                </div>
              );
            })}

            {interimText && (
              <div style={S.interim} className="fade-in">
                <span style={S.interimDots}>···</span>
                <span style={S.interimText}>{interimText}</span>
              </div>
            )}

            {isRecording && <span style={S.cursor} />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {!autoScroll && words.length > 0 && (
        <button style={S.scrollBtn} onClick={() => { setAutoScroll(true); bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>
          ↓ Resume auto-scroll
        </button>
      )}
    </div>
  );
}

function fmtMs(ms) {
  if (ms == null) return '';
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

const S = {
  root: { display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', position:'relative' },
  header: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'12px 20px',
    background:'rgba(5,10,20,0.7)',
    backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
    borderBottom:'1px solid var(--border)',
    flexShrink:0, flexWrap:'wrap', gap:10,
  },
  headerLeft:  { display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' },
  headerRight: { display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' },
  title: { fontWeight:800, fontSize:14, color:'var(--text-primary)', letterSpacing:'-0.02em' },
  liveChip: {
    display:'flex', alignItems:'center', gap:5,
    background:'rgba(247,93,93,0.12)',
    border:'1px solid rgba(247,93,93,0.25)',
    borderRadius:20, padding:'3px 9px',
    fontSize:9, fontWeight:800, fontFamily:'var(--font-mono)',
    color:'var(--red)', letterSpacing:'0.1em',
    boxShadow:'0 0 12px rgba(247,93,93,0.2)',
  },
  liveDot: { width:5, height:5, borderRadius:'50%', background:'var(--red)', animation:'pulse 1.2s ease-in-out infinite', boxShadow:'0 0 6px var(--red-glow)' },
  meta: { fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)' },
  langSelect: {
    background:'rgba(4,9,20,0.6)', border:'1px solid var(--border)',
    borderRadius:8, color:'var(--text-secondary)',
    fontSize:11, fontFamily:'var(--font-mono)', padding:'5px 10px',
    cursor:'pointer', outline:'none',
  },
  listeningBar: {
    display:'flex', alignItems:'center', gap:10,
    padding:'8px 20px',
    background:'rgba(34,211,160,0.07)',
    borderBottom:'1px solid rgba(34,211,160,0.15)',
    flexShrink:0,
  },
  listeningDot: { width:7, height:7, borderRadius:'50%', background:'var(--green)', animation:'pulse 1.5s ease-in-out infinite', flexShrink:0, boxShadow:'0 0 8px var(--green-glow)' },
  listeningText: { fontSize:11, color:'rgba(34,211,160,0.8)', fontFamily:'var(--font-mono)', fontWeight:500, flex:1 },
  listeningPulse: { width:80, height:2, background:'linear-gradient(90deg, transparent, rgba(34,211,160,0.4), transparent)', borderRadius:1, animation:'shimmer 2s infinite', backgroundSize:'200% 100%' },
  body: { flex:1, overflowY:'auto', padding:'24px 20px', display:'flex', flexDirection:'column', gap:16 },
  segment: {
  padding:'14px 16px 14px 20px',
  background:'rgba(14,24,46,0.4)',
  border:'1px solid var(--border)',
  borderLeft:'2px solid',
  transition:'border-color 0.2s',
  borderRadius:'0 var(--radius) var(--radius) 0',
},
  segHeader: { display:'flex', alignItems:'center', gap:10, marginBottom:8 },
  speakerLabel: {
    fontSize:9, fontWeight:800, fontFamily:'var(--font-mono)',
    letterSpacing:'0.08em', padding:'2px 8px', borderRadius:6,
  },
  timestamp: { fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)' },
  segText: { fontSize:15, color:'var(--text-primary)', lineHeight:1.85, letterSpacing:'0.01em' },
  interim: {
    display:'flex', gap:10, alignItems:'baseline',
    padding:'10px 16px 10px 20px',
    background:'rgba(79,142,247,0.05)',
    borderRadius:'0 var(--radius) var(--radius) 0',
    border:'1px solid rgba(79,142,247,0.1)',
    borderLeft:'2px solid rgba(79,142,247,0.4)',
    opacity:0.75,
  },
  interimDots: { fontSize:16, color:'var(--accent)', fontFamily:'var(--font-mono)', lineHeight:1, animation:'pulse 1.5s infinite' },
  interimText: { fontSize:15, color:'var(--text-secondary)', fontStyle:'italic', lineHeight:1.8 },
  cursor: {
    display:'inline-block', width:2, height:18,
    background:'var(--accent)', borderRadius:2,
    animation:'blink 1s step-end infinite',
    verticalAlign:'middle',
    boxShadow:'0 0 8px var(--accent-glow)',
    marginLeft:4,
  },
  empty: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, padding:48, textAlign:'center' },
  emptyIcon: { fontSize:48, animation:'float 3s ease-in-out infinite' },
  emptyTitle: { fontWeight:700, fontSize:17, color:'var(--text-primary)', letterSpacing:'-0.02em' },
  emptySubtitle: { color:'var(--text-muted)', fontSize:14, maxWidth:300, lineHeight:1.7 },
  scrollBtn: {
    position:'absolute', bottom:16, right:16,
    background:'rgba(79,142,247,0.15)', backdropFilter:'blur(12px)',
    border:'1px solid rgba(79,142,247,0.3)',
    borderRadius:20, color:'var(--accent-light)',
    fontSize:11, fontFamily:'var(--font-mono)', fontWeight:600,
    padding:'6px 14px', cursor:'pointer',
    boxShadow:'0 4px 16px rgba(0,0,0,0.3)',
    transition:'all 0.2s',
  },
};



import { spawn }            from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir }           from 'os';
import { join }             from 'path';
import { randomBytes }      from 'crypto';

// ── Persistent Whisper server URL ─────────────────────────────────────────────
const WHISPER_SERVER = process.env.WHISPER_SERVER_URL || 'http://localhost:9000';

// ── Fallback: spawn transcribe.py (legacy path) ───────────────────────────────
const SCRIPT_PATH = new URL('../../transcribe.py', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1');                    // Fix Windows path: /C:/… → C:/…
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';

function mimeToExt(mimeType) {
  if (!mimeType)               return 'webm';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

async function spawnWhisper(audioPath, language) {
  return new Promise((resolve, reject) => {
    const args = [SCRIPT_PATH, audioPath];
    if (language && language !== 'auto') args.push(language);

    const proc = spawn(PYTHON, args, { timeout: 60_000 });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      if (code !== 0) { reject(new Error(`transcribe.py exited ${code}: ${stderr.slice(0, 300)}`)); return; }
      try {
        const r = JSON.parse(stdout.trim());
        if (r.error) reject(new Error(r.error));
        else resolve(r);
      } catch {
        reject(new Error(`Bad output from transcribe.py: ${stdout.slice(0, 200)}`));
      }
    });
    proc.on('error', reject);
  });
}

// ── Primary path: call persistent Whisper server ──────────────────────────────
async function callWhisperServer(audio, mimeType, language) {
  const res = await fetch(`${WHISPER_SERVER}/transcribe`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ audio, mimeType, language }),
    signal:  AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Whisper server returned ${res.status}`);
  }

  return res.json();
}

// ── Fallback path: write temp file + spawn Python ─────────────────────────────
async function callSpawnFallback(audio, mimeType, language, log) {
  const buf = Buffer.from(audio, 'base64');
  const ext     = mimeToExt(mimeType);
  const tmpFile = join(tmpdir(), `eduscript_${randomBytes(8).toString('hex')}.${ext}`);
  try {
    await writeFile(tmpFile, buf);
    return await spawnWhisper(tmpFile, language);
  } finally {
    unlink(tmpFile).catch(() => {});
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function whisperRoute(fastify) {
  fastify.post('/', async (req, reply) => {
    const { audio, mimeType, language } = req.body || {};

    if (!audio) {
      return reply.status(400).send({ error: 'Missing audio field (base64)' });
    }

    // Reject obviously empty blobs before touching Python at all
    const byteLen = Math.floor((audio.length * 3) / 4);
    if (byteLen < 500) {
      return reply.send({ text: '', language: language || 'en', duration: 0 });
    }

    // ── Try persistent server first ───────────────────────────────────────────
    try {
      const result = await callWhisperServer(audio, mimeType, language);
      return reply.send(result);
    } catch (primaryErr) {
      fastify.log.warn(
        { err: primaryErr.message },
        '[Whisper] Persistent server unavailable — falling back to spawn',
      );
    }

    // ── Fallback: spawn transcribe.py ─────────────────────────────────────────
    try {
      const result = await callSpawnFallback(audio, mimeType, language, fastify.log);
      return reply.send(result);
    } catch (err) {
      fastify.log.error({ err }, '[Whisper] Both primary and fallback failed');
      return reply.status(500).send({ error: err.message });
    }
  });
}

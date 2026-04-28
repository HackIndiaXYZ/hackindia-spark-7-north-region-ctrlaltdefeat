/**
 * llm.js — Ollama LLM service
 *
 * Replaces Gemini with a local Ollama instance.
 * Set OLLAMA_URL and LLM_MODEL in your .env file.
 *
 * Default: llama3.1:8b running at http://localhost:11434
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LLM_MODEL  = process.env.LLM_MODEL  || 'llama3.1:8b';

/**
 * generateLLM — sends a chat request to Ollama and returns the response text.
 *
 * @param {object} opts
 * @param {string}   opts.systemInstruction  - System prompt (sets AI behaviour)
 * @param {Array}    opts.contents           - Array of { role, parts: [{ text }] } (Gemini-style, auto-converted)
 * @param {number}   [opts.temperature=0.3]  - Sampling temperature (0 = deterministic, 1 = creative)
 * @param {number}   [opts.maxOutputTokens=1500] - Max tokens to generate
 * @returns {Promise<string>} The raw text response from the model
 */
export async function generateLLM({
  systemInstruction = '',
  contents = [],
  temperature = 0.3,
  maxOutputTokens = 1500,
}) {
  // Build the messages array that Ollama expects
  const messages = [];

  // Add system prompt if provided
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  // Convert Gemini-style contents ({ role, parts: [{ text }] })
  // to Ollama-style messages ({ role, content })
  for (const item of contents) {
    // Gemini uses 'model' for assistant turns; Ollama uses 'assistant'
    const role = item.role === 'model' ? 'assistant' : 'user';
    const text = item.parts?.map(p => p.text || '').join('\n') || '';
    if (text.trim()) {
      messages.push({ role, content: text });
    }
  }

  // Call the Ollama /api/chat endpoint
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      stream: false,           // We want the full response at once
      options: {
        temperature,
        num_predict: maxOutputTokens,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.message?.content || '';
}

/**
 * withRetry — wraps any async function and retries it on failure.
 *
 * Retries up to maxRetries times with increasing delay between attempts.
 * Useful for handling temporary Ollama unavailability.
 *
 * @param {Function} fn          - Async function to call
 * @param {number}   maxRetries  - How many times to retry (default: 3)
 * @returns {Promise<any>}
 */
export async function withRetry(fn, maxRetries = 3) {
  let lastErr;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = 800 * (attempt + 1); // 800ms, 1600ms, 2400ms
      console.warn(`[LLM] Retry ${attempt + 1}/${maxRetries} in ${delay}ms — ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastErr;
}

/**
 * safeParseJSON — safely parses JSON from an LLM response string.
 *
 * LLMs sometimes wrap JSON in markdown fences or add extra text.
 * This function strips that noise and attempts to extract valid JSON.
 * If the JSON is truncated (model hit token limit), it tries to repair it.
 *
 * @param {string} text - Raw LLM output
 * @returns {object|null} Parsed object, or null if parsing failed
 */
export function safeParseJSON(text) {
  if (!text || typeof text !== 'string') return null;

  // Step 1: Extract the JSON part (strip markdown fences / preamble)
  let jsonStr = extractJSONString(text);
  if (!jsonStr) {
    console.warn('[safeParseJSON] No JSON found in response:', text.slice(0, 100));
    return null;
  }

  // Step 2: Try parsing as-is (the happy path)
  try {
    return JSON.parse(jsonStr);
  } catch { /* fall through to repair */ }

  // Step 3: JSON might be truncated — attempt to repair and re-parse
  const repaired = repairTruncatedJSON(jsonStr);
  try {
    return JSON.parse(repaired);
  } catch {
    console.warn('[safeParseJSON] Could not parse even after repair. Raw:', text.slice(0, 200));
    return null;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Strips markdown fences and finds the JSON object/array in a string.
 */
function extractJSONString(text) {
  // Handle ```json ... ``` fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  // Find the first { (JSON object)
  const start = text.indexOf('{');
  if (start !== -1) return text.slice(start).trim();

  // Find the first [ (JSON array)
  const arrStart = text.indexOf('[');
  if (arrStart !== -1) return text.slice(arrStart).trim();

  return null;
}

/**
 * Closes an unclosed JSON string that was cut off mid-generation.
 * Handles: unclosed strings, unclosed arrays, unclosed objects.
 */
function repairTruncatedJSON(str) {
  // Remove trailing comma (common truncation artifact)
  let s = str.trimEnd().replace(/,\s*$/, '');

  // If the last thing is a key with no value (e.g. "key":), add null
  if (/:\s*$/.test(s)) s += 'null';

  // If we're inside an unclosed string, close it
  const lastDelim = Math.max(s.lastIndexOf(','), s.lastIndexOf('{'), s.lastIndexOf('['));
  const tail = s.slice(lastDelim + 1);
  const quoteCount = (tail.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) s += '"';

  // Count open braces/brackets and close them all
  const stack = [];
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && s[i - 1] !== '\\') inString = !inString;
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  return s + stack.reverse().join('');
}
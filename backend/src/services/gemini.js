// FILE: backend/src/services/gemini.js
import { GoogleGenerativeAI } from '@google/generative-ai';

let _client = null;

export function getGeminiClient() {
  if (!_client) {
    _client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _client;
}

export function getModel(tier = 'flash') {
  const client = getGeminiClient();
  const modelName = tier === 'pro'
    ? 'gemini-2.5-pro-latest'
    : 'gemini-3.0-flash-latest';
  return client.getGenerativeModel({ model: modelName });
}

export async function withRetry(fn, maxRetries = 3) {
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = err?.status ?? err?.code ?? 0;
      const msg  = err?.message ?? '';
      const isRetryable =
        code === 429 || code === 503 || code === 500 ||
        msg.includes('quota') || msg.includes('overloaded') || msg.includes('RESOURCE_EXHAUSTED');
      if (!isRetryable) throw err;
      const delay = Math.min(1200 * 2 ** attempt + Math.random() * 400, 10000);
      console.warn(`[Gemini] Retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * THE REAL FIX: Gemini truncates at maxOutputTokens mid-JSON.
 * We detect truncation and surgically close the JSON before parsing.
 */
export function safeParseJSON(text) {
  if (!text || typeof text !== 'string') return null;

  // Step 1: Extract the JSON substring (strip any markdown fences / preamble)
  let jsonStr = extractJSONString(text);
  if (!jsonStr) {
    console.warn('[safeParseJSON] No JSON-like content found in:', text.slice(0, 100));
    return null;
  }

  // Step 2: Try parsing as-is (happy path)
  try {
    return JSON.parse(jsonStr);
  } catch { /* truncated — continue */ }

  // Step 3: JSON is truncated — repair it
  const repaired = repairTruncatedJSON(jsonStr);
  if (repaired) {
    try {
      return JSON.parse(repaired);
    } catch (e) {
      console.warn('[safeParseJSON] Repair failed:', e.message, '| Attempted:', repaired.slice(-80));
    }
  }

  console.warn('[safeParseJSON] All strategies failed. Raw (first 200):', text.slice(0, 200));
  return null;
}

function extractJSONString(text) {
  // Strip ```json ... ``` fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  // Find outermost { } block
  const start = text.indexOf('{');
  if (start !== -1) {
    // Take from first { to end of string (truncated JSON won't have closing })
    return text.slice(start).trim();
  }

  // Find outermost [ ] block
  const arrStart = text.indexOf('[');
  if (arrStart !== -1) return text.slice(arrStart).trim();

  return null;
}

/**
 * Closes an unclosed JSON string by counting brackets/braces and appending closers.
 * Handles: unclosed strings, unclosed arrays, unclosed objects.
 */
function repairTruncatedJSON(str) {
  // Remove trailing comma before we close (common truncation artifact)
  let s = str.trimEnd().replace(/,\s*$/, '');

  // If last char is a colon or part of a key, the value is missing — add null
  if (/:\s*$/.test(s)) s += 'null';

  // If we're mid-string (odd number of unescaped quotes in the last "token"), close it
  // Simple heuristic: count quotes from the last { or ,
  const lastDelim = Math.max(s.lastIndexOf(','), s.lastIndexOf('{'), s.lastIndexOf('['));
  const tail = s.slice(lastDelim + 1);
  const quoteCount = (tail.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    s += '"'; // close the open string
  }

  // Now close all open brackets/braces
  const stack = [];
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && (i === 0 || s[i - 1] !== '\\')) inString = !inString;
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // Append closers in reverse order
  return s + stack.reverse().join('');
}

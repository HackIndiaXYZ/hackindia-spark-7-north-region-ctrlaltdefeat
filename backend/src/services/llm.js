const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LLM_MODEL  = process.env.LLM_MODEL  || 'llama3.1:8b';

export async function generateLLM({
  systemInstruction = '',
  contents = [],
  temperature = 0.3,
  maxOutputTokens = 1500,
}) {
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  for (const item of contents) {
    const role = item.role === 'model' ? 'assistant' : 'user';
    const text = item.parts?.map(p => p.text || '').join('\n') || '';
    if (text.trim()) {
      messages.push({ role, content: text });
    }
  }
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      stream: false,
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

export async function withRetry(fn, maxRetries = 3) {
  let lastErr;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = 800 * (attempt + 1);
      console.warn(`[LLM] Retry ${attempt + 1}/${maxRetries} in ${delay}ms — ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastErr;
}

export function safeParseJSON(text) {
  if (!text || typeof text !== 'string') return null;
  let jsonStr = extractJSONString(text);
  if (!jsonStr) {
    console.warn('[safeParseJSON] No JSON found in response:', text.slice(0, 100));
    return null;
  }
  try {
    return JSON.parse(jsonStr);
  } catch {  }
  const repaired = repairTruncatedJSON(jsonStr);
  try {
    return JSON.parse(repaired);
  } catch {
    console.warn('[safeParseJSON] Could not parse even after repair. Raw:', text.slice(0, 200));
    return null;
  }
}

function extractJSONString(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  if (start !== -1) return text.slice(start).trim();
  const arrStart = text.indexOf('[');
  if (arrStart !== -1) return text.slice(arrStart).trim();

  return null;
}

function repairTruncatedJSON(str) {
  let s = str.trimEnd().replace(/,\s*$/, '');
  if (/:\s*$/.test(s)) s += 'null';
  const lastDelim = Math.max(s.lastIndexOf(','), s.lastIndexOf('{'), s.lastIndexOf('['));
  const tail = s.slice(lastDelim + 1);
  const quoteCount = (tail.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) s += '"';
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
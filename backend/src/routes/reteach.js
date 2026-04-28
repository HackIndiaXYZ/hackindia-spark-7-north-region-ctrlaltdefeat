// FILE: backend/src/routes/reteach.js
import { generateLLM, withRetry, safeParseJSON } from '../services/llm.js';

const RETEACH_SYSTEM_PROMPT = `You are an expert tutor generating a JSON micro-lesson.

CRITICAL: Your response must be ONLY a valid JSON object. No markdown. No code fences. No preamble. No explanation. Start your response with { and end with }.

Required JSON shape:
{
  "topic": "string",
  "coreIdea": "string — one sentence, the single most important idea",
  "explanation": "string — 100-150 words, plain language, no jargon",
  "analogy": "string — relatable real-world comparison",
  "example": "string — concrete step-by-step example",
  "commonMistakes": ["string", "string", "string"],
  "checkQuestion": {
    "question": "string",
    "options": ["A. option text", "B. option text", "C. option text", "D. option text"],
    "correctIndex": 0,
    "explanation": "string — why this answer is correct"
  },
  "keyTerms": [
    { "term": "string", "meaning": "string" }
  ]
}

Rules:
- commonMistakes: exactly 2-3 items
- checkQuestion.correctIndex: integer 0-3
- keyTerms: 2-4 items
- All fields are required — do not omit any`;

export async function reteachRoute(app) {
  app.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['topic'],
        properties: {
          topic:         { type: 'string', minLength: 1, maxLength: 500 },
          lectureContext: { type: 'string', maxLength: 15000 },
          studentLevel: {
            type: 'string',
            enum: ['beginner', 'intermediate', 'advanced'],
            default: 'intermediate',
          },
        },
      },
    },
  }, async (req, reply) => {
    const { topic, lectureContext = '', studentLevel = 'intermediate' } = req.body;

    const cleanTopic = topic?.trim();
    if (!cleanTopic) {
      return reply.status(400).send({ error: 'topic is required and cannot be empty' });
    }

    const userPrompt = [
      `Topic to re-teach: "${cleanTopic}"`,
      `Student level: ${studentLevel}`,
      lectureContext
        ? `\nLecture context for reference:\n${lectureContext.slice(0, 8000)}`
        : '',
    ].join('\n');

    let raw = '';

    try {
      raw = await withRetry(() =>
        generateLLM({
          systemInstruction: RETEACH_SYSTEM_PROMPT,
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }],
            },
          ],
          temperature: 0.4,
          maxOutputTokens: 3000,
        })
      );
    } catch (err) {
      req.log.error({ err }, 'LLM call failed for reteach');
      return reply.status(502).send({
        error: 'LLM API error: ' + (err.message || 'unknown'),
      });
    }

    const lesson = safeParseJSON(raw);

    if (!lesson) {
      req.log.error({ raw: raw.slice(0, 300) }, 'Reteach: JSON parse failed');
      return reply.status(422).send({
        error: 'AI returned invalid JSON. Please try again.',
        debug: process.env.NODE_ENV !== 'production' ? raw.slice(0, 200) : undefined,
      });
    }

    // Fill in optional fields if missing (graceful degradation)
    if (!lesson.commonMistakes) lesson.commonMistakes = [];
    if (!lesson.keyTerms)       lesson.keyTerms = [];
    if (!lesson.analogy)        lesson.analogy = '';
    if (!lesson.example)        lesson.example = '';

    // These fields are required — reject if missing
    const requiredFields = ['topic', 'coreIdea', 'explanation', 'checkQuestion'];
    const missingRequired = requiredFields.filter(k => !lesson[k]);
    if (missingRequired.length > 0) {
      return reply.status(422).send({
        error: `Incomplete lesson generated. Missing: ${missingRequired.join(', ')}`,
      });
    }

    lesson.topic = lesson.topic || cleanTopic;

    return reply.send({ ok: true, lesson, generatedAt: Date.now() });
  });
}
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { transcriptionWsHandler } from './routes/transcription.js';
import { notesRoute }    from './routes/notes.js';
import { quizRoute }     from './routes/quiz.js';
import { chatRoute }     from './routes/chat.js';
import { reteachRoute }  from './routes/reteach.js';
import { whisperRoute }  from './routes/whisper.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});
await app.register(cors, {
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:4173'],
  methods: ['GET', 'POST', 'OPTIONS'],
});

await app.register(websocket);
app.get('/health', async () => ({ status: 'ok', ts: Date.now() }));
app.register(async (instance) => {
  instance.get('/ws/transcribe', { websocket: true }, transcriptionWsHandler);
});
app.register(notesRoute,    { prefix: '/api/notes'             });
app.register(quizRoute,     { prefix: '/api/quiz'              });
app.register(chatRoute,     { prefix: '/api/chat'              });
app.register(reteachRoute,  { prefix: '/api/reteach'           });
app.register(whisperRoute,  { prefix: '/api/transcribe-chunk'  });
app.setErrorHandler((error, _req, reply) => {
  app.log.error(error);
  const statusCode = error.statusCode || 500;
  reply.status(statusCode).send({
    error: statusCode === 500 ? 'Internal server error' : error.message,
  });
});
try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\n🚀 EduScript API running on http://localhost:${PORT}`);
  console.log(`🤖 Using Ollama model: ${process.env.LLM_MODEL || 'llama3.1:8b'}`);
  console.log(`🔗 Ollama URL: ${process.env.OLLAMA_URL || 'http://localhost:11434'}\n`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
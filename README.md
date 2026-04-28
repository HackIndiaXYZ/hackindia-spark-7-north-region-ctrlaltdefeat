# EduScript AI

An AI-powered lecture assistant that transcribes audio in real-time, generates smart notes, quizzes, chat answers, and reteach explanations — all running locally with Ollama. No API keys. No cloud dependency.

---

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express + WebSocket
- **AI:** Ollama (local LLM)
- **Speech:** Web Speech API + Whisper (optional)

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Ollama](https://ollama.com/download) installed and running

---

## Step 1 — Install Ollama

**macOS / Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download and install from https://ollama.com/download

---

## Step 2 — Pull the model

```bash
ollama serve

ollama pull llama3.1:8b
```

> Want a smaller/faster model? Use `llama3.2:3b` — change `LLM_MODEL` in `.env`.
> Want a smarter model? Use `llama3.1:70b` (requires a powerful GPU).

---

## Step 3 — Backend setup

```bash
cd eduscript/backend
npm install
npm run dev
```

Backend runs at: **http://localhost:3001**

---

## Step 4 — Frontend setup

```bash
cd eduscript/frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## Environment Variables

Create `eduscript/backend/.env`:

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
OLLAMA_URL=http://localhost:11434
LLM_MODEL=llama3.1:8b
```

---

## Project Structure

```
eduscript/
├── backend/
│   ├── .env
│   ├── package.json
│   ├── transcribe.py
│   ├── whisper_server.py
│   └── src/
│       ├── index.js
│       ├── services/
│       │   └── llm.js
│       └── routes/
│           ├── chat.js
│           ├── notes.js
│           ├── quiz.js
│           ├── reteach.js
│           ├── transcription.js
│           └── whisper.js
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css
        ├── hooks/
        │   └── useTranscription.js
        ├── services/
        │   ├── api.js
        │   └── db.js
        ├── store/
        │   └── index.js
        ├── utils/
        │   └── export.js
        └── components/
            ├── chat/ChatPanel.jsx
            ├── dashboard/
            │   ├── DebugBar.jsx
            │   └── TokenBudget.jsx
            ├── notes/NotesPanel.jsx
            ├── quiz/QuizPanel.jsx
            ├── reteach/ReteachPanel.jsx
            └── transcription/TranscriptPanel.jsx
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Connection refused` on port 11434 | Run `ollama serve` first |
| `model not found` error | Run `ollama pull llama3.1:8b` |
| Slow responses | Normal for CPU — use `llama3.2:3b` for speed |
| Empty or broken JSON from AI | Switch to a smarter model via `LLM_MODEL` in `.env` |
| CORS errors | Ensure `FRONTEND_URL` in `.env` matches your Vite port |

---

## No API Key Required

Ollama runs 100% locally. No internet needed after model download. No costs. No rate limits.
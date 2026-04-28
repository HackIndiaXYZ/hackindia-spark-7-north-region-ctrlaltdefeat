# EduScript — Ollama Setup Guide

Gemini has been completely removed. The backend now uses a local Ollama LLM.

---

## Step 1 — Install Ollama

**macOS / Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**  
Download the installer from https://ollama.com/download

---

## Step 2 — Start Ollama and pull the model

Open a terminal and run:

```bash
# Start the Ollama server (leave this running in the background)
ollama serve

# In a new terminal, download the model (one-time, ~4.7 GB)
ollama pull llama3.1:8b
```

> **Want a smaller model?** Use `llama3.2:3b` (2 GB) — just change `LLM_MODEL` in `.env`.  
> **Want a better model?** Use `llama3.1:70b` if you have a powerful GPU.

---

## Step 3 — Set up the backend

```bash
cd eduscript/backend

# Install dependencies (no Gemini — much lighter now!)
npm install

# Copy the env file
cp .env.example .env   # or create .env manually (contents below)

# Start the backend in dev mode
npm run dev
```

The backend will start at: **http://localhost:3001**

---

## Step 4 — Start the frontend

```bash
cd eduscript/frontend
npm install
npm run dev
```

The frontend will start at: **http://localhost:5173**

---

## .env file contents

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
OLLAMA_URL=http://localhost:11434
LLM_MODEL=llama3.1:8b
```

---

## File structure of changes

```
eduscript/backend/
├── .env                          ← NEW  (no API keys needed)
├── package.json                  ← UPDATED (removed @google/generative-ai)
└── src/
    ├── index.js                  ← UPDATED (removed Gemini imports)
    ├── services/
    │   ├── llm.js                ← NEW (Ollama client)
    │   └── gemini.js             ← DELETE this file (no longer used)
    └── routes/
        ├── notes.js              ← UPDATED (uses generateLLM)
        ├── quiz.js               ← UPDATED (uses generateLLM)
        ├── chat.js               ← UPDATED (uses generateLLM)
        ├── reteach.js            ← UPDATED (uses generateLLM)
        ├── transcription.js      ← UNCHANGED (WebSocket, no LLM)
        └── transcribeChunk.js    ← DELETE this file (Gemini-only, unused)
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `Connection refused` on port 11434 | Run `ollama serve` first |
| `model not found` error | Run `ollama pull llama3.1:8b` |
| Slow responses | Normal for CPU — llama3.2:3b is faster |
| Empty JSON from AI | Increase `LLM_MODEL` to a smarter model |
| CORS errors | Check `FRONTEND_URL` in `.env` matches your Vite port |

---

## No API key required

Ollama runs 100% locally on your machine. No internet connection needed after the model is downloaded. No costs. No rate limits.
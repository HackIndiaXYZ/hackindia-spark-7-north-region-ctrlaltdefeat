import argparse
import asyncio
import base64
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor

import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
_model      = None
_model_name = "base"
_executor   = ThreadPoolExecutor(max_workers=4)
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model, _model_name
    _model_name = app.state.model_size
    device      = app.state.device

    try:
        from faster_whisper import WhisperModel
        compute = "int8" if device == "cpu" else "float16"
        print(f"[Whisper] Loading '{_model_name}' on {device} ({compute})…", flush=True)
        _model = WhisperModel(_model_name, device=device, compute_type=compute)
        print("[Whisper] ✓ Model ready — server accepting requests", flush=True)
    except ImportError:
        print("[Whisper] ✗ faster-whisper not installed. Run: pip install faster-whisper", flush=True)

    yield
    _executor.shutdown(wait=False)
app = FastAPI(title="EduScript Whisper Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
class TranscribeRequest(BaseModel):
    audio:    str
    mimeType: str = "audio/webm"
    language: str | None = None

class TranscribeResponse(BaseModel):
    text:     str
    language: str
    duration: float
def _run_inference(audio_path: str, language: str | None) -> dict:

    segments, info = _model.transcribe(
        audio_path,
        language=language,
        beam_size=3,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 300},
    )
    parts = [s.text.strip() for s in segments if s.text.strip()]
    return {
        "text":     " ".join(parts),
        "language": info.language,
        "duration": round(info.duration, 2),
    }

def _mime_to_ext(mime: str) -> str:
    if "mp4" in mime: return "mp4"
    if "ogg" in mime: return "ogg"
    if "wav" in mime: return "wav"
    return "webm"
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model":  _model_name,
        "ready":  _model is not None,
    }

@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(req: TranscribeRequest):
    if _model is None:
        raise HTTPException(503, "Model not loaded — check server logs")
    try:
        buf = base64.b64decode(req.audio)
    except Exception:
        raise HTTPException(400, "Invalid base64 audio data")
    if len(buf) < 500:
        return TranscribeResponse(
            text="",
            language=req.language or "en",
            duration=0.0,
        )

    ext      = _mime_to_ext(req.mimeType)
    tmp_path = None

    try:
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as f:
            f.write(buf)
            tmp_path = f.name

        lang   = req.language if req.language and req.language != "auto" else None
        loop   = asyncio.get_event_loop()
        result = await loop.run_in_executor(_executor, _run_inference, tmp_path, lang)

        return TranscribeResponse(**result)

    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {e}")

    finally:
        if tmp_path:
            try: os.unlink(tmp_path)
            except: pass
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="EduScript Whisper Server")
    parser.add_argument("--port",   type=int, default=9000,  help="Port to listen on")
    parser.add_argument("--model",  default="base",          help="Whisper model size (tiny/base/small/medium)")
    parser.add_argument("--device", default="cpu",           help="Device: cpu or cuda")
    args = parser.parse_args()

    app.state.model_size = args.model
    app.state.device     = args.device

    print(f"[Whisper Server] Starting on http://localhost:{args.port}")
    print(f"[Whisper Server] Model: {args.model} | Device: {args.device}")
    uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="warning")
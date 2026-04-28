

import sys
import json
import os
import tempfile

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: transcribe.py <audio_file> [lang]"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    language   = sys.argv[2] if len(sys.argv) > 2 else None  # None = auto-detect

    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"File not found: {audio_path}"}))
        sys.exit(1)

    try:
        from faster_whisper import WhisperModel

        # Load model — downloaded once then cached in ~/.cache/huggingface
        # device="cpu" works on all machines; use "cuda" if you have a GPU
        model = WhisperModel("base", device="cpu", compute_type="int8")

        segments, info = model.transcribe(
            audio_path,
            language=language,
            beam_size=3,
            vad_filter=True,           # skip silent parts automatically
            vad_parameters={
                "min_silence_duration_ms": 500,
            },
        )

        text_parts = []
        for segment in segments:
            t = segment.text.strip()
            if t:
                text_parts.append(t)

        result = {
            "text":     " ".join(text_parts),
            "language": info.language,
            "duration": round(info.duration, 2),
        }
        print(json.dumps(result))

    except ImportError:
        print(json.dumps({
            "error": "faster-whisper not installed. Run: pip install faster-whisper"
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()

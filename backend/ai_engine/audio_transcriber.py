"""
Audio Transcriber — LOCAL implementation
----------------------------------------
Transcribes short audio answers from the candidate interview using the
`faster-whisper` Python library. This runs ENTIRELY on our own server.
No audio is ever sent to an external AI API.

Why `faster-whisper`?
- Pure Python package. Installs with `pip install faster-whisper`.
- Runs the Whisper model locally (CPU-friendly, int8 quantized).
- Supports WebM/Opus from Chrome & Firefox and MP4/AAC from Safari out of
  the box (decoding via system ffmpeg).
- Quality dramatically better than older offline options (Vosk, PocketSphinx)
  on technical vocabulary like "React", "Kubernetes", "Postgres".

Model size vs. resources (droplet is 1 vCPU / 2 GB RAM):
  tiny    —  75 MB  — ~4x realtime  — ~85% accuracy  — safe on any droplet
  base    — 145 MB  — ~2x realtime  — ~92% accuracy  — default, comfortable fit
  small   — 488 MB  — ~1x realtime  — ~95% accuracy  — tight on 2 GB droplet
Set WHISPER_MODEL_SIZE=tiny|base|small via env to override.

Bias via `initial_prompt`:
Technical jargon (React, Kubernetes, Postgres) is the main failure mode
of any STT system. We pass the job's required skills + the candidate's
own claimed skills as an `initial_prompt`, which pushes the model
toward the correct tokens when those words occur.

Audio handling:
The uploaded blob is written to a temp file for ffmpeg decoding, then
the temp file is deleted in a `finally` block. Audio lives on disk for
~0.5–2 seconds during transcription. Nothing is persisted.
"""

from __future__ import annotations

import logging
import os
import tempfile
import threading
from dataclasses import dataclass
from typing import Iterable

logger = logging.getLogger(__name__)

# --- Configuration ---------------------------------------------------------
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
# "int8" keeps RAM low on CPU. "int8_float16" is faster on GPU.
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")  # "cpu" | "cuda"
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "en")
# Optional: pre-download location for the model cache (persists across restarts)
WHISPER_MODEL_DIR = os.getenv("WHISPER_MODEL_DIR", None)

MAX_BYTES = 25 * 1024 * 1024   # 25 MB hard cap on upload size
MAX_DURATION_S = 180           # 3 minutes per answer clip
MIN_DURATION_S = 0.5           # ignore accidental clicks

# Common technical terms used as a fallback prompt bias when job/resume
# skills don't cover them — these are Whisper's biggest mis-hears.
COMMON_TECH_TERMS = (
    "React, Next.js, TypeScript, JavaScript, Python, Django, FastAPI, "
    "Kubernetes, Docker, Postgres, PostgreSQL, MongoDB, Redis, Kafka, "
    "AWS, GCP, Azure, CI/CD, REST, GraphQL, JWT, OAuth, Webpack, Vite, "
    "Tailwind, Node.js, Express, Go, Rust, SQL, NoSQL, DevOps, MLOps"
)


class TranscriptionError(Exception):
    """Raised when transcription fails for any reason."""


@dataclass
class TranscriptionResult:
    text: str
    duration_ms: int
    language: str
    model: str


# --- Lazy model loader -----------------------------------------------------
# The Whisper model is ~150 MB on disk and takes 2-5 s to load into memory.
# We load it once per worker process, the first time someone actually records
# an answer. A thread lock makes the initial load safe if two answers land
# at the same instant.
_model = None
_model_lock = threading.Lock()


def get_model():
    """Return a singleton faster-whisper WhisperModel, loading on first use."""
    global _model
    if _model is not None:
        return _model
    with _model_lock:
        if _model is not None:
            return _model
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:  # pragma: no cover
            raise TranscriptionError("faster_whisper_not_installed") from exc
        logger.info(
            "Loading faster-whisper model=%s device=%s compute_type=%s",
            WHISPER_MODEL_SIZE, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE,
        )
        _model = WhisperModel(
            WHISPER_MODEL_SIZE,
            device=WHISPER_DEVICE,
            compute_type=WHISPER_COMPUTE_TYPE,
            download_root=WHISPER_MODEL_DIR,
        )
        return _model


def build_prompt_bias(
    job_skills: Iterable[str] | None = None,
    resume_skills: Iterable[str] | None = None,
    extra_terms: str | None = None,
) -> str:
    """Build a Whisper initial_prompt biased toward the technical vocabulary
    the candidate is likely to actually say. Whisper treats `initial_prompt`
    as preceding context, so listing domain terms there nudges token
    probabilities in their favour."""
    parts: list[str] = []
    job_list = ", ".join([s for s in (job_skills or []) if s])
    resume_list = ", ".join([s for s in (resume_skills or []) if s])
    if job_list:
        parts.append(f"Role technologies: {job_list}.")
    if resume_list:
        parts.append(f"Candidate background: {resume_list}.")
    if extra_terms:
        parts.append(extra_terms)
    parts.append(f"Commonly mentioned: {COMMON_TECH_TERMS}.")
    prompt = " ".join(parts)
    # initial_prompt is clipped to ~224 tokens by Whisper anyway; keep it tidy
    if len(prompt) > 900:
        prompt = prompt[:900]
    return prompt


def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "answer.webm",
    job_skills: Iterable[str] | None = None,
    resume_skills: Iterable[str] | None = None,
) -> TranscriptionResult:
    """
    Transcribe a browser-uploaded audio blob to text, entirely on this server.

    Raises TranscriptionError on any failure. Caller is responsible for
    ensuring the audio bytes are discarded after this call returns.
    """
    if not audio_bytes:
        raise TranscriptionError("empty_audio")
    if len(audio_bytes) > MAX_BYTES:
        raise TranscriptionError("audio_too_large")

    # Preserve the extension we were given so ffmpeg (underneath faster-whisper)
    # picks the right decoder. Browsers send .webm (Opus) or .mp4 (AAC).
    _, ext = os.path.splitext(filename or "")
    if not ext or len(ext) > 6:
        ext = ".webm"

    tmp_path: str | None = None
    try:
        # Write the blob to a temp file; delete=False so we control removal
        # in the finally block, which survives any Whisper exception.
        with tempfile.NamedTemporaryFile(
            prefix="aihr_answer_", suffix=ext, delete=False
        ) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        model = get_model()
        prompt = build_prompt_bias(job_skills, resume_skills)

        try:
            segments, info = model.transcribe(
                tmp_path,
                language=WHISPER_LANGUAGE,
                initial_prompt=prompt,
                beam_size=1,            # greedy — twice as fast, marginal quality loss
                vad_filter=True,        # skip leading/trailing silence
                vad_parameters={"min_silence_duration_ms": 500},
                condition_on_previous_text=False,
            )
            # faster-whisper returns a generator — materialising it is what
            # actually runs the inference. Do it inside the try so any
            # decoding error propagates.
            collected = [seg.text for seg in segments]
        except Exception as exc:  # noqa: BLE001
            logger.warning("Whisper inference failed: %s", exc)
            raise TranscriptionError("whisper_inference_error") from exc

        duration_s = float(getattr(info, "duration", 0.0) or 0.0)
        if duration_s and duration_s < MIN_DURATION_S:
            raise TranscriptionError("audio_too_short")
        if duration_s > MAX_DURATION_S:
            raise TranscriptionError("audio_too_long")

        text = " ".join(s.strip() for s in collected).strip()
        if not text:
            raise TranscriptionError("empty_transcription")

        return TranscriptionResult(
            text=text,
            duration_ms=int(duration_s * 1000),
            language=getattr(info, "language", WHISPER_LANGUAGE) or WHISPER_LANGUAGE,
            model=f"faster-whisper/{WHISPER_MODEL_SIZE}",
        )
    finally:
        # Always remove the temp file, even on error. Audio leaves no trace.
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                logger.warning("Failed to unlink temp audio file %s", tmp_path)

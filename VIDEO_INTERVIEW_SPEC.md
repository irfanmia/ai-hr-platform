# Video Interview Mode — Implementation Spec

> Status: **Built, committed locally, awaiting GitHub PAT to push**
> Branch: `feature/video-interview-mode` (in `/tmp/ai-hr-platform`)
> Date: 2026-04-24

This is the first Phase 2 feature. Candidates can answer interview questions on-camera; we record audio only, transcribe it locally on the server with `faster-whisper`, and feed the resulting text to the existing scoring engine. Camera video is never stored or uploaded.

---

## What changed

### Backend

- **`Job` model gets a `response_type` field** with four choices:
  - `text` — classic textarea (default; existing jobs unaffected)
  - `video` — camera on, audio recorded & transcribed; no text fallback
  - `video_preferred` — defaults to video, candidate may switch to text
  - `candidate_choice` — candidate picks once, before question 1

- **New migration:** `backend/jobs/migrations/0002_job_response_type.py`
  - Adds the `response_type` column with default `"text"`. Existing rows pick up the default automatically — zero data migration.
  - **Deploy note:** if production already has a locally-generated `0002_*` for the scoring-weight fields (which exist on the model but have no migration in git), rename our file to `0003_*` and update its `dependencies` line before running `migrate`.

- **New AI-engine module:** `backend/ai_engine/audio_transcriber.py`
  - Uses [`faster-whisper`](https://github.com/SYSTRAN/faster-whisper) — a pure Python Whisper inference library. Runs entirely on your own droplet. **No external AI API calls.**
  - Model size configurable via `WHISPER_MODEL_SIZE` env (default `base`, ~145 MB on disk, ~500 MB RAM, ~2× realtime on 1 vCPU). Use `tiny` if the droplet feels tight, `small` if you want higher accuracy and have headroom.
  - Audio is written to a temp file (so ffmpeg can decode WebM/MP4/Ogg), Whisper inference runs, the temp file is **always deleted in a `finally` block** — even on error.
  - Whisper is biased via `initial_prompt` containing the **job's required skills + the candidate's resume skills + a list of common technical terms** (React, Kubernetes, Postgres, etc.). This dramatically improves accuracy on jargon — Whisper without bias often hears "Kubernetes" as "communities".
  - Hard limits enforced: 25 MB max upload, 0.5 s minimum, 180 s (3 min) maximum per answer.

- **New endpoint:** `POST /api/applications/<id>/transcribe/`
  - Multipart body with `file=<audio Blob>`, optional `question_index`.
  - Returns `{ text, duration_ms, language, model }`.
  - `permissions = AllowAny` (matches the existing in-flight application pattern for `submit-answers` / `generate-questions`).
  - Returns `400` for user-input errors (empty, too short, too long, garbled), `503` for infra errors (model not installed, inference failure).

- **`requirements.txt` adds:** `faster-whisper>=1.0.3`. Server also needs `apt install ffmpeg` for audio decoding.

### Frontend

- **`lib/types.ts`** — added `ResponseType`, `AnswerMode`, `ResumeMatchResult`. Extended `Job` and `GenerateQuestionsResponse` with the new optional fields. Backfilled type holes that pre-existed in the codebase.

- **`lib/api.ts`** — added `transcribeAnswer(applicationId, audioBlob, filename, questionIndex)` returning `TranscriptionResponse`. Multipart form upload with proper error envelope.

- **New component:** `components/video-interview.tsx`. Three exports:
  - `useInterviewCamera()` — hook owning the `getUserMedia` lifecycle. Stream lives across all questions so the candidate is prompted exactly once.
  - `<CameraBubble />` — sticky bottom-right self-view with a mirrored `<video>` and a pulsing REC badge while recording.
  - `<VoiceAnswerPanel />` — per-question record / stop / transcribe / re-record UI. Builds a `MediaRecorder` over the audio track only (never video). Picks the best supported MIME (`audio/webm;codecs=opus` for Chrome/Firefox, `audio/mp4` for Safari).
  - `<InterviewPreflight />` — consent + permission screen shown before question 1 on video-capable jobs. Explains what happens, requests camera, lets candidate confirm or fall back to text where allowed.

- **`app/apply/[id]/page.tsx`** — interview step 4 now branches:
  - Job is `text` → straight to existing text UI (zero behaviour change for old jobs).
  - Job is `video`/`video_preferred`/`candidate_choice` → show preflight first, then render `VoiceAnswerPanel` for `descriptive`/`coding`/`scenario` questions and keep MCQ/one_word as before (you can't speak a multiple-choice answer).
  - `CameraBubble` is mounted whenever `step===4 && answerMode==="video"`.

- **HR job forms** — both `dashboard/jobs/new` and `dashboard/jobs/[id]/edit` get a new "Interview Response Mode" card with the four options as styled radio cards. Edit page hydrates from the API.

- **Pre-existing TypeScript errors fixed** as drive-by cleanup: `resume_match` now typed on `GenerateQuestionsResponse`, `message`/`error` envelope typed, `next.config.ts` `eslint` key annotated. `tsc --noEmit` is now clean.

---

## Privacy / data flow

| Stage | Where | Lifetime |
|---|---|---|
| Camera + microphone capture | Candidate's browser | Stays in browser. We render the video to a `<video>` element; we never call `MediaRecorder` over the video track. |
| Audio recording | Candidate's browser, in memory `Blob` | Until candidate hits "Stop", then immediately uploaded |
| Audio upload | Multipart POST to `/transcribe/` | Lives in Django request memory; written to a `tempfile.NamedTemporaryFile` for ffmpeg decode |
| Transcription | `faster-whisper` running on your droplet | ~1–10 seconds depending on model & answer length |
| Audio cleanup | `os.unlink()` in `finally` block | Always within seconds of upload, regardless of success/failure |
| Transcript text | `Application.custom_answers` (existing field) | Persists with the application. **This is the only thing the AI scoring engine ever sees.** |

Net: video is never uploaded. Audio is never persisted. Only transcribed text is kept.

---

## Decisions captured (per your earlier picks)

- **Audio retention:** delete immediately after transcription. ✅
- **Transcript editing:** no edits — but candidate can re-record if Whisper mis-hears. ✅
- **Candidate choice:** picks once upfront on `candidate_choice` jobs; choice is locked for the whole interview. ✅
- **Four modes:** `text` / `video` / `video_preferred` / `candidate_choice` — the fourth provides accessibility/low-bandwidth fallback without losing HR's preference signal. ✅
- **Transcription engine:** `faster-whisper` running locally on your droplet, no external AI API. ✅

---

## Tested locally

- `python3 -m py_compile` — all backend files clean.
- `npx tsc --noEmit` — zero errors.
- `npm run build` — production build succeeds, 11 routes generated, all dynamic and static pages intact.

What I have NOT tested (because the sandbox can't run a browser or hit the droplet):
- The actual Whisper inference latency on the droplet — you'll see the real cold-start when the first answer is recorded after deploy.
- The exact ffmpeg-via-PyAV decoding path for Safari MP4 — I picked `audio/mp4` for Safari but only Chrome/Firefox were syntax-checked.
- Camera permission flow on iOS Safari — typically the permission is granted at the first `getUserMedia` call but iOS sometimes prompts per-session.

---

## Deploy steps (when you're ready)

### 1. Frontend (Vercel auto-deploy on push to `main`)
- Push the branch, merge PR to `main`. Vercel picks it up. Nothing else needed.

### 2. Backend (DO droplet — needs SSH key when you're ready)
```bash
ssh root@<droplet-ip>
cd /var/www/ai-hr-platform
git pull origin main

# system prerequisite
apt update && apt install -y ffmpeg

source backend/venv/bin/activate
pip install -r backend/requirements.txt    # installs faster-whisper

# Migration: check existing migrations FIRST
cd backend
python manage.py showmigrations jobs
# If 0002_* already exists for scoring weights:
#   mv jobs/migrations/0002_job_response_type.py jobs/migrations/0003_job_response_type.py
#   sed -i 's|("jobs", "0001_initial")|("jobs", "0002_<existing-migration-name>")|' jobs/migrations/0003_job_response_type.py
python manage.py migrate

# Pre-warm the Whisper model (optional — happens on first request anyway)
python -c "from ai_engine.audio_transcriber import get_model; get_model()"

systemctl restart aihr
```

### 3. Optional env vars (none required — sensible defaults)
```env
WHISPER_MODEL_SIZE=base       # tiny | base | small
WHISPER_DEVICE=cpu            # cpu | cuda (only if you add a GPU)
WHISPER_COMPUTE_TYPE=int8     # int8 (CPU) | int8_float16 (GPU)
WHISPER_LANGUAGE=en
```

---

## Cleanup item for you

The `.trash_*` folders in your workspace folder are leftover lock files from the initial git-clone permission issue. The Linux sandbox can't delete files in your mounted folder, so they persist. Safe to delete from Finder whenever:
```
.trash_<timestamp>_.git/
.trash_<timestamp>_.git_corrupted_2/
.trash_<timestamp>_.test_write
.trash_<timestamp>_test_shell_write.txt
```
Nothing in those folders matters — they're empty git scaffolding plus two of my probe-files.

---

## What's next once you push the PAT

1. I push `feature/video-interview-mode` to GitHub
2. Open a PR against `main` so you can review the diff in GitHub's UI
3. You merge → Vercel auto-deploys frontend
4. We deploy backend (you SSH yourself or grant the deploy key)
5. Live test on the staging URL, fix anything weird
6. Move to the next Phase 2 milestone

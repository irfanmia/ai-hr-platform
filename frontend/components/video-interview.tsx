"use client";

/**
 * Video Interview — camera-on, audio-only recording, server-side transcription.
 * ---------------------------------------------------------------------------
 * Exposes three pieces:
 *   - useInterviewCamera():  lifecycle hook for the camera+mic MediaStream
 *   - <CameraBubble/>:        sticky self-preview bubble (bottom-right)
 *   - <VoiceAnswerPanel/>:    record / transcribe / confirm UI per question
 *
 * Design notes:
 *  - We request BOTH video and audio via getUserMedia because we want the
 *    candidate to see themselves on camera (interview feel). But we only
 *    put the *audio track* into the MediaRecorder — the video stream is
 *    rendered locally and otherwise discarded. Nothing video-related is
 *    ever uploaded.
 *  - The stream is owned by the apply page (via useInterviewCamera) and
 *    reused across all questions, so the candidate is prompted for
 *    permission exactly once.
 *  - No transcript editing. Candidate can re-record if Whisper mis-hears.
 *  - Safari only supports audio/mp4 for MediaRecorder; Chrome/Firefox
 *    prefer audio/webm;codecs=opus. We pick the best supported.
 */

import { Loader2, Mic, RefreshCw, Video, VideoOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { transcribeAnswer } from "@/lib/api";

// ─── Hook ────────────────────────────────────────────────────────────────

export interface CameraState {
  stream: MediaStream | null;
  error: string | null;
  status: "idle" | "requesting" | "ready" | "denied" | "unsupported";
  request: () => Promise<void>;
  stop: () => void;
}

/** Lifecycle hook for the interview camera+mic. Caller calls `request()`
 * explicitly after the candidate consents (never on mount — browsers treat
 * unprompted getUserMedia as hostile). */
export function useInterviewCamera(): CameraState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CameraState["status"]>("idle");
  const streamRef = useRef<MediaStream | null>(null);

  const request = useCallback(async () => {
    if (streamRef.current) return; // already granted
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setError("Your browser does not support camera recording. Please use Chrome, Firefox, or Safari.");
      return;
    }
    setStatus("requesting");
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 480 },
          height: { ideal: 360 },
          facingMode: "user",
        },
      });
      streamRef.current = s;
      setStream(s);
      setStatus("ready");
    } catch (err) {
      const name = (err as { name?: string })?.name ?? "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setStatus("denied");
        setError("Camera and microphone access was blocked. Allow access in your browser settings to continue.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setStatus("unsupported");
        setError("No camera or microphone found. Connect one and reload the page.");
      } else {
        setStatus("denied");
        setError("Could not access camera or microphone. " + ((err as Error)?.message ?? ""));
      }
    }
  }, []);

  const stop = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    setStream(null);
    setStatus("idle");
  }, []);

  // Stop on unmount — candidate shouldn't have camera on after leaving step 4
  useEffect(() => () => stop(), [stop]);

  return { stream, error, status, request, stop };
}

// ─── Self-view bubble ─────────────────────────────────────────────────────

/** Sticky bottom-right self-preview. Mirrored (like Zoom). Shows a REC
 * pulse when `recording` is true. */
export function CameraBubble({
  stream,
  recording,
}: {
  stream: MediaStream | null;
  recording?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-44 overflow-hidden rounded-2xl border border-white/30 bg-slate-900 shadow-2xl shadow-slate-900/50 sm:w-56"
      aria-label="Self-view — your camera preview"
    >
      <video
        ref={videoRef}
        className="block aspect-[4/3] w-full object-cover"
        style={{ transform: "scaleX(-1)" }}
        autoPlay
        muted
        playsInline
      />
      {recording ? (
        <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative h-2 w-2 rounded-full bg-white" />
          </span>
          Rec
        </span>
      ) : (
        <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
          You
        </span>
      )}
    </div>
  );
}

// ─── Voice answer panel ───────────────────────────────────────────────────

export interface VoiceAnswerPanelProps {
  applicationId: number;
  questionIndex: number;
  /** Passing the questionId lets us reset panel state when the candidate
   * moves to the next question. */
  questionId: string;
  stream: MediaStream | null;
  /** Called with the accepted transcript when candidate clicks "Use this answer". */
  onTranscribed: (text: string) => void;
  /** Optional: if job mode is `video_preferred`, render a "Switch to text" button. */
  onSwitchToText?: () => void;
  /** The transcript currently stored for this question (so if the candidate
   * navigates back we show it). */
  existingAnswer?: string;
  /** Max seconds per answer — clip is auto-stopped at this duration. */
  maxSeconds?: number;
}

type PanelState =
  | { kind: "idle" }
  | { kind: "recording"; startedAt: number }
  | { kind: "transcribing" }
  | { kind: "transcribed"; text: string }
  | { kind: "error"; message: string };

export function VoiceAnswerPanel({
  applicationId,
  questionIndex,
  questionId,
  stream,
  onTranscribed,
  onSwitchToText,
  existingAnswer,
  maxSeconds = 180,
}: VoiceAnswerPanelProps) {
  const [state, setState] = useState<PanelState>(
    existingAnswer ? { kind: "transcribed", text: existingAnswer } : { kind: "idle" }
  );
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef<string>("audio/webm");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset panel state when the question changes
  useEffect(() => {
    setState(existingAnswer ? { kind: "transcribed", text: existingAnswer } : { kind: "idle" });
    setElapsed(0);
    chunksRef.current = [];
    // Stop any active recorder lingering from a prior question
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try { rec.stop(); } catch { /* noop */ }
    }
    recorderRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  // Teardown on unmount
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        try { rec.stop(); } catch { /* noop */ }
      }
    },
    []
  );

  /** Build a MediaRecorder over the AUDIO TRACK only — we never record video. */
  const buildRecorder = useCallback((audioOnlyStream: MediaStream) => {
    // Prefer webm/opus (Chrome, Firefox), fall back to audio/mp4 (Safari)
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    const supported = candidates.find(
      (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)
    );
    mimeRef.current = supported ?? "";
    return new MediaRecorder(
      audioOnlyStream,
      supported ? { mimeType: supported, audioBitsPerSecond: 32_000 } : undefined
    );
  }, []);

  const startRecording = useCallback(() => {
    if (!stream) {
      setState({ kind: "error", message: "Camera not ready yet." });
      return;
    }
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      setState({ kind: "error", message: "No microphone detected." });
      return;
    }
    // Build a new stream containing only the audio track
    const audioOnly = new MediaStream([audioTracks[0]]);
    const recorder = buildRecorder(audioOnly);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onerror = (e) => {
      const msg = (e as unknown as { error?: { message?: string } }).error?.message ?? "Recorder error";
      setState({ kind: "error", message: msg });
    };
    recorder.onstop = async () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      const blob = new Blob(chunksRef.current, { type: mimeRef.current || "audio/webm" });
      chunksRef.current = [];
      if (blob.size < 1024) {
        setState({ kind: "error", message: "That recording was too short. Try again." });
        return;
      }
      setState({ kind: "transcribing" });
      try {
        const ext = (mimeRef.current || "").includes("mp4") ? "mp4"
                  : (mimeRef.current || "").includes("ogg") ? "ogg"
                  : "webm";
        const result = await transcribeAnswer(
          applicationId,
          blob,
          `answer_q${questionIndex + 1}.${ext}`,
          questionIndex,
        );
        setState({ kind: "transcribed", text: result.text });
      } catch (err) {
        const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
        const msg = anyErr?.response?.data?.message ?? anyErr?.message ?? "Transcription failed.";
        setState({ kind: "error", message: msg });
      }
    };

    recorder.start(250); // flush chunks every 250ms so onstop has data
    recorderRef.current = recorder;
    setState({ kind: "recording", startedAt: Date.now() });
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= maxSeconds) {
          // Auto-stop at max duration
          try { recorder.stop(); } catch { /* noop */ }
        }
        return next;
      });
    }, 1000);
  }, [applicationId, buildRecorder, maxSeconds, questionIndex, stream]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state !== "inactive") {
      try { rec.stop(); } catch { /* noop */ }
    }
  }, []);

  const retry = useCallback(() => {
    setState({ kind: "idle" });
    setElapsed(0);
    chunksRef.current = [];
  }, []);

  // Ensure parent knows the accepted answer the moment "transcribed" state is entered
  useEffect(() => {
    if (state.kind === "transcribed") {
      onTranscribed(state.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const minsSecs = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {/* Instructions */}
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-indigo-100 text-indigo-600">
          <Mic className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-800">Record your answer</p>
          <p className="text-xs text-slate-500">
            Your camera is on for the interview feel. Only your audio is recorded, transcribed on
            our server, then deleted. Max {Math.floor(maxSeconds / 60)} minutes.
          </p>
        </div>
      </div>

      {/* Core control */}
      {state.kind === "idle" && (
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={startRecording}
            disabled={!stream}
            className="group relative grid h-20 w-20 place-items-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 transition-all hover:scale-105 hover:bg-indigo-700 disabled:bg-slate-300 disabled:shadow-none"
            aria-label="Start recording"
          >
            <Mic className="h-8 w-8" />
          </button>
          <p className="text-xs text-slate-500">Click to start recording</p>
        </div>
      )}

      {state.kind === "recording" && (
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={stopRecording}
            className="relative grid h-20 w-20 place-items-center rounded-full bg-red-600 text-white shadow-lg shadow-red-200 transition-all hover:scale-105 hover:bg-red-700"
            aria-label="Stop recording"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-40" />
            <span className="relative h-6 w-6 rounded-sm bg-white" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-red-600">Recording… {minsSecs(elapsed)}</p>
            <p className="text-xs text-slate-500">Click the square to stop</p>
          </div>
        </div>
      )}

      {state.kind === "transcribing" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-700">Transcribing your answer…</p>
          <p className="text-xs text-slate-500">Running Whisper on our server, this usually takes a few seconds.</p>
        </div>
      )}

      {state.kind === "transcribed" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Your answer (transcribed)</p>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{state.text}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-600"
            >
              <RefreshCw className="h-4 w-4" /> Re-record
            </button>
            {onSwitchToText && (
              <button
                type="button"
                onClick={onSwitchToText}
                className="text-sm text-slate-500 hover:text-indigo-600 hover:underline"
              >
                Switch to text mode
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Transcripts are final — no typing edits. If a word came out wrong, re-record your answer.
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">{state.message}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
            {onSwitchToText && (
              <button
                type="button"
                onClick={onSwitchToText}
                className="text-sm text-slate-600 hover:text-indigo-600 hover:underline"
              >
                Switch to text mode
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Consent / preflight screen ───────────────────────────────────────────

export interface PreflightProps {
  mode: "video" | "video_preferred" | "candidate_choice";
  cameraStatus: CameraState["status"];
  cameraError: string | null;
  onRequestCamera: () => void;
  onConfirmVideo: () => void;
  onConfirmText: () => void;
}

/** Shown once before the first question when the job is video-capable.
 * Explains what happens, asks for camera permission, lets the candidate
 * pick between video and text when allowed. */
export function InterviewPreflight({
  mode,
  cameraStatus,
  cameraError,
  onRequestCamera,
  onConfirmVideo,
  onConfirmText,
}: PreflightProps) {
  const textAllowed = mode !== "video";
  const cameraReady = cameraStatus === "ready";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold text-slate-900">Ready your interview</h3>
        <p className="mt-1 text-sm text-slate-500">
          This role uses a video interview format. Only your audio is recorded and transcribed —
          no video is ever stored.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-emerald-700">
            <Video className="h-5 w-5" /> <span className="font-semibold">Video mode</span>
          </div>
          <ul className="space-y-1.5 text-xs text-emerald-800/80">
            <li>• Camera on — you see yourself in the corner as proof of recording</li>
            <li>• We record your audio only; the video stream is never uploaded</li>
            <li>• Your voice is transcribed server-side and used as your answer</li>
            <li>• Transcripts are final (no typing) but you can re-record</li>
          </ul>
        </div>
        {textAllowed && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-slate-700">
              <VideoOff className="h-5 w-5" /> <span className="font-semibold">Text mode</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-500">
              <li>• Classic text answers — no camera, no microphone</li>
              <li>• Useful if your connection or environment isn&apos;t video-friendly</li>
              <li>• Available because this role allows it</li>
            </ul>
          </div>
        )}
      </div>

      {cameraStatus === "idle" && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRequestCamera}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Video className="h-4 w-4" /> Enable camera & microphone
          </button>
          {textAllowed && (
            <button
              type="button"
              onClick={onConfirmText}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-indigo-400 hover:text-indigo-600"
            >
              <VideoOff className="h-4 w-4" /> Use text mode
            </button>
          )}
        </div>
      )}

      {cameraStatus === "requesting" && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Waiting for your permission…
        </div>
      )}

      {cameraStatus === "ready" && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-emerald-600">✓ Camera and microphone ready</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onConfirmVideo}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Video className="h-4 w-4" /> Start video interview
            </button>
            {textAllowed && (
              <button
                type="button"
                onClick={onConfirmText}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
              >
                Actually, use text mode
              </button>
            )}
          </div>
        </div>
      )}

      {(cameraStatus === "denied" || cameraStatus === "unsupported") && (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">
            {cameraError ?? "Camera access was blocked."}
          </p>
          <div className="flex flex-wrap gap-2">
            {cameraStatus === "denied" && (
              <button
                type="button"
                onClick={onRequestCamera}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            )}
            {textAllowed ? (
              <button
                type="button"
                onClick={onConfirmText}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-indigo-400"
              >
                Use text mode instead
              </button>
            ) : (
              <p className="text-xs text-red-600">
                This role requires video responses. Please grant camera access to continue, or
                contact the recruiter.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

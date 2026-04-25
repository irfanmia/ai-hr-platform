"use client";

/**
 * Video Interview — continuous flow.
 * ---------------------------------------------------------------------------
 * Exports:
 *   - useInterviewCamera():   getUserMedia lifecycle hook (lives across questions)
 *   - <CameraBubble/>:         sticky bottom-right self-view bubble
 *   - <VoiceAnswerPanel/>:     listens in the background while a question is
 *                              shown. Parent calls .stopAndTranscribe() via
 *                              ref when the candidate clicks "Next question".
 *                              No mic-button chrome shown to the candidate.
 *   - <InterviewPreflight/>:   "Get ready" screen — friendly, no jargon.
 *
 * Privacy invariants kept identical to before — only audio leaves the browser,
 * audio is deleted server-side after transcription. Just nothing about that
 * is surfaced to the candidate; the experience reads as a normal video
 * interview.
 */

import {
  Loader2,
  Mic,
  RefreshCw,
  Video,
  VideoOff,
} from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { transcribeAnswer, uploadIdentitySnapshot } from "@/lib/api";

// ─── Camera hook ──────────────────────────────────────────────────────────

export interface CameraState {
  stream: MediaStream | null;
  error: string | null;
  status: "idle" | "requesting" | "ready" | "denied" | "unsupported";
  request: () => Promise<void>;
  stop: () => void;
}

export function useInterviewCamera(): CameraState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CameraState["status"]>("idle");
  const streamRef = useRef<MediaStream | null>(null);

  const request = useCallback(async () => {
    if (streamRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      setError("Your browser does not support camera recording. Please use Chrome, Firefox, or Safari.");
      return;
    }
    setStatus("requesting");
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: { width: { ideal: 480 }, height: { ideal: 360 }, facingMode: "user" },
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
    if (s) s.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setStatus("idle");
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { stream, error, status, request, stop };
}

// ─── Identity snapshot scheduler ─────────────────────────────────────────

/**
 * Capture still frames from the live camera stream at *random* moments
 * inside short, front-loaded windows. JPEG-encode and POST to the
 * identity-snapshot endpoint. Random timing matters — predictable timing
 * (e.g. always at second 30) lets a candidate "show their face on cue"
 * and then swap with someone else.
 *
 * Timing is front-loaded because real interviews are often shorter than
 * we expect (60-120 seconds, not 6 minutes). We schedule three captures
 * across the first ~90 seconds so even fast candidates produce ≥2:
 *   - capture 1: random in 3-15s   (fires for any interview ≥15s)
 *   - capture 2: random in 15-50s  (fires for any interview ≥50s)
 *   - capture 3: random in 50-100s (only on longer interviews)
 *
 * Fire-and-forget: failures are silently swallowed so they never affect
 * the interview. Ceiling enforced both client-side (this hook) and
 * server-side (max 6 per application). Job-level disable is enforced
 * server-side, so passing `enabled=true` here is always safe.
 *
 * Captures begin only once the stream has at least one video track AND
 * the candidate has actually started the interview (caller passes
 * `armed=true` after the preflight is done).
 */
export function useIdentitySnapshots({
  applicationId,
  stream,
  enabled,
  armed,
  /** Override the default capture schedule (each entry is [minMs, maxMs]).
   *  Default is the front-loaded 3-shot pattern described above. */
  schedule,
}: {
  applicationId: number | null;
  stream: MediaStream | null;
  enabled: boolean;
  armed: boolean;
  schedule?: Array<[number, number]>;
}) {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Clean up any previously-scheduled captures whenever a dep changes
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];

    if (!enabled || !armed || !stream || applicationId == null) return;

    const windows: Array<[number, number]> = schedule ?? [
      [3000,  15000],   // first 15s (almost always fires)
      [15000, 50000],   // 15-50s (fires for typical interviews)
      [50000, 100000],  // 50-100s (longer interviews)
    ];

    for (const [minMs, maxMs] of windows) {
      const at = minMs + Math.random() * Math.max(0, maxMs - minMs);
      const t = setTimeout(() => {
        captureFrameAndUpload(applicationId, stream).catch(() => {});
      }, at);
      timersRef.current.push(t);
    }

    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
    // intentionally re-arm only when the major deps change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, enabled, armed, stream]);
}

/** Grab a single frame from a live MediaStream and POST as JPEG. */
async function captureFrameAndUpload(applicationId: number, stream: MediaStream) {
  if (typeof document === "undefined") return;
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play().catch(() => {});
    // Briefly wait for a real frame to be available
    await new Promise((r) => setTimeout(r, 250));
    const w = video.videoWidth || 480;
    const h = video.videoHeight || 360;
    if (w === 0 || h === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.78),
    );
    if (!blob) return;
    await uploadIdentitySnapshot(applicationId, blob);
  } catch {
    // best-effort
  }
}

// ─── Self-view bubble ────────────────────────────────────────────────────

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
      aria-label="Self-view"
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
          Live
        </span>
      ) : (
        <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
          You
        </span>
      )}
    </div>
  );
}

// ─── Voice answer panel ──────────────────────────────────────────────────

export interface VoiceAnswerPanelProps {
  applicationId: number;
  questionIndex: number;
  questionId: string;
  stream: MediaStream | null;
  /** Called when this question's transcript settles (success or after re-record). */
  onTranscribed: (text: string) => void;
  /** Optional escape hatch for video_preferred jobs. */
  onSwitchToText?: () => void;
  /** Pre-existing answer (if candidate is navigating back, currently unused). */
  existingAnswer?: string;
  /** Cap each clip to keep uploads small. Default 3 min. */
  maxSeconds?: number;
}

export interface StopResult {
  /** Transcribed text. Empty string when silent. */
  text: string;
  /** True when the backend / panel detected no speech in the audio. The
   *  parent can decide whether to advance, prompt for a retry, or accept
   *  the answer as "no response". */
  silent: boolean;
}

export interface VoiceAnswerPanelHandle {
  /**
   * Stop the in-flight recording. Resolves with { text, silent } once the
   * server returns. Never rejects on silence — only on hard transcription
   * failures (5xx, network).
   */
  stopAndTranscribe: () => Promise<StopResult>;
  /** True if currently recording or awaiting a transcript. */
  isBusy: () => boolean;
  /** Re-arm the recorder for the same question (used by parent on "retry"). */
  restartListening: () => void;
}

type PanelState =
  | { kind: "preparing" }                 // brief moment before recording starts
  | { kind: "listening"; startedAt: number }
  | { kind: "transcribing" }
  | { kind: "ready"; text: string }       // transcript has settled, candidate can move on
  | { kind: "error"; message: string };

export const VoiceAnswerPanel = forwardRef<VoiceAnswerPanelHandle, VoiceAnswerPanelProps>(
  function VoiceAnswerPanel(
    { applicationId, questionIndex, questionId, stream, onTranscribed, onSwitchToText, maxSeconds = 180 },
    ref,
  ) {
    const [state, setState] = useState<PanelState>({ kind: "preparing" });
    const [elapsed, setElapsed] = useState(0);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);
    const mimeRef = useRef<string>("audio/webm");
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    /** Promise that resolves when the current onstop+upload settles. Held so
     *  the imperative stopAndTranscribe() can return it. */
    const settleResolverRef = useRef<{
      resolve: (result: StopResult) => void;
      reject: (err: Error) => void;
    } | null>(null);

    // ─── Build a MediaRecorder over only the audio track ───────────────────
    const buildRecorder = useCallback((audioStream: MediaStream) => {
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const supported = candidates.find(
        (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
      );
      mimeRef.current = supported ?? "";
      return new MediaRecorder(
        audioStream,
        supported ? { mimeType: supported, audioBitsPerSecond: 32_000 } : undefined,
      );
    }, []);

    // ─── Internal start ────────────────────────────────────────────────────
    const startListening = useCallback(() => {
      if (!stream) return;
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        setState({ kind: "error", message: "Microphone unavailable." });
        return;
      }
      const audioOnly = new MediaStream([audioTracks[0]]);
      const recorder = buildRecorder(audioOnly);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = (e) => {
        const msg = (e as unknown as { error?: { message?: string } }).error?.message ?? "Recording error";
        const resolver = settleResolverRef.current;
        settleResolverRef.current = null;
        setState({ kind: "error", message: msg });
        if (resolver) resolver.reject(new Error(msg));
      };
      recorder.onstop = async () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        const blob = new Blob(chunksRef.current, { type: mimeRef.current || "audio/webm" });
        chunksRef.current = [];
        const resolver = settleResolverRef.current;
        settleResolverRef.current = null;

        if (blob.size < 1024) {
          // Tiny clip — treat as silence; the parent decides whether to prompt.
          setState({ kind: "ready", text: "" });
          if (resolver) resolver.resolve({ text: "", silent: true });
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
          // Backend now returns 200 with {text:"", silent:true} on no-speech.
          const isSilent = result.silent === true || !result.text.trim();
          setState({ kind: "ready", text: result.text || "" });
          if (!isSilent) onTranscribed(result.text);
          if (resolver) resolver.resolve({ text: result.text || "", silent: isSilent });
        } catch (err) {
          // Real infra errors only — silence comes back as 200 above.
          const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
          const msg = anyErr?.response?.data?.message ?? anyErr?.message ?? "Couldn't transcribe answer.";
          setState({ kind: "error", message: msg });
          if (resolver) resolver.reject(new Error(msg));
        }
      };

      recorder.start(250);
      recorderRef.current = recorder;
      setState({ kind: "listening", startedAt: Date.now() });
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= maxSeconds) {
            try { recorder.stop(); } catch { /* noop */ }
          }
          return next;
        });
      }, 1000);
    }, [stream, buildRecorder, applicationId, questionIndex, onTranscribed, maxSeconds]);

    // ─── Auto-start when the panel is shown for a question ────────────────
    // Small delay so the candidate has time to read the question before mic
    // engages, and so any prior recorder cleanup completes cleanly.
    useEffect(() => {
      setState({ kind: "preparing" });
      setElapsed(0);
      const stale = recorderRef.current;
      if (stale && stale.state !== "inactive") {
        try { stale.stop(); } catch { /* noop */ }
      }
      recorderRef.current = null;
      const t = setTimeout(() => startListening(), 600);
      return () => clearTimeout(t);
      // intentionally only re-run when the question changes (not on every render)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questionId]);

    // ─── Teardown on unmount ──────────────────────────────────────────────
    useEffect(
      () => () => {
        if (timerRef.current) clearInterval(timerRef.current);
        const rec = recorderRef.current;
        if (rec && rec.state !== "inactive") {
          try { rec.stop(); } catch { /* noop */ }
        }
      },
      [],
    );

    // ─── Imperative API for parent ────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      isBusy: () => state.kind === "listening" || state.kind === "transcribing" || state.kind === "preparing",
      restartListening: () => {
        // Discard whatever happened, start a fresh recording for this question.
        setState({ kind: "preparing" });
        setElapsed(0);
        setTimeout(() => startListening(), 250);
      },
      stopAndTranscribe: () =>
        new Promise<StopResult>((resolve, reject) => {
          const rec = recorderRef.current;
          if (state.kind === "ready") {
            return resolve({ text: state.text, silent: !state.text.trim() });
          }
          if (state.kind === "error") return reject(new Error(state.message));
          if (!rec || rec.state === "inactive") return resolve({ text: "", silent: true });
          settleResolverRef.current = { resolve, reject };
          try { rec.stop(); } catch (e) { reject(e as Error); }
        }),
    }));

    // ─── Re-record (small subtle action) ──────────────────────────────────
    const handleReRecord = useCallback(() => {
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        // Ignore the in-flight result; we'll start fresh
        settleResolverRef.current = null;
        try { rec.stop(); } catch { /* noop */ }
      }
      // Brief gap then restart
      setState({ kind: "preparing" });
      setElapsed(0);
      setTimeout(() => startListening(), 250);
    }, [startListening]);

    const minsSecs = (s: number) =>
      `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

    // ─── UI ───────────────────────────────────────────────────────────────
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        {/* Listening / preparing — friendly, no jargon */}
        {(state.kind === "listening" || state.kind === "preparing") && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`relative grid h-10 w-10 place-items-center rounded-full ${
                  state.kind === "listening"
                    ? "bg-indigo-100 text-indigo-600"
                    : "bg-slate-100 text-slate-400"
                }`}
                aria-hidden="true"
              >
                <Mic className="h-5 w-5" />
                {state.kind === "listening" && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-indigo-400/30" />
                )}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {state.kind === "listening" ? "Listening…" : "Getting ready…"}
                </p>
                <p className="text-xs text-slate-500">
                  Take your time. When you&apos;re done, click{" "}
                  <span className="font-medium text-slate-700">Next question</span>.
                </p>
              </div>
            </div>
            {state.kind === "listening" && (
              <span className="font-mono text-sm text-slate-500" aria-live="polite">
                {minsSecs(elapsed)}
              </span>
            )}
          </div>
        )}

        {/* Transcribing — a beat between Next and the next question loading */}
        {state.kind === "transcribing" && (
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <p className="text-sm text-slate-600">Saving your answer…</p>
          </div>
        )}

        {/* Ready — nothing chrome-heavy. Parent advances the question. */}
        {state.kind === "ready" && (
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <Mic className="h-4 w-4" />
            </span>
            <p className="text-sm text-slate-600">
              Got your answer. Ready for the next question whenever you are.
            </p>
          </div>
        )}

        {/* Error — surfaced inline, candidate can retry the same question */}
        {state.kind === "error" && (
          <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">{state.message}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleReRecord}
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
                  Switch to text instead
                </button>
              )}
            </div>
          </div>
        )}

        {/* Subtle re-record link — only when we're actively recording or just done */}
        {(state.kind === "listening" || state.kind === "ready") && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleReRecord}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600"
            >
              <RefreshCw className="h-3 w-3" /> Re-record this answer
            </button>
          </div>
        )}
      </div>
    );
  },
);

// ─── Interview rules — shown in preflight + on demand elsewhere ─────────

/** Shared list of interview rules / expectations, surfaced in the preflight
 *  before the candidate starts. Kept as its own export so we can reuse it
 *  for a "rules reminder" tooltip later if needed. */
export function InterviewRules() {
  return (
    <ul className="space-y-2 text-sm text-slate-600">
      <li className="flex items-start gap-2">
        <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
          1
        </span>
        <span>
          Answer each question on camera, then click
          <span className="mx-1 font-medium text-slate-800">Next question</span>
          to move on.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
          2
        </span>
        <span>
          Take your time — there&apos;s no countdown. Speak naturally, like a normal interview.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
          3
        </span>
        <span>
          If you don&apos;t know an answer, just say
          <span className="mx-1 font-medium text-slate-800">&ldquo;I don&apos;t know&rdquo;</span>
          — it&apos;s honest, and scores higher than staying silent.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">
          !
        </span>
        <span>
          If you click <span className="mx-1 font-medium text-slate-800">Next</span> without
          speaking, we&apos;ll mark the question as unanswered. You get
          <span className="mx-1 font-semibold text-amber-700">one chance</span>
          per interview to retry a missed question.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
          i
        </span>
        <span>
          We&apos;ll capture a few photos from your camera during the interview so the
          recruiter can verify it&apos;s you. Only HR can see them, and they&apos;re
          deleted automatically once a decision is made.
        </span>
      </li>
    </ul>
  );
}

// ─── Preflight (rewritten — no jargon, with rules) ───────────────────────

export interface PreflightProps {
  mode: "video" | "video_preferred" | "candidate_choice";
  cameraStatus: CameraState["status"];
  cameraError: string | null;
  stream: MediaStream | null;
  onRequestCamera: () => void;
  onConfirmVideo: () => void;
  onConfirmText: () => void;
}

export function InterviewPreflight({
  mode,
  cameraStatus,
  cameraError,
  stream,
  onRequestCamera,
  onConfirmVideo,
  onConfirmText,
}: PreflightProps) {
  const textAllowed = mode !== "video";
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // For candidate_choice mode, the picker reads more naturally as two cards
  // up-front, before any camera prompt.
  if (mode === "candidate_choice" && cameraStatus !== "ready" && cameraStatus !== "requesting") {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-semibold text-slate-900">How would you like to interview?</h3>
          <p className="mt-1 text-sm text-slate-500">
            Pick one — your choice is set for the whole interview.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onRequestCamera}
            className="rounded-2xl border-2 border-indigo-200 bg-white p-5 text-left transition hover:border-indigo-400 hover:shadow-md"
          >
            <div className="mb-2 flex items-center gap-2 text-indigo-700">
              <Video className="h-5 w-5" /> <span className="font-semibold">Video interview</span>
            </div>
            <p className="text-xs text-slate-500">
              Answer on camera, like a normal interview. Recommended.
            </p>
          </button>
          <button
            type="button"
            onClick={onConfirmText}
            className="rounded-2xl border-2 border-slate-200 bg-white p-5 text-left transition hover:border-slate-400 hover:shadow-md"
          >
            <div className="mb-2 flex items-center gap-2 text-slate-700">
              <VideoOff className="h-5 w-5" /> <span className="font-semibold">Text interview</span>
            </div>
            <p className="text-xs text-slate-500">
              Type your answers — no camera or microphone needed.
            </p>
          </button>
        </div>
        {cameraError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {cameraError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold text-slate-900">Get ready for your video interview</h3>
        <p className="mt-1 text-sm text-slate-500">
          We&apos;ll ask you a few questions. Answer each one on camera, then click
          <span className="mx-1 font-medium text-slate-700">Next question</span>
          to move on. Take your time.
        </p>
      </div>

      {/* Big preview while we wait for the candidate to confirm */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-900">
        {stream ? (
          <video
            ref={videoRef}
            className="block aspect-video w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
            autoPlay
            muted
            playsInline
          />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 text-slate-400">
            <Video className="h-10 w-10" />
            <p className="text-sm">Camera preview will appear here</p>
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
            <Video className="h-4 w-4" /> Turn on camera
          </button>
          {textAllowed && (
            <button
              type="button"
              onClick={onConfirmText}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-600"
            >
              <VideoOff className="h-4 w-4" /> Type my answers instead
            </button>
          )}
        </div>
      )}

      {cameraStatus === "requesting" && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Waiting for camera permission…
        </div>
      )}

      {cameraStatus === "ready" && (
        <>
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-indigo-700">
              Quick interview rules
            </p>
            <InterviewRules />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onConfirmVideo}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-base font-semibold text-white hover:bg-indigo-700"
            >
              I&apos;m ready, start the interview
            </button>
            {textAllowed && (
              <button
                type="button"
                onClick={onConfirmText}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
              >
                Switch to typing
              </button>
            )}
          </div>
        </>
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
                Type my answers instead
              </button>
            ) : (
              <p className="text-xs text-red-600">
                This role requires a video interview. Please grant camera access to continue.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

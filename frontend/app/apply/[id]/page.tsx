"use client";

import { CheckCircle, Loader2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  CameraBubble,
  InterviewPreflight,
  VoiceAnswerPanel,
  type VoiceAnswerPanelHandle,
  useIdentitySnapshots,
  useInterviewCamera,
} from "@/components/video-interview";
import { generateQuestions, getJob, submitAnswers, submitApplication } from "@/lib/api";
import { decodeJwt, getAuthState, setCandidateTokens } from "@/lib/auth-store";
import type { AnswerMode, InterviewQuestion, Job, ResponseType } from "@/lib/types";

const STEPS = ["Sign In", "Personal Info", "Resume Upload", "AI Interview", "Done"];
const API = process.env.NEXT_PUBLIC_API_URL ?? "/api";

async function registerCandidate(name: string, email: string, password: string) {
  const res = await fetch(`${API}/auth/register/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  return data;
}

async function loginCandidate(email: string, password: string) {
  const res = await fetch(`${API}/auth/login/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Login failed");
  return data;
}

// Upload states
type UploadState = "idle" | "uploading" | "processing" | "ready" | "error";

export default function ApplyPage({ params }: { params: any }) {
  // Next.js 16: params is a Promise — unwrap with React.use()
  const resolvedParams = typeof params.then === "function" ? use(params) : params;
  const id = resolvedParams?.id ?? "";
  const [step, setStep] = useState(1);
  const [job, setJob] = useState<Job | null>(null);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isSignIn, setIsSignIn] = useState(false);
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });

  // Background upload state
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedAppId, setUploadedAppId] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const uploadRef = useRef<AbortController | null>(null);
  const [uploadAttempts, setUploadAttempts] = useState(0);
  const MAX_ATTEMPTS = 3;
  const [cachedQuestions, setCachedQuestions] = useState<InterviewQuestion[]>([]);
  const [validationStep, setValidationStep] = useState<"uploading" | "validating" | "matching" | "ready" | "">("")
  const [resumeMatchResult, setResumeMatchResult] = useState<any>(null);

  // Questions loading
  const [questionsLoading, setQuestionsLoading] = useState(false);

  // ── Video interview state ──
  const camera = useInterviewCamera();
  const [answerMode, setAnswerMode] = useState<AnswerMode | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);
  // When the candidate clicks "Next", we ask the panel to stop & transcribe.
  const voicePanelRef = useRef<VoiceAnswerPanelHandle | null>(null);
  const [advancing, setAdvancing] = useState(false);

  // Identity verification: 3 random snapshots across the interview window.
  // Server-side honours the per-job toggle even if the frontend tries; we
  // also pass `enabled` based on the job config to avoid even attempting
  // capture when HR has it off (saves bandwidth + smaller privacy footprint).
  useIdentitySnapshots({
    applicationId,
    stream: camera.stream,
    enabled: (job as any)?.identity_snapshots_enabled !== false,
    armed: step === 4 && answerMode === "video",
  });

  // ── Silent-answer handling ──
  // The candidate gets ONE chance per interview to retry a missed question.
  // After they use it (or skip with "I don't know"), future silent answers
  // are auto-marked as no-response without prompting.
  const NO_RESPONSE_MARKER = "[no response]";
  const DONT_KNOW_MARKER = "I don't know.";
  const [silenceRetryUsed, setSilenceRetryUsed] = useState(false);
  // When a silent answer is detected AND the retry chance is still available,
  // we pause the flow and show this prompt instead of advancing.
  const [silentPrompt, setSilentPrompt] = useState<{
    questionId: string;
    isLast: boolean;
  } | null>(null);

  const [form, setForm] = useState({
    candidate_name: "", email: "", phone: "",
    portfolio_url: "", github_url: "", linkedin_url: "",
  });

  useEffect(() => {
    getJob(id).then(setJob);
    const { candidateAccess: token } = getAuthState();
    if (!token) return;
    const payload = decodeJwt(token);
    if (!payload || payload.is_staff || payload.is_superuser) return;

    // Pre-fill email
    setForm((f) => ({ ...f, email: payload.email || "", candidate_name: payload.name || "" }));
    setStep(2);

    // Check if candidate already has an application for this job
    fetch(`${API}/dashboard/my-applications/job/${id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.applied) return;
        // Has existing application
        setUploadedAppId(data.application_id);
        setApplicationId(data.application_id);
        if (data.has_report) {
          // Already completed — show done
          setStep(5);
        } else if (data.has_resume) {
          // Resume uploaded, jump to interview
          setUploadState("ready");
          setUploadProgress(100);
          setSelectedFileName("Previously uploaded resume");
          setStep(3);
        }
      })
      .catch(() => {});
  }, [id]);

  const currentQuestion = questions[questionIndex];
  const interviewProgress = useMemo(
    () => (questions.length ? ((questionIndex + 1) / questions.length) * 100 : 0),
    [questionIndex, questions.length]
  );

  // ── Background upload as soon as file is selected ──
  async function handleFileSelect(file: File) {
    // Ensure candidate_name is set — fallback to email prefix or auth token name
    const effectiveForm = { ...form };

    // Get name + email from JWT token if not already set
    const { candidateAccess: token } = getAuthState();
    const payload = token ? decodeJwt(token) : null;

    if (!effectiveForm.email.trim()) {
      effectiveForm.email = payload?.email || "";
    }
    if (!effectiveForm.candidate_name.trim()) {
      effectiveForm.candidate_name =
        payload?.name ||
        authForm.name ||
        (effectiveForm.email ? effectiveForm.email.split("@")[0] : "Candidate");
    }

    if (!effectiveForm.email.trim() || !effectiveForm.candidate_name.trim()) {
      setUploadState("error");
      setUploadError("Please fill in your name and email in the previous step first.");
      return;
    }

    setForm(effectiveForm);

    setSelectedFileName(file.name);
    setUploadState("uploading");
    setUploadProgress(0);
    setUploadError("");
    setUploadedAppId(null);

    // Animate progress bar during upload
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 85) { clearInterval(progressInterval); return 85; }
        return prev + Math.random() * 12;
      });
    }, 200);

    try {
      const result = await submitApplication({ job: Number(id), resume: file, ...effectiveForm });
      clearInterval(progressInterval);
      setUploadProgress(90);
      setUploadedAppId(result.id);
      setApplicationId(result.id);

      // Step 2: AI validates the document is a resume
      setValidationStep("validating");
      setUploadProgress(88);
      try {
        // Step 3: Score resume-job match + generate questions
        setValidationStep("matching");
        setUploadProgress(95);
        const generated = await generateQuestions(result.id);
        // All steps passed — cache everything
        setCachedQuestions(generated.questions || []);
        setResumeMatchResult(generated.resume_match || null);
        setValidationStep("ready");
        setUploadProgress(100);
        setUploadState("ready");
      } catch (validationErr: any) {
        // Document rejected by AI
        const attempt = uploadAttempts + 1;
        setUploadAttempts(attempt);
        setUploadProgress(0);

        if (attempt >= MAX_ATTEMPTS) {
          setUploadState("error");
          setUploadError(
            `You have reached the maximum of ${MAX_ATTEMPTS} upload attempts. ` +
            `Please contact support at support@hireparrot.com for assistance.`
          );
        } else {
          const remaining = MAX_ATTEMPTS - attempt;
          const msg = validationErr?.response?.data?.message ||
            "The uploaded file doesn't appear to be a resume.";
          setUploadState("error");
          setUploadError(
            `⚠️ ${msg} ` +
            `Please upload a proper CV/resume in PDF, DOC, or DOCX format. ` +
            `(${remaining} attempt${remaining > 1 ? "s" : ""} remaining)`
          );
        }
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setUploadState("error");
      setUploadError(err?.message || "Upload failed. Please try again.");
      setUploadProgress(0);
    }
  }

  // ── Submit: trigger questions (file already uploaded) ──
  async function handleSubmitAndStartInterview() {
    if (!uploadedAppId) return;
    setStep(4);
    // Decide whether to run the video preflight. Jobs with response_type=text
    // (or unset, for old jobs) skip it entirely and go straight to text
    // questions — zero change vs. Phase 1 for those jobs.
    const responseType = (job?.response_type ?? "text") as ResponseType;
    if (responseType === "text") {
      setAnswerMode("text");
      setShowPreflight(false);
    } else {
      setAnswerMode(null);
      setShowPreflight(true);
    }
    // Use cached questions from validation step — no extra API call needed
    if (cachedQuestions.length > 0) {
      setQuestions(cachedQuestions);
      return;
    }
    // Fallback: fetch questions if not cached
    setQuestionsLoading(true);
    try {
      const generated = await generateQuestions(uploadedAppId);
      setQuestions(generated.questions);
    } catch {
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  }

  /** Push a final answer for the current question and either advance to the
   *  next or submit the whole interview. Used by both the normal flow and
   *  the silent-prompt resolution paths below. */
  async function commitAnswerAndAdvance(textForCurrent: string) {
    if (!currentQuestion || !applicationId) return;
    const finalAnswers = { ...answers, [currentQuestion.id]: textForCurrent };
    setAnswers(finalAnswers);
    if (questionIndex === questions.length - 1) {
      try {
        setAdvancing(true);
        await submitAnswers(applicationId, finalAnswers);
        setStep(5);
      } finally {
        setAdvancing(false);
      }
      return;
    }
    setAdvancing(false);
    startTransition(() => setQuestionIndex((v) => v + 1));
  }

  async function handleNextQuestion() {
    if (!currentQuestion || !applicationId) return;
    setAdvancing(true);

    // Coding questions ALWAYS use the textarea/code editor — even in video
    // mode. Speaking code aloud is a terrible UX. MCQ/one_word always render
    // their own widgets. Only descriptive + scenario flow through the voice
    // panel when the candidate picked video mode.
    const isVoiceQuestion =
      answerMode === "video" &&
      ["descriptive", "scenario"].includes(currentQuestion.type);

    // ── Text / MCQ / one-word path: nothing fancy, just advance ──────────
    if (!isVoiceQuestion) {
      await commitAnswerAndAdvance(answers[currentQuestion.id] ?? "");
      return;
    }

    // ── Video path: stop the recorder and inspect the result ─────────────
    if (!voicePanelRef.current) {
      setAdvancing(false);
      return;
    }
    let result;
    try {
      result = await voicePanelRef.current.stopAndTranscribe();
    } catch {
      // Hard transcription failure — panel surfaces its own error UI
      setAdvancing(false);
      return;
    }

    if (!result.silent && result.text.trim()) {
      // Got a real answer — store and advance
      await commitAnswerAndAdvance(result.text);
      return;
    }

    // ── Silent answer ────────────────────────────────────────────────────
    if (!silenceRetryUsed) {
      // First silent answer in this interview — pause and offer the choice
      setSilentPrompt({
        questionId: currentQuestion.id,
        isLast: questionIndex === questions.length - 1,
      });
      setAdvancing(false);
      return;
    }
    // Retry chance already used — auto-mark and advance silently
    await commitAnswerAndAdvance(NO_RESPONSE_MARKER);
  }

  /** Candidate clicked "Try again" in the silent-answer prompt. Consumes
   *  the one-shot retry budget and re-arms the recorder for the same
   *  question. */
  function handleSilentRetry() {
    setSilenceRetryUsed(true);
    setSilentPrompt(null);
    voicePanelRef.current?.restartListening();
  }

  /** Candidate clicked "Mark as I don't know" in the silent-answer prompt.
   *  Stores the explicit answer and advances. Also consumes the retry budget
   *  (you only get prompted once per interview). */
  async function handleSilentDontKnow() {
    setSilenceRetryUsed(true);
    setSilentPrompt(null);
    setAdvancing(true);
    await commitAnswerAndAdvance(DONT_KNOW_MARKER);
  }

  async function handleAuth() {
    setAuthError(""); setAuthLoading(true);
    try {
      if (isSignIn) {
        const data = await loginCandidate(authForm.email, authForm.password);
        setCandidateTokens(data.access, data.refresh);
        setForm((f) => ({ ...f, email: authForm.email, candidate_name: authForm.email.split("@")[0] }));
        setStep(2);
      } else {
        if (authForm.password !== authForm.confirmPassword) { setAuthError("Passwords do not match."); return; }
        if (authForm.password.length < 6) { setAuthError("Password must be at least 6 characters."); return; }
        const data = await registerCandidate(authForm.name, authForm.email, authForm.password);
        // New flow: signup returns verification_required (no JWT). Send the
        // user to /login (it shows the "check your email" panel) and they
        // can come back to apply once they've clicked the link in their email.
        if (data.verification_required) {
          setAuthError(
            `We've sent a verification link to ${authForm.email}. Click it to activate your account, then come back to apply.`,
          );
          return;
        }
        // Legacy auto-login path (in case verification flow isn't deployed yet)
        setCandidateTokens(data.access, data.refresh);
        setForm((f) => ({ ...f, email: authForm.email, candidate_name: authForm.name }));
        setStep(2);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">

        {/* Step indicators */}
        <div className="mb-10 flex flex-wrap gap-3">
          {STEPS.map((label, index) => {
            const stepNum = index + 1;
            const isCompleted = step > stepNum;
            const isCurrent = step === stepNum;
            // Allow clicking back to completed steps (not forward)
            const canGoBack = isCompleted && stepNum < 4; // can’t go back into interview
            return (
              <button
                key={label}
                disabled={!canGoBack && !isCurrent}
                onClick={() => canGoBack ? setStep(stepNum) : undefined}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors
                  ${isCurrent ? "bg-indigo-600 text-white" :
                    isCompleted ? "bg-indigo-200 text-indigo-800 cursor-pointer hover:bg-indigo-300" :
                    "bg-slate-100 text-slate-400 cursor-default"}`}
              >
                {isCompleted ? "✓" : stepNum}. {label}
              </button>
            );
          })}
        </div>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>{job ? `Apply for ${job.title}` : "Application"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* ── STEP 1: Auth ── */}
            {step === 1 && (
              <div className="mx-auto max-w-md space-y-5">
                <h2 className="text-xl font-semibold text-slate-900">
                  {isSignIn ? "Sign in to continue" : "Create an account to apply"}
                </h2>
                {!isSignIn && (
                  <div>
                    <Label className="mb-1 block">Full Name</Label>
                    <Input placeholder="John Doe" value={authForm.name} onChange={e => setAuthForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                )}
                <div>
                  <Label className="mb-1 block">Email</Label>
                  <Input type="email" placeholder="you@example.com" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <Label className="mb-1 block">Password</Label>
                  <Input type="password" placeholder="Min. 6 characters" value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                {!isSignIn && (
                  <div>
                    <Label className="mb-1 block">Confirm Password</Label>
                    <Input type="password" placeholder="Re-enter password" value={authForm.confirmPassword} onChange={e => setAuthForm(f => ({ ...f, confirmPassword: e.target.value }))} />
                  </div>
                )}
                {authError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{authError}</p>}
                <Button className="w-full" onClick={handleAuth} disabled={authLoading}>
                  {authLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSignIn ? "Sign In & Continue" : "Create Account & Continue"}
                </Button>
                <p className="text-center text-sm text-slate-500">
                  {isSignIn ? (
                    <>Don&apos;t have an account? <button className="font-medium text-indigo-600 hover:underline" onClick={() => { setIsSignIn(false); setAuthError(""); }}>Create one</button></>
                  ) : (
                    <>Already have an account? <button className="font-medium text-indigo-600 hover:underline" onClick={() => { setIsSignIn(true); setAuthError(""); }}>Sign in</button></>
                  )}
                </p>
              </div>
            )}

            {/* ── STEP 2: Personal Info ── */}
            {step === 2 && (
              <div className="grid gap-5 md:grid-cols-2">
                {Object.entries(form).map(([key, value]) => (
                  <div key={key} className={key === "linkedin_url" ? "md:col-span-2" : ""}>
                    <Label className="mb-2 block capitalize">{key.replaceAll("_", " ")}</Label>
                    <Input value={value} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
                <div className="md:col-span-2 flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                  <Button onClick={() => setStep(3)}>Continue to Resume →</Button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Resume Upload with background upload ── */}
            {step === 3 && (
              <div className="space-y-6">

                {/* Drop zone */}
                <label className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors
                  ${uploadState === "ready" ? "border-emerald-400 bg-emerald-50" :
                    uploadState === "error" ? "border-red-300 bg-red-50" :
                    uploadState === "uploading" ? "border-indigo-300 bg-indigo-50" :
                    "border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/30"}`}>
                  {uploadState === "ready" ? (
                    <>
                      <CheckCircle className="mb-3 h-10 w-10 text-emerald-500" />
                      <p className="text-lg font-semibold text-emerald-700">✓ Resume verified!</p>
                      <p className="mt-1 text-sm text-emerald-600">{selectedFileName}</p>
                      {resumeMatchResult && (
                        <div className="mt-2 flex flex-col items-center gap-1">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            resumeMatchResult.match_level === "Strong Match" ? "bg-emerald-100 text-emerald-700" :
                            resumeMatchResult.match_level === "Moderate Match" ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-600"
                          }`}>{resumeMatchResult.match_level} — {resumeMatchResult.resume_match_score}/50 pts</span>
                        </div>
                      )}
                      <p className="mt-2 text-xs text-slate-400">Click to replace</p>
                    </>
                  ) : uploadState === "uploading" ? (
                    <>
                      <Loader2 className="mb-3 h-10 w-10 animate-spin text-indigo-500" />
                      <p className="text-lg font-semibold text-slate-700">Uploading resume...</p>
                      <p className="mt-1 text-sm text-slate-500">{selectedFileName}</p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="mb-3 h-10 w-10 text-indigo-500" />
                      <p className="text-lg font-semibold text-slate-800">Upload your resume</p>
                      <p className="mt-1 text-sm text-slate-500">PDF, DOC, or DOCX · Max 5MB</p>
                      <p className="mt-2 text-xs font-medium text-indigo-600">💡 ATS-friendly format recommended</p>
                      <p className="mt-0.5 text-xs text-slate-400">Clean layout, standard fonts, no graphics or tables</p>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    disabled={uploadAttempts >= MAX_ATTEMPTS}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f && uploadAttempts < MAX_ATTEMPTS) handleFileSelect(f);
                      // Reset file input so same file can be re-selected
                      e.target.value = "";
                    }}
                  />
                </label>

                {/* Progress bar — always visible when not idle */}
                {uploadState !== "idle" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className={
                        uploadState === "ready" ? "text-emerald-600" :
                        uploadState === "error" ? "text-red-500" :
                        "text-indigo-600"
                      }>
                        {uploadState === "uploading" || (uploadState !== "ready" && uploadState !== "error" && validationStep) ?
                          (validationStep === "validating" ? "Step 1 of 3: AI is checking your document..." :
                           validationStep === "matching" ? "Step 2 of 3: Analysing resume vs job requirements..." :
                           uploadProgress < 88 ? "Uploading resume..." :
                           "Processing...") :
                         uploadState === "ready" ? "✓ Document verified — ready to start interview" :
                         uploadState === "error" ? (uploadAttempts >= MAX_ATTEMPTS ? "Maximum attempts reached" : "Document rejected") : ""}
                      </span>
                      <span className="text-slate-400">{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ease-out ${
                          uploadState === "ready" ? "bg-emerald-500" :
                          uploadState === "error" ? "bg-red-400" : "bg-indigo-500"
                        }`}
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    {uploadError && (
                      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 space-y-1">
                        <p className="text-sm text-red-600">{uploadError}</p>
                        {uploadAttempts >= MAX_ATTEMPTS && (
                          <p className="text-xs text-red-500">
                            Need help?{" "}
                            <a href="mailto:support@hireparrot.com" className="font-medium underline">Contact support</a>
                          </p>
                        )}
                        {uploadAttempts > 0 && uploadAttempts < MAX_ATTEMPTS && (
                          <p className="text-xs text-slate-500">
                            Attempt {uploadAttempts} of {MAX_ATTEMPTS}. Upload a different file to try again.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button
                    onClick={handleSubmitAndStartInterview}
                    disabled={uploadState !== "ready"}
                    className={uploadState === "ready" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                  >
                    {uploadState === "uploading" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                    ) : uploadState === "ready" ? (
                      "Start AI Interview →"
                    ) : (
                      "Select a file to continue"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 4: AI Interview ── */}
            {step === 4 && questionsLoading && (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <Loader2 className="mb-4 h-10 w-10 animate-spin text-indigo-600" />
                <h3 className="text-2xl font-semibold text-slate-950">Preparing your interview...</h3>
                <p className="mt-2 text-slate-500">AI is generating questions based on your resume.</p>
              </div>
            )}

            {/* Preflight — shown once before question 1 on video-capable jobs */}
            {step === 4 && !questionsLoading && showPreflight && answerMode === null && job && (
              <InterviewPreflight
                mode={(job.response_type ?? "text") as Exclude<ResponseType, "text">}
                cameraStatus={camera.status}
                cameraError={camera.error}
                stream={camera.stream}
                onRequestCamera={() => camera.request()}
                onConfirmVideo={() => { setAnswerMode("video"); setShowPreflight(false); }}
                onConfirmText={() => { setAnswerMode("text"); setShowPreflight(false); camera.stop(); }}
              />
            )}

            {step === 4 && !questionsLoading && !showPreflight && currentQuestion && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>Question {questionIndex + 1} of {questions.length}</span>
                    <span>{Math.round(interviewProgress)}% complete</span>
                  </div>
                  <Progress value={interviewProgress} />
                </div>
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-slate-950">{currentQuestion.prompt}</h3>
                  {/* MCQ and one_word always use the original UI — voice answers
                      don't make sense for choosing an option or a single word. */}
                  {currentQuestion.type === "mcq" ? (
                    <div className="space-y-3">
                      {currentQuestion.options?.map(option => (
                        <label key={option} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${answers[currentQuestion.id] === option ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-indigo-300"}`}>
                          <input type="radio" name={currentQuestion.id} checked={answers[currentQuestion.id] === option} onChange={() => setAnswers(a => ({ ...a, [currentQuestion.id]: option }))} className="accent-indigo-600" />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : currentQuestion.type === "one_word" ? (
                    <Input placeholder="Your answer" value={answers[currentQuestion.id] ?? ""} onChange={e => setAnswers(a => ({ ...a, [currentQuestion.id]: e.target.value }))} />
                  ) : answerMode === "video"
                       && applicationId !== null
                       && ["descriptive", "scenario"].includes(currentQuestion.type) ? (
                    <div className="space-y-4">
                      <VoiceAnswerPanel
                        ref={voicePanelRef}
                        applicationId={applicationId}
                        questionIndex={questionIndex}
                        questionId={currentQuestion.id}
                        stream={camera.stream}
                        existingAnswer={answers[currentQuestion.id]}
                        onTranscribed={(text) => setAnswers(a => ({ ...a, [currentQuestion.id]: text }))}
                        onSwitchToText={
                          // Switch-to-text only on video_preferred jobs. Hard "video"
                          // and "candidate_choice" lock the choice once made.
                          job?.response_type === "video_preferred"
                            ? () => { setAnswerMode("text"); camera.stop(); }
                            : undefined
                        }
                      />

                      {silentPrompt && silentPrompt.questionId === currentQuestion.id && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                          <p className="text-sm font-semibold text-amber-900">
                            We didn&apos;t catch any answer for this question.
                          </p>
                          <p className="mt-1 text-xs text-amber-800/80">
                            What would you like to do? You get this choice
                            <span className="mx-1 font-semibold">once per interview</span>
                            — after this, missed questions are recorded as unanswered.
                          </p>
                          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                            <Button onClick={handleSilentRetry}>
                              Try again — re-record this answer
                            </Button>
                            <Button
                              variant="outline"
                              onClick={handleSilentDontKnow}
                              disabled={advancing}
                            >
                              {advancing ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                                </>
                              ) : (
                                'Mark as "I don\'t know"'
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : currentQuestion.type === "coding" ? (
                    // Code editor look — slate-dark background, mono font,
                    // tab key actually inserts a tab so candidates can write
                    // real-feeling code instead of a plain textarea.
                    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-inner">
                      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                        </div>
                        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
                          editor — pseudocode or any language
                        </span>
                      </div>
                      <textarea
                        className="block min-h-[200px] w-full resize-y bg-slate-900 px-4 py-3 font-mono text-sm leading-6 text-emerald-50 placeholder:text-slate-500 focus:outline-none"
                        placeholder="// Write your code or pseudocode here..."
                        spellCheck={false}
                        value={answers[currentQuestion.id] ?? ""}
                        onChange={e => setAnswers(a => ({ ...a, [currentQuestion.id]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === "Tab") {
                            e.preventDefault();
                            const ta = e.currentTarget;
                            const start = ta.selectionStart;
                            const end = ta.selectionEnd;
                            const before = ta.value.slice(0, start);
                            const after = ta.value.slice(end);
                            const next = before + "  " + after;
                            ta.value = next;
                            ta.selectionStart = ta.selectionEnd = start + 2;
                            setAnswers(a => ({ ...a, [currentQuestion.id]: next }));
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <Textarea
                      placeholder="Write your answer here..."
                      rows={5}
                      value={answers[currentQuestion.id] ?? ""}
                      onChange={e => setAnswers(a => ({ ...a, [currentQuestion.id]: e.target.value }))}
                    />
                  )}
                </div>
                {(() => {
                  // For voice questions the panel auto-records, so the Next
                  // button is always enabled (clicking it triggers the stop
                  // + transcribe). For text questions, gate on answer presence.
                  const isVoiceQ =
                    answerMode === "video" &&
                    ["descriptive", "coding", "scenario"].includes(currentQuestion.type);
                  const disabled = advancing || isPending || (!isVoiceQ && !answers[currentQuestion.id]);
                  const isLast = questionIndex === questions.length - 1;
                  return (
                    <Button onClick={handleNextQuestion} disabled={disabled}>
                      {advancing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {isLast ? "Submitting…" : "Saving answer…"}
                        </>
                      ) : isLast ? (
                        "Submit Interview ✓"
                      ) : (
                        "Next Question →"
                      )}
                    </Button>
                  );
                })()}
              </div>
            )}

            {/* ── STEP 5: Done ── */}
            {step === 5 && (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-3xl font-semibold text-slate-950">Application submitted!</h3>
                <p className="mt-3 text-slate-500">Your AI interview is complete. HR will review your report shortly.</p>
                <p className="mt-2 text-sm font-medium text-slate-700">Application ID: #{applicationId}</p>
                <div className="mt-6 flex gap-4">
                  <Link href="/my-dashboard" className="text-sm text-indigo-600 hover:underline">View My Dashboard →</Link>
                  <Link href="/jobs" className="text-sm text-slate-500 hover:underline">Browse more jobs</Link>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </main>

      {/* Self-view bubble — only while in the interview step and camera is granted */}
      {step === 4 && answerMode === "video" && (
        <CameraBubble stream={camera.stream} />
      )}
    </div>
  );
}

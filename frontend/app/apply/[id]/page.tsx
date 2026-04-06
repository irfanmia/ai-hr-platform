"use client";

import { CheckCircle, Loader2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { PublicNav } from "@/components/public-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { generateQuestions, getJob, submitAnswers, submitApplication } from "@/lib/api";
import type { InterviewQuestion, Job } from "@/lib/types";

const STEPS = ["Sign In", "Personal Info", "Resume Upload", "AI Interview", "Done"];
const API = process.env.NEXT_PUBLIC_API_URL ?? "/api";

function decodeJwt(token: string) {
  try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); }
  catch { return null; }
}

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
  const id = params.id;
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

  // Questions loading
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const [form, setForm] = useState({
    candidate_name: "", email: "", phone: "",
    portfolio_url: "", github_url: "", linkedin_url: "",
  });

  useEffect(() => {
    getJob(id).then(setJob);
    const token = localStorage.getItem("candidate_access_token");
    if (token) {
      const payload = decodeJwt(token);
      if (payload && !payload.is_staff && !payload.is_superuser) {
        setForm((f) => ({ ...f, email: payload.email || "" }));
        setStep(2);
      }
    }
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
    if (!effectiveForm.candidate_name.trim()) {
      const token = localStorage.getItem("candidate_access_token");
      const payload = token ? decodeJwt(token) : null;
      effectiveForm.candidate_name = payload?.name ||
        (effectiveForm.email ? effectiveForm.email.split("@")[0] : "Candidate");
      setForm(effectiveForm);
    }
    if (!effectiveForm.email.trim()) {
      setUploadState("error");
      setUploadError("Please fill in your personal info first.");
      return;
    }

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
      setUploadProgress(100);
      setUploadedAppId(result.id);
      setApplicationId(result.id);
      setUploadState("ready");
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
    setQuestionsLoading(true);
    setStep(4);
    try {
      const generated = await generateQuestions(uploadedAppId);
      setQuestions(generated.questions);
    } catch {
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  }

  async function handleNextQuestion() {
    if (!currentQuestion || !applicationId) return;
    if (questionIndex === questions.length - 1) {
      await submitAnswers(applicationId, answers);
      setStep(5);
      return;
    }
    startTransition(() => setQuestionIndex((v) => v + 1));
  }

  async function handleAuth() {
    setAuthError(""); setAuthLoading(true);
    try {
      if (isSignIn) {
        const data = await loginCandidate(authForm.email, authForm.password);
        localStorage.setItem("candidate_access_token", data.access);
        setForm((f) => ({ ...f, email: authForm.email, candidate_name: authForm.email.split("@")[0] }));
      } else {
        if (authForm.password !== authForm.confirmPassword) { setAuthError("Passwords do not match."); return; }
        if (authForm.password.length < 6) { setAuthError("Password must be at least 6 characters."); return; }
        const data = await registerCandidate(authForm.name, authForm.email, authForm.password);
        localStorage.setItem("candidate_access_token", data.access);
        setForm((f) => ({ ...f, email: authForm.email, candidate_name: authForm.name }));
      }
      setStep(2);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="mx-auto max-w-4xl px-6 py-12">

        {/* Step indicators */}
        <div className="mb-10 flex flex-wrap gap-3">
          {STEPS.map((label, index) => (
            <div key={label} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${step >= index + 1 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
              {index + 1}. {label}
            </div>
          ))}
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
                <div className="md:col-span-2">
                  <Button onClick={() => setStep(3)}>Continue to Resume</Button>
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
                      <p className="text-lg font-semibold text-emerald-700">Resume uploaded!</p>
                      <p className="mt-1 text-sm text-emerald-600">{selectedFileName}</p>
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
                      <p className="mt-2 text-xs text-slate-400">Upload starts immediately on file selection</p>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
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
                        {uploadState === "uploading" ? "Uploading & analysing your resume..." :
                         uploadState === "ready" ? "✓ Ready — AI has received your resume" :
                         uploadState === "error" ? "Upload failed" : ""}
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
                    {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
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

            {step === 4 && !questionsLoading && currentQuestion && (
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
                  ) : (
                    <Textarea
                      className={currentQuestion.type === "coding" ? "font-mono text-sm" : ""}
                      placeholder={currentQuestion.type === "coding" ? "Write your code or pseudocode here..." : "Write your answer here..."}
                      rows={5}
                      value={answers[currentQuestion.id] ?? ""}
                      onChange={e => setAnswers(a => ({ ...a, [currentQuestion.id]: e.target.value }))}
                    />
                  )}
                </div>
                <Button onClick={handleNextQuestion} disabled={!answers[currentQuestion.id] || isPending}>
                  {questionIndex === questions.length - 1 ? "Submit Interview ✓" : "Next Question →"}
                </Button>
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
    </div>
  );
}

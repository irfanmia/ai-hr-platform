"use client";

import { Loader2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { PublicNav } from "@/components/public-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { generateQuestions, getJob, submitAnswers, submitApplication } from "@/lib/api";
import type { InterviewQuestion, Job } from "@/lib/types";

const STEPS = ["Account", "Personal Info", "Resume Upload", "AI Interview", "Done"];

async function registerCandidate(name: string, email: string, password: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  return data;
}

async function loginCandidate(email: string, password: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Login failed");
  return data;
}

export default function ApplyPage({ params }: { params: any }) {
  const id = params.id;
  const [step, setStep] = useState(1); // 1=Account, 2=Info, 3=Resume, 4=Interview, 5=Done
  const [job, setJob] = useState<Job | null>(null);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isSignIn, setIsSignIn] = useState(false);

  // Auth form state
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });

  // Application form
  const [form, setForm] = useState({
    candidate_name: "",
    email: "",
    phone: "",
    portfolio_url: "",
    github_url: "",
    linkedin_url: "",
  });

  useEffect(() => {
    getJob(id).then(setJob);
  }, [id]);

  const currentQuestion = questions[questionIndex];
  const interviewProgress = useMemo(
    () => (questions.length ? ((questionIndex + 1) / questions.length) * 100 : 0),
    [questionIndex, questions.length]
  );

  async function handleAuth() {
    setAuthError("");
    setAuthLoading(true);
    try {
      if (isSignIn) {
        const data = await loginCandidate(authForm.email, authForm.password);
        localStorage.setItem("candidate_access_token", data.access);
        setForm((f) => ({ ...f, email: authForm.email, candidate_name: authForm.email.split("@")[0] }));
      } else {
        if (authForm.password !== authForm.confirmPassword) {
          setAuthError("Passwords do not match.");
          return;
        }
        if (authForm.password.length < 6) {
          setAuthError("Password must be at least 6 characters.");
          return;
        }
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

  async function handleSubmitApplication() {
    if (!resumeFile) return;
    setUploadProgress(15);
    const result = await submitApplication({ job: Number(id), resume: resumeFile, ...form });
    setApplicationId(result.id);
    setUploadProgress(100);
    setStep(4);
    setAnalyzing(true);
    await new Promise((resolve) => setTimeout(resolve, 2200));
    const generated = await generateQuestions(result.id);
    setQuestions(generated.questions);
    setAnalyzing(false);
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

  const stepLabels = STEPS;

  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* Progress steps */}
        <div className="mb-10 flex flex-wrap gap-3">
          {stepLabels.map((label, index) => (
            <div
              key={label}
              className={`rounded-full px-4 py-2 text-sm font-medium ${step >= index + 1 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}
            >
              {index + 1}. {label}
            </div>
          ))}
        </div>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>{job ? `Apply for ${job.title}` : "Application"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* ── STEP 1: Auth gate ── */}
            {step === 1 && (
              <div className="mx-auto max-w-md space-y-5">
                <h2 className="text-xl font-semibold text-slate-900">
                  {isSignIn ? "Sign in to continue" : "Create an account to apply"}
                </h2>

                {!isSignIn && (
                  <div>
                    <Label className="mb-1 block">Full Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={authForm.name}
                      onChange={(e) => setAuthForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                )}

                <div>
                  <Label className="mb-1 block">Email</Label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={authForm.email}
                    onChange={(e) => setAuthForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div>
                  <Label className="mb-1 block">Password</Label>
                  <Input
                    type="password"
                    placeholder="Min. 6 characters"
                    value={authForm.password}
                    onChange={(e) => setAuthForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>

                {!isSignIn && (
                  <div>
                    <Label className="mb-1 block">Confirm Password</Label>
                    <Input
                      type="password"
                      placeholder="Re-enter password"
                      value={authForm.confirmPassword}
                      onChange={(e) => setAuthForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    />
                  </div>
                )}

                {authError && (
                  <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{authError}</p>
                )}

                <Button className="w-full" onClick={handleAuth} disabled={authLoading}>
                  {authLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSignIn ? "Sign In & Continue" : "Create Account & Continue"}
                </Button>

                <p className="text-center text-sm text-slate-500">
                  {isSignIn ? (
                    <>
                      Don&apos;t have an account?{" "}
                      <button
                        className="font-medium text-indigo-600 hover:underline"
                        onClick={() => { setIsSignIn(false); setAuthError(""); }}
                      >
                        Create one
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        className="font-medium text-indigo-600 hover:underline"
                        onClick={() => { setIsSignIn(true); setAuthError(""); }}
                      >
                        Sign in
                      </button>
                    </>
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
                    <Input
                      value={value}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <Button onClick={() => setStep(3)}>Continue to Resume</Button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Resume Upload ── */}
            {step === 3 && (
              <div className="space-y-5">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
                  <UploadCloud className="mb-4 h-10 w-10 text-indigo-600" />
                  <p className="text-lg font-medium text-slate-950">Upload resume</p>
                  <p className="mt-1 text-sm text-slate-500">PDF, DOC, or DOCX. Maximum size 5MB.</p>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {resumeFile && <p className="text-sm text-slate-600">Selected: {resumeFile.name}</p>}
                <Progress value={uploadProgress} />
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button onClick={handleSubmitApplication} disabled={!resumeFile}>
                    Submit & Start AI Review
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 4: AI Interview ── */}
            {step === 4 && analyzing && (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <Loader2 className="mb-4 h-10 w-10 animate-spin text-indigo-600" />
                <h3 className="text-2xl font-semibold text-slate-950">AI is analyzing your resume...</h3>
                <p className="mt-2 text-slate-500">Generating a role-specific interview based on your experience.</p>
              </div>
            )}

            {step === 4 && !analyzing && currentQuestion && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>Q{questionIndex + 1} of {questions.length}</span>
                    <span>{Math.round(interviewProgress)}%</span>
                  </div>
                  <Progress value={interviewProgress} />
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-semibold text-slate-950">{currentQuestion.prompt}</h3>
                  {currentQuestion.type === "mcq" ? (
                    <div className="space-y-3">
                      {currentQuestion.options?.map((option) => (
                        <label key={option} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 cursor-pointer hover:border-indigo-300">
                          <input
                            type="radio"
                            name={currentQuestion.id}
                            checked={answers[currentQuestion.id] === option}
                            onChange={() => setAnswers((a) => ({ ...a, [currentQuestion.id]: option }))}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : currentQuestion.type === "one_word" ? (
                    <Input
                      placeholder="Your answer"
                      value={answers[currentQuestion.id] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [currentQuestion.id]: e.target.value }))}
                    />
                  ) : (
                    <Textarea
                      className={currentQuestion.type === "coding" ? "font-mono" : ""}
                      placeholder="Write your answer here"
                      value={answers[currentQuestion.id] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [currentQuestion.id]: e.target.value }))}
                    />
                  )}
                </div>
                <Button onClick={handleNextQuestion} disabled={!answers[currentQuestion.id] || isPending}>
                  {questionIndex === questions.length - 1 ? "Submit Interview" : "Next Question"}
                </Button>
              </div>
            )}

            {/* ── STEP 5: Done ── */}
            {step === 5 && (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
                <h3 className="text-3xl font-semibold text-slate-950">Application submitted!</h3>
                <p className="mt-3 text-slate-500">Your application has been recorded and the AI report is ready for HR review.</p>
                <p className="mt-2 text-sm font-medium text-slate-700">Application ID: {applicationId}</p>
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

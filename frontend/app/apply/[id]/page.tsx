"use client";

import { Loader2, UploadCloud } from "lucide-react";
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

const steps = ["Personal Info", "Resume Upload", "AI Interview", "Done"];

export default function ApplyPage({ params }: { params: { id: string } }) {
  const [step, setStep] = useState(1);
  const [job, setJob] = useState<Job | null>(null);
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    candidate_name: "",
    email: "",
    phone: "",
    portfolio_url: "",
    github_url: "",
    linkedin_url: "",
  });

  useEffect(() => {
    getJob(params.id).then(setJob);
  }, [params.id]);

  const currentQuestion = questions[questionIndex];
  const interviewProgress = useMemo(
    () => (questions.length ? ((questionIndex + 1) / questions.length) * 100 : 0),
    [questionIndex, questions.length]
  );

  async function handleSubmitApplication() {
    if (!resumeFile) return;
    setUploadProgress(15);
    const result = await submitApplication({
      job: Number(params.id),
      resume: resumeFile,
      ...form,
    });
    setApplicationId(result.id);
    setUploadProgress(100);
    setStep(3);
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
      setStep(4);
      return;
    }
    startTransition(() => {
      setQuestionIndex((value) => value + 1);
    });
  }

  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10 flex flex-wrap gap-3">
          {steps.map((label, index) => (
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
            {step === 1 ? (
              <div className="grid gap-5 md:grid-cols-2">
                {Object.entries(form).map(([key, value]) => (
                  <div key={key} className={key === "linkedin_url" ? "md:col-span-2" : ""}>
                    <Label className="mb-2 block capitalize">{key.replaceAll("_", " ")}</Label>
                    <Input value={value} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <Button onClick={() => setStep(2)}>Continue to Resume</Button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
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
                {resumeFile ? <p className="text-sm text-slate-600">Selected file: {resumeFile.name}</p> : null}
                <Progress value={uploadProgress} />
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button onClick={handleSubmitApplication} disabled={!resumeFile}>
                    Submit and Start AI Review
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 3 && analyzing ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <Loader2 className="mb-4 h-10 w-10 animate-spin text-indigo-600" />
                <h3 className="text-2xl font-semibold text-slate-950">AI is analyzing your resume...</h3>
                <p className="mt-2 text-slate-500">Generating a role-specific interview based on your experience.</p>
              </div>
            ) : null}

            {step === 3 && !analyzing && currentQuestion ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>
                      Q{questionIndex + 1} of {questions.length}
                    </span>
                    <span>{Math.round(interviewProgress)}%</span>
                  </div>
                  <Progress value={interviewProgress} />
                </div>

                <div className="space-y-4">
                  <h3 className="text-2xl font-semibold text-slate-950">{currentQuestion.prompt}</h3>
                  {currentQuestion.type === "mcq" ? (
                    <div className="space-y-3">
                      {currentQuestion.options?.map((option) => (
                        <label key={option} className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                          <input
                            type="radio"
                            name={currentQuestion.id}
                            checked={answers[currentQuestion.id] === option}
                            onChange={() => setAnswers((current) => ({ ...current, [currentQuestion.id]: option }))}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : currentQuestion.type === "one_word" ? (
                    <Input
                      placeholder="Your answer"
                      value={answers[currentQuestion.id] ?? ""}
                      onChange={(e) => setAnswers((current) => ({ ...current, [currentQuestion.id]: e.target.value }))}
                    />
                  ) : (
                    <Textarea
                      className={currentQuestion.type === "coding" ? "font-mono" : ""}
                      placeholder="Write your answer here"
                      value={answers[currentQuestion.id] ?? ""}
                      onChange={(e) => setAnswers((current) => ({ ...current, [currentQuestion.id]: e.target.value }))}
                    />
                  )}
                </div>

                <Button onClick={handleNextQuestion} disabled={!answers[currentQuestion.id] || isPending}>
                  {questionIndex === questions.length - 1 ? "Submit Interview" : "Next Question"}
                </Button>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
                <h3 className="text-3xl font-semibold text-slate-950">Application submitted</h3>
                <p className="mt-3 text-slate-500">Your application has been recorded and the AI report is ready for HR review.</p>
                <p className="mt-2 text-sm font-medium text-slate-700">Application ID: {applicationId}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

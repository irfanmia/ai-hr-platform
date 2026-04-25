"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getJob, updateJob } from "@/lib/api";

export default function EditJobPage({ params }: { params: any }) {
  const resolvedParams = typeof params.then === "function" ? use(params) : params;
  const id = resolvedParams?.id ?? "";
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    title: "",
    department: "",
    location_type: "remote",
    experience_years_min: 1,
    experience_years_max: 3,
    skills: "",
    salary_min: 0,
    salary_max: 0,
    description: "",
    requirements: "",
    responsibilities: "",
    is_active: true,
    resume_match_weight: 50,
    interview_weight: 50,
    response_type: "text" as "text" | "video" | "video_preferred" | "candidate_choice",
    identity_snapshots_enabled: true,
  });

  useEffect(() => {
    getJob(id).then((job) => {
      setForm({
        title: job.title,
        department: job.department,
        location_type: job.location_type,
        experience_years_min: job.experience_years_min,
        experience_years_max: job.experience_years_max,
        skills: job.skills.join(", "),
        salary_min: job.salary_min ?? 0,
        salary_max: job.salary_max ?? 0,
        description: job.description,
        requirements: job.requirements,
        responsibilities: job.responsibilities,
        is_active: job.is_active,
        resume_match_weight: (job as any).resume_match_weight ?? 50,
        interview_weight: (job as any).interview_weight ?? 50,
        response_type: ((job as any).response_type ?? "text") as "text" | "video" | "video_preferred" | "candidate_choice",
        identity_snapshots_enabled: (job as any).identity_snapshots_enabled !== false,
      });
      setLoading(false);
    });
  }, [id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await updateJob(Number(id), {
      ...form,
      location_type: form.location_type as any,
      skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
      custom_fields: {},
      resume_match_weight: form.resume_match_weight,
      interview_weight: form.interview_weight,
      response_type: form.response_type,
      identity_snapshots_enabled: form.identity_snapshots_enabled,
    } as any);
    router.push("/dashboard/jobs");
  }

  if (loading) {
    return <Skeleton className="h-72 rounded-3xl" />;
  }

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Edit role</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
          {["title", "department", "location_type", "skills", "salary_min", "salary_max", "description", "requirements", "responsibilities"].map((field) => (
            <div key={field} className={["description", "requirements", "responsibilities"].includes(field) ? "md:col-span-2" : ""}>
              <Label className="mb-2 block capitalize">{field.replaceAll("_", " ")}</Label>
              {["description", "requirements", "responsibilities"].includes(field) ? (
                <Textarea value={String(form[field as keyof typeof form])} onChange={(e) => setForm((current) => ({ ...current, [field]: e.target.value }))} />
              ) : (
                <Input value={String(form[field as keyof typeof form])} onChange={(e) => setForm((current) => ({ ...current, [field]: e.target.value }))} />
              )}
            </div>
          ))}
          <div>
            <Label className="mb-2 block">Min experience</Label>
            <Input type="number" value={form.experience_years_min} onChange={(e) => setForm((current) => ({ ...current, experience_years_min: Number(e.target.value) }))} />
          </div>
          <div>
            <Label className="mb-2 block">Max experience</Label>
            <Input type="number" value={form.experience_years_max} onChange={(e) => setForm((current) => ({ ...current, experience_years_max: Number(e.target.value) }))} />
          </div>
          {/* Interview Response Mode */}
          <div className="md:col-span-2">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-emerald-900">Interview Response Mode</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  How should candidates answer interview questions? Changing this affects new applications only.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  { value: "text", label: "Text only", desc: "Classic textarea. Fastest for candidates." },
                  { value: "video", label: "Video interview", desc: "Camera on, audio recorded & transcribed. No video stored." },
                  { value: "video_preferred", label: "Video preferred", desc: "Candidate can switch to text if needed." },
                  { value: "candidate_choice", label: "Let candidate choose", desc: "Candidate picks once, before question 1." },
                ] as const).map((option) => {
                  const active = form.response_type === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, response_type: option.value as typeof f.response_type }))}
                      className={`text-left rounded-xl border p-3 transition-all ${
                        active
                          ? "border-emerald-500 bg-white ring-2 ring-emerald-500/30"
                          : "border-slate-200 bg-white/60 hover:border-emerald-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`grid h-4 w-4 place-items-center rounded-full border-2 ${
                            active ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"
                          }`}
                        >
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="text-sm font-medium text-slate-800">{option.label}</span>
                      </div>
                      <p className="mt-1 ml-6 text-xs text-slate-500">{option.desc}</p>
                    </button>
                  );
                })}
              </div>

              {form.response_type !== "text" && (
                <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-white p-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-emerald-600"
                    checked={form.identity_snapshots_enabled}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, identity_snapshots_enabled: e.target.checked }))
                    }
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800">Capture identity snapshots</p>
                    <p className="mt-0.5 text-slate-500">
                      Three random photos from the candidate&apos;s camera during the
                      interview. Disclosed to the candidate; auto-deleted on rejection.
                    </p>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Scoring Weights */}
          <div className="md:col-span-2">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-indigo-900">AI Scoring Weights</p>
                <p className="text-xs text-indigo-600 mt-0.5">Must add up to 100. Changing this affects new applications only.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Resume Match Weight (%)</label>
                  <input type="number" min={0} max={100}
                    value={form.resume_match_weight}
                    onChange={e => { const v = Math.min(100, Math.max(0, Number(e.target.value))); setForm(f => ({ ...f, resume_match_weight: v, interview_weight: 100 - v })); }}
                    className="flex h-10 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Interview Score Weight (%)</label>
                  <input type="number" min={0} max={100}
                    value={form.interview_weight}
                    onChange={e => { const v = Math.min(100, Math.max(0, Number(e.target.value))); setForm(f => ({ ...f, interview_weight: v, resume_match_weight: 100 - v })); }}
                    className="flex h-10 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="bg-indigo-500 transition-all" style={{ width: `${form.resume_match_weight}%` }} />
                <div className="bg-emerald-500 transition-all" style={{ width: `${form.interview_weight}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Resume: {form.resume_match_weight}%</span>
                <span>Interview: {form.interview_weight}%</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[{label:"Equal (50/50)",r:50,i:50},{label:"Resume-heavy (70/30)",r:70,i:30},{label:"Interview-heavy (30/70)",r:30,i:70}].map(p => (
                  <button key={p.label} type="button"
                    onClick={() => setForm(f => ({ ...f, resume_match_weight: p.r, interview_weight: p.i }))}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      form.resume_match_weight === p.r ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-indigo-400"
                    }`}>{p.label}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

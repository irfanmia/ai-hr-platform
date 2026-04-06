"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createJob } from "@/lib/api";

export default function NewJobPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    department: "",
    location_type: "remote",
    experience_years_min: 1,
    experience_years_max: 3,
    skills: "Python, Communication",
    salary_min: 60000,
    salary_max: 90000,
    description: "",
    requirements: "",
    responsibilities: "",
    resume_match_weight: 50,
    interview_weight: 50,
  });

  const weightError = form.resume_match_weight + form.interview_weight !== 100;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (weightError) return;
    await createJob({
      ...form,
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      custom_fields: {},
      is_active: true,
    });
    router.push("/dashboard/jobs");
  }

  const set = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Create a new role</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>

          {/* Basic fields */}
          <div>
            <Label className="mb-2 block">Job Title</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Software Engineer" required />
          </div>
          <div>
            <Label className="mb-2 block">Department</Label>
            <Input value={form.department} onChange={e => set("department", e.target.value)} placeholder="e.g. Engineering" required />
          </div>
          <div>
            <Label className="mb-2 block">Location Type</Label>
            <select
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={form.location_type}
              onChange={e => set("location_type", e.target.value)}
            >
              <option value="remote">Remote</option>
              <option value="onsite">Onsite</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div>
            <Label className="mb-2 block">Required Skills (comma-separated)</Label>
            <Input value={form.skills} onChange={e => set("skills", e.target.value)} placeholder="Python, Django, React" />
          </div>
          <div>
            <Label className="mb-2 block">Min Experience (years)</Label>
            <Input type="number" min={0} value={form.experience_years_min} onChange={e => set("experience_years_min", Number(e.target.value))} />
          </div>
          <div>
            <Label className="mb-2 block">Max Experience (years)</Label>
            <Input type="number" min={0} value={form.experience_years_max} onChange={e => set("experience_years_max", Number(e.target.value))} />
          </div>
          <div>
            <Label className="mb-2 block">Salary Min ($)</Label>
            <Input type="number" value={form.salary_min} onChange={e => set("salary_min", Number(e.target.value))} />
          </div>
          <div>
            <Label className="mb-2 block">Salary Max ($)</Label>
            <Input type="number" value={form.salary_max} onChange={e => set("salary_max", Number(e.target.value))} />
          </div>

          {/* Text areas */}
          <div className="md:col-span-2">
            <Label className="mb-2 block">Job Description</Label>
            <Textarea rows={5} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Describe the role, company, and team..." />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-2 block">Requirements</Label>
            <Textarea rows={5} value={form.requirements} onChange={e => set("requirements", e.target.value)} placeholder="List qualifications, experience, and skills required..." />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-2 block">Responsibilities</Label>
            <Textarea rows={5} value={form.responsibilities} onChange={e => set("responsibilities", e.target.value)} placeholder="List day-to-day responsibilities..." />
          </div>

          {/* ── Scoring Weights ── */}
          <div className="md:col-span-2">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-indigo-900">AI Scoring Weights</p>
                <p className="text-xs text-indigo-600 mt-0.5">
                  Set how much each component contributes to the candidate&apos;s final score. Must add up to 100.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-2 block text-sm font-medium text-slate-700">
                    Resume Match Weight (%)
                    <span className="ml-1 font-normal text-slate-400">— how well resume fits job requirements</span>
                  </Label>
                  <Input
                    type="number" min={0} max={100}
                    value={form.resume_match_weight}
                    onChange={e => {
                      const v = Math.min(100, Math.max(0, Number(e.target.value)));
                      set("resume_match_weight", v);
                      set("interview_weight", 100 - v);
                    }}
                    className="border-indigo-200 bg-white"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Evaluates: skills overlap, years of experience, education/certifications vs job requirements
                  </p>
                </div>
                <div>
                  <Label className="mb-2 block text-sm font-medium text-slate-700">
                    Interview Score Weight (%)
                    <span className="ml-1 font-normal text-slate-400">— quality of AI interview answers</span>
                  </Label>
                  <Input
                    type="number" min={0} max={100}
                    value={form.interview_weight}
                    onChange={e => {
                      const v = Math.min(100, Math.max(0, Number(e.target.value)));
                      set("interview_weight", v);
                      set("resume_match_weight", 100 - v);
                    }}
                    className="border-indigo-200 bg-white"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Evaluates: answer quality, depth, relevance to role, communication clarity
                  </p>
                </div>
              </div>

              {/* Visual weight bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Resume Match: {form.resume_match_weight}%</span>
                  <span>Interview: {form.interview_weight}%</span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="bg-indigo-500 transition-all" style={{ width: `${form.resume_match_weight}%` }} />
                  <div className="bg-emerald-500 transition-all" style={{ width: `${form.interview_weight}%` }} />
                </div>
                {weightError && (
                  <p className="text-xs font-medium text-red-500">⚠️ Weights must add up to exactly 100 (currently {form.resume_match_weight + form.interview_weight})</p>
                )}
                {!weightError && (
                  <p className="text-xs text-indigo-600">✓ Weights add up to 100</p>
                )}
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-500 self-center">Presets:</span>
                {[
                  { label: "Equal (50/50)", r: 50, i: 50 },
                  { label: "Resume-heavy (70/30)", r: 70, i: 30 },
                  { label: "Interview-heavy (30/70)", r: 30, i: 70 },
                  { label: "Resume only (100/0)", r: 100, i: 0 },
                  { label: "Interview only (0/100)", r: 0, i: 100 },
                ].map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => { set("resume_match_weight", preset.r); set("interview_weight", preset.i); }}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      form.resume_match_weight === preset.r && form.interview_weight === preset.i
                        ? "border-indigo-500 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white text-slate-600 hover:border-indigo-400"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex gap-3">
            <Button type="submit" disabled={weightError}>Create Job</Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

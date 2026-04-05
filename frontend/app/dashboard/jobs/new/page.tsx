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
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await createJob({
      ...form,
      skills: form.skills.split(",").map((skill) => skill.trim()),
      custom_fields: {},
      is_active: true,
    });
    router.push("/dashboard/jobs");
  }

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Create a new role</CardTitle>
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
          <div className="md:col-span-2">
            <Button type="submit">Create job</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

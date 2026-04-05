"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getJob, updateJob } from "@/lib/api";

export default function EditJobPage({ params }: { params: any }) {
  const id = params.id;
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
      });
      setLoading(false);
    });
  }, [id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await updateJob(Number(id), {
      ...form,
      skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
      custom_fields: {},
    });
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
          <div className="md:col-span-2">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

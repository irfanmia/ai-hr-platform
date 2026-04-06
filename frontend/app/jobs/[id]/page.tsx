"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { PublicNav } from "@/components/public-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getJob } from "@/lib/api";
import type { Job } from "@/lib/types";

export default function JobDetailPage({ params }: { params: any }) {
  const resolvedParams = typeof params.then === "function" ? use(params) : params;
  const id = resolvedParams?.id ?? "";
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadJob() {
      setLoading(true);
      try {
        const data = await getJob(id);
        setJob(data);
      } finally {
        setLoading(false);
      }
    }
    loadJob();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <PublicNav />
        <div className="mx-auto max-w-7xl px-6 py-12">
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="min-h-screen">
      <PublicNav />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1fr_320px]">
        <section className="space-y-8">
          <div className="space-y-4">
            <Badge>{job.location_type}</Badge>
            <div>
              <h1 className="text-4xl font-semibold text-slate-950">{job.title}</h1>
              <p className="mt-2 text-lg text-slate-600">{job.department}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-slate-600">{job.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-slate-600">{job.requirements}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Responsibilities</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-slate-600">{job.responsibilities}</p>
            </CardContent>
          </Card>
        </section>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <Card className="rounded-3xl">
            <CardContent className="space-y-5 p-6">
              <div>
                <p className="text-sm text-slate-500">Location</p>
                <p className="font-medium text-slate-950 capitalize">{job.location_type}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Experience</p>
                <p className="font-medium text-slate-950">
                  {job.experience_years_min}-{job.experience_years_max} years
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Salary</p>
                <p className="font-medium text-slate-950">
                  {job.salary_min && job.salary_max ? `$${job.salary_min.toLocaleString()} - $${job.salary_max.toLocaleString()}` : "Competitive"}
                </p>
              </div>
              <Button asChild className="h-12 w-full rounded-xl">
                <Link href={`/apply/${job.id}`}>Apply Now</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}

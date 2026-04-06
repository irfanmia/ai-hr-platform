"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Job } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api";

function decodeJwt(token: string) {
  try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); }
  catch { return null; }
}

type AppStatus = {
  applied: boolean;
  application_id?: number;
  status?: string;
  has_report?: boolean;
  has_resume?: boolean;
};

export function JobCard({ job }: { job: Job }) {
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("candidate_access_token");
    if (!token) return;
    const payload = decodeJwt(token);
    if (!payload || payload.is_staff || payload.is_superuser) return;

    fetch(`${API}/dashboard/my-applications/job/${job.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAppStatus(data); })
      .catch(() => {});
  }, [job.id]);

  const isCompleted = appStatus?.applied && appStatus?.has_report;
  const isInProgress = appStatus?.applied && !appStatus?.has_report;

  return (
    <Card className="overflow-hidden border-slate-200 bg-white transition hover:shadow-md">
      <CardContent className="space-y-5 p-6">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-slate-950">{job.title}</h3>
              <p className="text-sm text-slate-500">{job.department}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge>{job.location_type}</Badge>
              {isCompleted && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">✓ Applied</span>
              )}
              {isInProgress && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">In Progress</span>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-600">
            {job.experience_years_min}–{job.experience_years_max} years · {job.salary_min && job.salary_max ? `$${(job.salary_min / 1000).toFixed(0)}K–$${(job.salary_max / 1000).toFixed(0)}K` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {job.skills.slice(0, 3).map((skill) => (
            <Badge key={skill} variant="secondary">{skill}</Badge>
          ))}
          {job.skills.length > 3 && (
            <Badge variant="secondary">+{job.skills.length - 3} more</Badge>
          )}
        </div>

        <div className="flex gap-3">
          {isCompleted ? (
            <>
              <Button asChild variant="outline" className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                <Link href={`/my-dashboard`}>View Application</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href={`/jobs/${job.id}`}>View Role</Link>
              </Button>
            </>
          ) : isInProgress ? (
            <>
              <Button asChild className="flex-1 bg-amber-500 hover:bg-amber-600">
                <Link href={`/apply/${job.id}`}>Continue Application →</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href={`/jobs/${job.id}`}>View Role</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild className="flex-1">
                <Link href={`/apply/${job.id}`}>Apply Now</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href={`/jobs/${job.id}`}>View Role</Link>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

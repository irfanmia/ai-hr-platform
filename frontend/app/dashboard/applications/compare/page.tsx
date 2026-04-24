"use client";

/**
 * /dashboard/applications/compare?ids=1,2,3
 *
 * Side-by-side AI reports for up to 4 candidates. Pure frontend — fetches
 * each application via the existing getDashboardApplication endpoint.
 * Read-only. Any status changes go through the detail view as today.
 *
 * Layout: single horizontal-scroll row on mobile, 2/3/4 columns on wider
 * screens. Each column shows the same set of sections in the same order
 * so a recruiter can scan left/right cleanly.
 */

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboardApplication } from "@/lib/api";
import type { Application } from "@/lib/types";

function scoreTone(score: number | null | undefined) {
  if (score == null) return { bg: "bg-slate-100", text: "text-slate-500" };
  if (score >= 78) return { bg: "bg-emerald-100", text: "text-emerald-700" };
  if (score >= 62) return { bg: "bg-amber-100", text: "text-amber-700" };
  return { bg: "bg-red-100", text: "text-red-700" };
}

function recommendationTone(rec: string | undefined) {
  if (rec === "Strong Hire") return "bg-emerald-600 text-white";
  if (rec === "Consider") return "bg-amber-500 text-white";
  if (rec === "Reject") return "bg-red-500 text-white";
  return "bg-slate-300 text-slate-700";
}

function CandidateColumn({ app }: { app: Application }) {
  const report = app.ai_report;
  const score = app.ai_score;
  const tone = scoreTone(score);

  return (
    <Card className="flex min-w-[260px] flex-1 flex-col rounded-3xl border-slate-200">
      <CardContent className="space-y-4 p-5">
        {/* Header */}
        <div>
          <p className="text-xs text-slate-500">{app.job?.title ?? "Role"}</p>
          <h3 className="truncate text-lg font-semibold text-slate-950">{app.candidate_name}</h3>
          <p className="text-xs text-slate-400">Applied {new Date(app.created_at).toLocaleDateString()}</p>
        </div>

        {/* Overall score */}
        <div className={`rounded-2xl p-4 text-center ${tone.bg}`}>
          <p className={`text-xs font-medium uppercase tracking-wider ${tone.text}`}>Overall</p>
          <p className={`text-4xl font-bold ${tone.text}`}>{score ?? "—"}</p>
          <p className="text-xs text-slate-500">out of 100</p>
        </div>

        {/* Recommendation badge */}
        {report?.recommendation && (
          <div className="flex justify-center">
            <span className={`rounded-full px-4 py-1 text-sm font-semibold ${recommendationTone(report.recommendation)}`}>
              {report.recommendation}
            </span>
          </div>
        )}

        {/* Resume vs performance */}
        {report && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Resume vs Performance</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-slate-500">Resume</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, report.resume_strength_score ?? 0))}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-medium text-slate-700">{report.resume_strength_score ?? 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs text-slate-500">Interview</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, report.actual_performance_score ?? 0))}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-medium text-slate-700">{report.actual_performance_score ?? 0}</span>
              </div>
            </div>
            {report.gap_analysis && (
              <p className="text-xs text-slate-500">
                Gap: <span className={report.gap_analysis.type === "positive" ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                  {report.gap_analysis.type === "positive" ? "+" : ""}{report.gap_analysis.score_difference}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Key skills breakdown (top 4) */}
        {report?.skill_breakdown && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Top skills</p>
            <div className="space-y-1.5">
              {Object.entries(report.skill_breakdown)
                .sort(([, a], [, b]) => Number(b) - Number(a))
                .slice(0, 4)
                .map(([skill, value]) => {
                  const v = Number(value);
                  const col = v >= 80 ? "bg-emerald-500" : v >= 60 ? "bg-amber-500" : "bg-red-400";
                  return (
                    <div key={skill} className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0 truncate text-slate-600">{skill}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full ${col}`} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
                      </div>
                      <span className="w-6 text-right font-medium text-slate-700">{v}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Strengths */}
        {report?.strengths && report.strengths.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-emerald-700">Strengths</p>
            <ul className="space-y-0.5 text-xs text-slate-600">
              {report.strengths.slice(0, 3).map((s) => <li key={s}>• {s}</li>)}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {report?.weaknesses && report.weaknesses.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-red-700">Weaknesses</p>
            <ul className="space-y-0.5 text-xs text-slate-600">
              {report.weaknesses.slice(0, 3).map((s) => <li key={s}>• {s}</li>)}
            </ul>
          </div>
        )}

        {/* Status + deep link */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
            {app.status}
          </span>
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/applications/${app.id}`}>Open →</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ComparePageInner() {
  const params = useSearchParams();
  const idsParam = params.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 4); // hard cap at 4 to keep layout readable

  const [apps, setApps] = useState<(Application | null)[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length === 0) {
      setApps([]);
      return;
    }
    let cancelled = false;
    Promise.all(ids.map((id) => getDashboardApplication(id).catch(() => null))).then((results) => {
      if (cancelled) return;
      setApps(results);
      if (results.every((r) => r === null)) setError("Couldn't load any of the selected applications.");
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  const loadedApps = (apps ?? []).filter((a): a is Application => a != null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard/applications"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600"
          >
            <ArrowLeft className="h-4 w-4" /> Back to applications
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Compare candidates {loadedApps.length > 0 && `(${loadedApps.length})`}
          </h1>
          <p className="text-sm text-slate-500">
            Side-by-side AI reports for the candidates you selected.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print
        </Button>
      </div>

      {ids.length === 0 && (
        <Card className="rounded-3xl">
          <CardContent className="px-6 py-10 text-center text-sm text-slate-500">
            No applications selected. Go back to{" "}
            <Link href="/dashboard/applications" className="font-medium text-indigo-600 hover:underline">
              Applications
            </Link>{" "}
            and tick at least two rows with a generated report.
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Cards */}
      {apps === null && ids.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ids.map((id) => (
            <Skeleton key={id} className="h-96 rounded-3xl" />
          ))}
        </div>
      )}
      {apps !== null && loadedApps.length > 0 && (
        <div className="flex flex-col gap-4 overflow-x-auto md:grid md:grid-cols-2 lg:grid-cols-4">
          {loadedApps.map((app) => (
            <CandidateColumn key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
      <ComparePageInner />
    </Suspense>
  );
}

"use client";

/**
 * Card that renders a candidate's application with a visual status timeline,
 * AI score preview, and context-appropriate action buttons.
 *
 * Layout:
 *   - Top row: job title/dept, status pill, date
 *   - Status timeline: Applied → Screening → Interview → Decision (4 stages)
 *   - AI score preview (compact ring) when available
 *   - CTAs: Continue (if unfinished), View report (if complete)
 */

import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  FileText,
  Sparkles,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ApplicationStatus } from "@/lib/types";

// Narrow shape we actually need — the backend returns the full Application but
// we only want a few fields, and older rows might miss some.
export interface ApplicationLite {
  id: number;
  status: ApplicationStatus | string;
  ai_score?: number | null;
  ai_report?: unknown;
  created_at: string;
  job?: {
    id: number;
    title?: string;
    department?: string;
    location_type?: string;
  } | null;
}

// ─── Timeline stages ──────────────────────────────────────────────────────

type Stage = {
  id: "applied" | "screening" | "interview" | "decision";
  label: string;
  hint: string;
};

const STAGES: Stage[] = [
  { id: "applied", label: "Applied", hint: "Application submitted" },
  { id: "screening", label: "AI Interview", hint: "Answering questions" },
  { id: "interview", label: "Review", hint: "HR reviewing your report" },
  { id: "decision", label: "Decision", hint: "Final outcome" },
];

/**
 * Map backend status → the most-forward stage the application has *reached*.
 * Candidates see progress moving forward; they don't see 'rejected' as a
 * separate bucket — they see all stages completed, with the Decision stage
 * coloured red.
 */
function stageReached(app: ApplicationLite): number {
  const status = app.status;
  if (status === "shortlisted" || status === "rejected") return 3; // decision made
  if (app.ai_report) return 2; // screening done, awaiting HR review
  if (status === "screening") return 2;
  // status === "new" or anything we don't recognise
  return app.ai_report ? 2 : 1;
}

function decisionTone(status: string): "positive" | "negative" | "neutral" {
  if (status === "shortlisted") return "positive";
  if (status === "rejected") return "negative";
  return "neutral";
}

// ─── Status pill ──────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  new: { bg: "bg-blue-100", text: "text-blue-700", label: "New" },
  screening: { bg: "bg-amber-100", text: "text-amber-700", label: "Screening" },
  shortlisted: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Shortlisted" },
  rejected: { bg: "bg-red-100", text: "text-red-700", label: "Not selected" },
};

// ─── Score ring (compact, inline) ─────────────────────────────────────────

function CompactScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (clamped / 100) * circumference;
  const tone =
    clamped >= 78 ? "#10b981"
    : clamped >= 62 ? "#f59e0b"
    : "#ef4444";
  return (
    <div className="relative grid h-14 w-14 place-items-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="18" stroke="#e2e8f0" strokeWidth="4" fill="none" />
        <circle
          cx="22" cy="22" r="18" stroke={tone} strokeWidth="4" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="relative text-[11px] font-semibold text-slate-900">{clamped}</div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────

export function ApplicationCard({ app }: { app: ApplicationLite }) {
  const reached = stageReached(app);
  const tone = decisionTone(String(app.status));
  const pill = STATUS_STYLES[String(app.status)] ?? {
    bg: "bg-slate-100",
    text: "text-slate-600",
    label: String(app.status),
  };
  const unfinished = !app.ai_report;

  return (
    <Card className="overflow-hidden rounded-3xl border-slate-200 bg-white transition hover:shadow-md">
      <CardContent className="space-y-5 p-5">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-slate-950">
              {app.job?.title ?? "Untitled role"}
            </h3>
            <p className="text-xs text-slate-500">
              {app.job?.department}
              {app.job?.location_type ? ` · ${app.job.location_type}` : ""} ·
              Applied {new Date(app.created_at).toLocaleDateString()}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${pill.bg} ${pill.text}`}>
            {pill.label}
          </span>
        </div>

        {/* ── Timeline ── */}
        <div>
          <div className="relative flex items-center">
            {STAGES.map((stage, i) => {
              const isDone = i < reached;
              const isActive = i === reached;
              const isFinalDecision = stage.id === "decision" && reached >= 3;
              const finalNegative = isFinalDecision && tone === "negative";
              const finalPositive = isFinalDecision && tone === "positive";
              return (
                <div key={stage.id} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`grid h-7 w-7 place-items-center rounded-full border-2 transition-colors ${
                        finalNegative
                          ? "border-red-500 bg-red-500 text-white"
                          : finalPositive
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : isDone
                          ? "border-indigo-500 bg-indigo-500 text-white"
                          : isActive
                          ? "border-indigo-500 bg-white text-indigo-600"
                          : "border-slate-200 bg-white text-slate-300"
                      }`}
                      aria-current={isActive ? "step" : undefined}
                    >
                      {finalNegative ? (
                        <XCircle className="h-4 w-4" />
                      ) : isDone || finalPositive ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isActive ? (
                        <Clock className="h-3.5 w-3.5" />
                      ) : (
                        <Circle className="h-3 w-3" />
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-medium uppercase tracking-wider ${
                        isActive ? "text-indigo-600" : isDone ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {i < STAGES.length - 1 && (
                    <div
                      className={`mx-1 h-[2px] flex-1 rounded-full transition-colors ${
                        i < reached - 1 || (i === reached - 1 && !isActive)
                          ? "bg-indigo-500"
                          : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Action row ── */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-3">
            {typeof app.ai_score === "number" && (
              <>
                <CompactScoreRing score={app.ai_score} />
                <div className="text-xs text-slate-500">
                  <p className="font-medium text-slate-700">AI score</p>
                  <p>Out of 100</p>
                </div>
              </>
            )}
            {app.ai_score == null && unfinished && (
              <p className="inline-flex items-center gap-1.5 text-xs text-amber-700">
                <Sparkles className="h-3.5 w-3.5" />
                Your AI interview is waiting for you
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {unfinished && app.job?.id && (
              <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600">
                <Link href={`/apply/${app.job.id}`}>
                  Continue <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            {!unfinished && app.job?.id && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/apply/${app.job.id}`}>
                  <FileText className="mr-1 h-3.5 w-3.5" /> View
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

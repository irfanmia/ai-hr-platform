"use client";

import { CheckCircle2, ChevronDown, Download, FileText, MessageSquareText, Printer } from "lucide-react";
import { use, useEffect, useRef, useState } from "react";

import { ClaimValidationList } from "@/components/claim-validation-list";
import { ScoreGauge } from "@/components/score-gauge";
import { SkillRadar } from "@/components/skill-radar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadApplicationPdf, getDashboardApplication, updateApplicationStatus } from "@/lib/api";
import type { Application, ApplicationStatus } from "@/lib/types";

type PdfKind = "responses" | "report" | "combined";

export default function ApplicationDetailPage({ params }: { params: any }) {
  const resolvedParams = typeof params.then === "function" ? use(params) : params;
  const id = resolvedParams?.id ?? "";
  const [application, setApplication] = useState<Application | null>(null);
  const [status, setStatus] = useState<ApplicationStatus>("new");
  const printRef = useRef<HTMLDivElement>(null);
  const [showResponses, setShowResponses] = useState(false);
  const [downloading, setDownloading] = useState<PdfKind | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);

  async function handleDownload(kind: PdfKind) {
    if (!application) return;
    setDownloading(kind);
    setDownloadOpen(false);
    try {
      await downloadApplicationPdf(application.id, kind);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("PDF download failed:", err);
      alert("Couldn't generate that PDF. Try again or check the server logs.");
    } finally {
      setDownloading(null);
    }
  }

  useEffect(() => {
    getDashboardApplication(id).then((data) => {
      setApplication(data);
      setStatus(data.status);
    });
  }, [id]);

  function handlePrintReport() {
    window.print();
  }

  async function handleDownloadResume() {
    if (!application?.resume_url) return;
    try {
      // Fetch the resume through our proxy to avoid CORS/mixed content
      const proxyUrl = application.resume_url.replace(
        /^https?:\/\/[^/]+/,
        ""
      );
      const res = await fetch(proxyUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = application.resume_url.split(".").pop() || "pdf";
      a.download = `${application.candidate_name.replace(/\s+/g, "_")}_resume.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(application.resume_url, "_blank");
    }
  }

  if (!application) {
    return <Skeleton className="h-96 rounded-3xl" />;
  }

  const report = application.ai_report;
  const appliedDate = new Date(application.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  });

  return (
    <>
      {/* Print styles — produce a clean A4 PDF */}
      <style>{`
        @media print {
          /* Hide the whole UI shell and only show the report */
          body * { visibility: hidden; }
          #printable-report, #printable-report * { visibility: visible; }
          #printable-report { position: absolute; left: 0; top: 0; width: 100%; }

          /* No interactive chrome in the print output */
          .no-print { display: none !important; }

          /* Every card stays together on its own page when possible */
          #printable-report [data-print-block] {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          /* Card borders print faintly instead of at screen weight */
          #printable-report .rounded-3xl {
            border-color: #cbd5e1 !important;
            box-shadow: none !important;
          }

          /* Strip coloured backgrounds that don't print well */
          #printable-report .bg-emerald-50\\/30,
          #printable-report .bg-red-50\\/30 {
            background: transparent !important;
          }

          /* Collapse empty space at the bottom of each card */
          #printable-report .space-y-6 > * + * { margin-top: 12mm !important; }

          /* A4 margins */
          @page { margin: 18mm; }
          @page:first { margin-top: 12mm; }
        }
      `}</style>

      {/* Action buttons — top right */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-end gap-3">
        <Button
          variant={showResponses ? "default" : "outline"}
          size="sm"
          onClick={() => setShowResponses((v) => !v)}
        >
          <MessageSquareText className="mr-2 h-4 w-4" />
          {showResponses ? "Hide responses" : "View responses"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadResume} disabled={!application.resume_url}>
          <FileText className="mr-2 h-4 w-4" />
          Resume only
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrintReport} disabled={!report}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>

        {/* Download dropdown — Responses / Report / Everything */}
        <div className="relative">
          <Button
            size="sm"
            onClick={() => setDownloadOpen((v) => !v)}
            disabled={downloading !== null}
          >
            <Download className="mr-2 h-4 w-4" />
            {downloading
              ? `Generating ${downloading}…`
              : "Download PDF"}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
          {downloadOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
              <button
                onClick={() => handleDownload("responses")}
                className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-slate-50"
                disabled={!report}
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Responses only</p>
                  <p className="text-xs text-slate-500">Q&amp;A in text form</p>
                </div>
              </button>
              <button
                onClick={() => handleDownload("report")}
                className="flex w-full items-start gap-2 border-t border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                disabled={!report}
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">AI report only</p>
                  <p className="text-xs text-slate-500">Score, gaps, recommendation</p>
                </div>
              </button>
              <button
                onClick={() => handleDownload("combined")}
                className="flex w-full items-start gap-2 border-t border-slate-100 bg-indigo-50/40 px-4 py-3 text-left hover:bg-indigo-50"
                disabled={!report}
              >
                <Download className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Everything (one PDF)</p>
                  <p className="text-xs text-slate-500">Resume + responses + report, merged</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Inline responses viewer (HR can read Q&A without downloading) ── */}
      {showResponses && (() => {
        const stored = (application.custom_answers as any) || {};
        const qs: any[] = stored.questions || [];
        const ans: Record<string, string> = stored.submitted_answers || {};
        const evalData = stored.evaluation || {};
        const scoredById: Record<string, number> = Object.fromEntries(
          (evalData.scored_answers || []).map((s: any) => [s.question_id, s.score])
        );
        const TYPE_LABEL: Record<string, string> = {
          descriptive: "Descriptive",
          scenario: "Scenario",
          coding: "Coding",
          mcq: "Multiple choice",
          one_word: "One word",
        };
        return (
          <Card className="no-print mb-6 rounded-3xl border-indigo-100">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Interview responses ({qs.length})</span>
                <span className="text-xs font-normal text-slate-500">
                  Scores shown are per-question (out of 100)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {qs.length === 0 && (
                <p className="text-sm text-slate-500">
                  No questions were generated for this application.
                </p>
              )}
              {qs.map((q, idx) => {
                const a = (ans[q.id] || "").trim();
                const isSilent = !a || a === "[no response]";
                const isCode = q.type === "coding";
                const score = scoredById[q.id];
                return (
                  <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs uppercase tracking-wider text-slate-500">
                        Q{idx + 1} · {TYPE_LABEL[q.type] ?? q.type}
                      </div>
                      {typeof score === "number" && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            score >= 78 ? "bg-emerald-100 text-emerald-700"
                            : score >= 62 ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                          }`}
                        >
                          {score}/100
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-900">{q.prompt}</p>
                    {q.type === "mcq" && Array.isArray(q.options) && (
                      <ul className="mt-2 ml-4 list-disc text-xs text-slate-500">
                        {q.options.map((opt: string) => (
                          <li key={opt} className={a === opt ? "font-semibold text-slate-800" : ""}>
                            {opt}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Answer
                      </p>
                      {isSilent ? (
                        <p className="mt-1 italic rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          No response — candidate did not answer this question.
                        </p>
                      ) : isCode ? (
                        <pre className="mt-1 overflow-x-auto rounded-xl bg-slate-900 px-3 py-2 font-mono text-xs leading-5 text-emerald-50">
                          {a}
                        </pre>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800">
                          {a}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })()}

      <div id="printable-report" ref={printRef}>

        {/* Print header — only visible when printing */}
        <div className="hidden print:block mb-8 border-b pb-6">
          <h1 className="text-2xl font-bold text-slate-900">AI HR Platform — Candidate Report</h1>
          <p className="text-sm text-slate-500 mt-1">Generated on {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">

          {/* Left: Candidate Profile */}
          <Card className="rounded-3xl h-fit">
            <CardHeader>
              <CardTitle>Candidate Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-2xl font-semibold text-slate-950">{application.candidate_name}</p>
                <p className="text-sm text-slate-500">{application.email}</p>
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                {application.phone && <p><span className="font-medium">Phone:</span> {application.phone}</p>}
                <p><span className="font-medium">Role:</span> {application.job.title}</p>
                <p><span className="font-medium">Department:</span> {application.job.department}</p>
                <p><span className="font-medium">Applied:</span> {appliedDate}</p>
                {application.portfolio_url && (
                  <p><span className="font-medium">Portfolio:</span>{" "}
                    <a href={application.portfolio_url} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">{application.portfolio_url}</a>
                  </p>
                )}
                {application.github_url && (
                  <p><span className="font-medium">GitHub:</span>{" "}
                    <a href={application.github_url} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">{application.github_url}</a>
                  </p>
                )}
                {application.linkedin_url && (
                  <p><span className="font-medium">LinkedIn:</span>{" "}
                    <a href={application.linkedin_url} className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">{application.linkedin_url}</a>
                  </p>
                )}
              </div>

              {/* Resume download in card (no-print) */}
              {application.resume_url && (
                <button
                  className="no-print flex w-full items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
                  onClick={handleDownloadResume}
                >
                  <FileText className="h-4 w-4" />
                  Download Resume
                </button>
              )}

              {/* Status selector (no-print) */}
              <div className="no-print">
                <p className="mb-2 text-sm font-medium text-slate-700">Application Status</p>
                <Select value={status} onValueChange={(v) => setStatus(v as ApplicationStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["new", "screening", "shortlisted", "rejected"].map((item) => (
                      <SelectItem key={item} value={item}>{item}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="mt-3 w-full" onClick={() => updateApplicationStatus(application.id, status).then(setApplication)}>
                  Save Status
                </Button>
              </div>

              {/* Print-only status */}
              <div className="hidden print:block">
                <p className="text-sm font-medium text-slate-700">Status: <span className="capitalize">{application.status}</span></p>
              </div>
            </CardContent>
          </Card>

          {/* Right: AI Report */}
          {report ? (
            <div className="space-y-6">

              {/* Score + Performance */}
              <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
                <Card className="rounded-3xl">
                  <CardContent className="flex flex-col items-center p-6">
                    <ScoreGauge score={report.overall_score} />
                    <p className="mt-2 text-sm text-slate-500">Overall AI Score</p>
                  </CardContent>
                </Card>
                <Card className="rounded-3xl">
                  <CardHeader><CardTitle>Performance Comparison</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: "Resume Strength", value: report.resume_strength_score, color: "bg-slate-500" },
                      { label: "Actual Performance", value: report.actual_performance_score, color: "bg-indigo-600" },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="mb-1 flex justify-between text-sm text-slate-600">
                          <span>{item.label}</span>
                          <span className="font-semibold">{item.value}/100</span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-100">
                          <div className={`h-3 rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Gap Analysis */}
              <Card
                data-print-block
                className={`rounded-3xl border-2 ${report.gap_analysis?.type === "positive" ? "border-emerald-300 bg-emerald-50/30" : "border-red-300 bg-red-50/30"}`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Gap Analysis
                    <Badge className={report.gap_analysis?.type === "positive" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                      {report.gap_analysis?.type === "positive" ? `+${report.gap_analysis?.score_difference} pts above resume` : `${report.gap_analysis?.score_difference} pts below resume`}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700">{report.gap_analysis?.explanation}</p>
                </CardContent>
              </Card>

              {/* Skill breakdown: radar chart + bars fallback for < 3 skills */}
              <Card className="rounded-3xl" data-print-block>
                <CardHeader><CardTitle>Skill Breakdown</CardTitle></CardHeader>
                <CardContent>
                  {(() => {
                    const entries = Object.entries(report.skill_breakdown || {}).map(
                      ([label, value]) => ({ label, value: Number(value) }),
                    );
                    // Sort by value desc so the strongest skills are on the "top"
                    entries.sort((a, b) => b.value - a.value);

                    if (entries.length >= 3) {
                      return (
                        <div className="grid gap-6 md:grid-cols-[1fr_200px]">
                          <SkillRadar data={entries} />
                          {/* Companion list for quick numeric read */}
                          <div className="space-y-2">
                            {entries.slice(0, 8).map((e) => {
                              const col =
                                e.value >= 80 ? "bg-emerald-500"
                                : e.value >= 60 ? "bg-amber-500"
                                : "bg-red-400";
                              return (
                                <div key={e.label} className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="truncate text-slate-600">{e.label}</span>
                                    <span className="font-semibold text-slate-800">{e.value}</span>
                                  </div>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                    <div className={`h-full ${col}`} style={{ width: `${Math.max(0, Math.min(100, e.value))}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    // Fewer than 3 skills — fall back to horizontal bars
                    return (
                      <div className="space-y-3">
                        {entries.map((e) => {
                          const col =
                            e.value >= 80 ? "bg-emerald-500"
                            : e.value >= 60 ? "bg-amber-500"
                            : "bg-red-400";
                          return (
                            <div key={e.label}>
                              <div className="mb-1 flex justify-between text-sm text-slate-600">
                                <span>{e.label}</span>
                                <span className="font-semibold">{e.value}%</span>
                              </div>
                              <div className="h-2.5 rounded-full bg-slate-100">
                                <div className={`h-2.5 rounded-full ${col}`} style={{ width: `${e.value}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Claim validation — expandable rows */}
              {report.claim_validation?.length > 0 && (
                <Card className="rounded-3xl" data-print-block>
                  <CardHeader>
                    <CardTitle className="flex items-baseline gap-2">
                      Claim Validation
                      <span className="text-xs font-normal text-slate-400">
                        Click a row to see the evidence
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ClaimValidationList claims={report.claim_validation} />
                  </CardContent>
                </Card>
              )}

              {/* Key findings + Behavioral */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-3xl">
                  <CardHeader><CardTitle>Key Findings</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {(report.key_findings || []).map((finding: string) => (
                      <div key={finding} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                        <p className="text-sm text-slate-700">{finding}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-3xl">
                  <CardHeader><CardTitle>Behavioral Insights</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(report.behavioral_insights || {}).map(([label, value]) => (
                      <div key={label}>
                        <div className="mb-1 flex justify-between text-sm text-slate-600">
                          <span className="capitalize">{label.replaceAll("_", " ")}</span>
                          <span className="font-semibold">{String(value)}%</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100">
                          <div className="h-2.5 rounded-full bg-indigo-500" style={{ width: `${value}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Strengths & Weaknesses */}
              {(report.strengths?.length > 0 || report.weaknesses?.length > 0) && (
                <div className="grid gap-6 lg:grid-cols-2">
                  {report.strengths?.length > 0 && (
                    <Card className="rounded-3xl border-emerald-200">
                      <CardHeader><CardTitle className="text-emerald-700">Strengths</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {report.strengths.map((s: string) => (
                          <div key={s} className="flex items-center gap-2 text-sm text-slate-700">
                            <span className="text-emerald-500">✓</span> {s}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  {report.weaknesses?.length > 0 && (
                    <Card className="rounded-3xl border-red-200">
                      <CardHeader><CardTitle className="text-red-600">Areas to Improve</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {report.weaknesses.map((w: string) => (
                          <div key={w} className="flex items-center gap-2 text-sm text-slate-700">
                            <span className="text-red-400">→</span> {w}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Recommendation */}
              <Card className="rounded-3xl" data-print-block>
                <CardHeader><CardTitle>AI Recommendation</CardTitle></CardHeader>
                <CardContent className="flex items-center gap-4">
                  <span className={`rounded-2xl px-6 py-3 text-lg font-bold ${
                    report.recommendation === "Strong Hire" ? "bg-emerald-100 text-emerald-700" :
                    report.recommendation === "Consider" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>{report.recommendation}</span>
                  <div className="no-print flex gap-2">
                    <Button size="sm" onClick={handlePrintReport}>
                      <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>

            </div>
          ) : (
            <Card className="rounded-3xl">
              <CardContent className="p-6 text-slate-500">AI report not generated yet. The candidate may not have completed the interview.</CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

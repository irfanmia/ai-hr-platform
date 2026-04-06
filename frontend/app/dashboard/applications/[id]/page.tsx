"use client";

import { CheckCircle2, Download, FileText, Printer } from "lucide-react";
import { use, useEffect, useRef, useState } from "react";

import { ScoreGauge } from "@/components/score-gauge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDashboardApplication, updateApplicationStatus } from "@/lib/api";
import type { Application, ApplicationStatus } from "@/lib/types";

export default function ApplicationDetailPage({ params }: { params: any }) {
  const resolvedParams = typeof params.then === "function" ? use(params) : params;
  const id = resolvedParams?.id ?? "";
  const [application, setApplication] = useState<Application | null>(null);
  const [status, setStatus] = useState<ApplicationStatus>("new");
  const printRef = useRef<HTMLDivElement>(null);

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
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-report, #printable-report * { visibility: visible; }
          #printable-report { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          @page { margin: 20mm; }
        }
      `}</style>

      {/* Action buttons — top right */}
      <div className="no-print mb-4 flex justify-end gap-3">
        <Button variant="outline" size="sm" onClick={handleDownloadResume} disabled={!application.resume_url}>
          <FileText className="mr-2 h-4 w-4" />
          Download Resume
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrintReport} disabled={!report}>
          <Printer className="mr-2 h-4 w-4" />
          Print Report
        </Button>
        <Button size="sm" onClick={handlePrintReport} disabled={!report}>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </div>

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
              <Card className={`rounded-3xl border-2 ${report.gap_analysis?.type === "positive" ? "border-emerald-300 bg-emerald-50/30" : "border-red-300 bg-red-50/30"}`}>
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

              {/* Skill heatmap */}
              <Card className="rounded-3xl">
                <CardHeader><CardTitle>Skill Breakdown</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(report.skill_breakdown || {}).map(([skill, value]) => (
                    <div key={skill}>
                      <div className="mb-1 flex justify-between text-sm text-slate-600">
                        <span>{skill}</span>
                        <span className="font-semibold">{String(value)}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100">
                        <div
                          className={`h-2.5 rounded-full ${Number(value) >= 80 ? "bg-emerald-500" : Number(value) >= 60 ? "bg-amber-500" : "bg-red-400"}`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Claim validation */}
              {report.claim_validation?.length > 0 && (
                <Card className="rounded-3xl">
                  <CardHeader><CardTitle>Claim Validation</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Claim</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Evidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.claim_validation.map((claim: any) => (
                          <TableRow key={claim.claim}>
                            <TableCell className="text-sm">{claim.claim}</TableCell>
                            <TableCell>
                              <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                                claim.status === "verified" ? "bg-emerald-100 text-emerald-700" :
                                claim.status === "partial" ? "bg-amber-100 text-amber-700" :
                                "bg-red-100 text-red-700"
                              }`}>{claim.status}</span>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">{claim.evidence}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
              <Card className="rounded-3xl">
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

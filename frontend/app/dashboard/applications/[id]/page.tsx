"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import { ScoreGauge } from "@/components/score-gauge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDashboardApplication, updateApplicationStatus } from "@/lib/api";
import type { Application, ApplicationStatus } from "@/lib/types";

export default function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const [application, setApplication] = useState<Application | null>(null);
  const [status, setStatus] = useState<ApplicationStatus>("new");

  useEffect(() => {
    getDashboardApplication(params.id).then((data) => {
      setApplication(data);
      setStatus(data.status);
    });
  }, [params.id]);

  if (!application) {
    return <Skeleton className="h-96 rounded-3xl" />;
  }

  const report = application.ai_report;

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Candidate Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="text-2xl font-semibold text-slate-950">{application.candidate_name}</p>
            <p className="text-sm text-slate-500">{application.email}</p>
          </div>
          <div className="space-y-1 text-sm text-slate-600">
            <p>Phone: {application.phone}</p>
            <p>Role: {application.job.title}</p>
            {application.resume_url ? (
              <a className="font-medium text-indigo-600" href={application.resume_url} target="_blank" rel="noreferrer">
                Download resume
              </a>
            ) : null}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Status</p>
            <Select value={status} onValueChange={(value) => setStatus(value as ApplicationStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["new", "screening", "shortlisted", "rejected"].map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="mt-3 w-full" onClick={() => updateApplicationStatus(application.id, status).then(setApplication)}>
              Save status
            </Button>
          </div>
        </CardContent>
      </Card>

      {report ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <Card className="rounded-3xl">
              <CardContent className="flex justify-center p-6">
                <ScoreGauge score={report.overall_score} />
              </CardContent>
            </Card>
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle>Performance comparison</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Resume Strength", value: report.resume_strength_score },
                  { label: "Actual Performance", value: report.actual_performance_score },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex justify-between text-sm text-slate-600">
                      <span>{item.label}</span>
                      <span>{item.value}</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100">
                      <div className="h-3 rounded-full bg-indigo-600" style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className={`rounded-3xl border-2 ${report.gap_analysis.type === "positive" ? "border-emerald-300" : "border-red-300"}`}>
            <CardHeader>
              <CardTitle>Gap Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">{report.gap_analysis.explanation}</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Skill heatmap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(report.skill_breakdown).map(([skill, value]) => (
                <div key={skill}>
                  <div className="mb-2 flex justify-between text-sm text-slate-600">
                    <span>{skill}</span>
                    <span>{value}</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div
                      className={`h-3 rounded-full ${value > 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Claim validation</CardTitle>
            </CardHeader>
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
                  {report.claim_validation.map((claim) => (
                    <TableRow key={claim.claim}>
                      <TableCell>{claim.claim}</TableCell>
                      <TableCell>
                        <Badge variant={claim.status === "verified" ? "success" : claim.status === "partial" ? "warning" : "destructive"}>
                          {claim.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{claim.evidence}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle>Key findings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.key_findings.map((finding) => (
                  <div key={finding} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
                    <p className="text-slate-700">{finding}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle>Behavioral insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(report.behavioral_insights).map(([label, value]) => (
                  <div key={label}>
                    <div className="mb-2 flex justify-between text-sm text-slate-600">
                      <span className="capitalize">{label.replaceAll("_", " ")}</span>
                      <span>{value}</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100">
                      <div className="h-3 rounded-full bg-indigo-600" style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Recommendation</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={report.recommendation === "Strong Hire" ? "success" : report.recommendation === "Consider" ? "warning" : "destructive"}>
                {report.recommendation}
              </Badge>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="rounded-3xl">
          <CardContent className="p-6 text-slate-500">AI report not generated yet.</CardContent>
        </Card>
      )}
    </div>
  );
}

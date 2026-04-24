"use client";

import { CheckCircle2, ChevronDown, ChevronUp, Download, GitCompare, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDashboardApplications, getJobs, updateApplicationStatus } from "@/lib/api";
import type { Application, ApplicationStatus, Job } from "@/lib/types";

type SortField = "name" | "score" | "date";
type SortDir = "asc" | "desc";

export default function DashboardApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState({ job: "all", status: "all", date_from: "", date_to: "" });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "date", dir: "desc" });
  const [bulkBusy, setBulkBusy] = useState<null | "shortlist" | "reject">(null);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  useEffect(() => { getJobs().then(setJobs); }, []);

  useEffect(() => {
    getDashboardApplications({
      job: filters.job === "all" ? undefined : filters.job,
      status: filters.status === "all" ? undefined : filters.status,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
    }).then((rows) => {
      setApplications(rows);
      // Drop any selection whose row no longer appears (filter changed)
      setSelected((prev) => {
        const visible = new Set(rows.map((r) => r.id));
        const next = new Set<number>();
        prev.forEach((id) => { if (visible.has(id)) next.add(id); });
        return next;
      });
    });
  }, [filters]);

  // ── Sorted rows ──────────────────────────────────────────────────────────
  const sortedRows = useMemo(() => {
    const arr = [...applications];
    arr.sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      if (sort.field === "name") { va = a.candidate_name ?? ""; vb = b.candidate_name ?? ""; }
      else if (sort.field === "score") { va = a.ai_score ?? -1; vb = b.ai_score ?? -1; }
      else { va = a.created_at; vb = b.created_at; }
      const cmp = va > vb ? 1 : va < vb ? -1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [applications, sort]);

  function toggleSort(field: SortField) {
    setSort((s) => s.field === field ? { field, dir: s.dir === "asc" ? "desc" : "asc" } : { field, dir: "desc" });
  }

  // ── Selection helpers ────────────────────────────────────────────────────
  const allVisible = sortedRows.map((r) => r.id);
  const allChecked = allVisible.length > 0 && allVisible.every((id) => selected.has(id));
  const someChecked = allVisible.some((id) => selected.has(id));

  function toggleRow(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (allChecked) return new Set();
      const next = new Set(prev);
      allVisible.forEach((id) => next.add(id));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setBulkMsg(null);
  }

  // ── Bulk status update ───────────────────────────────────────────────────
  async function bulkUpdateStatus(status: ApplicationStatus) {
    if (selected.size === 0) return;
    setBulkBusy(status === "shortlisted" ? "shortlist" : "reject");
    setBulkMsg(null);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(ids.map((id) => updateApplicationStatus(id, status)));
    const failed = results.filter((r) => r.status === "rejected").length;
    const ok = results.length - failed;
    setApplications((prev) =>
      prev.map((a) => selected.has(a.id) && failed === 0 ? { ...a, status } : a),
    );
    setBulkBusy(null);
    setBulkMsg(
      failed === 0
        ? `Updated ${ok} application${ok !== 1 ? "s" : ""} to ${status}.`
        : `Updated ${ok}, ${failed} failed. Try again for the failures.`,
    );
  }

  // ── CSV export (client-side) ─────────────────────────────────────────────
  function exportSelectedAsCsv() {
    const rows = sortedRows.filter((r) => selected.has(r.id));
    if (rows.length === 0) return;
    const header = ["ID", "Name", "Email", "Job", "Status", "AI Score", "Applied"];
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = rows.map((r) => [
      r.id,
      r.candidate_name,
      r.email,
      r.job?.title ?? "",
      r.status,
      r.ai_score ?? "",
      new Date(r.created_at).toISOString().slice(0, 10),
    ].map(escape).join(","));
    const csv = [header.join(","), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applications_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── Compare URL ──────────────────────────────────────────────────────────
  // Only applications with a generated report are worth comparing; we pass
  // the ones with ai_report. Capped at 4 to fit side-by-side on desktop.
  const comparableIds = sortedRows
    .filter((r) => selected.has(r.id) && r.ai_report != null)
    .map((r) => r.id)
    .slice(0, 4);
  const compareUrl = `/dashboard/applications/compare?ids=${comparableIds.join(",")}`;

  // ── Sort-header helper ───────────────────────────────────────────────────
  function SortHeader({ field, children }: { field: SortField; children: React.ReactNode }) {
    const active = sort.field === field;
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={`inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider ${
          active ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        {children}
        {active ? (
          sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    );
  }

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Applications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filter bar */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <Label className="mb-2 block">Job</Label>
            <Select value={filters.job} onValueChange={(value) => setFilters((c) => ({ ...c, job: value }))}>
              <SelectTrigger><SelectValue placeholder="All jobs" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All jobs</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={String(job.id)}>{job.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Status</Label>
            <Select value={filters.status} onValueChange={(value) => setFilters((c) => ({ ...c, status: value }))}>
              <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["new", "screening", "shortlisted", "rejected"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">From</Label>
            <Input type="date" value={filters.date_from} onChange={(e) => setFilters((c) => ({ ...c, date_from: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-2 block">To</Label>
            <Input type="date" value={filters.date_to} onChange={(e) => setFilters((c) => ({ ...c, date_to: e.target.value }))} />
          </div>
        </div>

        {/* Bulk toolbar — shows only when selection exists */}
        {selected.size > 0 && (
          <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-indigo-900">
              <span className="font-semibold">{selected.size}</span> selected
              <button onClick={clearSelection} className="text-xs text-indigo-600 hover:underline">
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={bulkBusy !== null}
                onClick={() => bulkUpdateStatus("shortlisted")}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                {bulkBusy === "shortlist" ? "Shortlisting…" : "Shortlist"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
                disabled={bulkBusy !== null}
                onClick={() => bulkUpdateStatus("rejected")}
              >
                <XCircle className="mr-1 h-4 w-4" />
                {bulkBusy === "reject" ? "Rejecting…" : "Reject"}
              </Button>
              <Button size="sm" variant="outline" onClick={exportSelectedAsCsv}>
                <Download className="mr-1 h-4 w-4" />
                Export CSV
              </Button>
              {comparableIds.length >= 2 && (
                <Button asChild size="sm" variant="outline" className="border-indigo-300 text-indigo-700 hover:bg-indigo-100">
                  <Link href={compareUrl}>
                    <GitCompare className="mr-1 h-4 w-4" />
                    Compare ({comparableIds.length})
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
        {bulkMsg && (
          <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            {bulkMsg}
          </div>
        )}

        <div className="overflow-x-auto -mx-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allChecked}
                    indeterminate={!allChecked && someChecked}
                    onCheckedChange={() => toggleAll()}
                    aria-label="Select all rows"
                  />
                </TableHead>
                <TableHead><SortHeader field="name">Name</SortHeader></TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead><SortHeader field="score">Score</SortHeader></TableHead>
                <TableHead>Status</TableHead>
                <TableHead><SortHeader field="date">Date</SortHeader></TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((application) => {
                const isSelected = selected.has(application.id);
                return (
                  <TableRow
                    key={application.id}
                    data-state={isSelected ? "selected" : undefined}
                    className={isSelected ? "bg-indigo-50/50" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(application.id)}
                        aria-label={`Select application from ${application.candidate_name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">{application.candidate_name}</TableCell>
                    <TableCell>{application.job.title}</TableCell>
                    <TableCell>
                      {application.ai_score != null ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          application.ai_score >= 78 ? "bg-emerald-100 text-emerald-700"
                          : application.ai_score >= 62 ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                        }`}>
                          {application.ai_score}
                        </span>
                      ) : <span className="text-slate-400">Pending</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={application.status === "shortlisted" ? "success" : application.status === "rejected" ? "destructive" : "warning"}>
                        {application.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(application.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/applications/${application.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                    No applications match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

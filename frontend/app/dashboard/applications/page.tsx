"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDashboardApplications, getJobs } from "@/lib/api";
import type { Application, Job } from "@/lib/types";

export default function DashboardApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState({
    job: "all",
    status: "all",
    date_from: "",
    date_to: "",
  });

  useEffect(() => {
    getJobs().then(setJobs);
  }, []);

  useEffect(() => {
    getDashboardApplications({
      job: filters.job === "all" ? undefined : filters.job,
      status: filters.status === "all" ? undefined : filters.status,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
    }).then(setApplications);
  }, [filters]);

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Applications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <Label className="mb-2 block">Job</Label>
            <Select value={filters.job} onValueChange={(value) => setFilters((current) => ({ ...current, job: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All jobs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All jobs</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={String(job.id)}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Status</Label>
            <Select value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["new", "screening", "shortlisted", "rejected"].map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">From</Label>
            <Input type="date" value={filters.date_from} onChange={(e) => setFilters((current) => ({ ...current, date_from: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-2 block">To</Label>
            <Input type="date" value={filters.date_to} onChange={(e) => setFilters((current) => ({ ...current, date_to: e.target.value }))} />
          </div>
        </div>

        <div className="overflow-x-auto -mx-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Job Title</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((application) => (
              <TableRow key={application.id}>
                <TableCell>{application.candidate_name}</TableCell>
                <TableCell>{application.job.title}</TableCell>
                <TableCell>{application.ai_score ?? "Pending"}</TableCell>
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
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

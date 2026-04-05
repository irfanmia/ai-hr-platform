"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteJob, getJobs, updateJob } from "@/lib/api";
import type { Job } from "@/lib/types";

export default function DashboardJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);

  async function loadJobs() {
    const data = await getJobs();
    setJobs(data);
  }

  useEffect(() => {
    loadJobs();
  }, []);

  return (
    <Card className="rounded-3xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Job management</CardTitle>
        <Button asChild>
          <Link href="/dashboard/jobs/new">Create job</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Applications</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-slate-900">{job.title}</p>
                    <p className="text-xs text-slate-500">{job.department}</p>
                  </div>
                </TableCell>
                <TableCell>{job.applications_count}</TableCell>
                <TableCell>
                  <Badge variant={job.is_active ? "success" : "secondary"}>{job.is_active ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/jobs/${job.id}/edit`}>Edit</Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => updateJob(job.id, { is_active: !job.is_active }).then(loadJobs)}>
                      Toggle
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteJob(job.id).then(loadJobs)}>
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDashboardStats } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";

const statConfig = [
  { key: "total_applications", label: "Total Applications" },
  { key: "new_today", label: "New Today" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "average_score", label: "Average Score" },
] as const;

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    getDashboardStats().then(setStats);
  }, []);

  if (!stats) {
    return <Skeleton className="h-72 rounded-3xl" />;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-600">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Recruiting overview</h1>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {statConfig.map(({ key, label }) => (
          <Card key={key} className="rounded-3xl">
            <CardContent className="p-6">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-3 text-4xl font-semibold text-slate-950">{stats[key]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent applications</CardTitle>
          <Link href="/dashboard/applications" className="text-sm font-medium text-indigo-600">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recent_applications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell>{application.candidate_name}</TableCell>
                  <TableCell>{application.job.title}</TableCell>
                  <TableCell>
                    <Badge variant={application.status === "shortlisted" ? "success" : application.status === "rejected" ? "destructive" : "warning"}>
                      {application.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{application.ai_score ?? "Pending"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

/**
 * /saved — shows the jobs the candidate has bookmarked.
 *
 * Data flow:
 *   1. Read saved job IDs from useSavedJobs() (localStorage)
 *   2. Fetch each job's full details from GET /jobs/:id/
 *   3. Render with the existing <JobCard/> so the bookmark/apply state
 *      stays consistent with the /jobs page
 *
 * Empty state shows a friendly call to action pointing back to /jobs.
 */

import { Bookmark } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { JobCard } from "@/components/job-card";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getJob } from "@/lib/api";
import { useSavedJobs } from "@/lib/saved-jobs";
import type { Job } from "@/lib/types";

export default function SavedJobsPage() {
  const { saved } = useSavedJobs();
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (saved.size === 0) {
        setJobs([]);
        return;
      }
      const ids = Array.from(saved);
      const results = await Promise.allSettled(ids.map((id) => getJob(id)));
      if (cancelled) return;
      const ok = results
        .filter((r): r is PromiseFulfilledResult<Job> => r.status === "fulfilled")
        .map((r) => r.value);
      setJobs(ok);
    }
    load();
    return () => { cancelled = true; };
  }, [saved]);

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-100 text-indigo-600">
            <Bookmark className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Saved jobs</h1>
            <p className="text-sm text-slate-500">
              Jobs you&apos;ve bookmarked to come back to later.
            </p>
          </div>
        </div>

        {jobs === null ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-3xl" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-slate-400">
              <Bookmark className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">No saved jobs yet</h2>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Click the bookmark icon on any job card to save it here for later.
            </p>
            <Button asChild className="mt-6">
              <Link href="/jobs">Browse open roles</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

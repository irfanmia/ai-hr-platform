"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";

import { BrandWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { clearCandidate } from "@/lib/auth-store";
import { useSavedJobs } from "@/lib/saved-jobs";
import { useAuth } from "@/lib/use-auth";

export function PublicNav() {
  const { isCandidateLoggedIn, candidate } = useAuth();
  const { count: savedCount } = useSavedJobs();
  const candidateName = isCandidateLoggedIn
    ? candidate?.name || candidate?.email?.split("@")[0] || "Me"
    : null;

  function handleLogout() {
    clearCandidate();
    window.location.href = "/jobs";
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/jobs" aria-label="HireParrot home">
          <BrandWordmark size="md" />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/jobs" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">
            Jobs
          </Link>
          {savedCount > 0 && (
            <Link
              href="/saved"
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-indigo-100 hover:text-indigo-700"
              aria-label={`Saved jobs (${savedCount})`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Saved <span className="font-semibold">{savedCount}</span>
            </Link>
          )}
          {candidateName ? (
            <>
              <Link href="/my-dashboard" className="text-sm font-medium text-indigo-600 hover:underline">
                My Dashboard
              </Link>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Sign Out
              </Button>
            </>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

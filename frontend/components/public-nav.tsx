"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { clearCandidate } from "@/lib/auth-store";
import { useAuth } from "@/lib/use-auth";

export function PublicNav() {
  const { isCandidateLoggedIn, candidate } = useAuth();
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
        <Link href="/jobs" className="text-lg font-semibold text-slate-950">
          AI HR Platform
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/jobs" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">
            Jobs
          </Link>
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

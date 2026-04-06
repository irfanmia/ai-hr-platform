"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

function decodeJwt(token: string) {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return null; }
}

export function PublicNav() {
  const [candidateName, setCandidateName] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("candidate_access_token");
    if (token) {
      const payload = decodeJwt(token);
      if (payload && !payload.is_staff && !payload.is_superuser) {
        setCandidateName(payload.email?.split("@")[0] || "Me");
      }
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("candidate_access_token");
    setCandidateName(null);
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

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { clearHr } from "@/lib/auth-store";
import { useAuth } from "@/lib/use-auth";

/**
 * Gate for the HR dashboard. Ensures the visitor has a valid HR token
 * (JWT carries `is_staff=true`). If not, redirects to /login with a reason.
 *
 * Note: this only checks the token's claims, not its signature. The server
 * rejects tampered/expired tokens on every request, and the 401 interceptor
 * logs the user out on second-auth-failure.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { state, hr } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!state.hrAccess) {
      router.replace("/login");
      return;
    }
    if (!hr || (!hr.is_staff && !hr.is_superuser)) {
      // Candidate token sneaked in somehow — scrub and redirect
      clearHr("hr_logged_out");
      router.replace("/login?error=not_staff");
      return;
    }
    setReady(true);
  }, [router, state.hrAccess, hr]);

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-50 p-6">
        <Skeleton className="h-24 w-full max-w-md rounded-2xl" />
      </div>
    );
  }

  return <>{children}</>;
}

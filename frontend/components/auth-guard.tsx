"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

function decodeJwt(token: string): Record<string, any> | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded;
  } catch {
    return null;
  }
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("hr_access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    // Decode JWT and check is_staff
    const payload = decodeJwt(token);
    if (!payload || (!payload.is_staff && !payload.is_superuser)) {
      // Candidate account — redirect to jobs with message
      localStorage.removeItem("hr_access_token");
      localStorage.removeItem("hr_refresh_token");
      router.replace("/login?error=not_staff");
      return;
    }

    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-slate-50 p-6">
        <Skeleton className="h-24 w-full max-w-md rounded-2xl" />
      </div>
    );
  }

  return <>{children}</>;
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("hr_access_token");
    if (!token) {
      router.replace("/login");
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

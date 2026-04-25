"use client";

/**
 * Route-level error boundary. Next.js auto-mounts this whenever a React
 * component inside the app/ tree throws during render. Without this, a
 * single bug turns the whole page into a white screen.
 *
 * The `reset` callback re-runs the last render — useful for transient
 * errors like a flaky fetch.
 */

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production this is where we'd ship to Sentry/GlitchTip. For now we
    // keep the console log so devs see the full trace in the browser.
    // eslint-disable-next-line no-console
    console.error("[app/error.tsx] Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <Card className="w-full max-w-lg rounded-3xl border-red-200 bg-white">
        <CardContent className="space-y-5 p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Something went wrong</h2>
            <p className="mt-2 text-sm text-slate-500">
              We hit an unexpected error rendering this page. It&apos;s been logged, and you can
              usually recover by retrying.
            </p>
          </div>
          {error?.digest && (
            <p className="mx-auto inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-mono text-slate-500">
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => reset()} className="inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = "/")}>
              Go home
            </Button>
          </div>
          <p className="text-xs text-slate-400">
            If this keeps happening, email{" "}
            <a href="mailto:support@hireparrot.com" className="text-indigo-600 hover:underline">
              support@hireparrot.com
            </a>{" "}
            with the error ID above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

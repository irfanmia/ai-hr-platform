"use client";

/**
 * /verify-email?token=<token> — finalises a candidate signup.
 *
 * The signup flow emails this URL (with a one-time token in the query
 * string). Hitting it calls the backend, which marks the user active
 * and returns JWT tokens. We stash the tokens in the auth store and
 * forward the user to /my-dashboard so they land already-logged-in.
 *
 * Expired/invalid tokens fall back to a "request a new one" panel that
 * lets the user resubmit their email.
 */
import { CheckCircle2, Loader2, Mail, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { resendVerificationEmail, verifyEmailToken } from "@/lib/api";
import { setCandidateTokens } from "@/lib/auth-store";

type State =
  | { kind: "verifying" }
  | { kind: "success"; email: string }
  | { kind: "expired" }
  | { kind: "missing-token" }
  | { kind: "error"; message: string };

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [state, setState] = useState<State>({ kind: "verifying" });

  // Resend form (only used in expired / error states)
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => {
    if (!token) {
      setState({ kind: "missing-token" });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await verifyEmailToken(token);
        if (cancelled) return;
        setCandidateTokens(data.access, data.refresh);
        setState({ kind: "success", email: data.user.email });
        // Brief pause so the user sees the success state, then forward
        setTimeout(() => router.push("/my-dashboard"), 1500);
      } catch (err) {
        if (cancelled) return;
        const e = err as { response?: { status?: number; data?: { detail?: string } } };
        const detail = e?.response?.data?.detail ?? "";
        if (e?.response?.status === 400 && /expired|invalid/i.test(detail)) {
          setState({ kind: "expired" });
        } else {
          setState({
            kind: "error",
            message: detail || "We couldn't verify your email. Please try again.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  async function handleResend() {
    if (!resendEmail.includes("@")) return;
    setResendStatus("sending");
    try {
      await resendVerificationEmail(resendEmail);
      setResendStatus("sent");
    } catch {
      setResendStatus("idle");
    }
  }

  return (
    <Card className="rounded-3xl shadow-sm">
      <CardContent className="space-y-4 py-10 text-center">
        {state.kind === "verifying" && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-emerald-600" />
            <h1 className="text-lg font-semibold text-slate-900">Verifying your email…</h1>
            <p className="text-sm text-slate-500">Just a moment.</p>
          </>
        )}

        {state.kind === "success" && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-lg font-semibold text-slate-900">You're verified!</h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Welcome to HireParrot. Taking you to your dashboard…
            </p>
            <p className="text-xs text-slate-400">
              If nothing happens,{" "}
              <Link href="/my-dashboard" className="font-medium text-indigo-600 hover:underline">
                continue manually
              </Link>.
            </p>
          </>
        )}

        {state.kind === "missing-token" && (
          <>
            <Mail className="mx-auto h-12 w-12 text-slate-400" />
            <h1 className="text-lg font-semibold text-slate-900">No token in this link</h1>
            <p className="text-sm leading-relaxed text-slate-600">
              The verification link looks incomplete. Try clicking the link in your email
              again, or sign up if you haven't yet.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button asChild variant="outline">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </div>
          </>
        )}

        {(state.kind === "expired" || state.kind === "error") && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h1 className="text-lg font-semibold text-slate-900">
              {state.kind === "expired" ? "Link expired" : "Verification failed"}
            </h1>
            <p className="text-sm leading-relaxed text-slate-600">
              {state.kind === "expired"
                ? "That link has expired. Verification links are valid for 24 hours — request a fresh one below."
                : (state as { kind: "error"; message: string }).message}
            </p>

            {resendStatus === "sent" ? (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                ✓ If an account exists for that email, a fresh verification link is on its way.
              </p>
            ) : (
              <div className="space-y-3 pt-2">
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="text-center"
                />
                <Button
                  type="button"
                  className="w-full"
                  disabled={resendStatus === "sending" || !resendEmail.includes("@")}
                  onClick={handleResend}
                >
                  {resendStatus === "sending" ? "Sending…" : "Send new verification email"}
                </Button>
              </div>
            )}

            <p className="pt-2 text-xs text-slate-400">
              Already verified?{" "}
              <Link href="/login" className="font-medium text-indigo-600 hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[calc(100vh-65px)] bg-slate-50 px-6 py-12">
        <div className="mx-auto w-full max-w-md space-y-4">
          <Suspense
            fallback={
              <Card className="rounded-3xl shadow-sm">
                <CardContent className="py-12 text-center">
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-600" />
                </CardContent>
              </Card>
            }
          >
            <VerifyEmailInner />
          </Suspense>
        </div>
      </main>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyLoginError, login } from "@/lib/api";
import { decodeJwt, getAuthState, setCandidateTokens, setHrTokens } from "@/lib/auth-store";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api";

interface RegisterResponse {
  /** New verification flow returns this instead of JWT tokens. */
  verification_required?: boolean;
  email?: string;
  message?: string;
  /** Legacy auto-login response (for accounts that pre-date the gate). */
  access?: string;
  refresh?: string;
}

async function registerCandidate(
  name: string, email: string, password: string,
): Promise<RegisterResponse> {
  const res = await fetch(`${API}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  return data;
}

async function resendVerification(email: string): Promise<void> {
  await fetch(`${API}/auth/resend-verification/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

function LoginSignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // "login-candidate" | "signup"
  const [mode, setMode] = useState<"login-hr" | "login-candidate" | "signup">("login-candidate");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // After a successful signup we swap the form for a "check your email"
  // panel; null means still on the form. Stores the email so the resend
  // button knows where to send.
  const [verifySent, setVerifySent] = useState<string | null>(null);
  // Set when login fails because the candidate hasn't verified yet — lets
  // us show the "Resend verification email" button inline.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => {
    if (searchParams.get("error") === "not_staff") {
      setError("That account doesn't have HR access. Log in as a candidate below.");
      setMode("login-candidate");
    }
    // If already signed in as candidate → go to my-dashboard
    const { candidateAccess } = getAuthState();
    if (candidateAccess) {
      const p = decodeJwt(candidateAccess);
      if (p && !p.is_staff) router.replace("/my-dashboard");
    }
  }, [searchParams, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setUnverifiedEmail(null); setLoading(true);

    try {
      if (mode === "signup") {
        if (!name.trim()) { setError("Please enter your full name."); return; }
        if (password !== confirmPassword) { setError("Passwords do not match."); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
        const data = await registerCandidate(name, email, password);

        // New flow: backend sent a verification email; show the
        // check-your-inbox panel instead of auto-logging in.
        if (data.verification_required) {
          setVerifySent(email);
          return;
        }

        // Legacy / pre-verification accounts may still come back with
        // an immediate JWT — keep the auto-login path for those.
        if (data.access && data.refresh) {
          setCandidateTokens(data.access, data.refresh);
          router.push("/my-dashboard");
        }

      } else if (mode === "login-candidate") {
        const tokens = await login(email, password);
        const payload = decodeJwt(tokens.access);
        if (payload?.is_staff || payload?.is_superuser) {
          // Oops — HR user logged into candidate form
          setHrTokens(tokens.access, tokens.refresh);
          router.push("/dashboard");
        } else {
          setCandidateTokens(tokens.access, tokens.refresh);
          router.push("/my-dashboard");
        }

      } else {
        // HR login
        const tokens = await login(email, password);
        const payload = decodeJwt(tokens.access);
        if (!payload?.is_staff && !payload?.is_superuser) {
          setError("This is for HR administrators only. Use 'Candidate Login' below.");
          return;
        }
        setHrTokens(tokens.access, tokens.refresh);
        router.push("/dashboard");
      }
    } catch (err) {
      // SimpleJWT returns "no_active_account" + 401 when is_active=False —
      // surface a verification-specific error with a resend button.
      const msg = friendlyLoginError(err);
      const e = err as { response?: { data?: { detail?: string; code?: string } } };
      const detail = e?.response?.data?.detail ?? "";
      const code = e?.response?.data?.code ?? "";
      const isUnverified =
        code === "no_active_account" ||
        /no active account/i.test(detail) ||
        /not active/i.test(detail);
      if (isUnverified && mode !== "login-hr") {
        setError("Please verify your email before signing in.");
        setUnverifiedEmail(email);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(targetEmail: string) {
    setResendStatus("sending");
    try {
      await resendVerification(targetEmail);
      setResendStatus("sent");
    } catch {
      setResendStatus("idle");
      setError("Couldn't send the verification email. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <div className="flex min-h-[calc(100vh-65px)] items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-4">

          {/* Tab switcher — candidates only */}
          <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => { setMode("login-candidate"); setError(""); }}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${mode === "login-candidate" ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:text-slate-900"}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("signup"); setError(""); }}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${mode === "signup" ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:text-slate-900"}`}
            >
              Sign Up
            </button>
          </div>

          <Card className="rounded-3xl shadow-sm">
            {verifySent ? (
              <CardContent className="space-y-4 py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">📧</div>
                <h2 className="text-lg font-semibold text-slate-900">Check your inbox</h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  We've sent a verification link to{" "}
                  <span className="font-medium text-slate-900">{verifySent}</span>.
                  Click the link to finish setting up your account — it expires in 24 hours.
                </p>
                <p className="text-xs text-slate-500">
                  Didn't see it? Check your spam folder, or{" "}
                  <button
                    type="button"
                    onClick={() => handleResend(verifySent)}
                    disabled={resendStatus !== "idle"}
                    className="font-medium text-indigo-600 hover:underline disabled:opacity-60"
                  >
                    {resendStatus === "sending" ? "sending…" : resendStatus === "sent" ? "sent ✓" : "resend the email"}
                  </button>.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setVerifySent(null);
                    setMode("login-candidate");
                    setError("");
                    setResendStatus("idle");
                  }}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Back to sign in
                </button>
              </CardContent>
            ) : <>
            <CardHeader>
              <CardTitle>
                {mode === "signup" ? "Create your account" : "Welcome back"}
              </CardTitle>
              <p className="text-sm text-slate-500">
                {mode === "signup" ? "Sign up to apply for jobs and track your applications." : "Sign in to view your applications and profile."}
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                {mode === "signup" && (
                  <div>
                    <Label className="mb-1.5 block">Full Name</Label>
                    <Input placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                )}
                <div>
                  <Label className="mb-1.5 block">Email</Label>
                  <Input type="email" placeholder={mode === "login-hr" ? "admin@aihr.com" : "you@example.com"} value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label className="mb-1.5 block">Password</Label>
                  <Input type="password" placeholder={mode === "signup" ? "Min. 6 characters" : "••••••••"} value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                {mode === "signup" && (
                  <div>
                    <Label className="mb-1.5 block">Confirm Password</Label>
                    <Input type="password" placeholder="Re-enter password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                  </div>
                )}

                {error && (
                  <div className="space-y-2">
                    <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
                    {unverifiedEmail && (
                      <button
                        type="button"
                        onClick={() => handleResend(unverifiedEmail)}
                        disabled={resendStatus !== "idle"}
                        className="text-sm font-medium text-indigo-600 hover:underline disabled:opacity-60"
                      >
                        {resendStatus === "sending" ? "Sending verification email…" : resendStatus === "sent" ? "✓ Verification email sent — check your inbox" : "Resend verification email →"}
                      </button>
                    )}
                  </div>
                )}

                <Button className="w-full" type="submit" disabled={loading}>
                  {loading ? "Please wait..." : mode === "signup" ? "Create Account" : "Sign In"}
                </Button>
              </form>

              {/* Bottom links */}
              <div className="mt-5 text-center text-sm text-slate-500">
                {mode === "login-candidate" && (
                  <>Don&apos;t have an account?{" "}
                    <button className="font-medium text-indigo-600 hover:underline" onClick={() => { setMode("signup"); setError(""); }}>Sign up</button>
                  </>
                )}
                {mode === "signup" && (
                  <>Already have an account?{" "}
                    <button className="font-medium text-indigo-600 hover:underline" onClick={() => { setMode("login-candidate"); setError(""); }}>Sign in</button>
                  </>
                )}

              </div>
            </CardContent>
            </>}
          </Card>

          {/* Browse jobs CTA */}
          <p className="text-center text-sm text-slate-500">
            Looking for a job?{" "}
            <Link href="/jobs" className="font-medium text-indigo-600 hover:underline">Browse open roles →</Link>
          </p>

          {/* Discrete HR admin link */}
          <p className="text-center text-xs text-slate-300 hover:text-slate-400 transition-colors">
            <Link href="/admin-login">Admin access</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginSignupForm />
    </Suspense>
  );
}

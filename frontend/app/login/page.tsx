"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { PublicNav } from "@/components/public-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api";

function decodeJwt(token: string): Record<string, any> | null {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return null; }
}

async function registerCandidate(name: string, email: string, password: string) {
  const res = await fetch(`${API}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  return data;
}

function LoginSignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // "login-hr" | "login-candidate" | "signup"
  const [mode, setMode] = useState<"login-hr" | "login-candidate" | "signup">("login-candidate");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "not_staff") {
      setError("That account doesn't have HR access. Log in as a candidate below.");
      setMode("login-candidate");
    }
    // If already signed in as candidate → go to my-dashboard
    const token = localStorage.getItem("candidate_access_token");
    if (token) {
      const p = decodeJwt(token);
      if (p && !p.is_staff) router.replace("/my-dashboard");
    }
  }, [searchParams, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);

    try {
      if (mode === "signup") {
        if (!name.trim()) { setError("Please enter your full name."); return; }
        if (password !== confirmPassword) { setError("Passwords do not match."); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
        const data = await registerCandidate(name, email, password);
        localStorage.setItem("candidate_access_token", data.access);
        router.push("/my-dashboard");

      } else if (mode === "login-candidate") {
        const tokens = await login(email, password);
        const payload = decodeJwt(tokens.access);
        if (payload?.is_staff || payload?.is_superuser) {
          // Oops — HR user logged into candidate form
          localStorage.setItem("hr_access_token", tokens.access);
          router.push("/dashboard");
        } else {
          localStorage.setItem("candidate_access_token", tokens.access);
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
        localStorage.setItem("hr_access_token", tokens.access);
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNav />
      <div className="flex min-h-[calc(100vh-65px)] items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-4">

          {/* Tab switcher */}
          <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => { setMode("login-candidate"); setError(""); }}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${mode === "login-candidate" ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:text-slate-900"}`}
            >
              Candidate Login
            </button>
            <button
              onClick={() => { setMode("signup"); setError(""); }}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${mode === "signup" ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:text-slate-900"}`}
            >
              Sign Up
            </button>
            <button
              onClick={() => { setMode("login-hr"); setError(""); }}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${mode === "login-hr" ? "bg-slate-800 text-white shadow" : "text-slate-600 hover:text-slate-900"}`}
            >
              HR Admin
            </button>
          </div>

          <Card className="rounded-3xl shadow-sm">
            <CardHeader>
              <CardTitle>
                {mode === "signup" ? "Create your account" :
                 mode === "login-candidate" ? "Welcome back" :
                 "HR Admin Login"}
              </CardTitle>
              <p className="text-sm text-slate-500">
                {mode === "signup" ? "Sign up to apply for jobs and track your applications." :
                 mode === "login-candidate" ? "Sign in to view your applications and profile." :
                 "Restricted to authorised HR staff only."}
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
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
                )}

                <Button className={`w-full ${mode === "login-hr" ? "bg-slate-800 hover:bg-slate-700" : ""}`} type="submit" disabled={loading}>
                  {loading ? "Please wait..." :
                   mode === "signup" ? "Create Account" :
                   mode === "login-candidate" ? "Sign In" :
                   "HR Admin Login"}
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
                {mode === "login-hr" && (
                  <>Looking to apply?{" "}
                    <Link href="/jobs" className="font-medium text-indigo-600 hover:underline">Browse jobs →</Link>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Browse jobs CTA for candidates */}
          {mode !== "login-hr" && (
            <p className="text-center text-sm text-slate-500">
              Looking for a job?{" "}
              <Link href="/jobs" className="font-medium text-indigo-600 hover:underline">Browse open roles →</Link>
            </p>
          )}
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

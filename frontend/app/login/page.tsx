"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api";

function decodeJwt(token: string): Record<string, any> | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "not_staff") {
      setError("This account does not have dashboard access. Please use your HR admin credentials.");
    }
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const tokens = await login(email, password);

      // Check if this is a staff/admin account
      const payload = decodeJwt(tokens.access);
      if (!payload?.is_staff && !payload?.is_superuser) {
        setError("This login is for HR administrators only. Candidates can apply directly from the jobs page.");
        setLoading(false);
        return;
      }

      localStorage.setItem("hr_access_token", tokens.access);
      localStorage.setItem("hr_refresh_token", tokens.refresh);
      router.push("/dashboard");
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md rounded-3xl">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <p className="text-sm text-slate-500">HR Admin access only</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <Label className="mb-2 block">Email or Username</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@aihr.com" />
            </div>
            <div>
              <Label className="mb-2 block">Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
            )}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

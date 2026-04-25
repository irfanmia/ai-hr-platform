"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyLoginError, login } from "@/lib/api";
import { decodeJwt, setHrTokens } from "@/lib/auth-store";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const tokens = await login(email, password);
      const payload = decodeJwt(tokens.access);
      if (!payload?.is_staff && !payload?.is_superuser) {
        setError("Access denied. This portal is for HR administrators only.");
        return;
      }
      setHrTokens(tokens.access, tokens.refresh);
      router.push("/dashboard");
    } catch (err) {
      setError(friendlyLoginError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-6 py-12">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">AI HR Platform</h1>
          <p className="text-slate-400 text-sm mt-1">HR Administrator Portal</p>
        </div>

        <Card className="rounded-3xl border-slate-700 bg-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Admin Login</CardTitle>
            <p className="text-sm text-slate-400">Restricted to authorised HR staff only.</p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <Label className="mb-1.5 block text-slate-300">Email</Label>
                <Input
                  type="email"
                  placeholder="admin@aihr.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-slate-300">Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500"
                  required
                />
              </div>
              {error && (
                <p className="rounded-xl bg-red-900/40 px-4 py-3 text-sm text-red-400">{error}</p>
              )}
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500" type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign In to Dashboard"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-600">
          Not an admin?{" "}
          <Link href="/login" className="text-slate-500 hover:text-slate-400 underline">
            Go to candidate login
          </Link>
        </p>
      </div>
    </div>
  );
}

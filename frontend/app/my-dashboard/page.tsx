"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Link from "next/link";

import { Briefcase, Bookmark, ClipboardList, FileCheck2 } from "lucide-react";

import { ApplicationCard, type ApplicationLite } from "@/components/application-card";
import { PublicNav } from "@/components/public-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { clearCandidate } from "@/lib/auth-store";
import { useSavedJobs } from "@/lib/saved-jobs";
import { useAuth } from "@/lib/use-auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export default function CandidateDashboard() {
  const router = useRouter();
  const { state, candidate } = useAuth();
  const { count: savedCount } = useSavedJobs();
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ name?: string; email?: string } | null>(null);
  const [applications, setApplications] = useState<ApplicationLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirm, setEditConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");

  useEffect(() => {
    const t = state.candidateAccess;
    if (!t) { router.replace("/login"); return; }
    if (candidate?.is_staff || candidate?.is_superuser) {
      router.replace("/dashboard"); return;
    }
    setToken(t);

    const headers = { Authorization: `Bearer ${t}` };

    Promise.all([
      fetch(`${API}/auth/profile/`, { headers }).then(r => r.json()),
      fetch(`${API}/dashboard/my-applications/`, { headers }).then(r => r.json()),
    ]).then(([prof, apps]) => {
      const p = prof as { name?: string; email?: string };
      setProfile(p);
      setEditName(p.name || "");
      setApplications(Array.isArray(apps) ? (apps as ApplicationLite[]) : []);
      setLoading(false);
    });
    // We intentionally don't include `candidate` — its identity changes
    // every render but its .is_staff claim is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, state.candidateAccess]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaveErr(""); setSaveMsg("");
    if (editPassword && editPassword !== editConfirm) {
      setSaveErr("Passwords do not match."); return;
    }
    if (editPassword && editPassword.length < 6) {
      setSaveErr("Password must be at least 6 characters."); return;
    }
    setSaving(true);
    const body: any = {};
    if (editName) body.name = editName;
    if (editPassword) body.password = editPassword;

    const res = await fetch(`${API}/auth/profile/update/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      setSaveMsg("Profile updated successfully!");
      setProfile((p) => ({ ...(p ?? {}), name: data.name }));
      setEditPassword(""); setEditConfirm("");
    } else {
      setSaveErr(data.error || "Failed to save.");
    }
    setSaving(false);
  }

  function handleLogout() {
    clearCandidate();
    router.push("/jobs");
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <PublicNav />
        <main className="mx-auto max-w-4xl px-6 py-12 space-y-6">
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </main>
      </div>
    );
  }

  // ── Derived stats for the top strip ──
  const totalApps = applications.length;
  const inProgress = applications.filter((a) => !a.ai_report).length;
  const decisions = applications.filter(
    (a) => a.status === "shortlisted" || a.status === "rejected"
  ).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNav />
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">

        {/* ── Hero header ── */}
        <div className="flex flex-col gap-4 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
              My Dashboard
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">
              Welcome back{profile?.name ? `, ${profile.name}` : ""}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Track your applications, view AI interview results, manage your profile.
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>Sign Out</Button>
        </div>

        {/* ── Stats strip ── */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-indigo-600">
                <ClipboardList className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs text-slate-500">Applications</p>
                <p className="text-xl font-semibold text-slate-900">{totalApps}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-amber-600">
                <Briefcase className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs text-slate-500">In progress</p>
                <p className="text-xl font-semibold text-slate-900">{inProgress}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <FileCheck2 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs text-slate-500">Decisions</p>
                <p className="text-xl font-semibold text-slate-900">{decisions}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Saved jobs callout (only when user has some) ── */}
        {savedCount > 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-50 text-indigo-600">
                <Bookmark className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  You have {savedCount} saved job{savedCount !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-slate-500">Go back and apply when you&apos;re ready.</p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/saved">View saved →</Link>
            </Button>
          </div>
        )}

        {/* ── Applications ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">My applications</h2>
            {totalApps > 0 && (
              <Link href="/jobs" className="text-sm font-medium text-indigo-600 hover:underline">
                + Apply to another role
              </Link>
            )}
          </div>

          {totalApps === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-indigo-50 text-indigo-500">
                <Briefcase className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">No applications yet</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Start by browsing open roles. The AI interview takes about 10 minutes and
                generates a report HR reviews automatically.
              </p>
              <div className="mt-6 flex gap-3">
                <Button asChild>
                  <Link href="/jobs">Browse open roles</Link>
                </Button>
                {savedCount > 0 && (
                  <Button asChild variant="outline">
                    <Link href="/saved">View saved jobs</Link>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {applications.map((app) => (
                <ApplicationCard key={app.id} app={app} />
              ))}
            </div>
          )}
        </section>

        {/* Edit Profile */}
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-5 max-w-md">
              <div>
                <Label className="mb-1 block">Full Name</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <Label className="mb-1 block">Email</Label>
                <Input value={profile?.email} disabled className="bg-slate-50 text-slate-400" />
                <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
              </div>
              <div>
                <Label className="mb-1 block">New Password <span className="text-slate-400">(leave blank to keep current)</span></Label>
                <Input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Min. 6 characters" />
              </div>
              {editPassword && (
                <div>
                  <Label className="mb-1 block">Confirm New Password</Label>
                  <Input type="password" value={editConfirm} onChange={e => setEditConfirm(e.target.value)} placeholder="Re-enter password" />
                </div>
              )}
              {saveErr && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{saveErr}</p>}
              {saveMsg && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{saveMsg}</p>}
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
            </form>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}

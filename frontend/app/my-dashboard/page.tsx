"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PublicNav } from "@/components/public-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  screening: "bg-yellow-100 text-yellow-700",
  shortlisted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function decodeJwt(token: string) {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return null; }
}

export default function CandidateDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirm, setEditConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("candidate_access_token");
    if (!t) { router.replace("/login"); return; }
    const payload = decodeJwt(t);
    if (payload?.is_staff || payload?.is_superuser) {
      router.replace("/dashboard"); return;
    }
    setToken(t);

    const headers = { Authorization: `Bearer ${t}` };

    Promise.all([
      fetch(`${API}/auth/profile/`, { headers }).then(r => r.json()),
      fetch(`${API}/dashboard/my-applications/`, { headers }).then(r => r.json()),
    ]).then(([prof, apps]) => {
      setProfile(prof);
      setEditName(prof.name || "");
      setApplications(Array.isArray(apps) ? apps : []);
      setLoading(false);
    });
  }, [router]);

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
      setProfile((p: any) => ({ ...p, name: data.name }));
      setEditPassword(""); setEditConfirm("");
    } else {
      setSaveErr(data.error || "Failed to save.");
    }
    setSaving(false);
  }

  function handleLogout() {
    localStorage.removeItem("candidate_access_token");
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

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNav />
      <main className="mx-auto max-w-4xl px-6 py-12 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">My Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Welcome back, {profile?.name}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>Sign Out</Button>
        </div>

        {/* My Applications */}
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>My Applications ({applications.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-slate-500 mb-4">You haven't applied to any jobs yet.</p>
                <Button onClick={() => router.push("/jobs")}>Browse Jobs</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div key={app.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                    <div>
                      <p className="font-medium text-slate-900">{app.job?.title}</p>
                      <p className="text-sm text-slate-500">{app.job?.department} · {app.job?.location_type}</p>
                      <p className="text-xs text-slate-400 mt-1">Applied {new Date(app.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_COLORS[app.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {app.status}
                      </span>
                      {app.ai_score != null && (
                        <span className="text-xs text-slate-500">AI Score: <strong>{app.ai_score}</strong>/100</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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

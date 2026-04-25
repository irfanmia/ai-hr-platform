"use client";

/**
 * /verify?token=<token> — public landing page for QR-scan verification.
 *
 * Anyone who scans the QR on a candidate-document PDF lands here. The page
 * calls the backend's /api/verify/ endpoint with the token. If the HMAC
 * signature checks out, we render a green "valid" card with candidate +
 * job + issued-at info so HR can sanity-check the PDF against their
 * dashboard. If not, we show a red "invalid or tampered" card.
 *
 * No PII beyond what's already on the printed PDF is exposed here.
 */

import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type VerifyResponse, verifyDocument } from "@/lib/api";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setData({ valid: false, error: "missing_token" });
      setLoading(false);
      return;
    }
    verifyDocument(token)
      .then(setData)
      .catch(() => setData({ valid: false, error: "verification_request_failed" }))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="mx-auto max-w-xl">
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    );
  }

  const isValid = Boolean(data?.valid);
  const issuedAt = data?.issued_at ? new Date(data.issued_at) : null;

  return (
    <div className="mx-auto max-w-xl">
      <Card className={`overflow-hidden rounded-3xl border-2 ${isValid ? "border-emerald-300" : "border-red-300"}`}>
        <CardContent className="space-y-5 p-8">
          <div className="flex items-center gap-3">
            <span
              className={`grid h-12 w-12 place-items-center rounded-full ${
                isValid ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
              }`}
            >
              {isValid ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            </span>
            <div>
              <h1 className="text-xl font-semibold text-slate-950">
                {isValid ? "Document verified" : "This document could not be verified"}
              </h1>
              <p className="text-sm text-slate-500">
                {isValid
                  ? "This PDF was issued by HireParrot."
                  : "The token is invalid, tampered with, or no longer points to a real application."}
              </p>
            </div>
          </div>

          {isValid && data && (
            <>
              <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Candidate</p>
                  <p className="text-sm font-semibold text-slate-900">{data.candidate_name}</p>
                  <p className="text-xs text-slate-500">{data.candidate_email}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Role</p>
                  <p className="text-sm font-semibold text-slate-900">{data.job_title}</p>
                  <p className="text-xs text-slate-500">Application #{data.application_id}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Document type</p>
                  <p className="text-sm font-semibold capitalize text-slate-900">{data.doc_type}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Issued</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {issuedAt ? issuedAt.toLocaleString() : "—"}
                  </p>
                </div>
                {data.current_status && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Current status
                    </p>
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold capitalize text-slate-900">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      {data.current_status}
                    </p>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400">
                If any of the above doesn&apos;t match what&apos;s printed on the PDF in front of you,
                the document was likely tampered with after issue.
              </p>
            </>
          )}

          {!isValid && data?.error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
              Reason: <code className="font-mono">{data.error}</code>
            </p>
          )}

          <div className="flex justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
            <span>HireParrot · Document verification</span>
            <Link href="/jobs" className="text-indigo-500 hover:underline">
              Browse jobs →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12">
      <Suspense fallback={<Skeleton className="mx-auto h-72 max-w-xl rounded-3xl" />}>
        <VerifyInner />
      </Suspense>
    </div>
  );
}

"use client";

/**
 * Expandable claim validation list. Replaces the flat 3-column table with
 * rows that open to reveal the evidence (the interview answer that
 * produced the verdict). HR scanners can skim the claim+status list, then
 * drill into evidence per row only when curious.
 *
 * Keyboard accessible: each row is a button; Space/Enter toggles.
 */

import { ChevronDown, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { useState } from "react";

export interface ClaimItem {
  claim: string;
  status: "verified" | "partial" | "weak" | string;
  evidence?: string;
}

const STATUS_CHIP: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  verified: { bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle2 },
  partial:  { bg: "bg-amber-100",   text: "text-amber-700",   icon: AlertCircle },
  weak:     { bg: "bg-red-100",     text: "text-red-700",     icon: XCircle },
};

export function ClaimValidationList({ claims }: { claims: ClaimItem[] }) {
  const [openIdx, setOpenIdx] = useState<Set<number>>(new Set());
  if (!claims || claims.length === 0) return null;

  function toggle(i: number) {
    setOpenIdx((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {claims.map((c, i) => {
        const styling = STATUS_CHIP[c.status] ?? {
          bg: "bg-slate-100",
          text: "text-slate-600",
          icon: AlertCircle,
        };
        const Icon = styling.icon;
        const isOpen = openIdx.has(i);
        const hasEvidence = Boolean(c.evidence && c.evidence.trim());
        return (
          <div key={`${c.claim}-${i}`}>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
              onClick={() => hasEvidence && toggle(i)}
              aria-expanded={isOpen}
              aria-disabled={!hasEvidence}
            >
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${styling.bg} ${styling.text}`}>
                <Icon className="h-3.5 w-3.5" />
                {c.status}
              </span>
              <span className="flex-1 text-sm text-slate-800">{c.claim}</span>
              {hasEvidence && (
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              )}
            </button>
            {hasEvidence && isOpen && (
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
                  Evidence
                </p>
                <p className="whitespace-pre-wrap">{c.evidence}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

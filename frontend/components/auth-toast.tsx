"use client";

/**
 * Tiny toast that listens for auth events and briefly surfaces them.
 * Today it only renders for `*_session_expired` — the silent "you've been
 * logged out" signal that users used to just get a mysterious 401 for.
 *
 * We keep this ultra-small: no external toast library, no portal, just a
 * fixed-position banner at the top-right that auto-dismisses after 6s.
 */

import { useEffect, useState } from "react";

import { type AuthEventKind, onAuthEvent } from "@/lib/auth-events";

interface Toast {
  id: number;
  kind: "info" | "warning" | "success";
  title: string;
  body?: string;
}

const MESSAGES: Partial<Record<AuthEventKind, Omit<Toast, "id">>> = {
  hr_session_expired: {
    kind: "warning",
    title: "Session expired",
    body: "Please sign in again to continue where you left off.",
  },
  candidate_session_expired: {
    kind: "warning",
    title: "You've been signed out",
    body: "Your session expired. Sign in again to continue your application.",
  },
};

export function AuthToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let id = 0;
    const unsub = onAuthEvent((kind) => {
      const template = MESSAGES[kind];
      if (!template) return;
      const toast: Toast = { id: ++id, ...template };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 6_000);
    });
    return unsub;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto min-w-[260px] max-w-sm rounded-xl border px-4 py-3 shadow-lg backdrop-blur animate-in slide-in-from-right-5 ${
            t.kind === "warning"
              ? "border-amber-300 bg-amber-50/95 text-amber-900"
              : t.kind === "success"
              ? "border-emerald-300 bg-emerald-50/95 text-emerald-900"
              : "border-slate-300 bg-white/95 text-slate-900"
          }`}
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-semibold">{t.title}</p>
          {t.body && <p className="mt-0.5 text-xs text-inherit/80">{t.body}</p>}
        </div>
      ))}
    </div>
  );
}

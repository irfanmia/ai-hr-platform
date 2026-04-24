/**
 * Tiny, zero-dependency auth store.
 * ---------------------------------
 * Single source of truth for HR and candidate tokens. Hydrates from the same
 * localStorage keys the previous scattered callers used, so this drop-in
 * migration doesn't log anyone out.
 *
 * Why a hand-rolled store?
 *  - Avoids adding zustand/jotai just for this.
 *  - ~70 lines, SSR-safe (guards every `window` access), cross-tab-safe
 *    (listens to `storage` events), test-friendly (pure functions).
 *
 * Why one store for both HR and candidate? Because the same user object can't
 * logically be logged in as both at once (JWT.is_staff differs). The store
 * tracks them separately but a page reads whichever role it cares about.
 */

import type { AuthEventKind } from "./auth-events";
import { emitAuthEvent } from "./auth-events";

// Localstorage keys — MUST match what was written by the Phase 1 code
export const LS = {
  hrAccess: "hr_access_token",
  hrRefresh: "hr_refresh_token",
  candidateAccess: "candidate_access_token",
  candidateRefresh: "candidate_refresh_token",
} as const;

export type AuthRole = "hr" | "candidate" | null;

export interface JwtPayload {
  exp?: number;
  iat?: number;
  user_id?: number;
  email?: string;
  name?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  [key: string]: unknown;
}

export interface AuthState {
  hrAccess: string | null;
  hrRefresh: string | null;
  candidateAccess: string | null;
  candidateRefresh: string | null;
}

const INITIAL: AuthState = {
  hrAccess: null,
  hrRefresh: null,
  candidateAccess: null,
  candidateRefresh: null,
};

let state: AuthState = { ...INITIAL };
const subscribers = new Set<(s: AuthState) => void>();

function notify() {
  subscribers.forEach((fn) => {
    try {
      fn(state);
    } catch {
      /* subscribers must not crash the store */
    }
  });
}

// ─── Hydration ─────────────────────────────────────────────────────────────

function isBrowser() {
  return typeof window !== "undefined";
}

function hydrateFromStorage() {
  if (!isBrowser()) return;
  state = {
    hrAccess: localStorage.getItem(LS.hrAccess),
    hrRefresh: localStorage.getItem(LS.hrRefresh),
    candidateAccess: localStorage.getItem(LS.candidateAccess),
    candidateRefresh: localStorage.getItem(LS.candidateRefresh),
  };
}

// One-shot hydration on module load
hydrateFromStorage();

// Re-hydrate on cross-tab storage changes so logging out in one tab propagates
if (isBrowser()) {
  window.addEventListener("storage", (e) => {
    // Only re-hydrate if one of OUR keys changed
    if (!e.key) return;
    const ourKeys: string[] = [
      LS.hrAccess, LS.hrRefresh, LS.candidateAccess, LS.candidateRefresh,
    ];
    if (!ourKeys.includes(e.key)) return;
    hydrateFromStorage();
    notify();
  });
}

// ─── Public API ────────────────────────────────────────────────────────────

export function getAuthState(): AuthState {
  return state;
}

export function subscribe(fn: (s: AuthState) => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function setHrTokens(access: string, refresh?: string | null) {
  state = { ...state, hrAccess: access, hrRefresh: refresh ?? state.hrRefresh };
  if (isBrowser()) {
    localStorage.setItem(LS.hrAccess, access);
    if (refresh) localStorage.setItem(LS.hrRefresh, refresh);
  }
  notify();
  emitAuthEvent("hr_logged_in");
}

export function setCandidateTokens(access: string, refresh?: string | null) {
  state = {
    ...state,
    candidateAccess: access,
    candidateRefresh: refresh ?? state.candidateRefresh,
  };
  if (isBrowser()) {
    localStorage.setItem(LS.candidateAccess, access);
    if (refresh) localStorage.setItem(LS.candidateRefresh, refresh);
  }
  notify();
  emitAuthEvent("candidate_logged_in");
}

export function updateHrAccess(access: string) {
  // Used by the refresh interceptor — does NOT emit login event
  state = { ...state, hrAccess: access };
  if (isBrowser()) localStorage.setItem(LS.hrAccess, access);
  notify();
}

export function updateCandidateAccess(access: string) {
  state = { ...state, candidateAccess: access };
  if (isBrowser()) localStorage.setItem(LS.candidateAccess, access);
  notify();
}

export function clearHr(reason: AuthEventKind = "hr_logged_out") {
  state = { ...state, hrAccess: null, hrRefresh: null };
  if (isBrowser()) {
    localStorage.removeItem(LS.hrAccess);
    localStorage.removeItem(LS.hrRefresh);
  }
  notify();
  emitAuthEvent(reason);
}

export function clearCandidate(reason: AuthEventKind = "candidate_logged_out") {
  state = { ...state, candidateAccess: null, candidateRefresh: null };
  if (isBrowser()) {
    localStorage.removeItem(LS.candidateAccess);
    localStorage.removeItem(LS.candidateRefresh);
  }
  notify();
  emitAuthEvent(reason);
}

// ─── JWT helpers ───────────────────────────────────────────────────────────

/** Decode a JWT payload without verifying the signature. Safe for reading
 *  claims like `email`, `is_staff`, `exp`. NEVER trust these for authz —
 *  the server verifies the signature on every request. */
export function decodeJwt(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as JwtPayload;
  } catch {
    return null;
  }
}

export function getHrPayload(): JwtPayload | null {
  return decodeJwt(state.hrAccess);
}

export function getCandidatePayload(): JwtPayload | null {
  return decodeJwt(state.candidateAccess);
}

/** True if the given JWT is expired (or missing). 30-second skew. */
export function isExpired(token: string | null | undefined): boolean {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return true;
  return payload.exp * 1000 < Date.now() + 30_000;
}

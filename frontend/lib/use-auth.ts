/**
 * React hook over the auth store. Uses useSyncExternalStore (stable in React
 * 18+) so SSR and concurrent rendering stay correct.
 */

"use client";

import { useSyncExternalStore } from "react";

import {
  type AuthState,
  getAuthState,
  getCandidatePayload,
  getHrPayload,
  subscribe,
} from "./auth-store";

const EMPTY_STATE: AuthState = {
  hrAccess: null,
  hrRefresh: null,
  candidateAccess: null,
  candidateRefresh: null,
};

export interface UseAuthReturn {
  state: AuthState;
  /** Parsed JWT payload for the logged-in HR user, if any. */
  hr: ReturnType<typeof getHrPayload>;
  /** Parsed JWT payload for the logged-in candidate, if any. */
  candidate: ReturnType<typeof getCandidatePayload>;
  /** Convenience booleans — `isHrLoggedIn` reflects whether a token exists AND
   *  the JWT claims `is_staff=true`. It doesn't check signature/expiry; the
   *  server rejects bad tokens and our interceptor forces logout on refresh
   *  failure, so this is safe for UI gating. */
  isHrLoggedIn: boolean;
  isCandidateLoggedIn: boolean;
}

export function useAuth(): UseAuthReturn {
  const state = useSyncExternalStore(
    subscribe,
    getAuthState,
    () => EMPTY_STATE, // SSR snapshot — tokens never ship to the server
  );

  const hr = getHrPayload();
  const candidate = getCandidatePayload();

  return {
    state,
    hr,
    candidate,
    isHrLoggedIn: Boolean(state.hrAccess && hr?.is_staff),
    isCandidateLoggedIn: Boolean(state.candidateAccess && candidate && !candidate.is_staff),
  };
}

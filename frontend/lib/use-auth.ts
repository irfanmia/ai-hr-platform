/**
 * React hook over the auth store. Uses useSyncExternalStore (stable in React
 * 18+) so SSR and concurrent rendering stay correct.
 *
 * Hydration: tokens live in localStorage which doesn't exist on the server.
 * On SSR + the first client render, useSyncExternalStore returns the empty
 * snapshot to keep the markup matching. We expose a `hydrated` flag that
 * flips true on `useEffect`, so auth-aware UI (avatar dropdown vs Sign-in
 * button) can render a neutral placeholder during the hydration window
 * instead of flashing "logged out" → "logged in" on every navigation.
 */

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

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
  /** False on SSR + the first client render, true after the client mount.
   *  Components should treat the auth booleans as "unknown" while
   *  `hydrated` is false and render a neutral placeholder to avoid
   *  flashing the logged-out UI on every page transition. */
  hydrated: boolean;
}

export function useAuth(): UseAuthReturn {
  const state = useSyncExternalStore(
    subscribe,
    getAuthState,
    () => EMPTY_STATE, // SSR snapshot — tokens never ship to the server
  );

  // Hydration sentinel — flips true after the first client commit.
  // Stays false during SSR + the React-strict-equality first render.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const hr = getHrPayload();
  const candidate = getCandidatePayload();

  return {
    state,
    hr,
    candidate,
    isHrLoggedIn: Boolean(state.hrAccess && hr?.is_staff),
    isCandidateLoggedIn: Boolean(state.candidateAccess && candidate && !candidate.is_staff),
    hydrated,
  };
}

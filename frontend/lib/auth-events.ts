/**
 * Tiny auth-event pub/sub. Decoupled from the store so the toast component
 * can listen without importing the whole store.
 *
 * Events:
 *   hr_logged_in          — HR user completed login
 *   hr_logged_out         — HR user clicked logout (voluntary)
 *   hr_session_expired    — HR refresh token was rejected; forced logout
 *   candidate_logged_in
 *   candidate_logged_out
 *   candidate_session_expired
 *   token_refreshed       — silent token refresh succeeded (diagnostic)
 */

export type AuthEventKind =
  | "hr_logged_in"
  | "hr_logged_out"
  | "hr_session_expired"
  | "candidate_logged_in"
  | "candidate_logged_out"
  | "candidate_session_expired"
  | "token_refreshed";

type Listener = (kind: AuthEventKind) => void;

const listeners = new Set<Listener>();

export function onAuthEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitAuthEvent(kind: AuthEventKind) {
  listeners.forEach((fn) => {
    try {
      fn(kind);
    } catch {
      /* listener errors must not break the emitter */
    }
  });
}

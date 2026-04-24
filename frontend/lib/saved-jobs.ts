/**
 * Saved jobs — client-side only for now.
 *
 * Stores a Set of job IDs in localStorage under `saved_jobs_v1`. Exposes a
 * React hook with a subscribe pattern so every component showing a bookmark
 * icon stays in sync across the app.
 *
 * Server-side persistence is Wave 2 territory — a small
 * SavedJob(user, job) model + sync on login.
 */

"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "saved_jobs_v1";

type Listener = () => void;
const listeners = new Set<Listener>();

function isBrowser() {
  return typeof window !== "undefined";
}

function read(): Set<number> {
  if (!isBrowser()) return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(Array.isArray(arr) ? arr.filter((x) => Number.isInteger(x)) : []);
  } catch {
    return new Set();
  }
}

function write(set: Set<number>) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* quota? nothing we can do */
  }
}

// In-memory cache so the hook doesn't re-parse localStorage per render
let cache: Set<number> | null = null;
function getCache(): Set<number> {
  if (cache === null) cache = read();
  return cache;
}

// Cross-tab sync
if (isBrowser()) {
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    cache = read();
    listeners.forEach((fn) => fn());
  });
}

function notify() {
  listeners.forEach((fn) => fn());
}

// ─── Public API ────────────────────────────────────────────────────────────

export function getSavedJobs(): Set<number> {
  return getCache();
}

export function isJobSaved(id: number): boolean {
  return getCache().has(id);
}

export function toggleSavedJob(id: number): boolean {
  const next = new Set(getCache());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  cache = next;
  write(next);
  notify();
  return next.has(id);
}

export function useSavedJobs(): {
  saved: Set<number>;
  isSaved: (id: number) => boolean;
  toggle: (id: number) => void;
  count: number;
} {
  // useSyncExternalStore needs a stable snapshot — we pass the cached Set
  // which changes identity only when mutated. Works for both server render
  // (returns empty) and hydration.
  const saved = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getCache,
    () => new Set<number>(), // SSR — always empty, bookmark icons hydrate after mount
  );
  return {
    saved,
    isSaved: (id: number) => saved.has(id),
    toggle: (id: number) => toggleSavedJob(id),
    count: saved.size,
  };
}

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import type {
  Application,
  ApplicationStatus,
  ApplicationSubmission,
  DashboardStats,
  GenerateQuestionsResponse,
  Job,
  LoginResponse,
} from "@/lib/types";
import {
  clearCandidate,
  clearHr,
  getAuthState,
  updateCandidateAccess,
  updateHrAccess,
} from "@/lib/auth-store";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const api = axios.create({ baseURL: BASE_URL });

/** Request interceptor — attach whichever access token we have.
 *
 * Preference order:
 *  1. HR access token   — a logged-in HR user is doing the request
 *  2. Candidate access  — a logged-in candidate; the backend accepts either
 *
 * Routes that are candidate-only or HR-only are enforced server-side; the
 * client just attaches what it has. */
api.interceptors.request.use((config) => {
  if (typeof window === "undefined") return config;
  const { hrAccess, candidateAccess } = getAuthState();
  const token = hrAccess || candidateAccess;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Response interceptor — on 401 try one silent refresh and retry.
 *
 * Concurrency: a burst of 10 parallel requests hitting a just-expired token
 * would all 401. We do a single refresh per burst via `refreshPromise`.
 *
 * Which refresh token? We look at the request's Authorization header to
 * decide whether HR or candidate refresh should run. Fallback: HR first,
 * then candidate. */
let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(kind: "hr" | "candidate"): Promise<string | null> {
  const { hrRefresh, candidateRefresh } = getAuthState();
  const refresh = kind === "hr" ? hrRefresh : candidateRefresh;
  if (!refresh) return null;
  try {
    // Use a bare axios call so we don't recurse through our own interceptors
    const res = await axios.post<{ access: string }>(
      `${BASE_URL}/auth/refresh/`,
      { refresh },
      { headers: { "Content-Type": "application/json" } },
    );
    const access = res.data.access;
    if (!access) return null;
    if (kind === "hr") updateHrAccess(access);
    else updateCandidateAccess(access);
    return access;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    const status = error.response?.status;
    if (status !== 401 || !original || original._retried) {
      return Promise.reject(error);
    }
    // Don't try to refresh the refresh endpoint itself
    if (original.url?.includes("/auth/refresh/") || original.url?.includes("/auth/login/")) {
      return Promise.reject(error);
    }
    original._retried = true;

    // Figure out which role made the call by inspecting the token we sent
    const sentAuth = String(original.headers?.Authorization ?? "");
    const { hrAccess } = getAuthState();
    const isHrRequest = hrAccess && sentAuth.includes(hrAccess);
    const kind: "hr" | "candidate" = isHrRequest ? "hr" : "candidate";

    if (!refreshPromise) {
      refreshPromise = tryRefresh(kind).finally(() => {
        refreshPromise = null;
      });
    }
    const newAccess = await refreshPromise;

    if (!newAccess) {
      // Refresh failed — the user's session is truly gone. Clear and surface.
      if (kind === "hr") clearHr("hr_session_expired");
      else clearCandidate("candidate_session_expired");
      return Promise.reject(error);
    }
    // Retry the original request with the fresh token
    original.headers = original.headers ?? {};
    (original.headers as Record<string, string>).Authorization = `Bearer ${newAccess}`;
    return api(original);
  },
);

export async function getJobs(params?: Record<string, string | string[] | undefined>) {
  // Build URLSearchParams manually so arrays serialize as repeated keys
  // e.g. location_type=remote&location_type=hybrid (not location_type[]=...)
  const query = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (!value) continue;
      if (Array.isArray(value)) {
        value.forEach(v => query.append(key, v));
      } else {
        query.append(key, value);
      }
    }
  }
  const response = await api.get<Job[]>(`/jobs/?${query.toString()}`);
  return response.data;
}

export async function getJob(id: string | number) {
  const response = await api.get<Job>(`/jobs/${id}/`);
  return response.data;
}

export async function createJob(payload: Partial<Job>) {
  const response = await api.post<Job>("/jobs/", payload);
  return response.data;
}

export async function updateJob(id: number, payload: Partial<Job>) {
  const response = await api.patch<Job>(`/jobs/${id}/`, payload);
  return response.data;
}

export async function deleteJob(id: number) {
  await api.delete(`/jobs/${id}/`);
}

export async function submitApplication(payload: ApplicationSubmission) {
  const formData = new FormData();
  formData.append("job", String(payload.job));
  formData.append("candidate_name", payload.candidate_name);
  formData.append("email", payload.email);
  formData.append("phone", payload.phone);
  formData.append("resume", payload.resume);
  if (payload.portfolio_url) formData.append("portfolio_url", payload.portfolio_url);
  if (payload.github_url) formData.append("github_url", payload.github_url);
  if (payload.linkedin_url) formData.append("linkedin_url", payload.linkedin_url);
  formData.append("custom_answers", JSON.stringify(payload.custom_answers ?? {}));

  // Do NOT set Content-Type manually — axios sets it automatically with the correct
  // multipart boundary when FormData is passed. Setting it manually breaks uploads.
  const response = await api.post<{ id: number }>("/applications/", formData);
  return response.data;
}

export async function generateQuestions(applicationId: number) {
  const response = await api.get<GenerateQuestionsResponse>(
    `/applications/${applicationId}/generate-questions/`,
    { validateStatus: (s) => s < 500 } // let 400 through so we can inspect it
  );
  if (response.status === 400) {
    const err: any = new Error(response.data?.message || "Invalid document");
    err.response = response;
    throw err;
  }
  return response.data;
}

export async function submitAnswers(applicationId: number, answers: Record<string, string>) {
  const response = await api.post<{ application_id: number; report: Application["ai_report"] }>(
    `/applications/${applicationId}/submit-answers/`,
    { answers }
  );
  return response.data;
}

/**
 * Upload a short audio blob for a single interview answer, get back the
 * transcript. Audio is never stored server-side — it's transcribed via
 * Groq Whisper and discarded.
 *
 * The optional `questionIndex` is passed through for client-side correlation
 * only; the server doesn't persist it.
 */
export interface TranscriptionResponse {
  text: string;
  duration_ms: number;
  language: string;
  model: string;
  /** Set to true by the backend when the audio was silent / too short /
   *  contained no recognisable speech. Frontend treats this as "no answer
   *  detected, offer retry" rather than an error. */
  silent?: boolean;
}
export async function transcribeAnswer(
  applicationId: number,
  audioBlob: Blob,
  filename: string,
  questionIndex?: number,
): Promise<TranscriptionResponse> {
  const formData = new FormData();
  formData.append("file", audioBlob, filename);
  if (questionIndex !== undefined) {
    formData.append("question_index", String(questionIndex));
  }
  const response = await api.post<TranscriptionResponse>(
    `/applications/${applicationId}/transcribe/`,
    formData,
    { validateStatus: (s) => s < 500 || s === 503 },
  );
  if (response.status >= 400) {
    const err: Error & { response?: typeof response } = new Error(
      (response.data as any)?.message || "Transcription failed",
    );
    err.response = response;
    throw err;
  }
  return response.data;
}

export async function login(email: string, password: string) {
  const response = await api.post<LoginResponse>("/auth/login/", {
    username: email,
    password,
  });
  return response.data;
}

export async function getDashboardStats() {
  const response = await api.get<DashboardStats>("/dashboard/stats/");
  return response.data;
}

export async function getDashboardApplications(params?: Record<string, string | undefined>) {
  const response = await api.get<Application[]>("/dashboard/applications/", { params });
  return response.data;
}

export async function getDashboardApplication(id: string | number) {
  const response = await api.get<Application>(`/dashboard/applications/${id}/`);
  return response.data;
}

export async function updateApplicationStatus(id: number, status: ApplicationStatus) {
  const response = await api.patch<Application>(`/dashboard/applications/${id}/`, { status });
  return response.data;
}

/**
 * Trigger an authenticated PDF download. Browsers can't send Authorization
 * headers via <a href download>, so we fetch the PDF as a blob, build an
 * object URL, and click a hidden anchor to trigger the save dialog.
 *
 * `kind`:
 *   "responses" — Q&A only
 *   "report"    — AI evaluation only
 *   "combined"  — resume + responses + report merged
 */
export async function downloadApplicationPdf(
  applicationId: number,
  kind: "responses" | "report" | "combined",
): Promise<void> {
  const res = await api.get(`/dashboard/applications/${applicationId}/pdf/${kind}/`, {
    responseType: "blob",
  });
  const blob = res.data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Filename comes from Content-Disposition; use a fallback if not present
  const cd = String(res.headers["content-disposition"] ?? "");
  const m = cd.match(/filename="?([^";]+)"?/);
  a.download = m?.[1] ?? `application_${applicationId}_${kind}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Upload one identity-verification snapshot (JPEG) for the current
 * application. Backend stores under media/identity_snapshots/<id>/
 * and appends to Application.identity_snapshots.
 *
 * Returns { ok, path, captured_at, count } on success, or { skipped, reason }
 * if the job has snapshots disabled. Never throws on transient network errors
 * — caller is fire-and-forget.
 */
export async function uploadIdentitySnapshot(
  applicationId: number,
  blob: Blob,
): Promise<void> {
  try {
    const fd = new FormData();
    fd.append("file", blob, "snapshot.jpg");
    await api.post(`/applications/${applicationId}/identity-snapshot/`, fd, {
      validateStatus: (s) => s < 500,
    });
  } catch {
    // Snapshots are best-effort; never break the interview flow because of one
  }
}

/**
 * Public — used by the /verify page after a QR scan. No auth required.
 */
export interface VerifyResponse {
  valid: boolean;
  error?: string;
  candidate_name?: string;
  candidate_email?: string;
  job_title?: string;
  application_id?: number;
  doc_type?: string;
  issued_at?: string;
  current_status?: string;
}
export async function verifyDocument(token: string): Promise<VerifyResponse> {
  const response = await api.get<VerifyResponse>("/verify/", { params: { token } });
  return response.data;
}

/**
 * Translate any thrown error from a login / auth call into a friendly,
 * user-facing string. Hides axios's "Request failed with status code 500"
 * boilerplate behind real human language.
 */
export function friendlyLoginError(err: unknown): string {
  // Axios attaches { response: { status, data } } on HTTP errors
  const e = err as {
    response?: { status?: number; data?: { detail?: string; error?: string; message?: string } };
    code?: string;
    message?: string;
  };
  const status = e?.response?.status;
  const serverMessage =
    e?.response?.data?.detail ||
    e?.response?.data?.error ||
    e?.response?.data?.message;

  if (status === 401 || status === 403) {
    return "Email or password is incorrect.";
  }
  if (status === 400) {
    return serverMessage || "Couldn't sign you in with those details.";
  }
  if (status === 429) {
    return "Too many attempts — please wait a minute and try again.";
  }
  if (status === 503) {
    return "We're under maintenance. Please try again in a moment.";
  }
  if (typeof status === "number" && status >= 500) {
    return "We're having trouble signing you in. Please try again in a moment.";
  }
  if (e?.code === "ERR_NETWORK" || e?.message?.includes("Network Error")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  // Last resort — never surface "Request failed with status code …" to users
  return "Something went wrong. Please try again.";
}

// ─── Email verification (public signup flow) ──────────────────────────────

export interface VerifyEmailResponse {
  verified?: boolean;
  already_verified?: boolean;
  access: string;
  refresh: string;
  user: { name: string; email: string };
}

/** Hand the click-link token to the backend; on success returns JWT tokens
 *  for an immediate auto-login (or a 400 if the link is invalid/expired). */
export async function verifyEmailToken(token: string): Promise<VerifyEmailResponse> {
  const r = await api.get<VerifyEmailResponse>(
    "/auth/verify-email/", { params: { token } },
  );
  return r.data;
}

/** Request a fresh verification email. Always 200 — the backend never
 *  reveals whether the email is registered (account-enumeration guard). */
export async function resendVerificationEmail(email: string): Promise<{ detail: string }> {
  const r = await api.post<{ detail: string }>(
    "/auth/resend-verification/", { email },
  );
  return r.data;
}

// ─── Demo request (public landing-page form) ───────────────────────────────

export interface DemoRequestPayload {
  name: string;
  email: string;
  company: string;
  designation: string;
  phone: string;
  message?: string;
}

export interface DemoRequestResponse {
  id: number;
  message: string;
}

export async function submitDemoRequest(
  payload: DemoRequestPayload,
): Promise<DemoRequestResponse> {
  const r = await api.post<DemoRequestResponse>("/demo-requests/", payload);
  return r.data;
}

/**
 * Translate a demo-request submission error into a friendly, single-line
 * string. Field-level validation errors are joined into one message; the
 * 429 rate limit gets its own copy. Falls back to the generic friendly
 * sign-in message for unknown errors.
 */
export function friendlyDemoError(err: unknown): string {
  const e = err as {
    response?: { status?: number; data?: unknown };
    code?: string;
    message?: string;
  };
  const status = e?.response?.status;
  const data = e?.response?.data as
    | { detail?: string; [k: string]: unknown }
    | undefined;

  if (status === 429) {
    return (
      (data?.detail as string | undefined) ??
      "Too many submissions from your network. Please try again in an hour."
    );
  }
  if (status === 400 && data && typeof data === "object") {
    const parts: string[] = [];
    for (const [field, msgs] of Object.entries(data)) {
      if (field === "detail") continue;
      const text = Array.isArray(msgs) ? String(msgs[0]) : String(msgs);
      parts.push(`${field}: ${text}`);
    }
    if (parts.length) return parts.join(" · ");
  }
  return friendlyLoginError(err);
}

export default api;

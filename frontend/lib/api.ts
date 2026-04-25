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

export default api;

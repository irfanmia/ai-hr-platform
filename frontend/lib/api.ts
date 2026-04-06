import axios from "axios";

import type {
  Application,
  ApplicationStatus,
  ApplicationSubmission,
  DashboardStats,
  GenerateQuestionsResponse,
  Job,
  LoginResponse,
} from "@/lib/types";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "/api",
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("hr_access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

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

export type LocationType = "remote" | "onsite" | "hybrid";
export type ApplicationStatus = "new" | "screening" | "shortlisted" | "rejected";
export type QuestionType = "mcq" | "descriptive" | "coding" | "scenario" | "one_word";

export interface Job {
  id: number;
  title: string;
  department: string;
  location_type: LocationType;
  experience_years_min: number;
  experience_years_max: number;
  skills: string[];
  salary_min: number | null;
  salary_max: number | null;
  description: string;
  requirements: string;
  responsibilities: string;
  custom_fields: Record<string, string>;
  is_active: boolean;
  applications_count: number;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: number;
  job: Job;
  candidate_name: string;
  email: string;
  phone: string;
  resume: string;
  resume_url?: string | null;
  portfolio_url?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  custom_answers: Record<string, unknown>;
  status: ApplicationStatus;
  ai_report: AIReport | null;
  ai_score: number | null;
  created_at: string;
}

export interface ApplicationSubmission {
  job: number;
  candidate_name: string;
  email: string;
  phone: string;
  resume: File;
  portfolio_url?: string;
  github_url?: string;
  linkedin_url?: string;
  custom_answers?: Record<string, unknown>;
}

export interface InterviewQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
}

export interface ParsedResume {
  extracted_skills: string[];
  experience_years: number;
  claims: string[];
  summary: string;
}

export interface GenerateQuestionsResponse {
  application_id: number;
  parsed_resume: ParsedResume;
  questions: InterviewQuestion[];
}

export interface AIReport {
  overall_score: number;
  resume_strength_score: number;
  actual_performance_score: number;
  gap_analysis: {
    type: "positive" | "negative";
    score_difference: number;
    explanation: string;
  };
  skill_breakdown: Record<string, number>;
  claim_validation: Array<{
    claim: string;
    status: "verified" | "partial" | "weak";
    evidence: string;
  }>;
  key_findings: string[];
  strengths: string[];
  weaknesses: string[];
  behavioral_insights: {
    confidence: number;
    clarity: number;
    depth_of_knowledge: number;
  };
  recommendation: "Strong Hire" | "Consider" | "Reject";
}

export interface DashboardStats {
  total_applications: number;
  new_today: number;
  shortlisted: number;
  average_score: number;
  recent_applications: Application[];
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

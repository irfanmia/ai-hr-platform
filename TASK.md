# AI HR Platform - Build Task

Build a full-stack AI HR Assistant Platform in this directory.

## Stack
- Frontend: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui → deploy on Vercel
- Backend: Python Django 5 + Django REST Framework → deploy on Railway
- Database: PostgreSQL

## Structure to create

```
frontend/           # Next.js app
backend/            # Django app
README.md
```

## Backend (Django)

### Models

**Job:**
- title, department, location_type (choices: remote/onsite/hybrid)
- experience_years_min, experience_years_max
- skills (JSONField - list of strings)
- salary_min, salary_max (nullable)
- description, requirements, responsibilities (TextField)
- custom_fields (JSONField default {})
- is_active (default True)
- created_at, updated_at

**Application:**
- job (FK to Job)
- candidate_name, email, phone
- resume (FileField, upload_to='resumes/')
- portfolio_url, github_url, linkedin_url (nullable)
- custom_answers (JSONField default {})
- status (choices: new/screening/shortlisted/rejected, default new)
- ai_report (JSONField null)
- ai_score (IntegerField null)
- created_at

### Apps

**jobs/** - CRUD API + public list/detail endpoints
**applications/** - Submit application, upload resume, HR management
**ai_engine/** - Mock AI services (no real LLM needed):
  - `resume_parser.py` - extract skills/experience/claims from text using keyword matching
  - `question_generator.py` - generate 8-10 mixed questions (MCQ, descriptive, coding, scenario, one_word)
  - `answer_evaluator.py` - score answers (mock logic), produce candidate vector
  - `report_generator.py` - compile full AI report JSON

### AI Report JSON structure:
```json
{
  "overall_score": 78,
  "resume_strength_score": 65,
  "actual_performance_score": 78,
  "gap_analysis": {
    "type": "positive",
    "score_difference": 13,
    "explanation": "Candidate demonstrates stronger practical skills than resume suggests"
  },
  "skill_breakdown": {"Python": 85, "React": 70, "Communication": 80},
  "claim_validation": [
    {"claim": "5 years Python", "status": "verified", "evidence": "Answered advanced questions correctly"}
  ],
  "key_findings": ["Strong algorithmic thinking", "Communication above resume level"],
  "strengths": ["Problem solving", "Clear communication"],
  "weaknesses": ["Limited system design exposure"],
  "behavioral_insights": {"confidence": 75, "clarity": 80, "depth_of_knowledge": 70},
  "recommendation": "Strong Hire"
}
```

### API Endpoints:
- `GET /api/jobs/` - public job listing
- `GET /api/jobs/<id>/` - job detail
- `POST /api/applications/` - submit application + resume
- `GET /api/applications/<id>/generate-questions/` - parse resume, generate questions
- `POST /api/applications/<id>/submit-answers/` - evaluate answers, generate report
- `GET /api/dashboard/applications/` - HR: all applications (auth required)
- `POST /api/auth/login/` - JWT login

### Settings:
- CORS enabled for localhost:3000
- JWT auth (djangorestframework-simplejwt)
- File uploads to MEDIA_ROOT
- PostgreSQL (with SQLite fallback for dev)

## Frontend (Next.js)

### Pages:

**/jobs** - Job listings
- Left filter sidebar: location type checkboxes, experience range, skills search
- Grid of job cards: title, department, location badge, experience, 3 skill chips, "Apply Now" button
- Search bar at top

**/jobs/[id]** - Job detail
- Full description, requirements, responsibilities sections
- Sidebar: location, salary, experience quick info
- Sticky "Apply Now" CTA

**/apply/[id]** - 4-step application wizard
- Step 1: Personal info (name, email, phone, portfolio, github, linkedin)
- Step 2: Resume upload (drag-drop zone, PDF/DOC/DOCX, 5MB max, progress indicator)
- Step 3: AI Interview
  - Loading screen: "AI is analyzing your resume..." (2-3 second fake delay)
  - Questions shown one at a time with progress bar (Q1 of 10)
  - MCQ: radio buttons with 4 options
  - Descriptive: large textarea
  - Coding: textarea with monospace font + code styling
  - One-word/fill-blank: text input
  - Next/Submit button per question
- Step 4: Thank you screen with application ID

**/login** - HR login form (email + password, JWT)

**/dashboard** - HR Dashboard
- Stats cards: Total Applications, New Today, Shortlisted, Average Score
- Recent applications table (last 5)
- Protected route (redirect to /login if no token)

**/dashboard/jobs** - Job management table (title, apps count, status toggle, edit/delete)

**/dashboard/jobs/new** - Create job form

**/dashboard/applications** - Applications table
- Filter: by job, status, date range
- Columns: name, job title, score, status badge, date, View button

**/dashboard/applications/[id]** - Application detail + AI Report
- Left column: candidate info, resume download link, status selector + save
- Right column: AI Report:
  - Circular SVG score gauge (overall_score)
  - Side-by-side bars: Resume Strength vs Actual Performance
  - Gap analysis card (green border if positive, red if negative) with explanation text
  - Skill heatmap: colored horizontal bars (green >80, yellow 60-80, red <60)
  - Claim validation table: claim text + colored badge (verified=green, partial=yellow, weak=red)
  - Key Findings as bullet list with checkmark icons
  - Behavioral insights: 3 horizontal bars (Confidence, Clarity, Depth)
  - Recommendation badge: Strong Hire (green), Consider (yellow), Reject (red)

### Styling:
- shadcn/ui components (Button, Card, Badge, Input, Textarea, Table, Dialog)
- Dashboard layout: dark sidebar (bg-indigo-950 text-white), light content area
- Public pages: white background with indigo-600 accents
- Tailwind CSS for all styling
- Loading skeletons for data fetching
- Mobile responsive

### lib/api.ts:
- axios instance with baseURL from NEXT_PUBLIC_API_URL env
- interceptor to attach JWT token from localStorage
- typed functions for all API calls

### lib/types.ts:
- All TypeScript interfaces matching backend models and API responses

## Also create:
- `backend/.env.example` with all required env vars
- `frontend/.env.local.example` with NEXT_PUBLIC_API_URL
- `backend/seed_data.py` - script to create 5 realistic job postings (Software Engineer, Product Manager, Data Analyst, DevOps Engineer, UI/UX Designer)
- `README.md` with full setup instructions (backend + frontend separately)

## Notes:
- Use mock/placeholder data for AI - no real OpenAI calls needed in scaffold
- The AI interview flow should work end-to-end with mocked responses
- Include proper error handling and loading states
- Make it look polished and production-ready

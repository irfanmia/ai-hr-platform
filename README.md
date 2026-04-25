# AI HR Platform

An AI-powered hiring platform that transforms recruitment through intelligent resume parsing, claim-based AI interviews, and structured candidate evaluation reports.

> **Live Demo:** https://hireparrot.com
> **GitHub:** https://github.com/irfanmia/ai-hr-platform

---

## Overview

The platform moves hiring from resume-based screening → **skill + behaviour + claim validation-based hiring**.

**Candidate flow:** Browse jobs → Sign up → Fill personal info → Upload resume → AI interview (questions based on resume) → Report generated for HR

**HR flow:** Login → View all applications → Read AI reports → Download/print reports → Shortlist or reject candidates

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Python 3 + Django 5 + Django REST Framework |
| Database | PostgreSQL |
| AI/Vision | Groq API — `meta-llama/llama-4-scout-17b-16e-instruct` (vision model) |
| PDF Parsing | PyMuPDF — converts PDF pages → JPEG screenshots → sent to vision AI |
| Auth | JWT (djangorestframework-simplejwt) — separate HR admin and candidate tokens |
| Frontend Hosting | Vercel |
| Backend Hosting | DigitalOcean Droplet (Bangalore BLR1) |
| Web Server | Nginx (reverse proxy) + Gunicorn (WSGI) |

---

## Repository Structure

```
ai-hr-platform/
├── frontend/                      # Next.js app
│   ├── app/
│   │   ├── jobs/                  # Public job listings + detail
│   │   ├── apply/[id]/            # Multi-step application flow
│   │   ├── login/                 # Candidate login + signup
│   │   ├── admin-login/           # HR admin login (separate)
│   │   ├── my-dashboard/          # Candidate dashboard
│   │   └── dashboard/             # HR dashboard (staff only)
│   ├── components/
│   │   ├── job-card.tsx           # Smart card (Apply/Continue/Applied)
│   │   ├── public-nav.tsx         # Navigation with auth state
│   │   ├── auth-guard.tsx         # Protects HR dashboard routes
│   │   └── score-gauge.tsx        # SVG score ring
│   ├── lib/
│   │   ├── api.ts                 # Axios client + all API functions
│   │   └── types.ts               # TypeScript interfaces
│   ├── next.config.ts             # Vercel rewrites (API + media proxy)
│   └── .env.local.example
│
├── backend/
│   ├── config/
│   │   ├── settings.py
│   │   └── urls.py
│   ├── jobs/                      # Job model + CRUD API
│   ├── applications/              # Application model + candidate/HR views
│   │   ├── auth_views.py          # Register, login, profile, JWT tokens
│   │   ├── views.py               # Application CRUD + AI flow
│   │   └── dashboard_urls.py      # HR and candidate dashboard endpoints
│   ├── ai_engine/
│   │   ├── pdf_vision_parser.py   # PDF → images → Groq vision → structured data
│   │   ├── resume_parser.py       # Orchestrates parsing + fallbacks
│   │   ├── question_generator.py  # Role-relevant questions from resume claims
│   │   ├── answer_evaluator.py    # Scores answers, builds AI report
│   │   └── report_generator.py   # Compiles final candidate report
│   ├── requirements.txt
│   ├── seed_data.py               # Seeds 6 demo jobs
│   └── .env.example
│
└── README.md
```

---

## Production Deployment

### Frontend — Vercel

- **URL:** https://hireparrot.com
- **Alias:** `hireparrot.com`
- **Project:** `irfanmias-projects/frontend`
- **Framework:** Next.js (auto-detected)
- **Build command:** `npm run build`
- **Environment variables set in Vercel:**
  - `NEXT_PUBLIC_API_URL=/api` (proxied via Vercel rewrites — avoids mixed content)

**Vercel rewrites** (in `next.config.ts`) proxy API and media requests:
```
/api/* → http://<server-ip>/api/*
/media/* → http://<server-ip>/media/*
```
This avoids HTTPS → HTTP mixed content issues since the DO server has no SSL cert.

### Backend — DigitalOcean Droplet

| Property | Value |
|----------|-------|
| Region | Bangalore BLR1 |
| Spec | 1 vCPU / 2GB RAM / 70GB NVMe SSD |
| OS | Ubuntu 24.04 LTS |
| Cost | $16/month |
| Path | `/var/www/ai-hr-platform/backend/` |
| Python env | `/var/www/ai-hr-platform/backend/venv/` |

**Services running:**
- `aihr.service` — Gunicorn (3 workers, port 8000, timeout 120s)
- `nginx` — Reverse proxy on port 80, routes `/api/` and `/admin/` to Gunicorn
- `postgresql` — Local PostgreSQL database

**Nginx config:** `/etc/nginx/sites-available/aihr`
**Systemd service:** `/etc/systemd/system/aihr.service`

### Database — PostgreSQL

| Property | Value |
|----------|-------|
| Database name | `aihr_db` |
| User | `aihr` |
| Host | `localhost` |

> ⚠️ Database credentials are stored in `/var/www/ai-hr-platform/backend/.env` on the server — never committed to git.

---

## API Endpoints

### Public (no auth required)
```
GET  /api/jobs/                              List active jobs (with filters)
GET  /api/jobs/<id>/                         Job detail
POST /api/applications/                      Submit application + resume upload
GET  /api/applications/<id>/generate-questions/   Parse resume, generate questions
POST /api/applications/<id>/submit-answers/  Evaluate answers, generate AI report
POST /api/auth/login/                        Login (candidates + HR)
POST /api/auth/register/                     Candidate registration
```

### Candidate (JWT required — any authenticated user)
```
GET  /api/auth/profile/                      Get current user profile
PATCH /api/auth/profile/update/              Update name or password
GET  /api/dashboard/my-applications/         Candidate's own applications
GET  /api/dashboard/my-applications/job/<id>/  Check if applied to a specific job
```

### HR Admin (JWT required — `is_staff=True`)
```
GET  /api/dashboard/applications/            All applications (with filters)
GET  /api/dashboard/applications/<id>/       Application detail + AI report
PATCH /api/dashboard/applications/<id>/      Update application status
GET  /api/dashboard/stats/                   Dashboard stats
```

### Django Admin
```
http://<server-ip>/admin/
```

---

## AI Pipeline

```
PDF Upload
    │
    ▼
PyMuPDF (fitz)
  → Convert each page to JPEG at 120 DPI (max 4 pages)
  → Base64 encode images
    │
    ▼
Groq Vision API (llama-4-scout-17b-16e-instruct)
  → Extracts: name, email, skills, experience years,
              education, certifications, claims
    │
    ▼
Question Generator
  → Filters claims: removes irrelevant (PADI, hobbies, unrelated certs)
  → Generates 10 questions based on job JD + relevant resume claims
  → Question types: MCQ, descriptive (150-250 words), coding, scenario, one-word
  → Each question includes word count guidance
    │
    ▼
Answer Evaluator
  → Scores each answer: base 55 + length bonus + quality signals + keywords
  → Lenient scoring: 45-95 range (participation gets credit)
  → Recommendation: 78+ = Strong Hire, 62+ = Consider, <62 = Reject
    │
    ▼
AI Report
  → Overall score, resume vs performance gap analysis
  → Skill breakdown heatmap, claim validation table
  → Key findings, strengths, weaknesses, behavioral insights
  → Downloadable/printable PDF via browser print
```

---

## Local Development Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env — set SECRET_KEY, DATABASE_URL (or use SQLite default)

python manage.py migrate
python manage.py createsuperuser
python seed_data.py        # Seeds 6 demo jobs

python manage.py runserver  # Runs on http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local

npm run dev  # Runs on http://localhost:3000
```

---

## Environment Variables

### Backend `.env`
```
SECRET_KEY=<django-secret-key>
DEBUG=False
ALLOWED_HOSTS=*
DATABASE_URL=postgresql://user:password@localhost/dbname
GROQ_API_KEY=<groq-api-key>
CORS_ALLOW_ALL_ORIGINS=True
```

### Frontend `.env.local`
```
NEXT_PUBLIC_API_URL=/api        # Production (proxied via Vercel)
# or
NEXT_PUBLIC_API_URL=http://localhost:8000/api  # Local development
```

---

## Deployment: Update Production

### Deploy frontend update
```bash
cd frontend
npx vercel deploy --prod --yes --token "<vercel-token>"
npx vercel alias set <deployment-url> hireparrot.com --token "<vercel-token>"
```

### Deploy backend update
```bash
# SSH into server
ssh root@<server-ip>

cd /var/www/ai-hr-platform
git pull origin main
source backend/venv/bin/activate
pip install -r backend/requirements.txt   # if requirements changed
cd backend && python manage.py migrate    # if models changed
systemctl restart aihr
```

---

## Jobs Seeded (Demo Data)

| # | Title | Department | Type | Salary |
|---|-------|-----------|------|--------|
| 1 | Software Engineer | Engineering | Hybrid | $90K–$130K |
| 2 | Product Manager | Product | Remote | $95K–$140K |
| 3 | Data Analyst | Data | Onsite | $70K–$100K |
| 4 | DevOps Engineer | Platform | Hybrid | $105K–$150K |
| 5 | UI/UX Designer | Design | Remote | $80K–$115K |
| 6 | Chief Executive Officer | Executive Leadership | Hybrid | $180K–$280K |

---

## Access Points Summary

| Surface | URL |
|---------|-----|
| Job Listings | https://hireparrot.com/jobs |
| Candidate Login / Sign Up | https://hireparrot.com/login |
| Candidate Dashboard | https://hireparrot.com/my-dashboard |
| HR Admin Login | https://hireparrot.com/admin-login |
| HR Dashboard | https://hireparrot.com/dashboard |
| Django Admin | http://\<server-ip\>/admin/ |
| API Root | https://hireparrot.com/api/ |

---

## Key Design Decisions

- **Vercel proxy rewrites** instead of HTTPS on DO droplet — avoids SSL cert setup while keeping mixed content issues resolved
- **PDF → vision AI** instead of text extraction — handles scanned/designed resumes, better accuracy
- **Separate JWT claim scopes** — `is_staff` in token payload gates HR dashboard access at both frontend and backend
- **Lenient scoring** — rewards effort and elaboration, not keyword matching; minimum 45 for any real attempt
- **Irrelevant claim filtering** — questions only based on role-relevant resume content (e.g. PADI certification ignored for Software Engineer role)

---

*Built with ❤️ for Wayne · AI HR Platform v1.0*

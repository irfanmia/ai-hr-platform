# AI HR Platform

Full-stack AI HR assistant platform with a Next.js 15 frontend and Django 5 backend.

## Project Structure

```text
frontend/   Next.js 15 + TypeScript + Tailwind CSS recruiter and candidate UI
backend/    Django 5 + DRF + JWT + mock AI engine
README.md
```

## Backend Setup

1. Create a virtual environment and install dependencies:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Copy environment variables and update values as needed:

```bash
cp .env.example .env
```

3. Run migrations, create an admin user, and seed jobs:

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python seed_data.py
```

4. Start the API server:

```bash
python manage.py runserver
```

Key API routes:

- `GET /api/jobs/`
- `GET /api/jobs/<id>/`
- `POST /api/applications/`
- `GET /api/applications/<id>/generate-questions/`
- `POST /api/applications/<id>/submit-answers/`
- `GET /api/dashboard/applications/`
- `GET /api/dashboard/stats/`
- `POST /api/auth/login/`

## Frontend Setup

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Copy the frontend environment file:

```bash
cp .env.local.example .env.local
```

3. Start the Next.js app:

```bash
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

## Production Notes

- Frontend is designed for Vercel deployment.
- Backend is designed for Railway deployment.
- PostgreSQL is supported through `DATABASE_URL` or individual `POSTGRES_*` variables, with SQLite fallback for local development.
- Uploaded resumes are served from Django `MEDIA_ROOT`.
- The AI engine is fully mocked and works without external LLM services.

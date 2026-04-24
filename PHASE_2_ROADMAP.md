# AI HR Platform — Phase 2 Roadmap

> Status: **DRAFT — awaiting your approval**
> Last updated: 2026-04-24
> Author: Claude (Cowork)

Phase 1 is a solid MVP that's live at https://wayne-ai-hr.vercel.app. Phase 2 expands across all four directions you picked: new features, hardening, UX polish, and AI quality — for HR, candidates, and orgs.

Backend deploys (DigitalOcean droplet) are **deferred** until we actually need a backend change. Until then, every milestone in this roadmap is shippable through `git push origin main` → Vercel auto-deploy.

---

## Guiding principles

1. **Atomic, deployable increments.** Each milestone ships independently. No multi-week branches. If a milestone gets too big, it gets split.
2. **Frontend-first wherever possible.** Backend touches only when truly required (and even then, prefer additive — new endpoints, new model fields with defaults).
3. **No regressions.** Existing candidate + HR flows must keep working through every release.
4. **Visible quality.** UX polish counted as a feature, not a bonus. Every new screen ships with empty states, loading states, error states, and mobile responsive.
5. **AI quality is measurable.** When we touch the AI engine, we capture a small eval set first (10 sample resumes + answers) and compare before/after.

---

## Wave 1 — Foundation & Polish (frontend-only, ~1 week of work)

Goal: ship visible improvements without touching the backend. Pay down the most painful frontend tech debt while you decide if you want to expand backend in Wave 2.

### M1.1 — Centralised auth + token refresh
- Create `lib/auth-store.ts` (zustand or React context) that holds `{accessToken, refreshToken, user, role}` and listens to `storage` events so logging out in one tab logs out all tabs.
- Add an axios response interceptor that catches `401`, calls `/api/auth/token/refresh/` (already exists in djangorestframework-simplejwt), retries the original request once, and on second 401 logs the user out cleanly with a toast.
- Replace every `localStorage.getItem("hr_access_token")` call in `app/` and `components/` with `useAuthStore()`.
- **Ships:** smoother HR + candidate sessions, no more silent 401 failures, multi-tab consistency.

### M1.2 — Type-safety + error boundary
- Remove `typescript.ignoreBuildErrors: true` from `next.config.ts`. Fix every type error that surfaces.
- Add a top-level `app/error.tsx` and `app/global-error.tsx` so a single component crash doesn't blank the page. Show a friendly message with a "Reload" button and a "Report this" link.
- Add per-route `loading.tsx` for `/jobs`, `/jobs/[id]`, `/dashboard`, `/dashboard/applications`, `/my-dashboard` so navigation feels instant.
- **Ships:** fewer prod bugs, no more white-screen crashes, faster perceived loads.

### M1.3 — Candidate dashboard polish
- Redesign `/my-dashboard` with: status timeline per application (Applied → Screening → Interview → Decision), AI report preview card if available, "Withdraw application" button (POST to existing `applications/<id>/` PATCH with status=withdrawn — needs a new status enum value, see Wave 2 for backend).
- Add empty state with illustration when candidate has no applications, with CTA "Browse jobs".
- Add saved jobs (frontend-only via localStorage for now, server-side in Wave 2).
- **Ships:** candidate engagement, return visits.

### M1.4 — HR dashboard polish + bulk actions (frontend)
- `/dashboard/applications` — add column sort, sticky filter bar, candidate avatar (initials), score colour chips, "Open in new tab" right-click affordance.
- Add **multi-select checkboxes** per row + a bulk action toolbar (Shortlist all, Reject all, Export CSV). The status-update calls existing `PATCH /api/dashboard/applications/<id>/` in a loop with `Promise.allSettled`. Export CSV is fully client-side from already-fetched data.
- Add a **candidate compare view** at `/dashboard/applications/compare?ids=1,2,3`: side-by-side AI report cards, scores, claim validation. Pure frontend — uses existing `/applications/<id>/` endpoint.
- **Ships:** HR can triage 10x faster, no backend work needed.

### M1.5 — Better AI report visualisation
- Replace flat skill bars with a **radar chart** (recharts is already common in shadcn ecosystems). Score gauge gets a coloured ring + needle.
- Claim validation table gets per-row expand-to-see-evidence (the answer that produced the verdict).
- Behavioral insights get small sparkline trend if you have more than one application from the same candidate.
- Print stylesheet refined: clean A4 layout, no nav, no buttons, page-break-inside: avoid for each card.
- **Ships:** reports look premium, print as proper PDFs.

**Wave 1 deploys:** ~5 separate `main` pushes, each hitting Vercel auto-deploy. Verify every one on the live URL before moving to the next.

---

## Wave 2 — Backend hardening + new endpoints (~1 week)

Now we touch the Django side. This is where we'd need the SSH key to the droplet. Each change is additive — no breaking migrations.

### M2.1 — Production safety
- Fail-fast settings: at startup, raise if `SECRET_KEY` is the dev default and `DEBUG=False`. Same for `ALLOWED_HOSTS=*` in production.
- Add `django-environ` for cleaner env-var handling, replace ad-hoc `os.environ.get()` calls.
- Add `django-ratelimit` on resume upload, question generation, answer submission (per-IP and per-user). Default: 5 uploads/hour/user.
- Add file-upload validators on `Application.resume`: PDF/DOCX mimetype only, max 5 MB.
- Add **request logging** with structured JSON output to a file the droplet can ship to a log aggregator later.
- **Ships:** no accidental key exposure, no Groq API exhaustion, no malicious file uploads.

### M2.2 — Pagination + query optimisation
- Add `PageNumberPagination` (default 20/page) to `DashboardApplicationsView`, `JobListView`.
- Wrap `DashboardStatsView` queries in a single `.aggregate()` instead of multiple `.filter().count()` calls.
- Add `select_related("job")` and `prefetch_related` where serializers walk relations.
- Frontend: paginated table with page-size picker, infinite-scroll fallback option.
- **Ships:** scales to 10k+ applications without OOM.

### M2.3 — Tests + CI
- Add pytest + pytest-django. Test suite covers: scoring logic (`answer_evaluator`), claim filtering (`question_generator.is_claim_relevant`), resume matching (`resume_matcher`), the full submit-answers flow with a mocked Groq client.
- Add a GitHub Actions workflow `.github/workflows/ci.yml` that runs backend tests + frontend `npm run lint` + `tsc --noEmit` on every PR and on `main`. Block merges on red.
- Add Sentry (or self-hosted GlitchTip) for both frontend and backend. Free tier is enough.
- **Ships:** safety net before bigger features.

### M2.4 — Notifications endpoint + email
- New `Notification` model (id, application_fk, type, sent_at, payload). New `/api/notifications/` POST (HR only) with body `{type: "shortlist"|"reject"|"interview_invite", template_overrides: {}}`.
- Use Django's email backend with an SMTP relay (Resend, Postmark, or SES — cheapest first; user picks). Templates under `applications/templates/email/`.
- Trigger paths: HR clicks "Shortlist" → ask "Send email?" toggle → POST to `/api/notifications/`. Candidate self-applies → automatic "Application received" email.
- **Ships:** candidates aren't ghosted; HR doesn't have to context-switch to Gmail.

### M2.5 — Application status enum expansion
- Add statuses: `withdrawn` (candidate-initiated), `interview_scheduled`, `offer_sent`, `hired`. Migration with default = existing value.
- Frontend status pickers updated; status timeline uses new enum.
- **Ships:** real lifecycle tracking, not just shortlist/reject.

---

## Wave 3 — AI engine v2 (~1.5 weeks)

Goal: make the AI feel sharper. Capture an eval set first.

### M3.1 — Eval harness
- 10 sample resumes (varied roles + quality), 10 sets of sample answers, expected report fields. JSON fixture + a `manage.py run_evals` command that prints a diff vs golden output. Lets us measure regressions before shipping engine changes.

### M3.2 — Smarter question generation
- Replace `hash(skill) % 4` MCQ option picker with Groq-generated MCQs from claim + JD (cached by claim hash).
- Adaptive question count: 6–14 based on number of relevant claims, instead of fixed 10.
- Add **anti-cheat**: question-bank rotation per candidate (deterministic seed = candidate_id + job_id), so two candidates for same job don't get identical questions.
- Add "follow-up" questions: if first answer is short or generic, the next question probes deeper on the same skill.

### M3.3 — Stronger scoring rubric
- Move from heuristic `base+length+keywords` to a Groq-graded rubric: per-question, ask Groq to score on a 1–5 rubric (correctness, depth, clarity, evidence) with reasoning. Cache by `hash(question + answer)`.
- Final score = weighted average across questions, calibrated against the existing lenient scale so HR doesn't see sudden drops on day one.

### M3.4 — Multi-model fallback
- Wrap Groq calls in a `LLMClient` abstraction with primary (Groq llama-4-scout) + fallback (Groq llama-3.3-70b or Anthropic Claude). Auto-switches on rate limit or 5xx.

### M3.5 — Behaviour signal expansion
- Behavioral insights currently 3 dimensions (confidence, clarity, depth). Add: structure, specificity, ownership (uses "I" vs "we"), conciseness. Each is a small Groq-evaluated signal.

---

## Wave 4 — New big features (pick from menu)

These are larger features. We'll pick 1–2 to ship first, the rest stay queued. Each is scoped to ~1 week.

### F1 — Async video interview
Candidate records 30–90 sec video answers in-browser (MediaRecorder API). Stored in DigitalOcean Spaces (S3-compatible). Groq vision + transcription used to score delivery + content. HR plays back in dashboard with transcript synced.

### F2 — Interview scheduling
HR clicks "Schedule live interview" → calendar picker → sends email with Cal.com / Google Meet / Zoom link. Candidate dashboard shows upcoming interviews. Reminders 24h + 1h before.

### F3 — Multi-tenant (turns it into SaaS)
`Company` model, every `Job` and `Application` scoped by company. Invite-flow for HR colleagues. Subdomain routing (acme.wayne-ai-hr.com) or workspace switcher. Per-company branding (logo, colour). Stripe billing tiers (free / pro / enterprise) using `dj-stripe`.

### F4 — Analytics dashboard
Per-company charts: applications over time, conversion funnel (applied → screened → interview → hired), time-to-hire, source-of-hire, average AI score by role. Recharts on the frontend, Django aggregations on the backend with Redis cache (5-min TTL).

### F5 — Integrations
- LinkedIn import (candidate clicks "Sign in with LinkedIn", we autofill resume/profile via OAuth).
- Indeed / Greenhouse / Workable webhooks (incoming applications appear in your dashboard).
- ATS export (push hired candidates to BambooHR or similar).

### F6 — Candidate practice mode
Free practice interview — same flow but no application submission. Candidate gets immediate feedback. Acts as growth/SEO loop ("Practice for X interview" landing pages).

### F7 — HR collaboration
Team accounts, per-application notes, @mentions, approval workflows ("requires VP approval to extend offer"), Slack notifications.

### F8 — AI candidate matching (push side)
Recruiter creates a job, system suggests existing candidates (from past applications) who'd match. Reverse search.

---

## Suggested order

If this all looks right, my recommended sequence is:

1. **Wave 1** ships in full first — pure Vercel deploys, no risk.
2. We pause, look at it, decide if Wave 2 (backend hardening) is worth it before bigger features.
3. **Wave 2 + 3 in parallel** once backend deploy is set up.
4. **Wave 4:** pick 2 features you most want, ship them, then the rest.

Tell me which milestones you want to keep / drop / reorder, and I'll start on M1.1 the moment you give the green light + drop the GitHub PAT.

---

## What I need from you to start

- ✅ **GitHub fine-grained PAT** with `Contents: Read & write` on `irfanmia/ai-hr-platform`. (Required to push to `main`.)
- ⏸️ **DO droplet SSH key** — deferred. Only needed when we hit Wave 2.
- 📧 **Email sending provider** (Resend / Postmark / SES) — only needed at M2.4. Ignore for now.

Once the PAT lands, I create branch `phase-2/m1.1-auth-store`, ship M1.1 to a Vercel preview, you review the preview URL, I merge to `main`, repeat.

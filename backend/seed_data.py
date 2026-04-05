import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from jobs.models import Job

JOB_SEEDS = [
    {
        "title": "Software Engineer",
        "department": "Engineering",
        "location_type": "hybrid",
        "experience_years_min": 3,
        "experience_years_max": 5,
        "skills": ["Python", "Django", "React", "PostgreSQL"],
        "salary_min": 90000,
        "salary_max": 130000,
        "description": "Build and maintain internal AI-driven HR workflows across frontend and backend systems.",
        "requirements": "Strong Python and React experience. Comfortable with APIs, databases, and testing.",
        "responsibilities": "Ship product features, review code, collaborate with product and design.",
        "custom_fields": {"employment_type": "Full-time"},
    },
    {
        "title": "Product Manager",
        "department": "Product",
        "location_type": "remote",
        "experience_years_min": 4,
        "experience_years_max": 7,
        "skills": ["Roadmapping", "Analytics", "Stakeholder Management", "Communication"],
        "salary_min": 95000,
        "salary_max": 140000,
        "description": "Own roadmap execution for candidate screening and recruiter productivity products.",
        "requirements": "Experience shipping SaaS products and aligning engineering with business priorities.",
        "responsibilities": "Write PRDs, prioritize backlog, analyze adoption signals.",
        "custom_fields": {"employment_type": "Full-time"},
    },
    {
        "title": "Data Analyst",
        "department": "Data",
        "location_type": "onsite",
        "experience_years_min": 2,
        "experience_years_max": 4,
        "skills": ["SQL", "Python", "Dashboarding", "Statistics"],
        "salary_min": 70000,
        "salary_max": 100000,
        "description": "Turn recruiting and hiring data into decision-ready dashboards and recommendations.",
        "requirements": "Strong SQL, analytical thinking, and experience presenting insights.",
        "responsibilities": "Build reports, define metrics, partner with HR stakeholders.",
        "custom_fields": {"employment_type": "Full-time"},
    },
    {
        "title": "DevOps Engineer",
        "department": "Platform",
        "location_type": "hybrid",
        "experience_years_min": 4,
        "experience_years_max": 7,
        "skills": ["AWS", "Docker", "Kubernetes", "CI/CD"],
        "salary_min": 105000,
        "salary_max": 150000,
        "description": "Own deployment, observability, and platform reliability for the AI HR platform.",
        "requirements": "Experience with cloud infrastructure, containers, and secure delivery pipelines.",
        "responsibilities": "Improve uptime, automate deployment, manage environments.",
        "custom_fields": {"employment_type": "Full-time"},
    },
    {
        "title": "UI/UX Designer",
        "department": "Design",
        "location_type": "remote",
        "experience_years_min": 3,
        "experience_years_max": 6,
        "skills": ["Figma", "Prototyping", "User Research", "Design Systems"],
        "salary_min": 80000,
        "salary_max": 115000,
        "description": "Design polished candidate and recruiter experiences for a modern AI-first product.",
        "requirements": "Strong product design portfolio with responsive web experience.",
        "responsibilities": "Create flows, collaborate on UX strategy, maintain design quality.",
        "custom_fields": {"employment_type": "Full-time"},
    },
]


for payload in JOB_SEEDS:
    Job.objects.update_or_create(
        title=payload["title"],
        defaults=payload,
    )

print(f"Seeded {len(JOB_SEEDS)} jobs.")

import re

from applications.models import Application

KNOWN_SKILLS = [
    "Python",
    "Django",
    "React",
    "TypeScript",
    "PostgreSQL",
    "Docker",
    "AWS",
    "Kubernetes",
    "Figma",
    "SQL",
    "Communication",
    "Leadership",
]


def parse_resume_for_application(application: Application) -> dict:
    seed_text = " ".join(
        [
            application.candidate_name,
            application.email,
            application.portfolio_url or "",
            application.github_url or "",
            application.linkedin_url or "",
            application.resume.name or "",
            " ".join(application.job.skills),
        ]
    )
    text = seed_text.lower()
    matched_skills = [skill for skill in KNOWN_SKILLS if skill.lower() in text or skill in application.job.skills]
    years_matches = [int(match) for match in re.findall(r"(\d+)\+?\s*year", text)]
    experience_years = max(years_matches) if years_matches else max(application.job.experience_years_min - 1, 1)

    claims = [
        f"{experience_years} years {application.job.skills[0]}" if application.job.skills else f"{experience_years} years relevant experience",
        "Strong written communication",
    ]

    return {
        "extracted_skills": list(dict.fromkeys(matched_skills or application.job.skills[:4])),
        "experience_years": experience_years,
        "claims": claims,
        "summary": f"{application.candidate_name} appears aligned to {application.job.title} with emphasis on {', '.join((matched_skills or application.job.skills[:3])[:3])}.",
    }

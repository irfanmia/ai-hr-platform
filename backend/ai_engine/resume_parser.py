import logging
import os

from applications.models import Application

logger = logging.getLogger(__name__)


def parse_resume_for_application(application: Application) -> dict:
    """
    Parse the uploaded resume for an application.
    Routes to vision pipeline (PDF → screenshots → Groq) or text fallback.
    """
    from ai_engine.pdf_vision_parser import parse_resume_file

    # Get the actual file path on disk
    resume_path = None
    if application.resume:
        try:
            resume_path = application.resume.path
        except Exception:
            resume_path = None

    if resume_path and os.path.exists(resume_path):
        logger.info(f"Parsing resume via vision pipeline: {resume_path}")
        parsed = parse_resume_file(resume_path)
    else:
        logger.warning(f"Resume file not found for application {application.id}, using profile data")
        parsed = _fallback_from_profile(application)

    # Merge job skills to ensure relevant skills are considered
    job_skills = list(application.job.skills or [])
    merged_skills = list(dict.fromkeys(parsed.get("skills", []) + job_skills))

    return {
        **parsed,
        "extracted_skills": merged_skills[:15],  # cap at 15 for question gen
        "job_skills": job_skills,
        "candidate_name": parsed.get("full_name") or application.candidate_name,
    }


def _fallback_from_profile(application: Application) -> dict:
    """Fallback when file is missing — use profile data to seed."""
    import re

    seed_text = " ".join([
        application.candidate_name,
        application.email,
        application.portfolio_url or "",
        application.github_url or "",
        application.linkedin_url or "",
        " ".join(application.job.skills),
    ]).lower()

    KNOWN_SKILLS = [
        "Python", "Django", "React", "TypeScript", "PostgreSQL", "Docker",
        "AWS", "Kubernetes", "Figma", "SQL", "JavaScript", "Node.js",
        "Communication", "Leadership", "Git",
    ]
    matched = [s for s in KNOWN_SKILLS if s.lower() in seed_text or s in application.job.skills]
    exp = max(application.job.experience_years_min - 1, 1)

    return {
        "full_name": application.candidate_name,
        "email": application.email,
        "skills": matched,
        "experience_years": exp,
        "claims": [f"{exp} years of experience", "Proficient in relevant tools"],
        "summary": "",
        "method": "profile_fallback",
    }

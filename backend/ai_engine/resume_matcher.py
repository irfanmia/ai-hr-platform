"""
Resume-to-Job Matcher
---------------------
Scores how well a candidate's resume matches the job requirements.
This is worth 50 points out of the total 100.

Scoring breakdown (total 50):
  - Skills match:        up to 25 pts
  - Experience match:    up to 15 pts
  - Education/certs:     up to 10 pts

Also decides question strategy:
  - Strong match (>= 30/50): Use resume claims for questions
  - Weak match  (< 30/50):   Use job description for questions
"""

import logging
import os

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


def validate_is_resume(parsed: dict, pdf_path: str = None) -> dict:
    """
    Use Groq vision AI to check if the uploaded document is actually a resume.
    This is the primary validation — AI looks at the actual document pages.
    Falls back to heuristics if AI is unavailable.
    Returns {"is_resume": bool, "reason": str}
    """
    # Primary: use Groq vision to explicitly check (works for any document type)
    if pdf_path:
        try:
            from ai_engine.pdf_vision_parser import is_document_a_resume
            return is_document_a_resume(pdf_path)
        except Exception as e:
            logger.warning(f"Vision validation failed: {e} — falling back to heuristics")

    # Fallback: heuristic check using extracted fields
    name = parsed.get("full_name", "")
    skills = parsed.get("skills", [])
    raw = parsed.get("raw_text", "")
    resume_signals = 0
    if name and len(name.split()) >= 1: resume_signals += 1
    if skills and len(skills) >= 2: resume_signals += 2
    if parsed.get("experience_years", 0) > 0: resume_signals += 1
    if parsed.get("education"): resume_signals += 1
    raw_lower = raw.lower()
    resume_keywords = ["experience", "education", "skills", "work", "developer", "manager",
                       "analyst", "designer", "engineer", "years", "led", "built", "degree"]
    if sum(1 for kw in resume_keywords if kw in raw_lower) >= 3:
        resume_signals += 2
    if resume_signals < 3:
        return {
            "is_resume": False,
            "reason": "The document doesn't appear to be a resume. Please upload your CV or resume in PDF, DOC, or DOCX format."
        }
    return {"is_resume": True, "reason": ""}


def score_resume_match(parsed: dict, job) -> dict:
    """
    Score how well the resume matches the job. Returns score out of 50.

    Returns:
        {
            "resume_match_score": int (0-50),
            "skills_score": int (0-25),
            "experience_score": int (0-15),
            "education_score": int (0-10),
            "matched_skills": list,
            "missing_skills": list,
            "experience_gap": str,
            "question_strategy": "resume_based" | "jd_based",
            "match_summary": str,
        }
    """
    job_skills = [s.lower() for s in (job.skills or [])]
    candidate_skills = [s.lower() for s in (parsed.get("extracted_skills") or parsed.get("skills") or [])]
    candidate_exp = parsed.get("experience_years", 0)
    job_exp_min = job.experience_years_min or 0
    job_exp_max = job.experience_years_max or 20

    # ── Skills match (0-25) ──
    matched_skills = []
    missing_skills = []
    for skill in job_skills:
        # Check if any candidate skill contains or matches the job skill
        found = any(
            skill in cs or cs in skill or
            # Fuzzy: first 4 chars match
            (len(skill) > 3 and skill[:4] in cs)
            for cs in candidate_skills
        )
        if found:
            matched_skills.append(skill)
        else:
            missing_skills.append(skill)

    if job_skills:
        skills_pct = len(matched_skills) / len(job_skills)
    else:
        skills_pct = 0.5

    # Scale: 0-25 pts, but be generous — partial matches still reward
    skills_score = round(skills_pct * 25)
    # Minimum 5 pts if they have ANY relevant skills
    if matched_skills and skills_score < 5:
        skills_score = 5

    # ── Experience match (0-15) ──
    if candidate_exp >= job_exp_max:
        experience_score = 15  # Overqualified — still full score
        experience_gap = "exceeds"
    elif candidate_exp >= job_exp_min:
        # Within range
        range_size = max(1, job_exp_max - job_exp_min)
        pct = (candidate_exp - job_exp_min) / range_size
        experience_score = round(10 + pct * 5)
        experience_gap = "meets"
    elif candidate_exp >= job_exp_min - 1:
        # 1 year short — partial credit
        experience_score = 8
        experience_gap = "slightly_below"
    elif candidate_exp >= max(1, job_exp_min - 2):
        # 2 years short
        experience_score = 5
        experience_gap = "below"
    else:
        experience_score = 2
        experience_gap = "significantly_below"

    # ── Education/certs match (0-10) ──
    education = parsed.get("education", [])
    certifications = parsed.get("certifications", [])
    education_score = 0

    if education:
        education_score += 5
        # Bonus for relevant degree keywords
        edu_text = " ".join(str(e) for e in education).lower()
        job_text = (job.title + " " + job.department + " " + " ".join(job.skills or [])).lower()
        relevant_terms = ["computer", "software", "engineer", "science", "technology", "data",
                          "design", "business", "management", "finance", "analytics", "information"]
        if any(t in edu_text for t in relevant_terms):
            education_score += 3

    if certifications:
        # Only count relevant certs — filter out obvious unrelated ones
        irrelevant = ["padi", "scuba", "diving", "first aid", "cpr", "driving", "bartending",
                      "cooking", "yoga", "fitness", "real estate", "forex", "cosmetology"]
        relevant_certs = [c for c in certifications
                          if not any(irr in str(c).lower() for irr in irrelevant)]
        if relevant_certs:
            education_score = min(10, education_score + 2)

    education_score = min(10, education_score)

    # ── Total ──
    total = skills_score + experience_score + education_score

    # ── Question strategy ──
    # If match >= 30/50: resume is relevant → ask claim-based questions
    # If match < 30/50: resume is not that relevant → ask JD-based questions
    question_strategy = "resume_based" if total >= 30 else "jd_based"

    # ── Match summary ──
    if total >= 40:
        match_level = "Strong Match"
        summary = (
            f"Candidate is a strong match for the {job.title} role. "
            f"Matched {len(matched_skills)}/{len(job_skills)} required skills "
            f"with {candidate_exp} years of experience (requirement: {job_exp_min}–{job_exp_max} years)."
        )
    elif total >= 25:
        match_level = "Moderate Match"
        summary = (
            f"Candidate is a moderate match. Matched {len(matched_skills)}/{len(job_skills)} skills. "
            f"{'Experience meets requirements.' if experience_gap in ('meets', 'exceeds') else f'Experience is slightly below the required {job_exp_min}+ years.'}"
        )
    else:
        match_level = "Low Match"
        summary = (
            f"Resume shows limited alignment with the {job.title} requirements. "
            f"Only {len(matched_skills)}/{len(job_skills)} required skills found. "
            f"Missing: {', '.join(missing_skills[:3])}{'...' if len(missing_skills) > 3 else ''}."
        )

    return {
        "resume_match_score": total,
        "skills_score": skills_score,
        "experience_score": experience_score,
        "education_score": education_score,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "experience_gap": experience_gap,
        "question_strategy": question_strategy,
        "match_level": match_level,
        "match_summary": summary,
    }

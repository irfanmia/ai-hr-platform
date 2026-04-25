"""
Question Generator
------------------
Generates targeted, role-relevant interview questions based on:
- Job description, title, department, required skills
- Resume claims that are RELEVANT to the role
- Filters out irrelevant certifications/hobbies/unrelated experience

Each question includes:
- A detailed, elaborate prompt (no ambiguity)
- Word count guidance for the expected answer
- Source tag (job-based / claim-based / behavioral)
"""

from jobs.models import Job

from .mcq_generator import fallback_mcq, generate_mcq

# Skills and domains considered relevant per role type
ROLE_DOMAIN_KEYWORDS = {
    "software": ["python", "django", "react", "typescript", "javascript", "node", "sql", "postgresql",
                 "docker", "aws", "kubernetes", "git", "api", "backend", "frontend", "database",
                 "algorithm", "data structure", "system design", "architecture", "microservice",
                 "testing", "ci/cd", "devops", "cloud", "linux", "agile", "scrum"],
    "design": ["figma", "sketch", "ux", "ui", "prototyping", "wireframe", "user research",
                "design system", "adobe", "accessibility", "typography", "color", "motion"],
    "data": ["sql", "python", "tableau", "power bi", "statistics", "machine learning", "excel",
             "data pipeline", "etl", "analytics", "dashboard", "bigquery", "spark"],
    "product": ["roadmap", "stakeholder", "agile", "scrum", "analytics", "user story", "prioritization",
                "okr", "kpi", "a/b test", "market research", "product strategy"],
    "devops": ["docker", "kubernetes", "aws", "terraform", "ansible", "jenkins", "ci/cd",
               "linux", "bash", "monitoring", "prometheus", "grafana", "nginx"],
    "marketing": ["seo", "sem", "google ads", "social media", "content", "email marketing",
                  "analytics", "brand", "campaign", "crm"],
    "hr": ["recruitment", "onboarding", "performance", "payroll", "compliance", "talent",
           "employee engagement", "interview", "compensation"],
}

# Domains that are NEVER relevant for technical/professional roles
IRRELEVANT_DOMAINS = [
    "scuba", "padi", "diving", "swimming", "cooking", "baking", "sports", "fitness",
    "yoga", "meditation", "travel", "photography", "music", "art", "gaming",
    "driving", "first aid", "CPR", "bartending", "real estate license",
    "forex", "crypto trading", "cosmetology", "childcare",
]

# Skills that imply the role writes code as a regular activity. If any of
# these appear in the job's skills list (case-insensitive), or any of
# CODING_TITLE_HINTS appear in the title, we'll include a coding question.
# Otherwise the coding slot is replaced with a workflow descriptive Q —
# asking a UI/UX Designer to "write pseudocode for Figma" is nonsensical.
CODING_SKILL_KEYWORDS = {
    "python", "java", "javascript", "typescript", "react", "angular", "vue",
    "node", "node.js", "next.js", "django", "flask", "fastapi", "express",
    "rails", "spring", "laravel", "go", "golang", "rust", "c++", "c#",
    ".net", "scala", "kotlin", "swift", "objective-c",
    "sql", "postgresql", "postgres", "mysql", "mongodb", "redis", "elasticsearch",
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform", "ansible",
    "ci/cd", "jenkins", "github actions", "gitlab ci",
    "rest api", "graphql", "grpc", "microservices", "serverless",
    "shell scripting", "bash", "linux administration",
}
CODING_TITLE_HINTS = (
    "engineer", "developer", "programmer", "architect",
    "data analyst", "data scientist", "data engineer",
    "ml engineer", "machine learning engineer",
    "devops", "sre", "site reliability",
    "backend", "front end", "frontend", "front-end", "full stack", "fullstack",
    "qa", "test engineer", "automation",
)


def is_coding_role(job: Job) -> bool:
    """True iff this role's day-to-day work involves writing code.

    Used to decide whether to ask a literal pseudocode question or swap in a
    workflow-style descriptive question that's appropriate for the role.
    """
    title_l = (job.title or "").lower()
    if any(hint in title_l for hint in CODING_TITLE_HINTS):
        return True
    skills_l = [s.strip().lower() for s in (job.skills or [])]
    if any(skill in CODING_SKILL_KEYWORDS for skill in skills_l):
        return True
    return False


def is_claim_relevant(claim: str, job: Job) -> bool:
    """Check if a resume claim is relevant to the job role."""
    claim_lower = claim.lower()

    # Reject if clearly unrelated hobby/certification
    for irrelevant in IRRELEVANT_DOMAINS:
        if irrelevant.lower() in claim_lower:
            return False

    # Check if claim mentions job title words
    job_title_words = job.title.lower().split()
    job_dept_words = job.department.lower().split()
    if any(word in claim_lower for word in job_title_words + job_dept_words if len(word) > 3):
        return True

    # Check if claim mentions required skills
    for skill in (job.skills or []):
        if skill.lower() in claim_lower:
            return True

    # Detect role domain and check relevance
    combined = (job.title + " " + job.department + " " + " ".join(job.skills or [])).lower()
    for domain, keywords in ROLE_DOMAIN_KEYWORDS.items():
        if any(kw in combined for kw in keywords[:5]):
            if any(kw in claim_lower for kw in keywords):
                return True

    # Generic professional claims are always OK
    generic_ok = ["years of experience", "led", "managed", "delivered", "built", "developed",
                  "shipped", "improved", "reduced", "increased", "mentored", "collaborated"]
    if any(phrase in claim_lower for phrase in generic_ok):
        return True

    return False


def _build_practical_question(job: Job, primary_skill: str) -> dict:
    """
    The "show me you actually do this" question. For coding roles it's a
    pseudocode prompt; for everyone else it's a workflow walk-through.
    Asking a UI/UX Designer to write pseudocode for Figma was producing
    embarrassing prompts — this swap fixes it.
    """
    if is_coding_role(job):
        return {
            "id": "q_tech_2",
            "type": "coding",
            "source": "job_based",
            "word_count": "5–20 lines of code or pseudocode",
            "prompt": (
                f"Write a short code snippet or pseudocode that demonstrates a real use case for "
                f"{primary_skill} relevant to a {job.title} role. "
                f"Add brief inline comments explaining your logic and any trade-offs you considered."
            ),
            "expected_keywords": [primary_skill.lower(), "function", "return", "comment", "logic"],
        }
    # Non-coding roles: practical workflow question instead
    return {
        "id": "q_tech_2",
        "type": "descriptive",
        "source": "job_based",
        "word_count": "150–250 words",
        "prompt": (
            f"Walk us through your end-to-end workflow when applying {primary_skill} to a real "
            f"{job.title} project. Cover: how you start, the artefacts or deliverables you produce, "
            f"how you collaborate with others (designers, PMs, engineers, stakeholders), and how you "
            f"validate that the outcome was successful. Use a specific recent example you can speak to."
        ),
        "expected_keywords": [
            primary_skill.lower(), "workflow", "collaborate", "deliver", "validate", "outcome",
        ],
    }


def _build_mcq_question(job: Job, primary_skill: str) -> dict:
    """
    Produce the q_mcq_1 entry. Tries Groq first for a context-relevant MCQ;
    if Groq is unavailable or returns malformed output, slots in a sensible
    fallback that still references the actual role + skill (no payroll /
    legal / office-space placeholders).

    The 'expected_keywords' list is filled with the correct option's keywords
    so the answer evaluator can score MCQ answers consistently with other
    question types.
    """
    generated = generate_mcq(
        job_title=job.title,
        job_department=job.department,
        job_skills=job.skills or [],
        primary_skill=primary_skill,
    )
    if generated is None:
        fb = fallback_mcq(job.title, primary_skill)
        return {
            "id": "q_mcq_1",
            "type": "mcq",
            "source": "job_based",
            "word_count": "Select one option",
            "prompt": fb["prompt"],
            "options": fb["options"],
            # The first option in the fallback is always correct
            "correct_option": fb["options"][fb["correct_index"]],
            "expected_keywords": [primary_skill.lower()] + [
                w.lower() for w in fb["options"][fb["correct_index"]].split()[:6]
            ],
        }
    # Successful Groq generation
    correct_text = generated.correct_option
    return {
        "id": "q_mcq_1",
        "type": "mcq",
        "source": "job_based",
        "word_count": "Select one option",
        "prompt": generated.prompt,
        "options": generated.options,
        "correct_option": correct_text,
        # Pull a few representative keywords from the correct answer so the
        # answer evaluator can credit candidates who picked it.
        "expected_keywords": [primary_skill.lower()] + [
            w.lower() for w in correct_text.split()[:6]
        ],
    }


def generate_interview_questions(job: Job, parsed_resume: dict) -> list[dict]:
    """
    Generate 10 role-relevant interview questions with word count guidance.

    Strategy:
    - question_strategy = 'resume_based' (match >= 30/50): use resume claims for questions
    - question_strategy = 'jd_based' (match < 30/50): use job description, ignore resume claims
    """
    strategy = parsed_resume.get("question_strategy", "resume_based")
    skills = parsed_resume.get("extracted_skills") or parsed_resume.get("skills") or job.skills or []
    all_claims = parsed_resume.get("claims", [])
    experience_years = parsed_resume.get("experience_years", 1)

    # Always use job skills as base
    job_skills = job.skills or []
    job_combined = (job.title + " " + job.department + " " + " ".join(job_skills)).lower()

    if strategy == "jd_based":
        # Weak resume match: focus entirely on JD skills, ignore resume claims
        relevant_skills = job_skills[:5] or skills[:5]
        relevant_claims = []  # No claim-based questions
    else:
        # Strong resume match: blend resume skills with job skills
        relevant_skills = [s for s in skills if any(
            s.lower() in job_combined or
            s.lower() in (job.description or "").lower() or
            s in job_skills
            for _ in [1]
        )] or job_skills[:5] or skills[:5]
        relevant_claims = [c for c in all_claims if is_claim_relevant(c, job)]

    primary_skill = relevant_skills[0] if relevant_skills else (job_skills[0] if job_skills else "your core skill")
    secondary_skill = relevant_skills[1] if len(relevant_skills) > 1 else "communication"
    third_skill = relevant_skills[2] if len(relevant_skills) > 2 else "problem-solving"

    # Build claim-based questions (max 3, only from relevant claims, only if strategy allows)
    claim_questions = []
    for i, claim in enumerate(relevant_claims[:3]):
        claim_questions.append({
            "id": f"claim_{i}",
            "type": "descriptive",
            "source": "claim_validation",
            "word_count": "150–250 words",
            "prompt": (
                f"Your resume states: \"{claim}\". "
                f"Please describe a **specific, real situation** where this was demonstrated in a professional context. "
                f"Include: what the challenge was, what actions you took, what tools or methods you used, "
                f"and what the measurable outcome was."
            ),
            "expected_keywords": ["specific", "challenge", "outcome", "result", "tool", "action"],
        })

    # Core job-relevant question bank
    question_bank = [
        {
            "id": "q_tech_1",
            "type": "descriptive",
            "source": "job_based",
            "word_count": "150–200 words",
            "prompt": (
                f"As a {job.title} in the {job.department} team, you'll regularly work with {primary_skill}. "
                f"Describe the most complex or impactful project where you applied {primary_skill}. "
                f"Walk us through the problem, your approach, the technical decisions you made, and the final outcome."
            ),
            "expected_keywords": ["complex", "approach", "decision", "outcome", "impact"],
        },
        _build_practical_question(job, primary_skill),
        {
            "id": "q_tech_3",
            "type": "descriptive",
            "source": "job_based",
            "word_count": "100–180 words",
            "prompt": (
                f"The {job.title} role requires strong proficiency in {secondary_skill}. "
                f"Give a concrete example from your work history where {secondary_skill} was critical to success. "
                f"What would have gone wrong without it, and what did you do differently because of it?"
            ),
            "expected_keywords": [secondary_skill.lower(), "critical", "example", "different"],
        },
        {
            "id": "q_scenario_1",
            "type": "scenario",
            "source": "behavioral",
            "word_count": "120–200 words",
            "prompt": (
                f"Imagine you're 3 days before a key {job.title} deliverable, and a stakeholder requests a significant "
                f"scope change that would require an extra week of work. "
                f"Walk through your exact decision-making process: Who do you involve? How do you communicate the impact? "
                f"What trade-offs do you evaluate? And what's your final recommendation?"
            ),
            "expected_keywords": ["communicate", "stakeholder", "trade-off", "scope", "prioritize"],
        },
        _build_mcq_question(job, primary_skill),
        {
            "id": "q_exp_1",
            "type": "descriptive",
            "source": "experience_based",
            "word_count": "150–250 words",
            "prompt": (
                f"You mentioned {experience_years} year(s) of relevant experience. "
                f"Looking back at that journey specifically as it relates to a {job.title} role — "
                f"what is the single most technically challenging problem you solved? "
                f"Describe the context, the constraints you faced, your solution, and what you'd do differently today."
            ),
            "expected_keywords": ["challenge", "constraint", "solution", "differently", "technical"],
        },
        {
            "id": "q_scenario_2",
            "type": "scenario",
            "source": "behavioral",
            "word_count": "100–150 words",
            "prompt": (
                f"A critical issue surfaces in your work right before a major deliverable for a "
                f"{job.department} client. You have 30 minutes before the deadline. "
                f"Describe step-by-step exactly what you do — who you involve, how you assess severity, "
                f"and how you decide between a quick fix, postponing the deadline, or escalating."
            ),
            "expected_keywords": ["assess", "severity", "escalate", "communicate", "decide", "prioritize"],
        },
        {
            "id": "q_skill_3",
            "type": "descriptive",
            "source": "job_based",
            "word_count": "100–150 words",
            "prompt": (
                f"The {job.title} role at this company lists {third_skill} as a required skill. "
                f"Describe a situation where you had to rapidly develop or apply {third_skill} under real pressure. "
                f"What was the timeline, what resources did you use, and what was the result?"
            ),
            "expected_keywords": [third_skill.lower(), "rapid", "result", "timeline"],
        },
        {
            "id": "q_fit",
            "type": "descriptive",
            "source": "culture_fit",
            "word_count": "100–150 words",
            "prompt": (
                f"Based on the job description for {job.title} in the {job.department} team — "
                f"what specific aspect of this role excites you most, and what unique value do your skills in "
                f"{primary_skill} and {secondary_skill} bring that other candidates might not?"
            ),
            "expected_keywords": ["unique", "value", "excited", "contribute", "skill"],
        },
        {
            "id": "q_one_word",
            "type": "one_word",
            "source": "behavioral",
            "word_count": "1 word",
            "prompt": (
                "In exactly one word — what do your colleagues consistently say is your strongest professional quality "
                "that directly helps your team deliver results?"
            ),
            "expected_keywords": ["focused", "reliable", "analytical", "collaborative", "creative", "decisive"],
        },
    ]

    # Combine: relevant claim questions first, then job-based ones
    all_questions = claim_questions + question_bank

    # Return exactly 10
    return all_questions[:10]

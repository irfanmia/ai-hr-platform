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


def generate_interview_questions(job: Job, parsed_resume: dict) -> list[dict]:
    """
    Generate 10 role-relevant interview questions with word count guidance.
    Questions mix: job-based technical, claim validation, and behavioral.
    """
    skills = parsed_resume.get("extracted_skills") or parsed_resume.get("skills") or job.skills or []
    all_claims = parsed_resume.get("claims", [])
    experience_years = parsed_resume.get("experience_years", 1)

    # Filter skills to job-relevant ones
    job_combined = (job.title + " " + job.department + " " + " ".join(job.skills or [])).lower()
    relevant_skills = [s for s in skills if any(
        s.lower() in job_combined or
        s.lower() in (job.description or "").lower() or
        s in (job.skills or [])
        for _ in [1]
    )] or skills[:5]

    primary_skill = relevant_skills[0] if relevant_skills else (job.skills[0] if job.skills else "your core skill")
    secondary_skill = relevant_skills[1] if len(relevant_skills) > 1 else "communication"
    third_skill = relevant_skills[2] if len(relevant_skills) > 2 else "problem-solving"

    # Filter claims to job-relevant ones only
    relevant_claims = [c for c in all_claims if is_claim_relevant(c, job)]

    # Build claim-based questions (max 3, only from relevant claims)
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
        {
            "id": "q_tech_2",
            "type": "coding",
            "source": "job_based",
            "word_count": "5–20 lines of code or pseudocode",
            "prompt": (
                f"Write a short code snippet or pseudocode that demonstrates a real use case for {primary_skill} "
                f"relevant to a {job.title} role. "
                f"Add brief inline comments explaining your logic and any trade-offs you considered."
            ),
            "expected_keywords": [primary_skill.lower(), "function", "return", "comment", "logic"],
        },
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
        {
            "id": "q_mcq_1",
            "type": "mcq",
            "source": "job_based",
            "word_count": "Select one option",
            "prompt": (
                f"In the context of a {job.title} role, which of the following best describes "
                f"the primary purpose of {primary_skill}?"
            ),
            "options": [
                f"To {['build', 'optimise', 'design', 'manage'][hash(primary_skill) % 4]} scalable and maintainable systems",
                "To manage company payroll and benefits",
                "To handle legal contracts and compliance documentation",
                "To design physical office spaces and layouts",
            ],
            "expected_keywords": [primary_skill.lower(), "scalable", "maintainable"],
        },
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
                f"A critical bug is discovered in production right before a major demo for a {job.department} client. "
                f"You have 30 minutes. "
                f"Describe step-by-step exactly what you do — who you contact first, how you assess severity, "
                f"and whether you fix, roll back, or workaround."
            ),
            "expected_keywords": ["assess", "severity", "rollback", "fix", "communicate", "prioritize"],
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

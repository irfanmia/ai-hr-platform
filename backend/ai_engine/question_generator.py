"""
Question Generator
------------------
Generates targeted interview questions based on:
- Job requirements
- Resume claims extracted by the vision parser

Questions directly challenge specific claims the candidate made in their resume,
making the AI evaluation meaningful and hard to fake.
"""

from jobs.models import Job


def generate_interview_questions(job: Job, parsed_resume: dict) -> list[dict]:
    skills = parsed_resume.get("extracted_skills") or parsed_resume.get("skills") or job.skills or ["Communication"]
    claims = parsed_resume.get("claims", [])
    experience_years = parsed_resume.get("experience_years", 1)
    primary_skill = skills[0] if skills else "your primary skill"
    secondary_skill = skills[1] if len(skills) > 1 else "problem-solving"
    third_skill = skills[2] if len(skills) > 2 else "teamwork"

    # Build claim-based questions
    claim_questions = []
    for i, claim in enumerate(claims[:3]):
        claim_questions.append({
            "id": f"claim_{i}",
            "type": "descriptive",
            "prompt": f"Your resume states: \"{claim}\". Describe a specific situation where this was demonstrated. What was the outcome?",
            "expected_keywords": ["specific", "result", "outcome", "achieved"],
            "source": "claim_validation",
        })

    # Core question bank
    question_bank = [
        {
            "id": "q1",
            "type": "mcq",
            "prompt": f"Which of the following best describes a key responsibility of a {job.title}?",
            "options": [
                f"Leading {primary_skill} implementations end-to-end",
                "Managing payroll for all employees",
                "Designing office furniture layouts",
                "Scheduling flights for executives",
            ],
            "expected_keywords": [primary_skill.lower(), "leading", "implementation"],
        },
        {
            "id": "q2",
            "type": "descriptive",
            "prompt": f"You claim {experience_years} year(s) of experience. Describe your most impactful project in that time. What did you build, and what was the measurable result?",
            "expected_keywords": ["built", "impact", "result", "metric", "delivered"],
        },
        {
            "id": "q3",
            "type": "coding",
            "prompt": f"Write a short code snippet or pseudocode showing how you would use {primary_skill} to solve a real problem from your experience.",
            "expected_keywords": [primary_skill.lower(), "function", "return", "logic"],
        },
        {
            "id": "q4",
            "type": "descriptive",
            "prompt": f"How have you used {secondary_skill} professionally? Give a concrete example with a measurable outcome.",
            "expected_keywords": [secondary_skill.lower(), "example", "result"],
        },
        {
            "id": "q5",
            "type": "scenario",
            "prompt": f"A stakeholder changes the requirements for a {job.title} deliverable mid-project, just 3 days before the deadline. Walk me through exactly what you would do.",
            "expected_keywords": ["communicate", "prioritize", "escalate", "scope"],
        },
        {
            "id": "q6",
            "type": "mcq",
            "prompt": f"For a {job.title} role, which skill is MOST critical to succeed in the first 90 days?",
            "options": [
                primary_skill,
                "Calligraphy",
                "Video editing",
                "Travel planning",
            ],
            "expected_keywords": [primary_skill.lower()],
        },
        {
            "id": "q7",
            "type": "one_word",
            "prompt": "In one word, what do colleagues consistently say is your greatest professional strength?",
            "expected_keywords": ["focused", "reliable", "creative", "analytical", "collaborative"],
        },
        {
            "id": "q8",
            "type": "descriptive",
            "prompt": f"Describe a time you had to learn {third_skill} quickly under pressure. What was your approach and what did you deliver?",
            "expected_keywords": ["learned", "delivered", "pressure", "approach"],
        },
        {
            "id": "q9",
            "type": "scenario",
            "prompt": "You discover a critical bug in production right before a major demo. You have 30 minutes. What do you do?",
            "expected_keywords": ["fix", "escalate", "communicate", "rollback", "workaround"],
        },
        {
            "id": "q10",
            "type": "descriptive",
            "prompt": f"Why specifically do you want this {job.title} role at this company, and what unique value do your skills in {primary_skill} bring to the team?",
            "expected_keywords": ["contribute", "value", "skill", "team", "growth"],
        },
    ]

    # Combine: claim questions first (most targeted), then general questions
    all_questions = claim_questions + question_bank

    # Return up to 10 questions
    return all_questions[:10]

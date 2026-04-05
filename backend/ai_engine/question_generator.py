from jobs.models import Job


def generate_interview_questions(job: Job, parsed_resume: dict) -> list[dict]:
    primary_skills = (parsed_resume.get("extracted_skills") or job.skills or ["Communication"])[:4]
    question_bank = [
        {
            "id": "q1",
            "type": "mcq",
            "prompt": f"Which practice best improves maintainability when building a {job.title} workflow?",
            "options": ["Clear interfaces", "Larger commits", "Skipping tests", "Single giant module"],
            "expected_keywords": ["clear", "interfaces", "maintainability"],
        },
        {
            "id": "q2",
            "type": "descriptive",
            "prompt": f"Describe a project where you used {primary_skills[0]}. What problem did you solve?",
            "expected_keywords": [primary_skills[0].lower(), "impact", "problem"],
        },
        {
            "id": "q3",
            "type": "coding",
            "prompt": f"Write pseudocode or code to validate applicant data for a {job.department} team form.",
            "expected_keywords": ["validate", "field", "error", "return"],
        },
        {
            "id": "q4",
            "type": "scenario",
            "prompt": "A stakeholder changes requirements mid-sprint. How do you respond?",
            "expected_keywords": ["clarify", "communicate", "prioritize"],
        },
        {
            "id": "q5",
            "type": "one_word",
            "prompt": "One word that describes your working style.",
            "expected_keywords": ["focused", "curious", "collaborative", "adaptable"],
        },
        {
            "id": "q6",
            "type": "mcq",
            "prompt": f"Which skill is most critical for this role based on the JD?",
            "options": [
                primary_skills[0],
                "Graphic Design",
                "Payroll",
                "Procurement",
            ],
            "expected_keywords": [primary_skills[0].lower()],
        },
        {
            "id": "q7",
            "type": "descriptive",
            "prompt": "How do you measure the success of your work?",
            "expected_keywords": ["metric", "outcome", "quality"],
        },
        {
            "id": "q8",
            "type": "scenario",
            "prompt": "You notice a quality issue right before launch. What do you do?",
            "expected_keywords": ["escalate", "fix", "risk"],
        },
        {
            "id": "q9",
            "type": "coding",
            "prompt": f"Show how you would transform a list of {job.title} candidates into a ranked shortlist.",
            "expected_keywords": ["sort", "score", "list"],
        },
        {
            "id": "q10",
            "type": "descriptive",
            "prompt": "Why are you interested in this role?",
            "expected_keywords": ["role", "team", "growth"],
        },
    ]
    return question_bank

from statistics import mean

from applications.models import Application


def _score_answer(answer: str, expected_keywords: list[str]) -> int:
    normalized = (answer or "").lower()
    matches = sum(1 for keyword in expected_keywords if keyword.lower() in normalized)
    base = 40 if normalized.strip() else 0
    return min(100, base + matches * 20 + min(len(normalized) // 20, 20))


def evaluate_answers(application: Application, questions: list[dict], answers: dict, parsed_resume: dict) -> dict:
    scored_answers = []
    for question in questions:
        question_id = question["id"]
        answer = answers.get(question_id, "")
        score = _score_answer(str(answer), question.get("expected_keywords", []))
        scored_answers.append(
            {
                "question_id": question_id,
                "type": question["type"],
                "score": score,
                "answer": answer,
            }
        )

    average_score = round(mean([item["score"] for item in scored_answers])) if scored_answers else 0
    resume_strength = min(
        100,
        45 + len(parsed_resume.get("extracted_skills", [])) * 7 + parsed_resume.get("experience_years", 0) * 3,
    )
    candidate_vector = {
        "problem_solving": max(55, average_score - 3),
        "communication": min(100, average_score + 4),
        "technical_depth": min(100, average_score),
        "adaptability": min(100, average_score + 2),
    }

    return {
        "average_score": average_score,
        "resume_strength_score": resume_strength,
        "scored_answers": scored_answers,
        "candidate_vector": candidate_vector,
        "skill_signals": {
            skill: min(95, average_score - index * 5 + 8)
            for index, skill in enumerate((application.job.skills or ["Generalist"])[:5])
        },
    }

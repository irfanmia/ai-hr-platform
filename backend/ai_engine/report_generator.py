from jobs.models import Job


def compile_ai_report(job: Job, parsed_resume: dict, evaluation: dict) -> dict:
    overall = evaluation["average_score"]
    resume_strength = evaluation["resume_strength_score"]
    gap = overall - resume_strength
    recommendation = "Strong Hire" if overall >= 75 else "Consider" if overall >= 60 else "Reject"

    claim_validation = []
    for claim in parsed_resume.get("claims", []):
        status = "verified" if overall >= 75 else "partial" if overall >= 60 else "weak"
        evidence = "Answered advanced questions correctly" if status == "verified" else "Signals partially supported by interview responses"
        claim_validation.append({"claim": claim, "status": status, "evidence": evidence})

    return {
        "overall_score": overall,
        "resume_strength_score": resume_strength,
        "actual_performance_score": overall,
        "gap_analysis": {
            "type": "positive" if gap >= 0 else "negative",
            "score_difference": abs(gap),
            "explanation": "Candidate demonstrates stronger practical skills than resume suggests"
            if gap >= 0
            else "Interview performance did not fully validate the resume claims",
        },
        "skill_breakdown": evaluation["skill_signals"],
        "claim_validation": claim_validation,
        "key_findings": [
            "Strong algorithmic thinking" if overall >= 75 else "Solid fundamentals with room to deepen execution",
            "Communication above resume level" if evaluation["candidate_vector"]["communication"] >= 75 else "Communication needs more structure",
        ],
        "strengths": [
            "Problem solving",
            "Clear communication" if evaluation["candidate_vector"]["communication"] >= 70 else "Execution under guidance",
        ],
        "weaknesses": [
            "Limited system design exposure" if overall < 85 else "Could provide more concrete delivery metrics",
        ],
        "behavioral_insights": {
            "confidence": evaluation["candidate_vector"]["adaptability"],
            "clarity": evaluation["candidate_vector"]["communication"],
            "depth_of_knowledge": evaluation["candidate_vector"]["technical_depth"],
        },
        "recommendation": recommendation,
    }

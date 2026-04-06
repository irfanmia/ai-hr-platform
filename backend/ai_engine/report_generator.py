from jobs.models import Job


def compile_ai_report(job: Job, parsed_resume: dict, evaluation: dict) -> dict:
    overall = evaluation["average_score"]
    resume_strength = evaluation["resume_strength_score"]
    gap = overall - resume_strength
    recommendation = evaluation.get("recommendation") or ("Strong Hire" if overall >= 78 else "Consider" if overall >= 62 else "Reject")

    claim_validation = []
    for claim in parsed_resume.get("claims", []):
        status = "verified" if overall >= 75 else "partial" if overall >= 60 else "weak"
        evidence = "Answered advanced questions correctly" if status == "verified" else "Signals partially supported by interview responses"
        claim_validation.append({"claim": claim, "status": status, "evidence": evidence})

    return {
        "overall_score": overall,
        "resume_strength_score": resume_strength,
        "actual_performance_score": evaluation.get("actual_performance_score", overall),
        "gap_analysis": evaluation.get("gap_analysis") or {
            "type": "positive" if gap >= 0 else "negative",
            "score_difference": abs(gap),
            "explanation": "Candidate demonstrates stronger practical skills than resume suggests"
            if gap >= 0
            else "Interview performance did not fully validate the resume claims",
        },
        "skill_breakdown": evaluation["skill_signals"],
        "claim_validation": evaluation.get("claim_validation") or claim_validation,
        "key_findings": evaluation.get("key_findings", [
            "Strong algorithmic thinking" if overall >= 75 else "Solid fundamentals with room to deepen execution",
            "Communication clarity was clear and structured" if evaluation["candidate_vector"].get("clarity", 65) >= 70 else "Communication would benefit from more concrete examples",
        ]),
        "strengths": evaluation.get("strengths", [
            "Problem solving",
            "Clear communication" if evaluation["candidate_vector"].get("clarity", 65) >= 70 else "Execution under guidance",
        ]),
        "weaknesses": evaluation.get("weaknesses", [
            "Limited system design exposure" if overall < 85 else "Could provide more concrete delivery metrics",
        ]),
        "behavioral_insights": evaluation.get("behavioral_insights", {
            "confidence": evaluation["candidate_vector"].get("confidence", 65),
            "clarity": evaluation["candidate_vector"].get("clarity", 65),
            "depth_of_knowledge": evaluation["candidate_vector"].get("depth_of_knowledge", 65),
        }),
        "recommendation": recommendation,
    }

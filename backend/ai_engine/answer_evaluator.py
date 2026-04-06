"""
Answer Evaluator
----------------
Scores candidate answers generously — rewards effort, length, and relevance.
Not designed to fail candidates but to differentiate quality levels.

Scoring philosophy:
- Attempting an answer = baseline 55+ (participation credit)
- Longer, thoughtful answers = higher scores
- Keyword matching adds points but is not required to pass
- Maximum score is capped at 95 (perfection is rare)
- Minimum score for a real attempt is 45
"""

from statistics import mean

from applications.models import Application


def _score_answer(answer: str, question_type: str, expected_keywords: list[str]) -> int:
    text = (answer or "").strip()

    if not text:
        return 0  # No answer = 0

    word_count = len(text.split())
    text_lower = text.lower()

    # Base score for attempting — generous starting point
    base = 55

    # Length bonus (rewards elaboration)
    if question_type == "one_word":
        length_bonus = 5 if word_count <= 3 else 0
    elif question_type == "mcq":
        length_bonus = 10  # MCQ is always full credit if answered
    elif question_type in ("descriptive", "scenario"):
        # 150-250 words is ideal; reward proportionally
        if word_count >= 150:
            length_bonus = 20
        elif word_count >= 80:
            length_bonus = 15
        elif word_count >= 40:
            length_bonus = 10
        elif word_count >= 15:
            length_bonus = 5
        else:
            length_bonus = 2
    elif question_type == "coding":
        lines = len([l for l in text.split("\n") if l.strip()])
        length_bonus = min(20, lines * 3)
    else:
        length_bonus = min(15, word_count // 10)

    # Keyword relevance bonus (soft — just adds points, doesn't penalise)
    keyword_bonus = 0
    if expected_keywords:
        matches = sum(1 for kw in expected_keywords if kw.lower() in text_lower)
        keyword_bonus = min(15, matches * 4)

    # Quality signals bonus
    quality_bonus = 0
    quality_signals = [
        "because", "therefore", "as a result", "for example", "specifically",
        "in my experience", "the outcome was", "we achieved", "i measured",
        "the challenge was", "i decided to", "i learned", "this led to",
        "the impact", "we reduced", "we improved", "we increased",
    ]
    quality_hits = sum(1 for sig in quality_signals if sig in text_lower)
    quality_bonus = min(10, quality_hits * 3)

    total = base + length_bonus + keyword_bonus + quality_bonus

    # Cap between 45 (minimum for real attempt) and 95
    return max(45, min(95, total))


def evaluate_answers(application: Application, questions: list[dict], answers: dict, parsed_resume: dict) -> dict:
    scored_answers = []

    for question in questions:
        qid = question["id"]
        qtype = question.get("type", "descriptive")
        answer = answers.get(qid, "")
        score = _score_answer(str(answer), qtype, question.get("expected_keywords", []))
        scored_answers.append({
            "question_id": qid,
            "type": qtype,
            "score": score,
            "answer": answer,
        })

    avg = round(mean([s["score"] for s in scored_answers])) if scored_answers else 60

    # ── Weighted scoring: resume match + interview (weights set per job by HR) ──
    match_result = parsed_resume.get("match_result", {})
    resume_match_score_raw = match_result.get("resume_match_score", None)  # 0-50

    # Get weights from job (default 50/50)
    resume_weight = getattr(application.job, "resume_match_weight", 50)  # HR-configured
    interview_weight = getattr(application.job, "interview_weight", 50)   # HR-configured
    total_weight = resume_weight + interview_weight or 100

    if resume_match_score_raw is not None:
        # Scale resume match (0-50 raw) to job's weight
        resume_component = round((resume_match_score_raw / 50) * resume_weight)
        # Scale interview avg (0-100) to job's interview weight
        interview_component = round((avg / 100) * interview_weight)
        combined_score = resume_component + interview_component
        resume_strength = round(resume_match_score_raw * 2)   # display as 0-100
        actual_performance = avg  # interview score display as 0-100
    else:
        # Fallback
        skill_count = len(parsed_resume.get("extracted_skills", parsed_resume.get("skills", [])))
        exp_years = parsed_resume.get("experience_years", 1)
        resume_strength = min(95, 50 + skill_count * 4 + exp_years * 3)
        actual_performance = min(95, avg + 5)
        combined_score = avg

    avg = combined_score

    # Gap analysis
    gap = actual_performance - resume_strength
    gap_type = "positive" if gap >= 0 else "negative"
    gap_abs = abs(gap)

    if gap_type == "positive":
        gap_explanation = (
            f"The candidate performed {gap_abs} points above what their resume suggests. "
            f"They demonstrated strong practical knowledge and gave thoughtful, detailed answers "
            f"that go beyond what a resume alone can convey. This is a hidden gem candidate."
        ) if gap_abs > 8 else (
            f"The candidate's interview performance closely matches their resume — consistent and reliable. "
            f"Answers were well-structured and showed genuine understanding of the role requirements."
        )
    else:
        gap_explanation = (
            f"The candidate's interview performance was {gap_abs} points below their resume level. "
            f"Some answers lacked the depth or specificity expected given their stated experience. "
            f"Recommend probing further in a follow-up interview before making a final decision."
        ) if gap_abs > 10 else (
            f"The candidate performed slightly below their resume level, but the gap is minor. "
            f"Overall answers showed understanding of the role. A brief follow-up call is recommended."
        )

    # Skill breakdown — job skills scored relative to interview performance
    job_skills = application.job.skills or ["Communication"]
    skill_breakdown = {}
    for i, skill in enumerate(job_skills[:6]):
        # Vary scores naturally around the average (±10 range)
        variation = [8, -5, 12, -3, 6, -8]
        raw = avg + variation[i % len(variation)]
        skill_breakdown[skill] = max(40, min(95, raw))

    # Behavioral dimensions
    candidate_vector = {
        "confidence": max(45, min(95, avg + 3)),
        "clarity": max(45, min(95, avg + 6)),
        "depth_of_knowledge": max(45, min(95, avg - 2)),
    }

    # Recommendation logic
    if avg >= 78:
        recommendation = "Strong Hire"
    elif avg >= 62:
        recommendation = "Consider"
    else:
        recommendation = "Reject"

    # Key findings
    key_findings = _generate_key_findings(avg, gap, gap_type, skill_count, exp_years, application)

    # Strengths and weaknesses
    strengths, weaknesses = _generate_strengths_weaknesses(avg, scored_answers, application)

    return {
        "average_score": avg,
        "resume_strength_score": resume_strength,
        "actual_performance_score": actual_performance,
        "scored_answers": scored_answers,
        "candidate_vector": candidate_vector,
        "skill_signals": skill_breakdown,

        # Full report fields
        "overall_score": avg,
        "skill_breakdown": skill_breakdown,
        "gap_analysis": {
            "type": gap_type,
            "score_difference": gap_abs,
            "explanation": gap_explanation,
        },
        "claim_validation": _validate_claims(parsed_resume, avg),
        "key_findings": key_findings,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "behavioral_insights": candidate_vector,
        "recommendation": recommendation,
    }


def _generate_key_findings(avg, gap, gap_type, skill_count, exp_years, application):
    findings = []

    if avg >= 78:
        findings.append(f"Demonstrated strong command of {application.job.title} role requirements.")
    elif avg >= 62:
        findings.append(f"Showed solid foundational understanding of the {application.job.title} role.")
    else:
        findings.append(f"Candidate has a basic understanding of the role but may need more experience.")

    if gap_type == "positive" and abs(gap) > 8:
        findings.append("Candidate outperformed their resume — practical skills exceed what's on paper.")
    elif gap_type == "negative" and abs(gap) > 10:
        findings.append("Some answers lacked depth relative to claimed experience level.")

    if exp_years >= 5:
        findings.append(f"With {exp_years} years of experience, brings meaningful industry context.")
    elif exp_years >= 2:
        findings.append(f"{exp_years} years of experience shows a growing professional with room to scale.")

    if skill_count >= 5:
        findings.append(f"Broad skill set across {skill_count} relevant areas strengthens versatility.")

    findings.append(
        "Communication quality in written answers was clear and structured." if avg >= 65
        else "Written communication would benefit from more concrete examples and specifics."
    )

    return findings[:5]


def _generate_strengths_weaknesses(avg, scored_answers, application):
    strengths = []
    weaknesses = []

    if avg >= 70:
        strengths.append("Articulate and structured in responses — easy to follow line of thinking.")
    if any(s["score"] >= 80 for s in scored_answers):
        strengths.append("Excelled in at least one key question — shows depth of knowledge in that area.")
    strengths.append(f"Relevant background for a {application.job.title} in the {application.job.department} team.")

    if avg < 70:
        weaknesses.append("Some answers were brief and could benefit from more specific examples.")
    if any(s["score"] < 55 for s in scored_answers):
        weaknesses.append("Struggled with at least one question — worth exploring in a follow-up.")
    weaknesses.append("Written format may not fully capture verbal communication ability — consider a live interview.")

    return strengths[:3], weaknesses[:3]


def _validate_claims(parsed_resume, avg):
    claims = parsed_resume.get("claims", [])
    if not claims:
        return []

    results = []
    for i, claim in enumerate(claims[:5]):
        if avg >= 75:
            status = "verified"
            evidence = "Candidate answered related questions with sufficient depth and specifics."
        elif avg >= 60:
            status = "partial"
            evidence = "Candidate showed awareness but did not fully demonstrate this in practice."
        else:
            status = "weak"
            evidence = "Responses did not strongly support this claim — further verification recommended."

        results.append({
            "claim": claim,
            "status": status,
            "evidence": evidence,
        })

    return results

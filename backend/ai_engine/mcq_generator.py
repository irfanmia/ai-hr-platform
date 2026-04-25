"""
MCQ Generator
-------------
Generates a single multiple-choice question with 4 plausible options for a
given role + primary skill, using Groq's LLM. Replaces the previous
hardcoded "manage payroll / legal contracts / office layouts" template.

Caller pattern in question_generator.generate_interview_questions():

    mcq = generate_mcq(job, primary_skill)
    if mcq:
        # use mcq["prompt"] / mcq["options"] / mcq["correct_option"]
    else:
        # fall back to a static-but-on-topic MCQ

The function is fail-safe — any Groq error returns None and the caller
slots in a sensible default. We never raise into the interview flow.
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
# Versatile text model — good at structured JSON output, fast on Groq.
MODEL = os.getenv("GROQ_MCQ_MODEL", "llama-3.3-70b-versatile")


@dataclass
class GeneratedMCQ:
    prompt: str
    options: list[str]
    correct_option: str
    correct_index: int


_PROMPT_TEMPLATE = """You are writing a single multiple-choice interview question for a candidate \
applying to the role of "{title}" in the "{department}" team.

The question should test PRACTICAL understanding of {skill} as it applies to this role.

Strict requirements:
- ONE concise question, under 30 words. Tests judgment or knowledge a real practitioner would have.
- EXACTLY 4 answer options. Similar length and tone.
- Exactly ONE option is correct. The other three must be plausible-but-wrong distractors that a \
less-experienced candidate could easily mis-pick.
- All four options must be ON-TOPIC for {skill} and the {title} role. NEVER use unrelated fillers \
like "manage company payroll", "design office spaces", "handle legal contracts".
- Avoid trivia like "what does X stand for" or "who invented X". Test actual practical understanding.

Required job context:
- Title: {title}
- Department: {department}
- Required skills for the role: {skills}
- Primary skill being tested: {skill}

Return ONLY a JSON object on a single line, no prose, no markdown fences, in this exact shape:
{{"prompt": "...", "options": ["...", "...", "...", "..."], "correct_index": 0}}

`correct_index` is 0-based and must be 0, 1, 2, or 3."""


def _extract_json_object(text: str) -> dict | None:
    """Whatever the model returns, try to parse the first {...} block."""
    if not text:
        return None
    # Strip code fences if any
    text = text.strip()
    fence = re.match(r"^```(?:json)?\s*\n?(.*?)\n?```\s*$", text, flags=re.DOTALL)
    if fence:
        text = fence.group(1)
    # Find the first { ... } block
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def generate_mcq(
    job_title: str,
    job_department: str,
    job_skills: list[str],
    primary_skill: str,
) -> Optional[GeneratedMCQ]:
    """
    Ask Groq for one role + skill specific MCQ. Returns None on any failure
    (no key, network error, malformed JSON, validation failure). The caller
    should always have a sensible fallback.
    """
    if not GROQ_API_KEY:
        return None

    try:
        from groq import Groq
    except ImportError:
        logger.warning("groq SDK not installed — skipping MCQ generation")
        return None

    prompt = _PROMPT_TEMPLATE.format(
        title=job_title,
        department=job_department,
        skill=primary_skill,
        skills=", ".join(job_skills) if job_skills else "(none listed)",
    )

    try:
        client = Groq(api_key=GROQ_API_KEY)
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,            # some variety, but mostly deterministic
            max_completion_tokens=400,
            top_p=0.95,
            response_format={"type": "json_object"},
        )
        content = (resp.choices[0].message.content or "").strip()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Groq MCQ generation failed for skill=%s: %s", primary_skill, exc)
        return None

    parsed = _extract_json_object(content)
    if not parsed:
        logger.warning("Groq MCQ output not parseable as JSON: %r", content[:200])
        return None

    # ── Validate shape ────────────────────────────────────────────────────
    prompt_text = parsed.get("prompt")
    options = parsed.get("options")
    correct_index = parsed.get("correct_index")
    if not isinstance(prompt_text, str) or not prompt_text.strip():
        return None
    if not isinstance(options, list) or len(options) != 4:
        return None
    if not all(isinstance(o, str) and o.strip() for o in options):
        return None
    if not isinstance(correct_index, int) or correct_index < 0 or correct_index > 3:
        return None

    return GeneratedMCQ(
        prompt=prompt_text.strip(),
        options=[o.strip() for o in options],
        correct_option=options[correct_index].strip(),
        correct_index=correct_index,
    )


def fallback_mcq(job_title: str, primary_skill: str) -> dict:
    """
    Last-resort MCQ when Groq is unavailable. Far more on-topic than the old
    "office spaces / legal contracts" filler — at least all four options name
    realistic-sounding professional activities tied to the skill.
    """
    skill_l = (primary_skill or "your core skill").strip()
    return {
        "prompt": (
            f"Which of the following best reflects how a {job_title} typically uses {skill_l} "
            "in day-to-day work?"
        ),
        "options": [
            f"Applying {skill_l} to design, build, or improve work that meets the role's goals.",
            f"Avoiding {skill_l} entirely so other team members can specialise in it.",
            f"Using {skill_l} only during onboarding, then handing it off permanently.",
            f"Documenting {skill_l} for compliance audits, with no operational use.",
        ],
        "correct_index": 0,
    }

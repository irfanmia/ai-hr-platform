"""
Responses PDF — every interview question with the candidate's answer in
text form. HR uses this to read what the candidate actually said without
having to scrub through any audio.

Page layout:
    Header (branded, app-id, candidate, job)
    Title block
    For each question:
        Q1. <prompt>
        Type · Source · Score (if scored)
        ----- Answer -----
        <text>
    Footer (timestamp, QR, verify URL)
"""

from __future__ import annotations

import io
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
)

import os

from reportlab.lib.utils import ImageReader

from .branding import PdfMetadata, install_branding
from .fonts import brand_fonts


_QTYPE_LABEL = {
    "descriptive": "Descriptive answer",
    "scenario":    "Scenario answer",
    "coding":      "Coding answer",
    "mcq":         "Multiple choice",
    "one_word":    "One-word answer",
}

_NO_RESPONSE_MARKERS = {"[no response]", ""}


def _styles():
    base = getSampleStyleSheet()
    F = brand_fonts()  # registered Mulish names, or Helvetica fallback
    return {
        "title": ParagraphStyle(
            "Title", parent=base["Heading1"], fontName=F["bold"],
            fontSize=18, leading=22, spaceAfter=4,
            textColor=colors.HexColor("#0f172a"),
        ),
        "subtitle": ParagraphStyle(
            "Subtitle", parent=base["Normal"], fontName=F["regular"],
            fontSize=10, leading=14, spaceAfter=12,
            textColor=colors.HexColor("#475569"),
        ),
        "qheader": ParagraphStyle(
            "QHeader", parent=base["Heading2"], fontName=F["bold"],
            fontSize=11, leading=14, spaceAfter=2,
            textColor=colors.HexColor("#1e293b"),
        ),
        "qmeta": ParagraphStyle(
            "QMeta", parent=base["Normal"], fontName=F["regular"],
            fontSize=8, leading=11, spaceAfter=4,
            textColor=colors.HexColor("#64748b"),
        ),
        "qprompt": ParagraphStyle(
            "QPrompt", parent=base["Normal"], fontName=F["regular"],
            fontSize=10, leading=14, spaceAfter=6,
            textColor=colors.HexColor("#0f172a"),
        ),
        "answer_label": ParagraphStyle(
            "AnsLabel", parent=base["Normal"], fontName=F["bold"],
            fontSize=8, leading=10, spaceAfter=2,
            textColor=colors.HexColor("#475569"),
        ),
        "answer": ParagraphStyle(
            "Ans", parent=base["Normal"], fontName=F["regular"],
            fontSize=10, leading=14, spaceAfter=12,
            leftIndent=8, rightIndent=8,
            backColor=colors.HexColor("#f8fafc"),
            borderColor=colors.HexColor("#e2e8f0"),
            borderWidth=0.5,
            borderPadding=8,
            textColor=colors.HexColor("#1e293b"),
        ),
        "answer_silent": ParagraphStyle(
            "AnsSilent", parent=base["Normal"], fontName=F["italic"],
            fontSize=10, leading=14, spaceAfter=12,
            leftIndent=8, rightIndent=8,
            backColor=colors.HexColor("#fff7ed"),
            borderColor=colors.HexColor("#fed7aa"),
            borderWidth=0.5,
            borderPadding=8,
            textColor=colors.HexColor("#9a3412"),
        ),
        "answer_code": ParagraphStyle(
            "AnsCode", parent=base["Normal"], fontName="Courier",
            fontSize=9, leading=12, spaceAfter=12,
            leftIndent=8, rightIndent=8,
            backColor=colors.HexColor("#0f172a"),
            borderColor=colors.HexColor("#1e293b"),
            borderWidth=0.5,
            borderPadding=8,
            textColor=colors.HexColor("#e0f2fe"),
        ),
    }


def _escape(s: str) -> str:
    """Reportlab Paragraphs interpret a few HTML-ish tags. Escape user input."""
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def build_responses_pdf(
    metadata: PdfMetadata,
    questions: Iterable[dict],
    answers: dict,
    scores: dict | None = None,
    identity_snapshots: list[dict] | None = None,
) -> bytes:
    """
    Render the responses PDF. Returns raw PDF bytes.

    `questions` is the same dict list we generate in question_generator.
    `answers`   is { question_id -> text }.
    `scores`    is optional { question_id -> int 0..100 } from the evaluator.
    `identity_snapshots` is an optional list of dicts:
        [{"abs_path": "/var/.../media/identity_snapshots/<id>/<f>.jpg",
          "captured_at": "<iso>"}]
    Caller (views.py) resolves the media root path; this module stays
    decoupled from Django settings.
    """
    buf = io.BytesIO()

    # Page setup with branded header/footer
    margin_top = 26 * mm
    margin_bottom = 36 * mm
    margin_side = 18 * mm
    doc = BaseDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=margin_side,
        rightMargin=margin_side,
        topMargin=margin_top,
        bottomMargin=margin_bottom,
        title=metadata.doc_title,
        author=metadata.org_name,
    )
    frame = Frame(
        margin_side, margin_bottom,
        A4[0] - 2 * margin_side, A4[1] - margin_top - margin_bottom,
        id="content",
    )
    doc.addPageTemplates([
        PageTemplate(
            id="branded",
            frames=[frame],
            onPage=lambda c, d: install_branding(c, d, metadata),
        ),
    ])

    s = _styles()
    story = []

    # Materialise once so we can check emptiness AND iterate
    questions = list(questions)

    # ─── Title block ─────────────────────────────────────────────────────
    story.append(Paragraph(f"Interview Responses", s["title"]))
    story.append(Paragraph(
        f"{_escape(metadata.candidate_name)} &middot; "
        f"{_escape(metadata.candidate_email)}<br/>"
        f"Applied for <b>{_escape(metadata.job_title)}</b> "
        f"({_escape(metadata.job_department)})",
        s["subtitle"],
    ))

    # ─── Identity verification snapshots ─────────────────────────────────
    valid_snaps = [
        snap for snap in (identity_snapshots or [])
        if snap.get("abs_path") and os.path.exists(snap["abs_path"])
    ]
    if valid_snaps:
        from reportlab.platypus import Image as _Image
        story.append(Paragraph("Identity Verification", s["qheader"]))
        story.append(Paragraph(
            f"{len(valid_snaps)} still frame(s) captured at random moments during the interview "
            "for HR identity verification.",
            s["qmeta"],
        ))
        # Lay out snapshots as a horizontal row of 3-4 thumbnails
        thumb_w = 50 * mm
        thumb_h = thumb_w * 0.75  # 4:3 aspect
        cols: list = []
        for snap in valid_snaps[:6]:
            try:
                img = _Image(snap["abs_path"], width=thumb_w, height=thumb_h)
                cols.append(img)
            except Exception:
                continue
        if cols:
            from reportlab.platypus import Table as _Table, TableStyle as _TableStyle
            from reportlab.lib import colors as _colors
            # Pad to 3 cells per row for a clean grid
            rows: list[list] = []
            row_size = 3
            for i in range(0, len(cols), row_size):
                row = cols[i:i + row_size]
                while len(row) < row_size:
                    row.append("")
                rows.append(row)
            story.append(_Table(
                rows,
                colWidths=[thumb_w + 4 * mm] * row_size,
                style=_TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.3, _colors.HexColor("#e2e8f0")),
                ]),
            ))
        story.append(Spacer(1, 8))

    # ─── Each question ───────────────────────────────────────────────────
    for idx, q in enumerate(questions, start=1):
        qid = q.get("id") or f"q_{idx}"
        qtype = q.get("type", "descriptive")
        source = q.get("source", "")
        prompt = _escape(q.get("prompt", ""))
        answer = (answers.get(qid) or "").strip()
        score = (scores or {}).get(qid)

        meta_parts = [_QTYPE_LABEL.get(qtype, qtype.title())]
        if source:
            meta_parts.append(source.replace("_", " ").title())
        if score is not None:
            meta_parts.append(f"Score: {score}/100")
        meta_line = " &middot; ".join(meta_parts)

        # MCQ: append the options the candidate saw
        prompt_html = f"<b>Q{idx}.</b> {prompt}"
        if qtype == "mcq" and q.get("options"):
            opts = "".join(
                f"<br/>&nbsp;&nbsp;◦ {_escape(opt)}" for opt in q["options"]
            )
            prompt_html += f"<br/>{opts}"

        # Answer styling — silent / code / default
        if answer.lower() in _NO_RESPONSE_MARKERS or answer == "[no response]":
            display = "<i>No response — candidate did not answer this question.</i>"
            answer_style = s["answer_silent"]
        else:
            answer_style = s["answer_code"] if qtype == "coding" else s["answer"]
            display = _escape(answer).replace("\n", "<br/>")

        block = [
            Paragraph(prompt_html, s["qprompt"]),
            Paragraph(meta_line, s["qmeta"]),
            Paragraph("ANSWER", s["answer_label"]),
            Paragraph(display, answer_style),
        ]
        # Try to keep prompt + answer on the same page if it fits
        story.append(KeepTogether(block))
        story.append(Spacer(1, 4))

    if not questions:
        story.append(Paragraph(
            "<i>No questions were recorded for this application.</i>",
            s["qprompt"],
        ))

    doc.build(story)
    return buf.getvalue()

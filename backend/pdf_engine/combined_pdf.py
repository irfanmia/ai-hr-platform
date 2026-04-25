"""
Combined PDF — Resume + Responses + Report, merged in that order.

If the candidate's resume is a PDF we merge it directly. If it's a DOCX or
some other format we render a tasteful placeholder page so the merged PDF
still has a sensible structure (the resume text isn't lost — HR can always
download the original from the application detail page separately).

Each constituent PDF is generated with the same branding pipeline so headers
+ footers + QR codes line up across all three sections.
"""

from __future__ import annotations

import io
import logging
import os
from dataclasses import replace
from typing import Optional

from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
)

from .branding import PdfMetadata, install_branding

logger = logging.getLogger(__name__)


def _build_resume_placeholder(metadata: PdfMetadata, reason: str) -> bytes:
    """A single A4 page used when we can't merge the original resume in
    (DOCX, missing file, unreadable). The page itself is branded so the
    combined PDF still scans as one coherent document."""
    buf = io.BytesIO()
    margin_top, margin_bottom, margin_side = 26 * mm, 36 * mm, 18 * mm
    doc = BaseDocTemplate(
        buf, pagesize=A4,
        leftMargin=margin_side, rightMargin=margin_side,
        topMargin=margin_top, bottomMargin=margin_bottom,
        title=metadata.doc_title, author=metadata.org_name,
    )
    doc.addPageTemplates([
        PageTemplate(
            id="branded",
            frames=[Frame(
                margin_side, margin_bottom,
                A4[0] - 2 * margin_side,
                A4[1] - margin_top - margin_bottom,
                id="content",
            )],
            onPage=lambda c, d: install_branding(c, d, metadata),
        ),
    ])

    base = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "T", parent=base["Heading1"], fontName="Helvetica-Bold",
        fontSize=18, leading=22, spaceAfter=6,
        textColor=colors.HexColor("#0f172a"),
    )
    body_style = ParagraphStyle(
        "B", parent=base["Normal"], fontName="Helvetica",
        fontSize=10, leading=14, spaceAfter=6,
        textColor=colors.HexColor("#475569"),
    )

    doc.build([
        Paragraph("Resume", title_style),
        Paragraph(
            f"<b>{metadata.candidate_name}</b> — original resume not embedded.",
            body_style,
        ),
        Spacer(1, 8),
        Paragraph(reason, body_style),
        Spacer(1, 12),
        Paragraph(
            "The original resume file is available for download from the "
            "candidate's application page in the HR dashboard.",
            body_style,
        ),
    ])
    return buf.getvalue()


def _resume_section(application, metadata: PdfMetadata) -> bytes:
    """Return PDF bytes for the resume section. Either the original PDF (if
    the candidate uploaded one) or a branded placeholder."""
    resume = getattr(application, "resume", None)
    if not resume:
        return _build_resume_placeholder(
            metadata, "No resume was attached to this application."
        )

    try:
        path = resume.path
    except Exception as exc:
        logger.warning("resume.path unavailable: %s", exc)
        return _build_resume_placeholder(
            metadata, "The resume file could not be located on the server."
        )

    if not os.path.exists(path):
        return _build_resume_placeholder(
            metadata, "The resume file is missing from the server filesystem."
        )

    ext = os.path.splitext(path)[1].lower()
    if ext != ".pdf":
        return _build_resume_placeholder(
            metadata,
            f"The candidate uploaded a {ext.lstrip('.').upper() or 'non-PDF'} resume; "
            "the original is preserved on the server but cannot be inlined here.",
        )

    try:
        with open(path, "rb") as f:
            return f.read()
    except OSError as exc:
        logger.warning("Couldn't read resume PDF: %s", exc)
        return _build_resume_placeholder(
            metadata, "The resume file couldn't be read from disk."
        )


def build_combined_pdf(
    application,
    metadata: PdfMetadata,
    questions: list[dict],
    answers: dict,
    scores: Optional[dict] = None,
) -> bytes:
    """
    Build the full document pack: resume + responses + report.

    The metadata.doc_type / doc_title passed in should describe the combined
    document. We swap the per-section metadata down to "responses" / "report"
    so each individual section's header reads correctly while still pointing
    every QR back to the same combined verification token.
    """
    from .responses_pdf import build_responses_pdf
    from .report_pdf import build_report_pdf

    # ─── 1. Resume ───────────────────────────────────────────────────────
    resume_bytes = _resume_section(application, metadata)

    # ─── 2. Responses ────────────────────────────────────────────────────
    responses_meta = replace(
        metadata,
        doc_type="combined",  # keep token consistent
        doc_title="Document Pack — Responses",
    )
    responses_bytes = build_responses_pdf(responses_meta, questions, answers, scores)

    # ─── 3. Report ───────────────────────────────────────────────────────
    report_meta = replace(
        metadata,
        doc_type="combined",
        doc_title="Document Pack — AI Report",
    )
    report_bytes = build_report_pdf(report_meta, application.ai_report or {})

    # ─── Merge ───────────────────────────────────────────────────────────
    writer = PdfWriter()
    for label, blob in [
        ("resume", resume_bytes),
        ("responses", responses_bytes),
        ("report", report_bytes),
    ]:
        try:
            reader = PdfReader(io.BytesIO(blob))
            for page in reader.pages:
                writer.add_page(page)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Skipping %s section in combined PDF: %s", label, exc)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()

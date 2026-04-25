"""
Report PDF — server-side rendering of the AI evaluation report. Mirrors the
HR-facing UI section-by-section: overall score, gap analysis, skill breakdown,
claim validation, key findings, strengths/weaknesses, recommendation.

Self-contained — does not depend on browser print stylesheets — so the page
breaks, fonts, colours, and QR-coded footer are identical regardless of who
generates it.
"""

from __future__ import annotations

import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from .branding import PdfMetadata, install_branding
from .fonts import brand_fonts


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
        "section": ParagraphStyle(
            "Section", parent=base["Heading2"], fontName=F["bold"],
            fontSize=12, leading=16, spaceBefore=14, spaceAfter=6,
            textColor=colors.HexColor("#1e293b"),
        ),
        "body": ParagraphStyle(
            "Body", parent=base["Normal"], fontName=F["regular"],
            fontSize=10, leading=14, spaceAfter=4,
            textColor=colors.HexColor("#1e293b"),
        ),
        "bullet": ParagraphStyle(
            "Bullet", parent=base["Normal"], fontName=F["regular"],
            fontSize=10, leading=14, leftIndent=14, bulletIndent=2, spaceAfter=2,
            textColor=colors.HexColor("#334155"),
        ),
        "score_big": ParagraphStyle(
            "ScoreBig", parent=base["Normal"], fontName=F["bold"],
            fontSize=42, leading=48, alignment=1,  # centre
            textColor=colors.HexColor("#048132"),  # brand green-900
        ),
        "score_label": ParagraphStyle(
            "ScoreLabel", parent=base["Normal"], fontName=F["regular"],
            fontSize=9, leading=12, alignment=1,
            textColor=colors.HexColor("#64748b"),
        ),
        "rec_strong": ParagraphStyle(
            "RecStrong", parent=base["Normal"], fontName=F["bold"],
            fontSize=14, leading=18, alignment=1, spaceBefore=4,
            textColor=colors.HexColor("#047857"),  # emerald-700
        ),
        "rec_consider": ParagraphStyle(
            "RecConsider", parent=base["Normal"], fontName=F["bold"],
            fontSize=14, leading=18, alignment=1, spaceBefore=4,
            textColor=colors.HexColor("#b45309"),  # amber-700
        ),
        "rec_reject": ParagraphStyle(
            "RecReject", parent=base["Normal"], fontName=F["bold"],
            fontSize=14, leading=18, alignment=1, spaceBefore=4,
            textColor=colors.HexColor("#b91c1c"),  # red-700
        ),
    }


def _esc(s):
    return (str(s) if s is not None else "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _bar_row(label: str, value: int, bar_color: str) -> Table:
    """A single 'label · bar · value' row used for skill scores."""
    pct = max(0, min(100, int(value)))
    bar_width = 80 * mm
    fill_width = bar_width * (pct / 100.0)
    cell_bar = Table(
        [[""]], colWidths=[fill_width or 0.1], rowHeights=[3 * mm],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(bar_color)),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]),
    )
    bar_track = Table(
        [[cell_bar]], colWidths=[bar_width], rowHeights=[3 * mm],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]),
    )
    # _bar_row is called outside _styles() so we resolve the brand font
    # locally — brand_fonts() is cached after first call, basically free.
    _F = brand_fonts()
    return Table(
        [[
            Paragraph(_esc(label), ParagraphStyle("L", fontName=_F["regular"], fontSize=9, leading=11)),
            bar_track,
            Paragraph(f"<b>{pct}</b>", ParagraphStyle("V", fontName=_F["regular"], fontSize=9, leading=11, alignment=2)),
        ]],
        colWidths=[55 * mm, bar_width + 4 * mm, 12 * mm],
        style=TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]),
    )


def _color_for_score(value) -> str:
    v = int(value or 0)
    if v >= 80: return "#10b981"  # emerald-500
    if v >= 60: return "#f59e0b"  # amber-500
    return "#ef4444"               # red-500


def build_report_pdf(metadata: PdfMetadata, ai_report: dict) -> bytes:
    """Build the AI evaluation report PDF from the saved ai_report JSON."""
    buf = io.BytesIO()

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

    overall = int(ai_report.get("overall_score") or 0)
    rec = (ai_report.get("recommendation") or "").strip()
    rec_style = {
        "Strong Hire": s["rec_strong"],
        "Consider":    s["rec_consider"],
        "Reject":      s["rec_reject"],
    }.get(rec, s["rec_consider"])

    story.append(Paragraph("AI Evaluation Report", s["title"]))
    story.append(Paragraph(
        f"{_esc(metadata.candidate_name)} &middot; {_esc(metadata.candidate_email)}<br/>"
        f"Applied for <b>{_esc(metadata.job_title)}</b> ({_esc(metadata.job_department)})",
        s["subtitle"],
    ))

    # ─── Overall score + recommendation ─────────────────────────────────
    score_block = [
        Paragraph(f"{overall}", s["score_big"]),
        Paragraph("OVERALL AI SCORE  &middot;  out of 100", s["score_label"]),
        Spacer(1, 4),
        Paragraph(_esc(rec) or "No recommendation", rec_style),
    ]
    story.append(KeepTogether(score_block))

    # ─── Resume vs Performance ───────────────────────────────────────────
    rs = int(ai_report.get("resume_strength_score") or 0)
    ap = int(ai_report.get("actual_performance_score") or 0)
    story.append(Paragraph("Resume vs Performance", s["section"]))
    # Resume bar = brand green-700; Interview bar = emerald-500 to keep the
    # two bars visually distinct against each other.
    story.append(_bar_row("Resume strength", rs, "#1EAA50"))
    story.append(_bar_row("Interview performance", ap, "#10b981"))

    gap = ai_report.get("gap_analysis") or {}
    if gap.get("explanation"):
        story.append(Spacer(1, 4))
        story.append(Paragraph(_esc(gap.get("explanation")), s["body"]))

    # ─── Skill breakdown ─────────────────────────────────────────────────
    skill_breakdown = ai_report.get("skill_breakdown") or {}
    if skill_breakdown:
        story.append(Paragraph("Skill Breakdown", s["section"]))
        for skill, value in sorted(skill_breakdown.items(), key=lambda kv: -int(kv[1] or 0)):
            story.append(_bar_row(str(skill), int(value or 0), _color_for_score(value)))

    # ─── Claim validation ────────────────────────────────────────────────
    claims = ai_report.get("claim_validation") or []
    if claims:
        story.append(Paragraph("Claim Validation", s["section"]))
        rows = [["Status", "Claim", "Evidence"]]
        status_color = {
            "verified": "#10b981",
            "partial":  "#f59e0b",
            "weak":     "#ef4444",
        }
        # Resolve brand fonts once for the inline styles + table header
        _F = brand_fonts()
        for c in claims[:20]:
            rows.append([
                Paragraph(
                    f"<font color='{status_color.get(c.get('status'), '#64748b')}'><b>{_esc(c.get('status', '—').upper())}</b></font>",
                    ParagraphStyle("X", fontName=_F["regular"], fontSize=8, leading=10),
                ),
                Paragraph(_esc(c.get("claim", "")), ParagraphStyle("X", fontName=_F["regular"], fontSize=9, leading=12)),
                Paragraph(_esc(c.get("evidence", "")), ParagraphStyle("X", fontName=_F["regular"], fontSize=9, leading=12)),
            ])
        story.append(Table(rows, colWidths=[18 * mm, 60 * mm, 92 * mm], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("FONTNAME", (0, 0), (-1, 0), _F["bold"]),
            ("FONTSIZE", (0, 0), (-1, 0), 8),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#475569")),
            ("LINEABOVE", (0, 1), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])))

    # ─── Key findings ────────────────────────────────────────────────────
    findings = ai_report.get("key_findings") or []
    if findings:
        story.append(Paragraph("Key Findings", s["section"]))
        for f in findings:
            story.append(Paragraph(f"• {_esc(f)}", s["bullet"]))

    # ─── Strengths / Weaknesses ──────────────────────────────────────────
    strengths = ai_report.get("strengths") or []
    weaknesses = ai_report.get("weaknesses") or []
    if strengths:
        story.append(Paragraph("Strengths", s["section"]))
        for f in strengths:
            story.append(Paragraph(f"+ {_esc(f)}", s["bullet"]))
    if weaknesses:
        story.append(Paragraph("Areas to Improve", s["section"]))
        for f in weaknesses:
            story.append(Paragraph(f"- {_esc(f)}", s["bullet"]))

    # ─── Behavioral insights ─────────────────────────────────────────────
    bi = ai_report.get("behavioral_insights") or {}
    if bi:
        story.append(Paragraph("Behavioral Insights", s["section"]))
        for k in ("confidence", "clarity", "depth_of_knowledge"):
            if k in bi:
                # brand green-700 for behavioral insight bars
                story.append(_bar_row(k.replace("_", " ").title(), int(bi[k] or 0), "#1EAA50"))

    doc.build(story)
    return buf.getvalue()

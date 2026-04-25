"""
PDF branding — header, footer, QR verification code.

Every PDF the platform emits is signed with an HMAC token. The token is
embedded in a QR code on the footer and as plain text below it. Anyone
who scans or visits the verification URL gets back a JSON / HTML page
proving the PDF was issued by us, for which candidate, on what date, for
which document type. If a candidate (or anyone else) hands HR a fake
PDF, the verification will either fail or point to the wrong record.
"""

from __future__ import annotations

import hashlib
import hmac
import io
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas

# ─── Public verify endpoint config ────────────────────────────────────────

# The host visitors land on when they scan the QR. Defaults to the live
# Vercel URL, override with env if you swap domains.
PUBLIC_VERIFY_BASE = os.getenv(
    "PDF_VERIFY_BASE_URL",
    "https://wayne-ai-hr.vercel.app/verify",
)

# HMAC signing secret. MUST be set in production .env.
# Falls back to the Django SECRET_KEY in dev so signing still works locally.
VERIFY_SECRET = os.getenv("PDF_VERIFY_SECRET") or os.getenv("DJANGO_SECRET_KEY", "dev-pdf-secret")


# ─── Token signing ────────────────────────────────────────────────────────

def _hmac_sig(payload: str) -> str:
    """16-char hex HMAC-SHA256 — short enough to fit in QR + URL, still 64 bits
    of collision resistance which is plenty for document-issuance signing."""
    return hmac.new(
        VERIFY_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16]


def make_verify_token(application_id: int, doc_type: str, generated_at: datetime) -> str:
    """Format: '<app_id>:<doc_type>:<unix_ts>:<sig>'

    `doc_type` is one of "responses" | "report" | "combined".
    """
    ts = int(generated_at.timestamp())
    payload = f"{application_id}:{doc_type}:{ts}"
    return f"{payload}:{_hmac_sig(payload)}"


def parse_verify_token(token: str) -> Optional[dict]:
    """Reverse of make_verify_token. Returns the parsed metadata dict if
    the signature matches, else None. Constant-time comparison."""
    if not token or token.count(":") != 3:
        return None
    app_id, doc_type, ts, sig = token.split(":")
    payload = f"{app_id}:{doc_type}:{ts}"
    expected = _hmac_sig(payload)
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        return {
            "application_id": int(app_id),
            "doc_type": doc_type,
            "generated_at": datetime.fromtimestamp(int(ts), tz=timezone.utc),
        }
    except (ValueError, OSError):
        return None


def verify_url_for_token(token: str) -> str:
    return f"{PUBLIC_VERIFY_BASE}?token={token}"


# ─── Header / footer renderer (used by every PDF) ─────────────────────────

@dataclass
class PdfMetadata:
    candidate_name: str
    candidate_email: str
    job_title: str
    job_department: str
    application_id: int
    doc_type: str           # "responses" | "report" | "combined"
    doc_title: str          # human-readable, shown in header
    generated_at: datetime  # kept on the metadata for footer + QR
    org_name: str = "AI HR Platform"


def _qr_image_bytes(data: str, size_mm: int = 18) -> bytes:
    """Generate a small PNG QR code as bytes ready to embed in reportlab."""
    import qrcode
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=4,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def install_branding(canvas: Canvas, doc, metadata: PdfMetadata) -> None:
    """SimpleDocTemplate hook — installed via PageTemplate.onPage. Draws
    the header band at the top and the footer band at the bottom on every
    page, including the QR code on the bottom-right."""
    canvas.saveState()
    width, height = A4

    # ─── Header band ───────────────────────────────────────────────────
    # name.com brand: green-700 deep band (#1EAA50) with white text. Deep
    # green keeps WCAG AA contrast against white better than #6EDA78 would.
    canvas.setFillColor(colors.HexColor("#1EAA50"))
    canvas.rect(0, height - 14 * mm, width, 14 * mm, stroke=0, fill=1)

    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 11)
    canvas.drawString(15 * mm, height - 9 * mm, metadata.org_name)
    canvas.setFont("Helvetica", 9)
    canvas.drawString(15 * mm, height - 12.5 * mm, metadata.doc_title)

    # Right-aligned: candidate name + job
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawRightString(
        width - 15 * mm,
        height - 9 * mm,
        metadata.candidate_name or "Candidate",
    )
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(
        width - 15 * mm,
        height - 12.5 * mm,
        f"{metadata.job_title} · #{metadata.application_id}",
    )

    # Subtle green underline below the band — accent line at brand-500.
    canvas.setStrokeColor(colors.HexColor("#6EDA78"))
    canvas.setLineWidth(1.2)
    canvas.line(0, height - 14 * mm, width, height - 14 * mm)

    # ─── Footer band ───────────────────────────────────────────────────
    footer_y = 12 * mm
    canvas.setStrokeColor(colors.HexColor("#cbd5e1"))
    canvas.setLineWidth(0.4)
    canvas.line(15 * mm, footer_y + 18 * mm, width - 15 * mm, footer_y + 18 * mm)

    # Verification token + QR — bottom right
    token = make_verify_token(metadata.application_id, metadata.doc_type, metadata.generated_at)
    verify_url = verify_url_for_token(token)
    qr_size = 18 * mm
    try:
        qr_bytes = _qr_image_bytes(verify_url)
        from reportlab.lib.utils import ImageReader
        qr_img = ImageReader(io.BytesIO(qr_bytes))
        canvas.drawImage(
            qr_img,
            width - 15 * mm - qr_size,
            footer_y - 1 * mm,
            qr_size,
            qr_size,
            mask="auto",
        )
    except Exception:
        # Don't ever fail PDF generation just because the QR step crashed
        pass

    # Footer text — left side
    canvas.setFillColor(colors.HexColor("#475569"))  # slate-600
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(15 * mm, footer_y + 12 * mm, "Document verification")
    canvas.setFont("Helvetica", 7)
    canvas.drawString(
        15 * mm,
        footer_y + 8.5 * mm,
        f"Issued: {metadata.generated_at.strftime('%Y-%m-%d %H:%M UTC')}",
    )
    canvas.drawString(
        15 * mm,
        footer_y + 5 * mm,
        f"Scan QR or visit: {PUBLIC_VERIFY_BASE}?token={token[:24]}…",
    )
    canvas.drawString(
        15 * mm,
        footer_y + 1.5 * mm,
        f"Token: {token}",
    )

    # Page number — bottom centre
    canvas.setFillColor(colors.HexColor("#94a3b8"))  # slate-400
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(
        width / 2,
        footer_y - 4 * mm,
        f"Page {canvas.getPageNumber()}",
    )

    canvas.restoreState()

"""
Email templates + send helpers for demo requests.

Two emails per submission:
  1. notify_team()    — internal: lands at hello@hireparrot.com with the
                        full form payload so the team can follow up.
  2. send_autoreply() — external: thanks the enquirer + sets expectations
                        for response time.

Both use Django's email backend, which we configure in settings.py to point
at AWS SES SMTP. If SES is sandboxed and rejects an unverified recipient,
the helpers swallow the error and return False so the API still responds
200 to the form — the row in the DB is the source of truth and admins can
follow up manually.
"""
from __future__ import annotations

import logging
from typing import Tuple

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

from .models import DemoRequest

logger = logging.getLogger(__name__)


# ─── Internal notification ────────────────────────────────────────────────

def _notify_subject(req: DemoRequest) -> str:
    return f"New demo request — {req.company} ({req.name})"


def _notify_text(req: DemoRequest) -> str:
    return (
        f"New demo request submitted at {req.created_at:%Y-%m-%d %H:%M UTC}\n"
        f"\n"
        f"Name:        {req.name}\n"
        f"Email:       {req.email}\n"
        f"Company:     {req.company}\n"
        f"Designation: {req.designation}\n"
        f"Phone:       {req.phone}\n"
        f"\n"
        f"Message:\n{req.message or '(no additional message)'}\n"
        f"\n"
        f"---\n"
        f"Submission metadata\n"
        f"IP:        {req.source_ip or 'unknown'}\n"
        f"Referer:   {req.referer or 'unknown'}\n"
        f"UA:        {req.user_agent or 'unknown'}\n"
        f"Admin URL: https://hireparrot.com/admin/demo_requests/demorequest/{req.id}/change/\n"
    )


def _notify_html(req: DemoRequest) -> str:
    return (
        '<div style="font-family:Mulish,Arial,sans-serif;font-size:14px;color:#222;'
        'max-width:600px;line-height:1.6;">'
        f'<h2 style="margin:0 0 16px;font-size:18px;">New demo request from '
        f'<span style="color:#2eb872;">{_esc(req.company)}</span></h2>'
        '<table style="border-collapse:collapse;width:100%;">'
        f"{_row('Name', req.name)}"
        f"{_row('Email', req.email, link=f'mailto:{req.email}')}"
        f"{_row('Company', req.company)}"
        f"{_row('Designation', req.designation)}"
        f"{_row('Phone', req.phone, link=f'tel:{req.phone}')}"
        + (f"{_row('Message', req.message)}" if req.message else "")
        + '</table>'
        '<hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />'
        '<p style="color:#888;font-size:12px;margin:0;">'
        f'Submitted {req.created_at:%Y-%m-%d %H:%M UTC} · IP {req.source_ip or "unknown"}'
        '</p>'
        '<p style="margin:16px 0 0;">'
        '<a href="https://hireparrot.com/admin/demo_requests/demorequest/'
        f'{req.id}/change/" '
        'style="display:inline-block;background:#0c0e10;color:#fff;'
        'padding:10px 18px;border-radius:999px;text-decoration:none;'
        'font-size:13px;font-weight:500;">Open in admin →</a>'
        '</p>'
        '</div>'
    )


def _row(label: str, value: str, link: str | None = None) -> str:
    inner = f'<a href="{link}" style="color:#2eb872;text-decoration:none;">{_esc(value)}</a>' if link else _esc(value)
    return (
        '<tr>'
        '<td style="padding:8px 12px 8px 0;color:#666;width:120px;'
        'vertical-align:top;font-weight:500;">'
        f"{_esc(label)}</td>"
        '<td style="padding:8px 0;color:#222;">'
        f"{inner}</td>"
        '</tr>'
    )


def _esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def notify_team(req: DemoRequest) -> bool:
    """Internal notification → hello@hireparrot.com (or DEMO_NOTIFY_EMAIL).

    Returns True if SMTP accepted the message, False if it errored. Errors
    are logged + recorded on the DemoRequest row but not raised.
    """
    to_addr = getattr(settings, "DEMO_NOTIFY_EMAIL", "hello@hireparrot.com")
    msg = EmailMultiAlternatives(
        subject=_notify_subject(req),
        body=_notify_text(req),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to_addr],
        reply_to=[req.email],
        headers={"X-HireParrot-Source": "demo-request"},
    )
    msg.attach_alternative(_notify_html(req), "text/html")
    try:
        sent = msg.send(fail_silently=False)
        return sent > 0
    except Exception as e:
        logger.exception("notify_team failed for DemoRequest %s", req.id)
        req.last_email_error = f"notify_team: {e}"
        req.save(update_fields=["last_email_error"])
        return False


# ─── Auto-reply to enquirer ───────────────────────────────────────────────

def _autoreply_subject(req: DemoRequest) -> str:
    return "Thanks for reaching out — HireParrot demo"


def _autoreply_text(req: DemoRequest) -> str:
    return (
        f"Hi {req.name.split()[0] if req.name else 'there'},\n"
        f"\n"
        f"Thanks for requesting a HireParrot demo for {req.company}. We've "
        f"received your details and someone from our team will reach out within "
        f"one business day to set up a 30-minute walkthrough.\n"
        f"\n"
        f"In the meantime, feel free to explore the platform at "
        f"https://hireparrot.com — and reply to this email if you have any "
        f"questions.\n"
        f"\n"
        f"— Team HireParrot\n"
        f"hello@hireparrot.com\n"
    )


def _autoreply_html(req: DemoRequest) -> str:
    first = (req.name.split()[0] if req.name else "there")
    return (
        '<div style="font-family:Mulish,Arial,sans-serif;font-size:15px;color:#222;'
        'max-width:560px;line-height:1.65;">'
        f'<p style="margin:0 0 14px;">Hi {_esc(first)},</p>'
        '<p style="margin:0 0 14px;">'
        f'Thanks for requesting a HireParrot demo for '
        f'<strong>{_esc(req.company)}</strong>. We\'ve received your details '
        'and someone from our team will reach out within '
        '<strong>one business day</strong> to set up a 30-minute walkthrough.'
        '</p>'
        '<p style="margin:0 0 14px;">'
        'In the meantime, you can explore the platform at '
        '<a href="https://hireparrot.com" style="color:#2eb872;">hireparrot.com</a>'
        ' — and just reply to this email if you have any questions.'
        '</p>'
        '<p style="margin:24px 0 0;color:#666;">— Team HireParrot</p>'
        '<p style="margin:4px 0 0;color:#999;font-size:13px;">'
        '<a href="mailto:hello@hireparrot.com" style="color:#999;">hello@hireparrot.com</a>'
        '</p>'
        '</div>'
    )


def send_autoreply(req: DemoRequest) -> bool:
    msg = EmailMultiAlternatives(
        subject=_autoreply_subject(req),
        body=_autoreply_text(req),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[req.email],
        reply_to=["hello@hireparrot.com"],
        headers={"X-HireParrot-Source": "demo-autoreply"},
    )
    msg.attach_alternative(_autoreply_html(req), "text/html")
    try:
        sent = msg.send(fail_silently=False)
        return sent > 0
    except Exception as e:
        logger.exception("send_autoreply failed for DemoRequest %s", req.id)
        # Append rather than overwrite — notify_team error may already be set
        existing = req.last_email_error
        req.last_email_error = (
            f"{existing}\nautoreply: {e}" if existing else f"autoreply: {e}"
        )
        req.save(update_fields=["last_email_error"])
        return False


def send_demo_emails(req: DemoRequest) -> Tuple[bool, bool]:
    """Fire both emails. Returns (notify_ok, autoreply_ok)."""
    notify_ok = notify_team(req)
    auto_ok = send_autoreply(req)
    if notify_ok or auto_ok:
        req.notify_email_sent = notify_ok
        req.autoreply_email_sent = auto_ok
        req.save(update_fields=["notify_email_sent", "autoreply_email_sent"])
    return notify_ok, auto_ok

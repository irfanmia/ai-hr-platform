"""Email helpers for the account-verification flow."""
from __future__ import annotations

import logging
from urllib.parse import urlencode

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

from .models import EmailVerificationToken

logger = logging.getLogger(__name__)

# Public URL the link in the email points to. /verify-email is a
# Next.js page that calls the backend to finalise verification.
VERIFY_BASE = getattr(settings, "EMAIL_VERIFY_BASE_URL", "https://hireparrot.com/verify-email")


def _esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _build_link(token: str) -> str:
    return f"{VERIFY_BASE}?{urlencode({'token': token})}"


def send_verification_email(user, token: EmailVerificationToken) -> bool:
    """Send the click-to-verify link. Returns True on success.

    Failures are logged but never raised — the calling view should still
    return a friendly success to the user (we don't want to leak email-
    deliverability errors back to a registration form). The user can
    always hit /resend-verification to retry.
    """
    link = _build_link(token.token)
    first_name = (user.first_name or user.email.split("@")[0]).strip() or "there"

    subject = "Verify your email — HireParrot"

    text_body = (
        f"Hi {first_name},\n\n"
        f"Welcome to HireParrot. Please confirm your email address by clicking the link below:\n\n"
        f"{link}\n\n"
        f"This link expires in 24 hours. Once verified, you can sign in and start applying for jobs.\n\n"
        f"If you didn't sign up for HireParrot, just ignore this email — no account will be created.\n\n"
        f"— Team HireParrot\n"
        f"hello@hireparrot.com · https://hireparrot.com\n"
        f"\n"
        f"---\n"
        f"This email was sent from noreply@hireparrot.com. Replies are not monitored.\n"
    )

    html_body = (
        '<div style="font-family:Mulish,Arial,sans-serif;font-size:15px;color:#222;'
        'max-width:560px;line-height:1.65;">'
        f'<p style="margin:0 0 14px;">Hi {_esc(first_name)},</p>'
        '<p style="margin:0 0 18px;">'
        'Welcome to <strong>HireParrot</strong>. Please confirm your email address '
        'to finish setting up your account.'
        '</p>'
        '<p style="margin:0 0 26px;">'
        f'<a href="{_esc(link)}" '
        'style="display:inline-block;background:#2eb872;color:#ffffff;'
        'padding:12px 22px;border-radius:999px;text-decoration:none;'
        'font-weight:600;font-size:14px;">Verify my email →</a>'
        '</p>'
        '<p style="margin:0 0 14px;color:#666;font-size:13px;">'
        'Or copy this link into your browser:<br/>'
        f'<a href="{_esc(link)}" style="color:#2eb872;word-break:break-all;">{_esc(link)}</a>'
        '</p>'
        '<p style="margin:18px 0 0;color:#888;font-size:13px;">'
        'This link expires in 24 hours. If you didn\'t sign up for HireParrot, just '
        'ignore this email — no account will be created.'
        '</p>'
        '<p style="margin:24px 0 0;color:#666;">— Team HireParrot</p>'
        '<hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px;" />'
        '<p style="margin:0;color:#bbb;font-size:11px;line-height:1.5;">'
        'Sent from <code>noreply@hireparrot.com</code>. Replies are not monitored.'
        '</p>'
        '</div>'
    )

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=getattr(settings, "AUTOREPLY_FROM_EMAIL",
                           "HireParrot <noreply@hireparrot.com>"),
        to=[user.email],
        reply_to=["hello@hireparrot.com"],
        headers={
            "X-HireParrot-Source": "email-verification",
            "Auto-Submitted": "auto-replied",
        },
    )
    msg.attach_alternative(html_body, "text/html")

    try:
        sent = msg.send(fail_silently=False)
        return sent > 0
    except Exception as e:
        logger.exception("send_verification_email failed for user %s", user.id)
        return False

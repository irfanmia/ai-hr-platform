"""
Email verification tokens.

We piggy-back on Django's `User.is_active` flag to gate login: candidates
sign up with `is_active=False` and can't authenticate until they click
the link in their verification email. Once verified we flip `is_active=True`
and the existing JWT auth flow works unchanged.

HR / admin users are unaffected — `is_staff=True` accounts are created
manually and stay `is_active=True` from day one.
"""
from __future__ import annotations

import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


def _new_token() -> str:
    """URL-safe 32-byte token (~43 chars, ~256 bits of entropy)."""
    return secrets.token_urlsafe(32)


def _default_expiry():
    return timezone.now() + timedelta(hours=24)


class EmailVerificationToken(models.Model):
    """A short-lived signed link sent to the user's email."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_verification_tokens",
    )
    token = models.CharField(max_length=80, unique=True, db_index=True, default=_new_token)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=_default_expiry)
    used_at = models.DateTimeField(null=True, blank=True)
    # IP that submitted the form — useful when triaging spam / abuse
    source_ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["used_at"]),
        ]

    def __str__(self) -> str:
        status = "used" if self.used_at else (
            "expired" if self.expires_at < timezone.now() else "valid"
        )
        return f"{self.user.email} · {status}"

    @property
    def is_valid(self) -> bool:
        """True only if not used AND not expired."""
        return self.used_at is None and self.expires_at > timezone.now()

    def mark_used(self) -> None:
        self.used_at = timezone.now()
        self.save(update_fields=["used_at"])

"""
DemoRequest — captures contact-form submissions from the public landing page.

Every "Book a demo" submission lands here. The view also fires two emails:
notification to hello@hireparrot.com and an auto-reply to the enquirer.
This row is the source of truth even if the email send fails — admins can
browse and follow up via the Django admin.
"""
from __future__ import annotations

from django.db import models


class DemoRequest(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        CONTACTED = "contacted", "Contacted"
        QUALIFIED = "qualified", "Qualified"
        WON = "won", "Won"
        LOST = "lost", "Lost"
        SPAM = "spam", "Spam"

    # Identity
    name = models.CharField(max_length=120)
    email = models.EmailField()
    company = models.CharField(max_length=200)
    designation = models.CharField(max_length=120)
    phone = models.CharField(max_length=40)

    # Optional free-text the form may collect later (kept blank for now)
    message = models.TextField(blank=True, default="")

    # Submission metadata
    created_at = models.DateTimeField(auto_now_add=True)
    source_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=400, blank=True, default="")
    referer = models.CharField(max_length=400, blank=True, default="")

    # Email send results — useful for ops debugging when SES is sandboxed
    notify_email_sent = models.BooleanField(default=False)
    autoreply_email_sent = models.BooleanField(default=False)
    last_email_error = models.TextField(blank=True, default="")

    # Lifecycle
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.NEW,
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} <{self.email}> · {self.company}"

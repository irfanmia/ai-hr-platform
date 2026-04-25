"""Django admin for browsing + triaging demo requests."""
from __future__ import annotations

from django.contrib import admin
from django.utils.html import format_html

from .models import DemoRequest


@admin.register(DemoRequest)
class DemoRequestAdmin(admin.ModelAdmin):
    list_display = (
        "name", "company", "designation", "email_link", "phone_link",
        "status", "email_status", "created_at",
    )
    list_filter = ("status", "notify_email_sent", "autoreply_email_sent", "created_at")
    search_fields = ("name", "email", "company", "designation", "phone")
    readonly_fields = (
        "created_at", "source_ip", "user_agent", "referer",
        "notify_email_sent", "autoreply_email_sent", "last_email_error",
    )
    list_per_page = 50
    ordering = ("-created_at",)

    fieldsets = (
        ("Contact", {
            "fields": ("name", "email", "company", "designation", "phone", "message"),
        }),
        ("Triage", {
            "fields": ("status", "notes"),
        }),
        ("Submission metadata", {
            "classes": ("collapse",),
            "fields": ("created_at", "source_ip", "user_agent", "referer"),
        }),
        ("Email send results", {
            "classes": ("collapse",),
            "fields": ("notify_email_sent", "autoreply_email_sent", "last_email_error"),
        }),
    )

    def email_link(self, obj: DemoRequest) -> str:
        return format_html('<a href="mailto:{0}">{0}</a>', obj.email)
    email_link.short_description = "Email"

    def phone_link(self, obj: DemoRequest) -> str:
        return format_html('<a href="tel:{0}">{0}</a>', obj.phone)
    phone_link.short_description = "Phone"

    def email_status(self, obj: DemoRequest) -> str:
        n = "✓" if obj.notify_email_sent else "✗"
        a = "✓" if obj.autoreply_email_sent else "✗"
        return format_html("notify {} · autoreply {}", n, a)
    email_status.short_description = "Email"

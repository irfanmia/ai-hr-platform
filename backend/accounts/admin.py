from django.contrib import admin
from django.utils import timezone

from .models import EmailVerificationToken


@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display = ("user_email", "status", "created_at", "expires_at", "used_at", "source_ip")
    list_filter = ("used_at", "created_at")
    search_fields = ("user__email", "user__username", "token")
    readonly_fields = ("token", "created_at", "expires_at", "used_at", "source_ip")
    ordering = ("-created_at",)

    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = "Email"

    def status(self, obj):
        if obj.used_at:
            return "✓ used"
        if obj.expires_at < timezone.now():
            return "× expired"
        return "• pending"
    status.short_description = "Status"

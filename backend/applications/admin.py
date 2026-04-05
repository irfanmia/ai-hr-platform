from django.contrib import admin

from .models import Application


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("candidate_name", "job", "status", "ai_score", "created_at")
    list_filter = ("status", "job")
    search_fields = ("candidate_name", "email")

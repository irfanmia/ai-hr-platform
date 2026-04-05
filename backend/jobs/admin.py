from django.contrib import admin

from .models import Job


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("title", "department", "location_type", "is_active", "created_at")
    list_filter = ("location_type", "department", "is_active")
    search_fields = ("title", "department")

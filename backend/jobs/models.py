from django.db import models


class Job(models.Model):
    class LocationType(models.TextChoices):
        REMOTE = "remote", "Remote"
        ONSITE = "onsite", "Onsite"
        HYBRID = "hybrid", "Hybrid"

    title = models.CharField(max_length=255)
    department = models.CharField(max_length=255)
    location_type = models.CharField(max_length=20, choices=LocationType.choices)
    experience_years_min = models.PositiveIntegerField()
    experience_years_max = models.PositiveIntegerField()
    skills = models.JSONField(default=list)
    salary_min = models.PositiveIntegerField(null=True, blank=True)
    salary_max = models.PositiveIntegerField(null=True, blank=True)
    description = models.TextField()
    requirements = models.TextField()
    responsibilities = models.TextField()
    custom_fields = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title

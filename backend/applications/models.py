from django.db import models

from jobs.models import Job


class Application(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        SCREENING = "screening", "Screening"
        SHORTLISTED = "shortlisted", "Shortlisted"
        REJECTED = "rejected", "Rejected"

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="applications")
    candidate_name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True, default="")
    resume = models.FileField(upload_to="resumes/")
    portfolio_url = models.URLField(null=True, blank=True)
    github_url = models.URLField(null=True, blank=True)
    linkedin_url = models.URLField(null=True, blank=True)
    custom_answers = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    ai_report = models.JSONField(null=True, blank=True)
    ai_score = models.IntegerField(null=True, blank=True)
    # Identity verification snapshots — list of dicts:
    #   [{"path": "identity_snapshots/<id>/<ts>.jpg", "captured_at": "<iso>"}]
    # Files live under MEDIA_ROOT. Auto-deleted when status moves to rejected.
    identity_snapshots = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.candidate_name} - {self.job.title}"

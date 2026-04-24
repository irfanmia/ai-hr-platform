from django.db import models


class Job(models.Model):
    class LocationType(models.TextChoices):
        REMOTE = "remote", "Remote"
        ONSITE = "onsite", "Onsite"
        HYBRID = "hybrid", "Hybrid"

    class ResponseType(models.TextChoices):
        TEXT = "text", "Text only"
        VIDEO = "video", "Video interview (audio recorded & transcribed)"
        VIDEO_PREFERRED = "video_preferred", "Video preferred, text fallback allowed"
        CANDIDATE_CHOICE = "candidate_choice", "Let candidate choose"

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
    # Scoring weights (must add up to 100)
    resume_match_weight = models.PositiveIntegerField(
        default=50, help_text="Weight for resume-to-job match score (0-100)"
    )
    interview_weight = models.PositiveIntegerField(
        default=50, help_text="Weight for interview question score (0-100)"
    )
    # Interview response mode — how candidates answer interview questions.
    # 'video' turns on the camera for interview-feel, but ONLY the audio is
    # transcribed (Whisper) and sent to the scoring AI. No video is stored.
    response_type = models.CharField(
        max_length=20,
        choices=ResponseType.choices,
        default=ResponseType.TEXT,
        help_text=(
            "How candidates answer interview questions. Video mode turns the camera on for "
            "interview-feel but only audio is transcribed — no video is stored server-side."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [("jobs", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="Application",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("candidate_name", models.CharField(max_length=255)),
                ("email", models.EmailField(max_length=254)),
                ("phone", models.CharField(max_length=30)),
                ("resume", models.FileField(upload_to="resumes/")),
                ("portfolio_url", models.URLField(blank=True, null=True)),
                ("github_url", models.URLField(blank=True, null=True)),
                ("linkedin_url", models.URLField(blank=True, null=True)),
                ("custom_answers", models.JSONField(blank=True, default=dict)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("new", "New"),
                            ("screening", "Screening"),
                            ("shortlisted", "Shortlisted"),
                            ("rejected", "Rejected"),
                        ],
                        default="new",
                        max_length=20,
                    ),
                ),
                ("ai_report", models.JSONField(blank=True, null=True)),
                ("ai_score", models.IntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "job",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="applications", to="jobs.job"),
                ),
            ],
            options={"ordering": ["-created_at"]},
        )
    ]

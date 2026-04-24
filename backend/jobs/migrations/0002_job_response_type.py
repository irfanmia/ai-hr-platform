"""Add response_type to Job for text vs. video interviews.

NOTE FOR DEPLOY:
The production DB may already have a locally-generated migration at slot 0002
(for the scoring-weight fields `resume_match_weight` and `interview_weight`
which live on the model but have no migration tracked in this repo).

Before deploying, run on the server:
    python manage.py showmigrations jobs

If `0002_*` already exists in applied migrations, rename this file to the
next free slot (e.g. `0003_job_response_type.py`) AND update the
`dependencies` entry below to point to the existing latest migration name.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("jobs", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="job",
            name="response_type",
            field=models.CharField(
                choices=[
                    ("text", "Text only"),
                    ("video", "Video interview (audio recorded & transcribed)"),
                    ("video_preferred", "Video preferred, text fallback allowed"),
                    ("candidate_choice", "Let candidate choose"),
                ],
                default="text",
                help_text=(
                    "How candidates answer interview questions. Video mode turns the "
                    "camera on for interview-feel but only audio is transcribed — no "
                    "video is stored server-side."
                ),
                max_length=20,
            ),
        ),
    ]

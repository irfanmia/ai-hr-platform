"""Add identity_snapshots_enabled to Job.

NOTE: This migration depends on whatever 0002 currently exists in the
production DB (response_type if our pipeline ran, scoring weights if a
local-only migration was applied first). The dependencies entry below
points at the most recent migration in the repo. If the server has a
different latest migration name, rename this file and update deps before
running migrate.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("jobs", "0002_job_response_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="job",
            name="identity_snapshots_enabled",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "If on (and the role uses video), 3 random still frames from the candidate's "
                    "camera are captured during the interview for HR identity verification. "
                    "Snapshots auto-delete when the candidate is rejected. Disable for low-stakes "
                    "roles or jurisdictions where biometric capture is restricted."
                ),
            ),
        ),
    ]

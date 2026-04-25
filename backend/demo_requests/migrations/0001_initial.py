"""Initial schema for the demo_requests app."""
from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies: list = []

    operations = [
        migrations.CreateModel(
            name="DemoRequest",
            fields=[
                ("id", models.BigAutoField(
                    auto_created=True, primary_key=True, serialize=False, verbose_name="ID",
                )),
                ("name", models.CharField(max_length=120)),
                ("email", models.EmailField(max_length=254)),
                ("company", models.CharField(max_length=200)),
                ("designation", models.CharField(max_length=120)),
                ("phone", models.CharField(max_length=40)),
                ("message", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("source_ip", models.GenericIPAddressField(blank=True, null=True)),
                ("user_agent", models.CharField(blank=True, default="", max_length=400)),
                ("referer", models.CharField(blank=True, default="", max_length=400)),
                ("notify_email_sent", models.BooleanField(default=False)),
                ("autoreply_email_sent", models.BooleanField(default=False)),
                ("last_email_error", models.TextField(blank=True, default="")),
                ("status", models.CharField(
                    choices=[
                        ("new", "New"),
                        ("contacted", "Contacted"),
                        ("qualified", "Qualified"),
                        ("won", "Won"),
                        ("lost", "Lost"),
                        ("spam", "Spam"),
                    ],
                    default="new",
                    max_length=16,
                )),
                ("notes", models.TextField(blank=True, default="")),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["-created_at"], name="demo_create_idx"),
                    models.Index(fields=["status"], name="demo_status_idx"),
                ],
            },
        ),
    ]

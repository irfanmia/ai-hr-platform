"""Initial schema for the accounts app."""
from __future__ import annotations

import accounts.models
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="EmailVerificationToken",
            fields=[
                ("id", models.BigAutoField(
                    auto_created=True, primary_key=True, serialize=False, verbose_name="ID",
                )),
                ("token", models.CharField(
                    db_index=True, default=accounts.models._new_token,
                    max_length=80, unique=True,
                )),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField(default=accounts.models._default_expiry)),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                ("source_ip", models.GenericIPAddressField(blank=True, null=True)),
                ("user", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="email_verification_tokens",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["-created_at"], name="evt_created_idx"),
                    models.Index(fields=["used_at"], name="evt_used_idx"),
                ],
            },
        ),
    ]

"""
Defensive: ensure all users that existed BEFORE the verification flow
landed are marked is_active=True so they don't get locked out the moment
this code ships. New signups go through is_active=False → click link →
True; this migration only touches the historical population.
"""
from __future__ import annotations

from django.db import migrations


def mark_existing_users_active(apps, schema_editor):
    User = apps.get_model("auth", "User")
    User.objects.filter(is_active=False).update(is_active=True)


def noop_reverse(apps, schema_editor):
    """Don't undo — going back would lock everyone out."""
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(mark_existing_users_active, noop_reverse),
    ]

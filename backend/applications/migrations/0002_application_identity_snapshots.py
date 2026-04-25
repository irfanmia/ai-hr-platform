"""Add identity_snapshots JSONField to Application."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("applications", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="application",
            name="identity_snapshots",
            field=models.JSONField(blank=True, default=list),
        ),
    ]

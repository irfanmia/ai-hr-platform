from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Job",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("department", models.CharField(max_length=255)),
                (
                    "location_type",
                    models.CharField(
                        choices=[("remote", "Remote"), ("onsite", "Onsite"), ("hybrid", "Hybrid")],
                        max_length=20,
                    ),
                ),
                ("experience_years_min", models.PositiveIntegerField()),
                ("experience_years_max", models.PositiveIntegerField()),
                ("skills", models.JSONField(default=list)),
                ("salary_min", models.PositiveIntegerField(blank=True, null=True)),
                ("salary_max", models.PositiveIntegerField(blank=True, null=True)),
                ("description", models.TextField()),
                ("requirements", models.TextField()),
                ("responsibilities", models.TextField()),
                ("custom_fields", models.JSONField(blank=True, default=dict)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-created_at"]},
        )
    ]

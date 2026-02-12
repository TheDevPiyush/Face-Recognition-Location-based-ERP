# Generated migration for Announcement model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("college", "0010_user_can_update_picture"),
    ]

    operations = [
        migrations.CreateModel(
            name="Announcement",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("title", models.CharField(db_index=True, max_length=255)),
                (
                    "description",
                    models.TextField(blank=True, null=True),
                ),
                (
                    "announcement_type",
                    models.CharField(
                        choices=[
                            ("text", "Text"),
                            ("audio", "Audio"),
                            ("video", "Video"),
                        ],
                        db_index=True,
                        default="text",
                        max_length=20,
                    ),
                ),
                (
                    "text_content",
                    models.TextField(blank=True, null=True),
                ),
                (
                    "audio_url",
                    models.CharField(blank=True, max_length=9999, null=True),
                ),
                (
                    "video_url",
                    models.CharField(blank=True, max_length=9999, null=True),
                ),
                (
                    "is_published",
                    models.BooleanField(db_index=True, default=True),
                ),
                (
                    "is_pinned",
                    models.BooleanField(db_index=True, default=False),
                ),
                (
                    "published_at",
                    models.DateTimeField(db_index=True, default=django.utils.timezone.now),
                ),
                (
                    "expires_at",
                    models.DateTimeField(blank=True, null=True),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="announcements_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "target_batch",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="announcements",
                        to="college.batch",
                    ),
                ),
                (
                    "target_university",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="announcements",
                        to="college.university",
                    ),
                ),
            ],
            options={
                "ordering": ["-is_pinned", "-published_at"],
            },
        ),
        migrations.AddIndex(
            model_name="announcement",
            index=models.Index(
                fields=["-is_pinned", "-published_at"],
                name="college_ann_is_pin_idx",
            ),
        ),
    ]

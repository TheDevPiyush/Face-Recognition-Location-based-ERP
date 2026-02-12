from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import *

User = get_user_model()


class UniversitySerializer(serializers.ModelSerializer):
    class Meta:
        model = University
        fields = "__all__"


class CourseSerializer(serializers.ModelSerializer):
    # Accept a university id for write; expose nested detail for read
    university = serializers.PrimaryKeyRelatedField(queryset=University.objects.all())
    university_detail = UniversitySerializer(read_only=True, source="university")

    class Meta:
        model = Course
        fields = "__all__"

    def _compose_name(
        self,
        code: str | None,
        university: University | None,
        fallback: str | None = None,
    ) -> str:
        parts = []
        if code:
            parts.append(str(code))
        if university and university.code:
            parts.append(str(university.code))
        composed = " - ".join(parts)
        return composed or (fallback or "")

    def create(self, validated_data):
        code = validated_data.get("code")
        uni = validated_data.get("university")
        validated_data["name"] = self._compose_name(
            code, uni, validated_data.get("name")
        )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        code = validated_data.get("code", instance.code)
        uni = validated_data.get("university", instance.university)
        validated_data["name"] = self._compose_name(code, uni, instance.name)
        return super().update(instance, validated_data)


class UserAdminSerializer(serializers.ModelSerializer):
    password = serializers.CharField()

    class Meta:
        model = User
        fields = "__all__"

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)  # type: ignore


class SubjectSerializer(serializers.ModelSerializer):
    # Accept PK for batch/faculty; compute name using code + batch
    batch = serializers.PrimaryKeyRelatedField(queryset=Batch.objects.all())
    faculty = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Subject
        fields = "__all__"

    def _compose_name(
        self, code: str | None, batch: Batch | None, fallback: str | None = None
    ) -> str:
        parts = []
        if code:
            parts.append(str(code))
        if batch and batch.name:
            parts.append(str(batch.name))
        composed = " - ".join(parts)
        return composed or (fallback or "")

    def create(self, validated_data):
        code = validated_data.get("code")
        batch = validated_data.get("batch")
        validated_data["name"] = self._compose_name(
            code, batch, validated_data.get("name")
        )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        code = validated_data.get("code", instance.code)
        batch = validated_data.get("batch", instance.batch)
        validated_data["name"] = self._compose_name(code, batch, instance.name)
        return super().update(instance, validated_data)


class BatchSerializer(serializers.ModelSerializer):
    # Accept a course id for write; expose nested detail for read
    course = serializers.PrimaryKeyRelatedField(queryset=Course.objects.all())
    course_detail = CourseSerializer(read_only=True, source="course")
    subjects = SubjectSerializer(read_only=True, many=True)

    class Meta:
        model = Batch
        fields = "__all__"

    def _compose_name(
        self,
        course: Course | None,
        code: str | None,
        start_year: int | None,
        end_year: int | None,
        fallback: str | None = None,
    ) -> str:
        parts = []
        if course and course.name:
            parts.append(str(course.name))
        if code:
            parts.append(str(code))
        if start_year and end_year:
            parts.append(f"{start_year}-{end_year}")
        composed = "-".join(parts)
        return composed or (fallback or "")

    def create(self, validated_data):
        course = validated_data.get("course")
        code = validated_data.get("code")
        start_year = validated_data.get("start_year")
        end_year = validated_data.get("end_year")
        validated_data["name"] = self._compose_name(
            course, code, start_year, end_year, validated_data.get("name")
        )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        course = validated_data.get("course", instance.course)
        code = validated_data.get("code", instance.code)
        start_year = validated_data.get("start_year", instance.start_year)
        end_year = validated_data.get("end_year", instance.end_year)
        validated_data["name"] = self._compose_name(
            course, code, start_year, end_year, instance.name
        )
        return super().update(instance, validated_data)


class UserStudentSerializer(serializers.ModelSerializer):
    batch = BatchSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "name", "email", "role", "batch", "profile_picture"]
        read_only_fields = ["id", "name", "email", "role", "batch"]


class Attendance_WindowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance_Window
        fields = "__all__"


class AttendanceRecordSerializer(serializers.ModelSerializer):
    user = UserStudentSerializer(read_only=True)
    attendance_window = Attendance_WindowSerializer(read_only=True)

    class Meta:
        model = Attendance_Record
        fields = "__all__"

class AnnouncementSerializer(serializers.ModelSerializer):
    """Serializer for Announcement model with nested user details."""

    created_by = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = [
            "id",
            "title",
            "description",
            "announcement_type",
            "text_content",
            "audio_url",
            "video_url",
            "created_by",
            "target_batch",
            "target_university",
            "is_published",
            "is_pinned",
            "published_at",
            "expires_at",
            "created_at",
            "updated_at",
        ]

    def get_created_by(self, obj):
        """Return user info for the creator."""
        if obj.created_by:
            return {
                "id": obj.created_by.id,
                "name": obj.created_by.name,
                "email": obj.created_by.email,
                "role": obj.created_by.role,
            }
        return None


class AnnouncementCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating announcements."""

    class Meta:
        model = Announcement
        fields = [
            "title",
            "description",
            "announcement_type",
            "text_content",
            "audio_url",
            "video_url",
            "target_batch",
            "target_university",
            "is_published",
            "is_pinned",
            "published_at",
            "expires_at",
        ]
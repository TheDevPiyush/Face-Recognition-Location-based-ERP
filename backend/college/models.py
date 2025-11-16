from email.policy import default
from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser,
    PermissionsMixin,
    BaseUserManager,
)
from django.utils import timezone
from pgvector.django import VectorField

class University(models.Model):
    name = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    code = models.CharField(
        max_length=50, unique=True, null=True, blank=True, db_index=True
    )
    address = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Course(models.Model):
    university = models.ForeignKey(
        University, on_delete=models.CASCADE, related_name="courses"
    )
    name = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    code = models.CharField(max_length=50, null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.university.name})"


class Batch(models.Model):
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="batches", null=True, blank=True
    )  # BCA
    code = models.CharField(max_length=50, null=True, blank=True)  # B2
    start_year = models.IntegerField(null=True, blank=True)  # 2023
    end_year = models.IntegerField(null=True, blank=True)  # 2026
    created_at = models.DateTimeField(auto_now_add=True)
    name = models.CharField(
        max_length=100, null=True, blank=True, db_index=True
    )  # BCA-PPU-B2-2023-2026

    def __str__(self):
        return f"{self.name} ({self.course.name})"


class UserManager(BaseUserManager):
    """Manager to handle user creation and hashing."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required for user creation")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", User.Role.ADMIN)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Custom auth user with role, batch link, and geo fields."""

    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        TEACHER = "teacher", "Teacher"
        ADMIN = "admin", "Admin"
        PARENT = "parent", "Parent"
        OTHER = "other", "Other"

    email = models.EmailField(unique=True, null=True, blank=True, db_index=True)
    name = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    image_url = models.CharField(max_length=9999, null=True, blank=True, db_index=True)
    college_id = models.CharField(
        max_length=255, unique=True, null=True, blank=True, db_index=True
    )
    role = models.CharField(
        max_length=50,
        choices=Role.choices,
        default=Role.STUDENT,
        null=True,
        blank=True,
    )
    batch = models.ForeignKey(
        Batch, on_delete=models.CASCADE, related_name="users", null=True, blank=True
    )

    # --- location fields ---
    latitude = models.DecimalField(
        max_digits=10, decimal_places=8, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=11, decimal_places=8, null=True, blank=True
    )

    # --- contact info ---
    phone = models.CharField(max_length=20, null=True, blank=True, db_index=True)
    address = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=255, null=True, blank=True)
    state = models.CharField(max_length=255, null=True, blank=True)
    country = models.CharField(max_length=255, null=True, blank=True)
    pincode = models.CharField(max_length=20, null=True, blank=True)
    profile_picture = models.CharField(max_length=255, null=True, blank=True)
    face_embedding = VectorField(dimensions=128, null=True, blank=True)
    can_update_picture = models.BooleanField(default=False, db_index=True) # type: ignore[arg-type]

    # --- status flags ---
    is_active = models.BooleanField(default=True, db_index=True) # type: ignore[arg-type]
    is_staff = models.BooleanField(default=False, db_index=True) # type: ignore[arg-type]
    is_deleted = models.BooleanField(default=False) # type: ignore[arg-type]

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return f"{self.name or self.email or 'Unknown'} ({self.role})"


class Subject(models.Model):
    batch = models.ForeignKey(Batch, on_delete=models.CASCADE, related_name="subjects")
    faculty = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="faculty_subjects",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255, db_index=True, null=True, blank=True)
    code = models.CharField(max_length=50, null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.batch.name})"


class Attendance_Window(models.Model):
    target_batch = models.ForeignKey(
        Batch,
        on_delete=models.CASCADE,
        related_name="attendance_windows",
        null=True,
        blank=True,
    )
    target_subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name="attendance_windows",
        null=True,
        blank=True,
    )
    start_time = models.DateTimeField(default=timezone.now)
    duration = models.IntegerField(default=30) # type: ignore[arg-type]
    is_active = models.BooleanField(default=False) # type: ignore[arg-type]
    last_interacted_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="attendance_windows",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.target_subject.name} ({self.target_batch.name})"


class Attendance_Record(models.Model):

    class Status(models.TextChoices):
        PRESENT = "P", "Present"
        ABSENT = "A", "Absent"
        NOT_APPLICABLE = "NA", "Not Applicable"

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="attendance_records", db_index=True
    )
    attendance_window = models.ForeignKey(
        Attendance_Window,
        on_delete=models.CASCADE,
        related_name="attendance_records_users",
        db_index=True,
    )
    status = models.CharField(max_length=255, default=Status.NOT_APPLICABLE) # type: ignore[arg-type]
    created_at = models.DateTimeField(auto_now_add=True)
    date = models.DateField(default=timezone.localdate)
    marked_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="attendance_records_marked_by",
        db_index=True,
    )

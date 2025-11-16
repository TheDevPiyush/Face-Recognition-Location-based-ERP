from pgvector.django import L2Distance
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from shapely.geometry import Point, Polygon

from college.utils.check_roles import check_allow_roles
from services.face_recognition import has_face
from ..models import Batch, Subject, Attendance_Window, User, Attendance_Record
from ..serializers import Attendance_WindowSerializer, AttendanceRecordSerializer


class AttendanceWindowView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get the attendance window for a given batch and subject.

        Query params:
        - batch: int (required)
        - subject: int (required)
        """
        batch_id = request.query_params.get("target_batch")
        subject_id = request.query_params.get("target_subject")

        if not batch_id or not subject_id:
            return Response(
                {"error": "'batch' and 'subject' query params are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch = get_object_or_404(Batch, pk=batch_id)
        subject = get_object_or_404(Subject, pk=subject_id)

        if subject.batch_id != batch.id:
            return Response(
                {"error": "Subject does not belong to the provided batch"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        window = (
            Attendance_Window.objects.filter(target_batch=batch, target_subject=subject)
            .order_by("-id")
            .first()
        )

        if not window:
            return Response(
                {"message": "Attendance window not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check time validity
        now = timezone.now()
        window_end = window.start_time + timedelta(seconds=int(window.duration))
        if now > window_end:
            Attendance_Window.objects.filter(id=window.id).update(is_active=False)
            return Response(
                {"message": "Attendance window is closed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = Attendance_WindowSerializer(window)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        """Create or update (upsert) attendance window for batch+subject.

        Body fields:
        - batch: int (required)
        - subject: int (required, must belong to batch)
        - start_time: "HH:MM[:SS]" (required)
        - end_time: "HH:MM[:SS]" (required)
        - is_active: bool (optional)
        """

        if allowed := check_allow_roles(
            request.user, [User.Role.TEACHER, User.Role.ADMIN]
        ):
            return allowed

        data = request.data
        batch_id = data.get("target_batch")
        subject_id = data.get("target_subject")

        if not batch_id or not subject_id:
            return Response(
                {"message": "'batch' and 'subject' are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch = get_object_or_404(Batch, pk=batch_id)
        subject = get_object_or_404(Subject, pk=subject_id)
        print(batch, subject)

        if subject.batch_id != batch.id:
            return Response(
                {"message": "Subject does not belong to the provided batch"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = (
            Attendance_Window.objects.filter(target_batch=batch, target_subject=subject)
            .order_by("-id")
            .first()
        )

        mutable_data = dict(data)
        mutable_data["last_interacted_by"] = request.user.id

        if existing:
            requested_active = mutable_data.get("is_active", existing.is_active)

            if requested_active:
                mutable_data["start_time"] = timezone.now()

            serializer = Attendance_WindowSerializer(
                existing, data=mutable_data, partial=True
            )
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Create new attendance window if none exists for this batch+subject
        if mutable_data.get("is_active"):
            mutable_data["start_time"] = timezone.now()
        serializer = Attendance_WindowSerializer(data=mutable_data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AttendanceRecordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Create or update attendance based on today's date (not created_at)."""

        data = request.data
        image = request.FILES.get("student_picture")
        window_id = data.get("attendance_window")

        if not window_id:
            return Response(
                {"message": "'attendance_window' is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        has_face_flag, encoding = has_face(image_file=image)

        if not has_face_flag:
            return Response(
                {"error": "Not a valid face in the provided image"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if encoding is None:
            return Response(
                {"error": "Couldn't extract valid face data from the provided image"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # role-based access control
        if allowed := check_allow_roles(
            request.user, [User.Role.TEACHER, User.Role.ADMIN, User.Role.STUDENT]
        ):
            return allowed

        user_data = (
            User.objects.annotate(distance=L2Distance("face_embedding", encoding))
            .order_by("distance")
            .first()
        )
        print(user_data)
        print(user_data.distance)

        if not user_data:
            return Response(
                {
                    "error": "Couldn't find any user with the provided face. make sure you are registered and image is clear"
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if user_data and user_data.distance > 0.55:
            return Response(
                {"error": "Face did not match!"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if request.user.role == User.Role.STUDENT:
            target_user = request.user
        else:
            if not user_data:
                return Response(
                    {"message": "'user' is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            target_user = get_object_or_404(User, pk=user_data)

        window = get_object_or_404(Attendance_Window, pk=window_id)

        # Students can only mark their own attendance
        if request.user.role == User.Role.STUDENT and request.user.id != target_user.id:
            return Response(
                {"message": "Students can only mark their own attendance"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Batch validation
        if target_user.batch_id != window.target_batch_id:
            return Response(
                {"message": "User does not belong to the window's batch"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check active window
        if not window.is_active:
            return Response(
                {"message": "Attendance window is not active"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.localdate()

        # Check time validity
        now = timezone.now()
        window_end = window.start_time + timedelta(seconds=int(window.duration))
        if now > window_end:
            close_window = Attendance_Window.objects.filter(id=window.id).update(
                is_active=False
            )
            return Response(
                {"message": "Attendance window is closed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Location check
        if target_user.latitude is None or target_user.longitude is None:
            return Response(
                {"message": "User location not available"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            latitude = float(target_user.latitude)
            longitude = float(target_user.longitude)
        except:
            return Response(
                {"message": "Invalid user latitude/longitude"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 25.632935, 85.101305
        # Polygon check
        boundary_latlon = [
            (25.632875, 85.101206),
            (25.632820, 85.101317),
            (25.632982, 85.101409),
            (25.633035, 85.101295),
        ]
        polygon_coords = [(lon_, lat_) for (lat_, lon_) in boundary_latlon]
        college_polygon = Polygon(polygon_coords)

        student_point = Point(longitude, latitude)
        if not college_polygon.covers(student_point):
            return Response(
                {"message": "Student is outside the college boundary"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ✅ Now check: does today's record already exist?
        record, created = Attendance_Record.objects.get_or_create(
            user=target_user,
            attendance_window=window,
            date=today,  # ✅ key change
            defaults={
                "status": Attendance_Record.Status.PRESENT,
                "marked_by": request.user,
            },
        )

        if not created:
            record.status = Attendance_Record.Status.PRESENT
            record.marked_by = request.user
            record.save()

        serializer = AttendanceRecordSerializer(record)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

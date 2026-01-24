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

FACE_MATCH_THRESHOLD = 0.8


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
            Attendance_Window.objects.filter(
                target_batch=batch,
                target_subject=subject,
                is_active=True,
            )
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
        """Create or close an attendance window for batch+subject.

        - Open: is_active=True → always create a NEW window (unique per date).
        - Close: is_active=False → deactivate the latest active window only.

        Body: target_batch, target_subject, is_active, duration (optional, for open).
        """

        if allowed := check_allow_roles(
            request.user, [User.Role.TEACHER, User.Role.ADMIN]
        ):
            return allowed

        data = request.data
        batch_id = data.get("target_batch")
        subject_id = data.get("target_subject")
        is_active = data.get("is_active")

        if not batch_id or not subject_id:
            return Response(
                {"message": "'target_batch' and 'target_subject' are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch = get_object_or_404(Batch, pk=batch_id)
        subject = get_object_or_404(Subject, pk=subject_id)

        if subject.batch_id != batch.id:
            return Response(
                {"message": "Subject does not belong to the provided batch"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if is_active:
            # Open: always create a new window (one per open = unique per date/session)
            duration = data.get("duration")
            if duration is not None:
                duration = int(duration)
            else:
                duration = 30
            duration = max(30, duration)

            payload = {
                "target_batch": batch.id,
                "target_subject": subject.id,
                "start_time": timezone.now(),
                "duration": duration,
                "is_active": True,
                "last_interacted_by": request.user.id,
            }
            serializer = Attendance_WindowSerializer(data=payload)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Close: deactivate the latest active window for this batch+subject
        to_close = (
            Attendance_Window.objects.filter(
                target_batch=batch,
                target_subject=subject,
                is_active=True,
            )
            .order_by("-id")
            .first()
        )
        if not to_close:
            return Response(
                {"message": "No active window found to close."},
                status=status.HTTP_404_NOT_FOUND,
            )
        to_close.is_active = False
        to_close.save(update_fields=["is_active"])
        serializer = Attendance_WindowSerializer(to_close)
        return Response(serializer.data, status=status.HTTP_200_OK)


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

        window = get_object_or_404(Attendance_Window, pk=window_id)

        
        # Check active window
        if not window.is_active:
            return Response(
                {"message": "Attendance window is not active"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check time validity
        now = timezone.now()
        window_end = window.start_time + timedelta(seconds=int(window.duration))
        if now > window_end:
            Attendance_Window.objects.filter(id=window.id).update(
                is_active=False
            )
            return Response(
                {"message": "Attendance window is closed"},
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

        encoding_vector = encoding.tolist() if hasattr(encoding, "tolist") else encoding

        # role-based access control
        if allowed := check_allow_roles(
            request.user, [User.Role.TEACHER, User.Role.ADMIN, User.Role.STUDENT]
        ):
            return allowed

        user_data = (
            User.objects.annotate(distance=L2Distance("face_embedding", encoding_vector))
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
        print(user_data)
        if user_data and user_data.distance > FACE_MATCH_THRESHOLD:
            return Response(
                {"error": "Face did not match! Make sure you are not wearing glasses and you are close to the camera!"},
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

        today = timezone.localdate()

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

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.utils import timezone
from datetime import datetime, timedelta
from collections import defaultdict
import calendar

from ..models import User, Attendance_Record, Attendance_Window, Batch, Subject


# =========================================================
# ATTENDANCE ANALYTICS (DAILY + MONTHLY + SUBJECT WISE)
# =========================================================
class AttendanceAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # ---------------- Role control ----------------
        if user.role == User.Role.STUDENT:
            student_id = user.id
        elif user.role in [User.Role.ADMIN, User.Role.TEACHER]:
            student_id = request.query_params.get("student_id")
            if student_id:
                student_id = int(student_id)
        else:
            return Response(
                {"error": "You are not authorized"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ---------------- Filters ----------------
        batch_id = request.query_params.get("batch_id")
        subject_id = request.query_params.get("subject_id")
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        month_str = request.query_params.get("month")

        today = timezone.localdate()

        start_date = (
            datetime.strptime(start_date_str, "%Y-%m-%d").date()
            if start_date_str
            else today - timedelta(days=30)
        )
        end_date = (
            datetime.strptime(end_date_str, "%Y-%m-%d").date()
            if end_date_str
            else today
        )

        if start_date > end_date:
            return Response(
                {"error": "Invalid date range"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ---------------- Windows (classes) ----------------
        window_filters = Q(date__gte=start_date, date__lte=end_date)

        if batch_id:
            window_filters &= Q(target_batch_id=batch_id)
        if subject_id:
            window_filters &= Q(target_subject_id=subject_id)

        windows = Attendance_Window.objects.filter(window_filters)

        classes_by_date = defaultdict(int)
        for w in windows:
            key = w.date.isoformat()
            classes_by_date[key] += 1

        # ---------------- Records ----------------
        record_filters = Q(
            attendance_window__date__gte=start_date,
            attendance_window__date__lte=end_date,
        )

        if student_id:
            record_filters &= Q(user_id=student_id)

        if batch_id:
            record_filters &= Q(
                attendance_window__target_batch_id=batch_id
            )

        if subject_id:
            record_filters &= Q(
                attendance_window__target_subject_id=subject_id
            )

        records = Attendance_Record.objects.filter(
            record_filters
        ).select_related("attendance_window")

        # ---------------- Daily breakdown ----------------
        daily_data = {}

        for record in records:
            date_key = record.attendance_window.date.isoformat()

            if date_key not in daily_data:
                daily_data[date_key] = {
                    "date": date_key,
                    "present": 0,
                    "absent": 0,
                    "total_classes": classes_by_date.get(date_key, 0),
                }

            if record.status == Attendance_Record.Status.PRESENT:
                daily_data[date_key]["present"] += 1
            else:
                daily_data[date_key]["absent"] += 1

        for date_key, total in classes_by_date.items():
            if date_key not in daily_data:
                daily_data[date_key] = {
                    "date": date_key,
                    "present": 0,
                    "absent": total,
                    "total_classes": total,
                }

        daily_attendance = sorted(daily_data.values(), key=lambda x: x["date"])

        # ---------------- Monthly + subject wise ----------------
        monthly_data = None
        if month_str:
            try:
                month_date = datetime.strptime(month_str, "%Y-%m").date()
            except ValueError:
                return Response(
                    {"error": "Invalid month format"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            month_start = month_date.replace(day=1)
            if month_date.month == 12:
                month_end = month_date.replace(
                    year=month_date.year + 1, month=1, day=1
                ) - timedelta(days=1)
            else:
                month_end = month_date.replace(
                    month=month_date.month + 1, day=1
                ) - timedelta(days=1)

            month_windows = Attendance_Window.objects.filter(
                date__gte=month_start,
                date__lte=month_end,
            )

            if batch_id:
                month_windows = month_windows.filter(
                    target_batch_id=batch_id
                )
            if subject_id:
                month_windows = month_windows.filter(
                    target_subject_id=subject_id
                )

            total_classes = month_windows.count()

            month_records = Attendance_Record.objects.filter(
                attendance_window__in=month_windows
            )
            if student_id:
                month_records = month_records.filter(user_id=student_id)

            present_count = month_records.filter(
                status=Attendance_Record.Status.PRESENT
            ).count()

            percentage = (
                round((present_count / total_classes) * 100, 2)
                if total_classes > 0
                else 0.0
            )

            # Subject-wise
            subject_stats = []
            subjects = Subject.objects.filter(
                id__in=month_windows.values_list(
                    "target_subject_id", flat=True
                ).distinct()
            )

            for subject in subjects:
                subject_windows = month_windows.filter(
                    target_subject=subject
                )
                subject_total = subject_windows.count()

                subject_present = month_records.filter(
                    attendance_window__in=subject_windows,
                    status=Attendance_Record.Status.PRESENT,
                ).count()

                subject_percentage = (
                    round((subject_present / subject_total) * 100, 2)
                    if subject_total > 0
                    else 0.0
                )

                subject_stats.append({
                    "subject": {
                        "id": subject.id,
                        "name": subject.name,
                        "code": subject.code,
                    },
                    "present": subject_present,
                    "total_classes": subject_total,
                    "percentage": subject_percentage,
                })

            monthly_data = {
                "month": month_str,
                "total_classes": total_classes,
                "present_count": present_count,
                "percentage": percentage,
                "subjects": subject_stats,
            }

        # ---------------- Summary ----------------
        total_present = sum(d["present"] for d in daily_attendance)
        total_classes = sum(d["total_classes"] for d in daily_attendance)

        overall_percentage = (
            round((total_present / total_classes) * 100, 2)
            if total_classes > 0
            else 0.0
        )

        return Response({
            "daily_attendance": daily_attendance,
            "monthly": monthly_data,
            "summary": {
                "total_present": total_present,
                "total_classes": total_classes,
                "overall_percentage": overall_percentage,
            },
        })


# =========================================================
# MONTHLY PERCENTAGE VIEW (ADMIN/TEACHER)
# =========================================================
class AttendanceMonthlyPercentageView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        batch_id = request.query_params.get("batch_id")
        subject_id = request.query_params.get("subject_id")
        student_id = request.query_params.get("student_id")
        month_str = request.query_params.get("month")

        today = timezone.localdate()
        if month_str:
            month_date = datetime.strptime(month_str, "%Y-%m").date()
        else:
            month_date = today.replace(day=1)

        month_start = month_date.replace(day=1)
        if month_date.month == 12:
            month_end = month_date.replace(
                year=month_date.year + 1, month=1, day=1
            ) - timedelta(days=1)
        else:
            month_end = month_date.replace(
                month=month_date.month + 1, day=1
            ) - timedelta(days=1)

        if user.role == User.Role.STUDENT:
            student_id = user.id
        elif user.role not in [User.Role.ADMIN, User.Role.TEACHER]:
            return Response(
                {"error": "Not authorized"},
                status=status.HTTP_403_FORBIDDEN,
            )

        window_filters = Q(date__gte=month_start, date__lte=month_end)
        if batch_id:
            window_filters &= Q(target_batch_id=batch_id)
        if subject_id:
            window_filters &= Q(target_subject_id=subject_id)

        windows = Attendance_Window.objects.filter(window_filters)

        record_filters = Q(attendance_window__in=windows)
        if student_id:
            record_filters &= Q(user_id=student_id)

        records = Attendance_Record.objects.filter(record_filters)

        grouped = defaultdict(lambda: {"present": 0, "total": 0})

        for w in windows:
            key = (w.target_batch_id, w.target_subject_id)
            grouped[key]["total"] += 1

        for r in records:
            if r.status == Attendance_Record.Status.PRESENT:
                key = (
                    r.attendance_window.target_batch_id,
                    r.attendance_window.target_subject_id,
                )
                grouped[key]["present"] += 1

        result = []
        for (batch_key, subject_key), stats in grouped.items():
            batch = Batch.objects.get(pk=batch_key)
            subject = Subject.objects.get(pk=subject_key)

            total = stats["total"]
            present = stats["present"]
            percentage = (
                round((present / total) * 100, 2)
                if total > 0
                else 0.0
            )

            result.append({
                "batch": {"id": batch.id, "name": batch.name},
                "subject": {
                    "id": subject.id,
                    "name": subject.name,
                    "code": subject.code,
                },
                "statistics": {
                    "present": present,
                    "total_classes": total,
                    "percentage": percentage,
                },
            })

        return Response({
            "month": month_str or month_date.strftime("%Y-%m"),
            "data": result,
        })


# =========================================================
# STUDENT CALENDAR VIEW
# =========================================================
class StudentCalendarView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != User.Role.STUDENT:
            return Response(
                {"error": "Only students allowed"},
                status=status.HTTP_403_FORBIDDEN,
            )

        month_str = request.query_params.get("month")
        today = timezone.localdate()

        if month_str:
            month_date = datetime.strptime(month_str, "%Y-%m").date()
        else:
            month_date = today.replace(day=1)

        month_start = month_date.replace(day=1)
        if month_date.month == 12:
            month_end = month_date.replace(
                year=month_date.year + 1, month=1, day=1
            ) - timedelta(days=1)
        else:
            month_end = month_date.replace(
                month=month_date.month + 1, day=1
            ) - timedelta(days=1)

        batch_id = user.batch_id
        batch = get_object_or_404(Batch, pk=batch_id)

        subjects = Subject.objects.filter(batch_id=batch_id).order_by("name")

        windows = Attendance_Window.objects.filter(
            target_batch_id=batch_id,
            date__gte=month_start,
            date__lte=month_end,
        )

        records = Attendance_Record.objects.filter(
            user_id=user.id,
            attendance_window__in=windows,
        )

        record_map = {}
        for r in records:
            key = (
                r.attendance_window.target_subject_id,
                r.attendance_window.date.isoformat(),
            )
            record_map[key] = (
                "P"
                if r.status == Attendance_Record.Status.PRESENT
                else "A"
            )

        days_in_month = calendar.monthrange(
            month_date.year, month_date.month
        )[1]

        calendar_data = []

        for subject in subjects:
            row = {
                "subject": {
                    "id": subject.id,
                    "name": subject.name,
                    "code": subject.code,
                },
                "dates": {},
            }

            for day in range(1, days_in_month + 1):
                date_obj = month_date.replace(day=day)
                key = date_obj.isoformat()

                window_exists = windows.filter(
                    target_subject=subject,
                    date=date_obj
                ).exists()

                if not window_exists:
                    row["dates"][key] = "NA"
                else:
                    row["dates"][key] = record_map.get(
                        (subject.id, key), "A"
                    )

            calendar_data.append(row)

        return Response({
            "month": month_str or month_date.strftime("%Y-%m"),
            "batch": {
                "id": batch.id,
                "name": batch.name,
            },
            "calendar": calendar_data,
        })

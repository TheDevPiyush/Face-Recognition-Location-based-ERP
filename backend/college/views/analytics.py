from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count, Case, When, IntegerField, F, Avg
from django.utils import timezone
from datetime import datetime, timedelta
from collections import defaultdict
import calendar

from college.utils.check_roles import check_allow_roles
from ..models import User, Attendance_Record, Attendance_Window, Batch, Subject


class AttendanceAnalyticsView(APIView):
    """
    Analytics endpoint for attendance data.
    Supports filtering by batch, subject, student, and date range.
    Returns daily attendance and monthly percentages.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get attendance analytics with filters.
        
        Query params:
        - batch_id: int (optional, required for admin)
        - subject_id: int (optional)
        - student_id: int (optional, students can only view their own)
        - start_date: YYYY-MM-DD (optional, defaults to 30 days ago)
        - end_date: YYYY-MM-DD (optional, defaults to today)
        - month: YYYY-MM (optional, for monthly percentage)
        """
        user = request.user
        
        # Role-based access control
        if user.role == User.Role.STUDENT:
            # Students can only view their own analytics
            student_id = user.id
        elif user.role in [User.Role.ADMIN, User.Role.TEACHER]:
            # Admin/Teacher can view any student's analytics
            student_id = request.query_params.get("student_id")
            if student_id:
                student_id = int(student_id)
        else:
            return Response(
                {"error": "You are not authorized to view analytics"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Get filter parameters
        batch_id = request.query_params.get("batch_id")
        subject_id = request.query_params.get("subject_id")
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        month_str = request.query_params.get("month")

        # Parse dates
        today = timezone.localdate()
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            except ValueError:
                return Response(
                    {"error": "Invalid start_date format. Use YYYY-MM-DD"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            start_date = today - timedelta(days=30)

        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            except ValueError:
                return Response(
                    {"error": "Invalid end_date format. Use YYYY-MM-DD"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            end_date = today

        if start_date > end_date:
            return Response(
                {"error": "start_date must be before or equal to end_date"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build window filters to find classes that happened
        window_filters = Q()
        if batch_id:
            window_filters &= Q(target_batch_id=batch_id)
        if subject_id:
            window_filters &= Q(target_subject_id=subject_id)

        # Get all attendance windows (classes) in the date range
        # A class happened on the date of the window's start_time
        windows = Attendance_Window.objects.filter(window_filters).filter(
            start_time__date__gte=start_date,
            start_time__date__lte=end_date
        )

        # Build query filters for attendance records
        filters = Q(date__gte=start_date, date__lte=end_date)

        if student_id:
            student = get_object_or_404(User, pk=student_id)
            # Verify student belongs to batch if batch_id is provided
            if batch_id and student.batch_id != int(batch_id):
                return Response(
                    {"error": "Student does not belong to the specified batch"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            filters &= Q(user_id=student_id)
        elif user.role == User.Role.STUDENT:
            filters &= Q(user_id=user.id)

        # Filter records by window IDs
        if batch_id or subject_id:
            window_ids = windows.values_list("id", flat=True)
            filters &= Q(attendance_window_id__in=window_ids)

        # Get attendance records
        records = Attendance_Record.objects.filter(filters).select_related(
            "user", "attendance_window", "attendance_window__target_batch", 
            "attendance_window__target_subject"
        )

        # Count total classes (windows) by date
        classes_by_date = defaultdict(int)
        for window in windows:
            date_key = window.start_time.date().isoformat()
            classes_by_date[date_key] += 1

        # Daily attendance breakdown
        daily_data = {}
        for record in records:
            date_key = record.date.isoformat()
            if date_key not in daily_data:
                daily_data[date_key] = {
                    "date": date_key,
                    "present": 0,
                    "absent": 0,
                    "total_classes": classes_by_date.get(date_key, 0),
                }
            
            if record.status == Attendance_Record.Status.PRESENT:
                daily_data[date_key]["present"] += 1
            elif record.status == Attendance_Record.Status.ABSENT:
                daily_data[date_key]["absent"] += 1

        # Add dates with classes but no records (students were absent)
        for date_key, class_count in classes_by_date.items():
            if date_key not in daily_data:
                daily_data[date_key] = {
                    "date": date_key,
                    "present": 0,
                    "absent": 0,
                    "total_classes": class_count,
                }

        # Convert to list and sort by date
        daily_attendance = sorted(
            daily_data.values(),
            key=lambda x: x["date"]
        )

        # Monthly percentage calculation
        monthly_percentage = None
        if month_str:
            try:
                month_date = datetime.strptime(month_str, "%Y-%m").date()
                month_start = month_date.replace(day=1)
                # Get last day of month
                if month_date.month == 12:
                    month_end = month_date.replace(year=month_date.year + 1, month=1, day=1) - timedelta(days=1)
                else:
                    month_end = month_date.replace(month=month_date.month + 1, day=1) - timedelta(days=1)
                
                # Count total classes in the month
                month_window_filters = Q()
                if batch_id:
                    month_window_filters &= Q(target_batch_id=batch_id)
                if subject_id:
                    month_window_filters &= Q(target_subject_id=subject_id)
                
                month_windows = Attendance_Window.objects.filter(month_window_filters).filter(
                    start_time__date__gte=month_start,
                    start_time__date__lte=month_end
                )
                total_classes = month_windows.count()

                # Get attendance records for the month
                month_filters = Q(date__gte=month_start, date__lte=month_end)
                if student_id:
                    month_filters &= Q(user_id=student_id)
                elif user.role == User.Role.STUDENT:
                    month_filters &= Q(user_id=user.id)
                
                if batch_id or subject_id:
                    window_ids = month_windows.values_list("id", flat=True)
                    month_filters &= Q(attendance_window_id__in=window_ids)

                month_records = Attendance_Record.objects.filter(month_filters)
                
                present_count = month_records.filter(
                    status=Attendance_Record.Status.PRESENT
                ).count()
                
                # Total classes is based on windows, not records
                # Absent = total classes - present
                absent_count = total_classes - present_count
                
                if total_classes > 0:
                    percentage = round((present_count / total_classes) * 100, 2)
                else:
                    percentage = 0.0

                monthly_percentage = {
                    "month": month_str,
                    "total_classes": total_classes,
                    "present_count": present_count,
                    "absent_count": absent_count,
                    "percentage": percentage,
                }
            except ValueError:
                return Response(
                    {"error": "Invalid month format. Use YYYY-MM"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Summary statistics
        total_present = sum(day["present"] for day in daily_attendance)
        total_absent = sum(day["absent"] for day in daily_attendance)
        total_classes = sum(day["total_classes"] for day in daily_attendance)
        total_days_with_classes = len([d for d in daily_attendance if d["total_classes"] > 0])
        overall_percentage = 0.0
        if total_classes > 0:
            overall_percentage = round((total_present / total_classes) * 100, 2)

        return Response({
            "daily_attendance": daily_attendance,
            "monthly_percentage": monthly_percentage,
            "summary": {
                "total_present": total_present,
                "total_absent": total_absent,
                "total_classes": total_classes,
                "total_days": total_days_with_classes,
                "overall_percentage": overall_percentage,
                "date_range": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                },
            },
        }, status=status.HTTP_200_OK)


class AttendanceMonthlyPercentageView(APIView):
    """
    Get monthly attendance percentage for each student for each subject for each batch.
    Admin/Teacher can view all students, students can only view their own.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get monthly attendance percentages grouped by batch, subject, and student.
        
        Query params:
        - batch_id: int (optional)
        - subject_id: int (optional)
        - student_id: int (optional, students can only view their own)
        - month: YYYY-MM (optional, defaults to current month)
        """
        user = request.user

        # Get filter parameters
        batch_id = request.query_params.get("batch_id")
        subject_id = request.query_params.get("subject_id")
        student_id = request.query_params.get("student_id")
        month_str = request.query_params.get("month")

        # Parse month
        today = timezone.localdate()
        if month_str:
            try:
                month_date = datetime.strptime(month_str, "%Y-%m").date()
            except ValueError:
                return Response(
                    {"error": "Invalid month format. Use YYYY-MM"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            month_date = today.replace(day=1)

        month_start = month_date.replace(day=1)
        if month_date.month == 12:
            month_end = month_date.replace(year=month_date.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            month_end = month_date.replace(month=month_date.month + 1, day=1) - timedelta(days=1)

        # Role-based access control
        if user.role == User.Role.STUDENT:
            # Students can only view their own data
            student_id = user.id
        elif user.role not in [User.Role.ADMIN, User.Role.TEACHER]:
            return Response(
                {"error": "You are not authorized to view analytics"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Build window filters
        window_filters = Q()
        if batch_id:
            window_filters &= Q(target_batch_id=batch_id)
        if subject_id:
            window_filters &= Q(target_subject_id=subject_id)

        # Get all attendance windows (classes) in the month
        windows = Attendance_Window.objects.filter(window_filters).filter(
            start_time__date__gte=month_start,
            start_time__date__lte=month_end
        )

        # Build query filters for records
        filters = Q(date__gte=month_start, date__lte=month_end)

        if student_id:
            student = get_object_or_404(User, pk=student_id)
            filters &= Q(user_id=student_id)
        elif user.role == User.Role.STUDENT:
            filters &= Q(user_id=user.id)

        if batch_id or subject_id:
            window_ids = windows.values_list("id", flat=True)
            filters &= Q(attendance_window_id__in=window_ids)

        # Get records with related data
        records = Attendance_Record.objects.filter(filters).select_related(
            "user", "attendance_window__target_batch", "attendance_window__target_subject"
        )

        # Group by batch -> subject -> student
        # Count classes (windows) and records
        grouped_data = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {
            "present": 0,
            "total_classes": 0,
        })))

        # Count classes by batch-subject
        classes_by_batch_subject = defaultdict(lambda: defaultdict(int))
        for window in windows:
            batch = window.target_batch
            subject = window.target_subject
            classes_by_batch_subject[batch.id][subject.id] += 1

        # Count present records
        for record in records:
            batch = record.attendance_window.target_batch
            subject = record.attendance_window.target_subject
            student = record.user

            batch_key = batch.id
            subject_key = subject.id
            student_key = student.id

            if record.status == Attendance_Record.Status.PRESENT:
                grouped_data[batch_key][subject_key][student_key]["present"] += 1

        # Format response
        result = []
        for batch_id_key, subjects in classes_by_batch_subject.items():
            batch_obj = Batch.objects.get(pk=batch_id_key)
            for subject_id_key, total_classes in subjects.items():
                subject_obj = Subject.objects.get(pk=subject_id_key)
                
                # Get students for this batch
                if student_id:
                    students_list = [User.objects.get(pk=student_id)]
                elif user.role == User.Role.STUDENT:
                    students_list = [user]
                else:
                    # Get all students in the batch
                    students_list = User.objects.filter(
                        batch_id=batch_id_key,
                        role=User.Role.STUDENT
                    )

                for student_obj in students_list:
                    student_key = student_obj.id
                    present = grouped_data[batch_id_key][subject_id_key][student_key]["present"]
                    absent = total_classes - present
                    percentage = round((present / total_classes * 100), 2) if total_classes > 0 else 0.0

                    result.append({
                        "batch": {
                            "id": batch_obj.id,
                            "name": batch_obj.name,
                        },
                        "subject": {
                            "id": subject_obj.id,
                            "name": subject_obj.name,
                            "code": subject_obj.code,
                        },
                        "student": {
                            "id": student_obj.id,
                            "name": student_obj.name,
                            "email": student_obj.email,
                            "college_id": student_obj.college_id,
                        },
                        "statistics": {
                            "present": present,
                            "absent": absent,
                            "total_classes": total_classes,
                            "percentage": percentage,
                        },
                    })

        # Sort by batch name, subject name, then student name
        result.sort(key=lambda x: (
            x["batch"]["name"] or "",
            x["subject"]["name"] or "",
            x["student"]["name"] or x["student"]["email"] or ""
        ))

        return Response({
            "month": month_str or month_date.strftime("%Y-%m"),
            "data": result,
        }, status=status.HTTP_200_OK)


class StudentCalendarView(APIView):
    """
    Get monthly calendar view for students showing subject vs dates.
    Shows P (Present), A (Absent), or empty (no class) for each subject-date combination.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get monthly calendar view for a student.
        
        Query params:
        - month: YYYY-MM (optional, defaults to current month)
        - batch_id: int (optional, defaults to student's batch)
        """
        user = request.user

        # Only students can access this view
        if user.role != User.Role.STUDENT:
            return Response(
                {"error": "This endpoint is only available for students"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Get filter parameters
        month_str = request.query_params.get("month")
        batch_id = request.query_params.get("batch_id")

        # Parse month
        today = timezone.localdate()
        if month_str:
            try:
                month_date = datetime.strptime(month_str, "%Y-%m").date()
            except ValueError:
                return Response(
                    {"error": "Invalid month format. Use YYYY-MM"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            month_date = today.replace(day=1)

        month_start = month_date.replace(day=1)
        if month_date.month == 12:
            month_end = month_date.replace(year=month_date.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            month_end = month_date.replace(month=month_date.month + 1, day=1) - timedelta(days=1)

        if not batch_id:
            if not user.batch_id:
                return Response(
                    {"error": "Student is not assigned to a batch"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            batch_id = user.batch_id
        else:
            batch_id = int(batch_id)
            if user.batch_id != batch_id:
                return Response(
                    {"error": "Student does not belong to the specified batch"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        batch = get_object_or_404(Batch, pk=batch_id)

        subjects = Subject.objects.filter(batch_id=batch_id).order_by("name")

        windows = Attendance_Window.objects.filter(
            target_batch_id=batch_id,
            start_time__date__gte=month_start,
            start_time__date__lte=month_end
        ).select_related("target_subject")

        window_ids = windows.values_list("id", flat=True)
        records = Attendance_Record.objects.filter(
            user_id=user.id,
            attendance_window_id__in=window_ids,
            date__gte=month_start,
            date__lte=month_end
        ).select_related("attendance_window__target_subject")

        record_map = {}
        for record in records:
            subject_id = record.attendance_window.target_subject.id
            date_key = record.date.isoformat()
            attendance_status = "P" if record.status == Attendance_Record.Status.PRESENT else "A"
            record_map[(subject_id, date_key)] = attendance_status

        calendar_data = []
        days_in_month = calendar.monthrange(month_date.year, month_date.month)[1]

        for subject in subjects:
            subject_row = {
                "subject": {
                    "id": subject.id,
                    "name": subject.name,
                    "code": subject.code,
                },
                "dates": {},
            }

            # Initialize all dates as empty
            for day in range(1, days_in_month + 1):
                date_obj = month_date.replace(day=day)
                date_key = date_obj.isoformat()
                subject_row["dates"][date_key] = None  # No class by default

            # Mark classes that happened (windows)
            for window in windows:
                if window.target_subject.id == subject.id:
                    window_date = window.start_time.date()
                    date_key = window_date.isoformat()
                    # Check if student has a record
                    if (subject.id, date_key) in record_map:
                        subject_row["dates"][date_key] = record_map[(subject.id, date_key)]
                    else:
                        # Class happened but no record = Absent
                        subject_row["dates"][date_key] = "A"

            calendar_data.append(subject_row)

        return Response({
            "month": month_str or month_date.strftime("%Y-%m"),
            "year": month_date.year,
            "month_number": month_date.month,
            "days_in_month": days_in_month,
            "batch": {
                "id": batch.id,
                "name": batch.name,
            },
            "calendar": calendar_data,
        }, status=status.HTTP_200_OK)

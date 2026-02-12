from django.urls import path
from .views.user import *
from rest_framework_simplejwt.views import TokenRefreshView
from .views.university import UniversityListCreateView, UniversityDetailView
from .views.course import CourseListCreateView, CourseDetailView
from .views.batch import BatchListCreateView, BatchDetailView
from .views.subject import SubjectListCreateView, SubjectDetailView
from .views.attendance import AttendanceWindowView, AttendanceRecordView
from .views.analytics import AttendanceAnalyticsView, AttendanceMonthlyPercentageView, StudentCalendarView
from .views.announcement import (
    AnnouncementListCreateView,
    AnnouncementDetailView,
    AnnouncementSearchView,
    AnnouncementByBatchView,
    AnnouncementByUniversityView,
)
from .views.announcement_upload import AnnouncementMediaUploadView

urlpatterns = [
    #
    #
    # lOGIN ENDPOINTS
    #
    #
    path("token/login/", UserLoginView.as_view(), name="login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    #
    #
    # ADMIN ENDPOINTS :
    #
    #
    path("users/", UserView.as_view(), name="users"),
    path("users/students/<int:batch_id>/", UserStudentView.as_view(), name="students"),
    path("users/<int:pk>/", UserDetailView.as_view(), name="user_detail"),
    path("courses/", CourseListCreateView.as_view(), name="courses"),
    path("courses/<int:pk>/", CourseDetailView.as_view(), name="course-detail"),
    path("batches/", BatchListCreateView.as_view(), name="batches"),
    path("batches/<int:pk>/", BatchDetailView.as_view(), name="batch-detail"),
    path("subjects/", SubjectListCreateView.as_view(), name="subjects"),
    path("subjects/<int:pk>/", SubjectDetailView.as_view(), name="subject-detail"),
    path("universities/", UniversityListCreateView.as_view(), name="universities"),
    path(
        "universities/<int:pk>/",
        UniversityDetailView.as_view(),
        name="university-detail",
    ),
    path(
        "attendance/window/", AttendanceWindowView.as_view(), name="attendance-window"
    ),
    path(
        "attendance/record/", AttendanceRecordView.as_view(), name="attendance-record"
    ),
    path(
        "attendance/analytics/", AttendanceAnalyticsView.as_view(), name="attendance-analytics"
    ),
    path(
        "attendance/monthly-percentage/", AttendanceMonthlyPercentageView.as_view(), name="attendance-monthly-percentage"
    ),
    path(
        "attendance/student-calendar/", StudentCalendarView.as_view(), name="student-calendar"
    ),
    #
    #
    # ---- CURRENT_USER ENDPOINTS :
    #
    #
    path("me/", CurrentUserView.as_view(), name="current_user"),
    path("me/location/", UserLocationView.as_view(), name="me_location"),
    #
    #
    # ---- Announcements ENDPOINTS :
    #
    #
    path("announcements/", AnnouncementListCreateView.as_view(), name="announcements-list-create"),
    path("announcements/<int:pk>/", AnnouncementDetailView.as_view(), name="announcement-detail"),
    path("announcements/search/", AnnouncementSearchView.as_view(), name="announcements-search"),
    path("announcements/batch/<int:batch_id>/", AnnouncementByBatchView.as_view(), name="announcements-by-batch"),
    path("announcements/university/<int:university_id>/", AnnouncementByUniversityView.as_view(), name="announcements-by-university"),
    path("announcements/upload-media/", AnnouncementMediaUploadView.as_view(), name="announcement-media-upload"),
]

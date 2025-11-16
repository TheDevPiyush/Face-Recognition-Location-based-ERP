from django.urls import path
from .views.user import *
from rest_framework_simplejwt.views import TokenRefreshView
from .views.university import UniversityListCreateView, UniversityDetailView
from .views.course import CourseListCreateView, CourseDetailView
from .views.batch import BatchListCreateView, BatchDetailView
from .views.subject import SubjectListCreateView, SubjectDetailView
from .views.attendance import AttendanceWindowView, AttendanceRecordView

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
    #
    #
    # ---- CURRENT_USER ENDPOINTS :
    #
    #
    path("me/", CurrentUserView.as_view(), name="current_user"),
    path("me/location/", UserLocationView.as_view(), name="me_location"),
]

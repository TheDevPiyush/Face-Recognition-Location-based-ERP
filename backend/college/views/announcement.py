"""Views for Announcement API endpoints."""

from django.utils import timezone
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from college.utils.check_roles import check_allow_roles
from ..models import Announcement, Batch, University, User
from ..serializers import AnnouncementSerializer, AnnouncementCreateUpdateSerializer


class AnnouncementListCreateView(APIView):
    """List all announcements or create a new one."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get all announcements for the current user.
        - Admins see all announcements
        - Students/Teachers see announcements for their batch/university
        """
        # Only admins can view all announcements
        if request.user.role == User.Role.ADMIN:
            announcements = Announcement.objects.filter(is_published=True)
        else:
            # Students and teachers see announcements for their batch
            if request.user.batch:
                announcements = Announcement.objects.filter(
                    Q(target_batch=request.user.batch) | Q(target_batch__isnull=True),
                    is_published=True,
                )
            else:
                # If no batch assigned, show university-wide announcements
                if request.user.batch and request.user.batch.course:
                    university = request.user.batch.course.university
                    announcements = Announcement.objects.filter(
                        Q(target_university=university) | Q(target_batch__isnull=True),
                        is_published=True,
                    )
                else:
                    announcements = Announcement.objects.filter(is_published=True)

        serializer = AnnouncementSerializer(announcements, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        """Create a new announcement (Admin only)."""
        if allowed := check_allow_roles(request.user, [User.Role.ADMIN]):
            return allowed

        serializer = AnnouncementCreateUpdateSerializer(data=request.data)
        if serializer.is_valid():
            announcement = serializer.save(created_by=request.user)
            response_serializer = AnnouncementSerializer(announcement)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AnnouncementDetailView(APIView):
    """Retrieve, update, or delete a specific announcement."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Get a specific announcement."""
        announcement = get_object_or_404(Announcement, pk=pk)

        # Check if user has permission to view this announcement
        if announcement.target_batch:
            if request.user.batch != announcement.target_batch and request.user.role != User.Role.ADMIN:
                return Response(
                    {"detail": "Permission denied."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif announcement.target_university:
            if (
                not request.user.batch
                or request.user.batch.course.university != announcement.target_university
            ) and request.user.role != User.Role.ADMIN:
                return Response(
                    {"detail": "Permission denied."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        serializer = AnnouncementSerializer(announcement)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        """Update an announcement (Admin only, or creator)."""
        announcement = get_object_or_404(Announcement, pk=pk)

        # Check permissions
        if request.user.role != User.Role.ADMIN and request.user != announcement.created_by:
            return Response(
                {"detail": "Permission denied."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AnnouncementCreateUpdateSerializer(
            announcement, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            response_serializer = AnnouncementSerializer(announcement)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        """Delete an announcement (Admin only)."""
        if allowed := check_allow_roles(request.user, [User.Role.ADMIN]):
            return allowed

        announcement = get_object_or_404(Announcement, pk=pk)
        announcement.delete()
        return Response(
            {"detail": "Announcement deleted successfully."},
            status=status.HTTP_200_OK,
        )


class AnnouncementSearchView(APIView):
    """Search announcements by title or description."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Search announcements."""
        query = request.query_params.get("q", "")

        if not query:
            return Response(
                {"detail": "Search query is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Only admins can search all announcements
        if request.user.role == User.Role.ADMIN:
            announcements = Announcement.objects.filter(
                Q(title__icontains=query) | Q(description__icontains=query),
                is_published=True,
            )
        else:
            # Students/Teachers search within their batch announcements
            if request.user.batch:
                announcements = Announcement.objects.filter(
                    Q(target_batch=request.user.batch) | Q(target_batch__isnull=True),
                    Q(title__icontains=query) | Q(description__icontains=query),
                    is_published=True,
                )
            else:
                announcements = Announcement.objects.filter(
                    Q(title__icontains=query) | Q(description__icontains=query),
                    is_published=True,
                )

        serializer = AnnouncementSerializer(announcements, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AnnouncementByBatchView(APIView):
    """Get announcements for a specific batch."""

    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        """Get announcements for a specific batch."""
        # Only admins can view announcements for any batch
        if allowed := check_allow_roles(request.user, [User.Role.ADMIN]):
            return allowed

        batch = get_object_or_404(Batch, pk=batch_id)
        announcements = Announcement.objects.filter(target_batch=batch, is_published=True)

        serializer = AnnouncementSerializer(announcements, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AnnouncementByUniversityView(APIView):
    """Get announcements for a specific university."""

    permission_classes = [IsAuthenticated]

    def get(self, request, university_id):
        """Get announcements for a specific university."""
        # Only admins can view announcements for any university
        if allowed := check_allow_roles(request.user, [User.Role.ADMIN]):
            return allowed

        university = get_object_or_404(University, pk=university_id)
        announcements = Announcement.objects.filter(
            target_university=university, is_published=True
        )

        serializer = AnnouncementSerializer(announcements, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

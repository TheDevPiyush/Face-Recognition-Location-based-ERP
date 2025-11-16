import os
import uuid

from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from college.utils.check_roles import check_allow_roles
from services import upload_to_supabase
from services.face_recognition import has_face
from ..serializers import *
from ..models import *
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated

from supabase import create_client
from services.upload_to_supabase import upload_to_supabase


class UserView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get all users"""
        if allowed := check_allow_roles(request.user, [User.Role.ADMIN]):
            return allowed
        users = User.objects.all()
        serializer = UserStudentSerializer(users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        """Create a new user"""
        if allowed := check_allow_roles(request.user, [User.Role.ADMIN]):
            return allowed

        is_many = isinstance(request.data, list)

        serializer = UserAdminSerializer(data=request.data, many=is_many)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        """Update a user"""
        if allowed := check_allow_roles(request.user, [User.Role.ADMIN]):
            return allowed

        user = get_object_or_404(User, pk=pk)
        serializer = UserAdminSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(last_interacted_by=request.user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserStudentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id):
        """Get all students"""
        get_object_or_404(Batch, id=batch_id)
        students = User.objects.filter(role=User.Role.STUDENT, batch=batch_id)
        serializer = UserStudentSerializer(students, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserLoginView(APIView):

    def post(self, request):
        """Login a user"""
        email = request.data.get("email")
        password = request.data.get("password")

        user = authenticate(request, email=email, password=password)

        if user is None:
            return Response(
                {"error": "Invalid Credentials"}, status=status.HTTP_400_BAD_REQUEST
            )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "user": {
                    "id": user.id,
                    "name": user.name,
                    "email": user.email,
                    "is_staff": user.is_staff,
                },
            }
        )


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    # -----------------------------
    # GET: Fetch current user
    # -----------------------------
    def get(self, request):
        user = request.user

        # Use role-based serializers if needed
        if user.role == User.Role.STUDENT:
            serializer = UserStudentSerializer(user)
        else:
            serializer = UserStudentSerializer(user)

        return Response(serializer.data, status=status.HTTP_200_OK)

    # -----------------------------
    # PATCH: Update current user
    # -----------------------------

    def patch(self, request):
        user = request.user
        data = request.data.copy()

        if not user.can_update_picture:
            return Response(
                {"error": "You Require Admin Approval To Update Image"},
                status=status.HTTP_403_FORBIDDEN,
            )

        image_file = request.FILES.get("profile_picture")

        if image_file:

            has_face_flag, encoding = has_face(image_file)

            if not has_face_flag:
                return Response(
                    {"error": "No human face detected in the image."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                user.face_embedding = encoding
                user.save(update_fields=["face_embedding"])
                uploaded_url = upload_to_supabase(image_file=image_file)
            except Exception as e:
                print("Upload Error:", e)
                return Response(
                    {"error": "Image upload failed", "details": str(e)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            data["profile_picture"] = uploaded_url

        # Continue normal update
        serializer = UserStudentSerializer(user, data=data, partial=True)
        if serializer.is_valid():
            serializer.save(last_interacted_by=request.user)
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """
        Get user by ID.
        Only admins should access this (recommended).
        """
        if allowed := check_allow_roles(request.user, [User.Role.ADMIN]):
            return allowed

        user = get_object_or_404(User, pk=pk)

        if user.role == User.Role.STUDENT:
            serializer = UserStudentSerializer(user)
        else:
            serializer = UserStudentSerializer(user)

        return Response(serializer.data, status=status.HTTP_200_OK)


class UserLocationView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        """Update current user's latitude and longitude."""
        latitude = request.data.get("latitude")
        longitude = request.data.get("longitude")

        if latitude is None or longitude is None:
            return Response(
                {"message": "'latitude' and 'longitude' are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lat = float(latitude)
            lon = float(longitude)
        except (TypeError, ValueError):
            return Response(
                {"message": "Invalid latitude/longitude"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        user.latitude = lat
        user.longitude = lon
        user.save(update_fields=["latitude", "longitude"])

        serializer = UserStudentSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)

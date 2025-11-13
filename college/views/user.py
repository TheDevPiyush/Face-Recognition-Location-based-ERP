import os
import uuid

from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from college.utils.check_roles import check_allow_roles
from ..serializers import *
from ..models import *
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated

from supabase import create_client


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

    def get(self, request):
        """Get all students"""
        students = User.objects.filter(role=User.Role.STUDENT)
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
    # Helper: Upload to Supabase
    # -----------------------------

    def upload_to_supabase(self, file):
        supabase_url = str(os.getenv("SUPABASE_URL"))
        supabase_key = str(os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
        bucket = "profile-pictures"

        supabase = create_client(supabase_url, supabase_key)

        ext = file.name.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{ext}"

        # Upload file
        try:
            supabase.storage.from_(bucket).upload(
                file_name, file.read(), file_options={"content-type": file.content_type}
            )
            public_url = supabase.storage.from_(bucket).get_public_url(file_name)
            return public_url
        except:
            return Response({"error":"Image Upload Failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

        # 1. Handle image upload if present
        image_file = request.FILES.get("profile_picture")
        if image_file:
            try:
                uploaded_url = self.upload_to_supabase(image_file)
                print(uploaded_url)
                data["profile_picture"] = uploaded_url
            except Exception as e:
                return Response(
                    {"error": "Image upload failed", "details": str(e)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        # 2. Continue normal update using serializer
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

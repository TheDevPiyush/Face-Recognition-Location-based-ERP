from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from ..models import University
from ..serializers import UniversitySerializer


class UniversityListCreateView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):
        universities = University.objects.all()
        serializer = UniversitySerializer(universities, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = UniversitySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UniversityDetailView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        university = get_object_or_404(University, pk=pk)
        serializer = UniversitySerializer(university)
        return Response(serializer.data, status=status.HTTP_200_OK)



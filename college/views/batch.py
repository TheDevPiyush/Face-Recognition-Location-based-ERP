from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from ..models import Batch
from ..serializers import BatchSerializer


class BatchListCreateView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):
        batches = Batch.objects.all()
        serializer = BatchSerializer(batches, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = BatchSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BatchDetailView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        batch = get_object_or_404(Batch, pk=pk)
        serializer = BatchSerializer(batch)
        return Response(serializer.data, status=status.HTTP_200_OK)



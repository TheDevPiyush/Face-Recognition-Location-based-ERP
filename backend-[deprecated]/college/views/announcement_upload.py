"""Views for uploading announcement media (audio, video) to Supabase storage."""

import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from college.utils.check_roles import check_allow_roles
from ..models import User
from services.upload_to_supabase import upload_announcement_media

logger = logging.getLogger(__name__)

# Allowed MIME types for announcement media (broad to support various clients)
ALLOWED_AUDIO = {"audio/mpeg", "audio/mp3", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/wav", "audio/webm"}
ALLOWED_VIDEO = {"video/mp4", "video/quicktime", "video/x-quicktime", "video/webm"}
# Allow octet-stream when filename has known extension (mobile often sends this)
ALLOWED_EXTENSIONS = {".mp3", ".m4a", ".aac", ".wav", ".mp4", ".mov", ".webm"}


class AnnouncementMediaUploadView(APIView):
    """Upload audio or video file for announcements. Admin only. Stores in Supabase."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if allowed := check_allow_roles(request.user, [User.Role.ADMIN]):
            return allowed

        # Accept "file" or "audio" or "video" for compatibility
        file = request.FILES.get("file") or request.FILES.get("audio") or request.FILES.get("video")
        if not file:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        content_type = (getattr(file, "content_type", "") or "").split(";")[0].strip().lower()
        file_name = getattr(file, "name", "") or ""

        def _is_allowed():
            if content_type in ALLOWED_AUDIO or content_type in ALLOWED_VIDEO:
                return True
            if content_type in ("application/octet-stream", "") and file_name:
                ext = "." + file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
                return ext in ALLOWED_EXTENSIONS
            return False

        if not _is_allowed():
            return Response(
                {"error": "Only audio (mp3, m4a, aac, wav) or video (mp4, mov, webm) files are allowed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            url = upload_announcement_media(file)
            return Response({"url": url}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("Announcement media upload failed: %s", e)
            err_msg = str(e)
            if "Bucket not found" in err_msg or "not found" in err_msg.lower():
                err_msg = "Storage bucket 'announcements' does not exist. Create it in Supabase Storage."
            return Response(
                {"error": f"Upload failed: {err_msg}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

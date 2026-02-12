import os
import uuid
from supabase import create_client

_PROFILE_BUCKET = "profile-pictures"
_ANNOUNCEMENT_BUCKET = "announcements"


def _get_supabase():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        raise Exception("Supabase credentials not configured")
    return create_client(supabase_url, supabase_key)


def upload_to_supabase(image_file, bucket: str | None = None):
    """Upload profile picture to Supabase. Expects file-like object with .read(), .name, .content_type."""
    bucket = bucket or _PROFILE_BUCKET
    supabase = _get_supabase()

    ext = (image_file.name or "").split(".")[-1] if hasattr(image_file, "name") else "jpg"
    file_name = f"{uuid.uuid4()}.{ext}"

    file_bytes = image_file.read()
    if not file_bytes:
        raise Exception("Empty file")

    content_type = getattr(image_file, "content_type", None) or "image/jpeg"

    try:
        supabase.storage.from_(bucket).upload(
            file_name,
            file_bytes,
            file_options={"content-type": content_type},
        )
        return supabase.storage.from_(bucket).get_public_url(file_name)
    except Exception as e:
        print("Upload Error:", e)
        raise e


def _ensure_announcements_bucket(supabase):
    """Try to create announcements bucket if it doesn't exist. Ignore errors (e.g. already exists)."""
    try:
        supabase.storage.create_bucket(_ANNOUNCEMENT_BUCKET, {"public": True})
    except Exception:
        pass  # Bucket likely already exists


def upload_announcement_media(file_obj, filename: str | None = None):
    """Upload announcement audio/video to Supabase storage. Returns public URL."""
    supabase = _get_supabase()

    file_bytes = file_obj.read()
    if not file_bytes:
        raise Exception("Empty file")

    raw_name = file_obj.name or filename or ""
    ext = raw_name.split(".")[-1].lower() if "." in raw_name else ""
    if not ext or len(ext) > 5:
        ext = "bin"
    file_name = f"announcements/{uuid.uuid4()}.{ext}"

    content_type = (getattr(file_obj, "content_type", None) or "").split(";")[0].strip()
    if not content_type:
        if ext in ("mp3", "m4a", "aac", "wav"):
            content_type = "audio/mpeg" if ext == "mp3" else f"audio/{ext}"
        elif ext in ("mp4", "mov", "webm"):
            content_type = "video/mp4" if ext == "mp4" else f"video/{ext}"
        else:
            content_type = "application/octet-stream"

    _ensure_announcements_bucket(supabase)

    try:
        supabase.storage.from_(_ANNOUNCEMENT_BUCKET).upload(
            file_name,
            file_bytes,
            file_options={"content-type": content_type},
        )
        return supabase.storage.from_(_ANNOUNCEMENT_BUCKET).get_public_url(file_name)
    except Exception as e:
        print("Announcement media upload error:", e)
        raise e

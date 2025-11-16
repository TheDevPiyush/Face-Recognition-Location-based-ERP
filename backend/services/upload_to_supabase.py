import os
import uuid
from supabase import create_client

def upload_to_supabase(image_file):
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    bucket = "profile-pictures"

    if not supabase_url or not supabase_key:
        raise Exception("Supabase credentials not configured")

    supabase = create_client(supabase_url, supabase_key)

    ext = image_file.name.split(".")[-1]
    file_name = f"{uuid.uuid4()}.{ext}"

    file_bytes = image_file.read()
    if not file_bytes:
        raise Exception("Empty file")

    image_file.seek(0)

    try:
        res = supabase.storage.from_(bucket).upload(
            file_name,
            file_bytes,
            file_options={"content-type": image_file.content_type},
        )

        # SDK error handler
        if hasattr(res, "error") and res.error:
            raise Exception(res.error)

        # public URL
        public_url = supabase.storage.from_(bucket).get_public_url(file_name)
        return public_url

    except Exception as e:
        print("Upload Error:", e)
        raise e

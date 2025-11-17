import io
from functools import lru_cache

import numpy as np
from PIL import Image
from deepface import DeepFace  # type: ignore[import]


@lru_cache(maxsize=1)
def _get_model_kwargs():
    """Cache DeepFace kwargs so the model loads only once."""
    return {
        "model_name": "Facenet512",
        "detector_backend": "retinaface",
        "enforce_detection": True,
    }


def _load_image_np(image_file):
    file_bytes = image_file.read()
    if not file_bytes:
        return None

    pil_img = Image.open(io.BytesIO(file_bytes))
    if pil_img.mode not in ["RGB", "L"]:
        pil_img = pil_img.convert("RGB")
    else:
        pil_img = pil_img.convert("RGB")

    return np.array(pil_img)


def has_face(image_file):
    """
    Returns:
        (has_face: bool, encoding: np.ndarray or None)
    """
    image_rgb = _load_image_np(image_file)
    if image_rgb is None:
        image_file.seek(0)
        return False, None

    # DeepFace expects BGR numpy array
    image_bgr = image_rgb[:, :, ::-1].copy()

    try:
        representations = DeepFace.represent(img_path=image_bgr, **_get_model_kwargs())
    except Exception:
        image_file.seek(0)
        return False, None

    if not representations:
        image_file.seek(0)
        return False, None

    rep = representations[0] if isinstance(representations, list) else representations
    embedding = rep.get("embedding") if isinstance(rep, dict) else rep

    if embedding is None:
        image_file.seek(0)
        return False, None

    embedding_array = np.asarray(embedding, dtype=np.float32)

    # Downsample to 128 dims to match existing DB column size.
    if embedding_array.size > 128:
        embedding_array = embedding_array[:128]

    norm = float(np.linalg.norm(embedding_array))
    if norm == 0.0:
        image_file.seek(0)
        return False, None

    embedding_array = embedding_array / norm

    image_file.seek(0)
    return True, embedding_array

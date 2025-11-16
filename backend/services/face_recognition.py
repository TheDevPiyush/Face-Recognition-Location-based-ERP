import io
from PIL import Image
import face_recognition
import numpy as np


def has_face(image_file):
    """
    Returns:
        (has_face: bool, encoding: np.ndarray or None)
    """
    file_bytes = image_file.read()
    if not file_bytes:
        return False, None

    pil_img = Image.open(io.BytesIO(file_bytes))
    if pil_img.mode not in ["RGB", "L"]:
        pil_img = pil_img.convert("RGB")

    image = np.array(pil_img)

    faces = face_recognition.face_locations(image)
    if len(faces) == 0:
        image_file.seek(0)
        return False, None

    encodings = face_recognition.face_encodings(image, known_face_locations=faces)
    if len(encodings) == 0:
        image_file.seek(0)
        return False, None

    image_file.seek(0)

    return True, encodings[0]

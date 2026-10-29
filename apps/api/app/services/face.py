"""Face embeddings behind one interface.

- InsightFaceEngine: ArcFace (buffalo_l) via the optional `insightface` package. Production engine.
  Licence note: InsightFace's pretrained models are for non-commercial research; get a commercial licence
  or substitute a permissively licensed model before a real deployment.
- DevEmbeddingEngine: NOT face recognition. A deterministic pixel embedding so the flow can be developed and
  tested without the model. Refused outside dev/test.
"""

import base64
import binascii
import io
from functools import lru_cache
from typing import Protocol

import numpy as np
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

from app.core.config import get_settings


class FaceEngine(Protocol):
    name: str

    def embed(self, image: Image.Image) -> np.ndarray: ...


def decode_image(b64: str) -> Image.Image:
    s = get_settings()
    try:
        raw = base64.b64decode(b64.split(",", 1)[-1], validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(422, "Image is not valid base64") from None
    if len(raw) > s.max_face_image_bytes:
        raise HTTPException(413, "Image too large; send a cropped face only")
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(422, "Not an image") from None
    if img.format not in ("JPEG", "PNG", "WEBP"):
        raise HTTPException(422, "Use JPEG, PNG or WebP")
    if max(img.size) > s.max_face_image_px:
        raise HTTPException(413, "Image too large; send a cropped face only")
    return img.convert("RGB")


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


class DevEmbeddingEngine:
    name = "dev-pixels"

    def embed(self, image: Image.Image) -> np.ndarray:
        v = np.asarray(image.convert("L").resize((16, 16)), dtype=np.float32).ravel()
        v = v - v.mean()
        return v / (np.linalg.norm(v) + 1e-9)


class InsightFaceEngine:
    name = "arcface-buffalo_l"

    def __init__(self) -> None:
        from insightface.app import FaceAnalysis  # optional dependency group "identity"

        self._app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        self._app.prepare(ctx_id=-1, det_size=(320, 320))

    def embed(self, image: Image.Image) -> np.ndarray:
        faces = self._app.get(np.asarray(image)[:, :, ::-1])  # RGB -> BGR
        if len(faces) != 1:
            raise HTTPException(422, "Exactly one face must be visible")
        return faces[0].normed_embedding.astype(np.float32)


@lru_cache
def get_engine() -> FaceEngine:
    s = get_settings()
    if s.identity_engine == "insightface":
        return InsightFaceEngine()
    if s.environment not in ("dev", "test"):
        raise RuntimeError("DevEmbeddingEngine is not face recognition; set IDENTITY_ENGINE=insightface")
    return DevEmbeddingEngine()

"""Encrypted blob storage for face embeddings, identity crops and evidence snapshots (encrypted at rest).

Refs look like "<kind>/<uuid>". Plain files under STORAGE_DIR; swap for an object store in production.
Never log blob contents.
"""

import uuid
from functools import lru_cache
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


class StorageError(RuntimeError):
    pass


@lru_cache
def _fernet() -> Fernet:
    key = get_settings().evidence_encryption_key
    if not key:
        raise StorageError("EVIDENCE_ENCRYPTION_KEY is not set")
    return Fernet(key.encode())


def _path(ref: str) -> Path:
    kind, _, name = ref.partition("/")
    if not kind.isidentifier() or not name or "/" in name or ".." in name:
        raise StorageError("Bad storage ref")
    return Path(get_settings().storage_dir) / kind / f"{name}.bin"


def put(kind: str, data: bytes) -> str:
    ref = f"{kind}/{uuid.uuid4().hex}"
    path = _path(ref)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(_fernet().encrypt(data))
    return ref


def get(ref: str) -> bytes:
    try:
        return _fernet().decrypt(_path(ref).read_bytes())
    except (FileNotFoundError, InvalidToken) as exc:
        raise StorageError("Blob missing or unreadable") from exc


def delete(ref: str) -> bool:
    try:
        _path(ref).unlink()
        return True
    except FileNotFoundError:
        return False

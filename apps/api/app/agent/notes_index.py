"""Notes retrieval. Approval is enforced by SQL here; the vector index only ranks already-approved notes.

ChromaDB + bge-small (optional extra "rag") is used when CHROMA_URL is reachable; otherwise a local keyword
ranker keeps dev/test working without the service.
"""

import logging
import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.evaluation import Note, NoteLevel

log = logging.getLogger(__name__)
COLLECTION = "notes"
_WORD = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> set[str]:
    return set(_WORD.findall(text.lower()))


def approved_notes(db: Session, topic_id: uuid.UUID, level: NoteLevel | None = None) -> list[Note]:
    q = select(Note).where(Note.topic_id == topic_id, Note.approved.is_(True))
    if level:
        q = q.where(Note.level == level)
    return list(db.scalars(q.order_by(Note.title)))


def _chroma_collection():
    s = get_settings()
    if not s.chroma_url or s.environment == "test":
        return None
    try:
        import chromadb
        from chromadb.utils import embedding_functions

        host, _, port = s.chroma_url.removeprefix("http://").removeprefix("https://").partition(":")
        client = chromadb.HttpClient(host=host, port=int(port or 8000))
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="BAAI/bge-small-en-v1.5")
        return client.get_or_create_collection(COLLECTION, embedding_function=ef)
    except Exception:
        return None


def index_note(note: Note) -> None:
    """Upsert an approved note into Chroma; remove it when unapproved. Best effort."""
    col = _chroma_collection()
    if col is None:
        return
    try:
        if note.approved:
            col.upsert(
                ids=[str(note.id)],
                documents=[f"{note.title}\n{note.url_or_body}"],
                metadatas=[{"topic_id": str(note.topic_id), "level": note.level.value}],
            )
        else:
            col.delete(ids=[str(note.id)])
    except Exception:
        log.warning("Chroma indexing failed for note %s", note.id)


def find_notes(
    db: Session, topic_id: uuid.UUID, query: str = "", level: NoteLevel | None = None, k: int = 5
) -> list[Note]:
    candidates = approved_notes(db, topic_id, level)
    if not candidates or not query:
        return candidates[:k]
    col = _chroma_collection()
    if col is not None:
        try:
            res = col.query(
                query_texts=[query], n_results=min(k * 2, len(candidates)), where={"topic_id": str(topic_id)}
            )
            order = {nid: i for i, nid in enumerate(res["ids"][0])}
            ranked = sorted(candidates, key=lambda n: order.get(str(n.id), len(order)))
            return ranked[:k]
        except Exception:
            log.warning("Chroma query failed; using keyword ranking")
    q = _tokens(query)
    return sorted(candidates, key=lambda n: -len(q & _tokens(f"{n.title} {n.url_or_body}")))[:k]

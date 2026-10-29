"""Admin notes library: upload and approve. Only approved notes can be recommended."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.notes_index import index_note
from app.core import audit
from app.core.db import get_db
from app.core.deps import admin_only
from app.models import Topic, User
from app.models.evaluation import Note, NoteLevel
from app.schemas.exams import TopicOut
from app.schemas.users import ORM

router = APIRouter(prefix="/admin", tags=["notes library"], dependencies=[Depends(admin_only)])


class NoteIn(BaseModel):
    topic_id: uuid.UUID
    title: str = Field(min_length=2, max_length=200)
    url_or_body: str = Field(min_length=2, max_length=20_000)
    level: NoteLevel = NoteLevel.core
    approved: bool = False


class NotePatch(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    url_or_body: str | None = Field(default=None, max_length=20_000)
    level: NoteLevel | None = None
    approved: bool | None = None


class NoteOut(ORM):
    id: uuid.UUID
    topic_id: uuid.UUID
    title: str
    url_or_body: str
    level: NoteLevel
    approved: bool


@router.get("/courses/{course_id}/topics", response_model=list[TopicOut])
def course_topics(course_id: uuid.UUID, db: Session = Depends(get_db)):
    return list(db.scalars(select(Topic).where(Topic.course_id == course_id).order_by(Topic.name)))


@router.get("/notes", response_model=list[NoteOut])
def list_notes(course_id: uuid.UUID, db: Session = Depends(get_db)):
    return list(
        db.scalars(
            select(Note)
            .join(Topic, Topic.id == Note.topic_id)
            .where(Topic.course_id == course_id)
            .order_by(Note.title)
        )
    )


@router.post("/notes", response_model=NoteOut, status_code=201)
def create_note(body: NoteIn, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    if db.get(Topic, body.topic_id) is None:
        raise HTTPException(404, "Topic not found")
    note = Note(**body.model_dump(), created_by=admin.id)
    db.add(note)
    db.flush()
    if body.approved:
        audit.record(db, "note.approve", "notes", note.id)
    db.commit()
    index_note(note)
    return note


@router.patch("/notes/{note_id}", response_model=NoteOut)
def patch_note(note_id: uuid.UUID, body: NotePatch, db: Session = Depends(get_db)):
    note = db.get(Note, note_id)
    if note is None:
        raise HTTPException(404, "Note not found")
    data = body.model_dump(exclude_none=True)
    for k, v in data.items():
        setattr(note, k, v)
    if "approved" in data:
        audit.record(db, "note.approve" if data["approved"] else "note.unapprove", "notes", note.id)
    db.commit()
    index_note(note)
    return note

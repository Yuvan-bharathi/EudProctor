"""Candidate-facing session schemas. These deliberately contain no correct answers, glances, events,
snapshots or integrity data (CLAUDE.md rule 3)."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.session import SessionStatus


class CandidateOption(BaseModel):
    key: str
    text: str


class CandidateQuestion(BaseModel):
    id: uuid.UUID
    number: int
    type: str
    body: str
    marks: float
    options: list[CandidateOption]


class SavedAnswer(BaseModel):
    value: dict[str, Any]
    client_seq: int


class SessionOut(BaseModel):
    id: uuid.UUID
    exam_id: uuid.UUID
    exam_title: str
    duration_min: int
    status: SessionStatus
    started_at: datetime | None
    deadline_at: datetime | None
    submitted_at: datetime | None
    server_now: datetime
    max_flags: int
    flag_count: int
    questions: list[CandidateQuestion]
    answers: dict[str, SavedAnswer]
    next_identity_check_in_s: int | None = None


class AnswerIn(BaseModel):
    question_id: uuid.UUID
    value: dict[str, Any]
    client_seq: int = Field(ge=1)
    answered_at: datetime | None = None


class AnswersIn(BaseModel):
    answers: list[AnswerIn] = Field(max_length=500)


class AnswerAck(BaseModel):
    question_id: uuid.UUID
    client_seq: int  # highest seq the server holds for this question
    accepted: bool


class AnswersOut(BaseModel):
    acks: list[AnswerAck]
    status: SessionStatus
    deadline_at: datetime | None
    server_now: datetime


class MyAssessment(BaseModel):
    exam_id: uuid.UUID
    title: str
    duration_min: int
    window_start: datetime
    window_end: datetime
    session_id: uuid.UUID | None
    session_status: SessionStatus | None

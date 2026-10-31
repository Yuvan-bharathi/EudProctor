import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.models import ExamStatus, QuestionSource, QuestionStatus, QuestionType
from app.schemas.users import ORM


class TopicIn(BaseModel):
    course_id: uuid.UUID
    name: str = Field(min_length=1, max_length=160)
    parent_id: uuid.UUID | None = None


class TopicOut(ORM):
    id: uuid.UUID
    course_id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None


class MisconceptionIn(BaseModel):
    description: str = Field(min_length=3, max_length=300)


class MisconceptionOut(ORM):
    id: uuid.UUID
    topic_id: uuid.UUID
    description: str


class OptionIn(BaseModel):
    key: str = Field(min_length=1, max_length=4)
    text: str = Field(min_length=1)
    is_correct: bool = False
    misconception_id: uuid.UUID | None = None


class OptionOut(ORM):
    id: uuid.UUID
    key: str
    text: str
    is_correct: bool
    misconception_id: uuid.UUID | None


class QuestionIn(BaseModel):
    topic_id: uuid.UUID
    subtopic: str | None = Field(default=None, max_length=160)
    type: QuestionType = QuestionType.mcq
    difficulty: int = Field(default=2, ge=1, le=3)
    marks: float = Field(default=1.0, gt=0, le=100)
    body: str = Field(min_length=3)
    answer_text: str | None = None
    options: list[OptionIn] = []

    @model_validator(mode="after")
    def _check_options(self):
        if self.type == QuestionType.mcq:
            if not 2 <= len(self.options) <= 6:
                raise ValueError("A multiple-choice question needs 2 to 6 options")
            if sum(o.is_correct for o in self.options) != 1:
                raise ValueError("Exactly one option must be correct")
            keys = [o.key.upper() for o in self.options]
            if len(set(keys)) != len(keys):
                raise ValueError("Option keys must be unique")
        elif self.options:
            raise ValueError("Short-answer questions have no options")
        return self


class QuestionOut(ORM):
    id: uuid.UUID
    course_id: uuid.UUID
    topic_id: uuid.UUID
    subtopic: str | None
    type: QuestionType
    difficulty: int
    marks: float
    body: str
    answer_text: str | None
    status: QuestionStatus
    source: QuestionSource
    agent_run_id: uuid.UUID | None
    options: list[OptionOut]


class SuggestIn(BaseModel):
    course_id: uuid.UUID
    topic_id: uuid.UUID | None = None
    n: int = Field(default=3, ge=1)
    guidance: str | None = Field(default=None, max_length=500)


class SuggestOut(BaseModel):
    run_id: uuid.UUID
    status: str
    error: str | None
    drafts: list[QuestionOut]


class ExamIn(BaseModel):
    course_id: uuid.UUID
    title: str = Field(min_length=1, max_length=200)
    duration_min: int = Field(ge=1, le=600)
    window_start: datetime
    window_end: datetime
    shuffle: bool = False
    flag_threshold_s: float | None = None

    @model_validator(mode="after")
    def _window(self):
        if self.window_end <= self.window_start:
            raise ValueError("window_end must be after window_start")
        return self


class ExamPatch(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    duration_min: int | None = Field(default=None, ge=1, le=600)
    window_start: datetime | None = None
    window_end: datetime | None = None
    shuffle: bool | None = None
    flag_threshold_s: float | None = None


class ExamOut(ORM):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    duration_min: int
    window_start: datetime
    window_end: datetime
    shuffle: bool
    flag_threshold_s: float
    glance_min_s: float
    max_flags: int
    status: ExamStatus
    course_name: str | None = None
    created_by: str | None = None
    question_count: int = 0
    candidates_count: int = 0
    created_at: datetime | None = None


class ExamQuestionsIn(BaseModel):
    question_ids: list[uuid.UUID]


class AssignmentsIn(BaseModel):
    candidate_ids: list[uuid.UUID]
    accommodations: dict[str, Any] = {}


class AssignmentOut(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    candidate_name: str
    candidate_email: str
    link_sent_at: datetime | None
    link_used_at: datetime | None
    link_expires_at: datetime | None
    candidate_phone: str | None = None
    accommodations: dict[str, Any]
    status: str = 'Not started'


class ExamDetailOut(ExamOut):
    questions: list[QuestionOut]
    assignments: list[AssignmentOut]


class SendLinksIn(BaseModel):
    candidate_ids: list[uuid.UUID] | None = None


class JoinOut(BaseModel):
    assignment_id: uuid.UUID
    exam_id: uuid.UUID
    exam_title: str
    duration_min: int
    session_id: uuid.UUID | None = None


class ImportedOptionIn(BaseModel):
    key: str
    text: str
    is_correct: bool = False


class ImportedQuestionIn(BaseModel):
    body: str
    options: list[ImportedOptionIn]
    difficulty: int = 2
    marks: float = 1.0
    subtopic: str | None = None
    explanation: str | None = None


class ImportQuestionsIn(BaseModel):
    questions: list[ImportedQuestionIn]


class ImportedCandidateIn(BaseModel):
    name: str
    email: str
    phone: str | None = None
    rollNumber: str | None = None
    batch: str | None = None
    department: str | None = None


class ImportCandidatesIn(BaseModel):
    candidates: list[ImportedCandidateIn]

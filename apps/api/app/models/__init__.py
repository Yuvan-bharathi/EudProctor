"""Import every model here so Alembic and the audit hook see the full metadata."""

from app.models.agent import AgentRun, AgentStep
from app.models.audit import AuditLog
from app.models.base import Base
from app.models.evaluation import (
    EvaluationSummary,
    Note,
    NoteLevel,
    PracticeAttempt,
    PracticeSet,
    SummaryStatus,
)
from app.models.exam import (
    Exam,
    ExamAssignment,
    ExamQuestion,
    ExamStatus,
    Misconception,
    Question,
    QuestionOption,
    QuestionSource,
    QuestionStatus,
    QuestionType,
    Topic,
)
from app.models.identity import CheckKind, CheckResult, FaceProfile, IdentityCheck, ReviewDecision
from app.models.proctoring import CandidateFlag, FlagReview, GlanceLog, ProctorEvent
from app.models.results import ItemStat, Result, SessionMisconception, TopicResult
from app.models.session import Answer, ExamSession, SessionStatus, SubmitReason
from app.models.user import Course, CourseMember, MemberRole, Role, User

__all__ = [
    "EvaluationSummary",
    "Note",
    "NoteLevel",
    "PracticeAttempt",
    "PracticeSet",
    "SummaryStatus",
    "ItemStat",
    "Result",
    "SessionMisconception",
    "TopicResult",
    "CandidateFlag",
    "FlagReview",
    "GlanceLog",
    "ProctorEvent",
    "CheckKind",
    "CheckResult",
    "FaceProfile",
    "IdentityCheck",
    "ReviewDecision",
    "Answer",
    "ExamSession",
    "SessionStatus",
    "SubmitReason",
    "AgentRun",
    "AgentStep",
    "AuditLog",
    "Base",
    "Course",
    "CourseMember",
    "Exam",
    "ExamAssignment",
    "ExamQuestion",
    "ExamStatus",
    "MemberRole",
    "Misconception",
    "Question",
    "QuestionOption",
    "QuestionSource",
    "QuestionStatus",
    "QuestionType",
    "Role",
    "Topic",
    "User",
]

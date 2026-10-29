"""Glance / red-flag classification (PRD section 4). Pure and deterministic; mirrored in
apps/web/src/features/proctoring/classify.ts. Thresholds come from the assessment (defaulted from config)."""

from dataclasses import dataclass
from enum import StrEnum

from app.core.config import get_settings


class LookAwayClass(StrEnum):
    ignore = "ignore"  # < glance_min: not stored
    glance = "glance"  # glance_min .. < flag_threshold: mentor-only glance log
    flag = "flag"  # >= flag_threshold while flags < max: red flag, candidate notified
    post_limit = "post_limit"  # >= flag_threshold after max flags: logged, not notified


@dataclass(frozen=True)
class Policy:
    glance_min_s: float
    flag_threshold_s: float
    max_flags: int

    @classmethod
    def for_exam(cls, exam) -> "Policy":
        return cls(exam.glance_min_s, exam.flag_threshold_s, exam.max_flags)

    @classmethod
    def default(cls) -> "Policy":
        s = get_settings()
        return cls(s.glance_min_s, s.flag_threshold_s, s.max_flags)


def classify(duration_ms: int, flag_count: int, policy: Policy) -> LookAwayClass:
    if duration_ms < policy.glance_min_s * 1000:
        return LookAwayClass.ignore
    if duration_ms < policy.flag_threshold_s * 1000:
        return LookAwayClass.glance
    if flag_count < policy.max_flags:
        return LookAwayClass.flag
    return LookAwayClass.post_limit

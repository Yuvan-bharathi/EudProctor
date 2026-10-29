"""Deterministic evaluation rules (PRD section 5). Pure functions, unit-tested; the LLM never computes numbers.

Thresholds are passed in (from config), never hard-coded.
"""

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from enum import StrEnum


class TopicClass(StrEnum):
    strong = "strong"
    developing = "developing"
    weak = "weak"
    insufficient = "insufficient"


@dataclass(frozen=True)
class Thresholds:
    strong_pct: float
    weak_pct: float
    min_questions: int
    mastery_pct: float  # priority = mastery_pct - score_pct
    misconception_min: int
    group_fraction: float  # item analysis top/bottom group size (27%)


@dataclass(frozen=True)
class ItemScore:
    question_id: str
    topic_id: str
    max_marks: float
    marks: float | None  # None = not yet marked (subjective)
    chosen_key: str | None = None
    misconception_id: str | None = None


@dataclass(frozen=True)
class TopicResult:
    topic_id: str
    marks_obtained: float
    max_marks: float
    score_pct: float | None
    n_questions: int
    n_unmarked: int
    cls: TopicClass
    priority: float | None


def topic_score_pct(obtained: float, max_marks: float) -> float | None:
    return None if max_marks <= 0 else round(obtained / max_marks * 100, 2)


def classify_topic(score_pct: float | None, n_questions: int, t: Thresholds) -> TopicClass:
    if n_questions < t.min_questions or score_pct is None:
        return TopicClass.insufficient
    if score_pct >= t.strong_pct:
        return TopicClass.strong
    if score_pct < t.weak_pct:
        return TopicClass.weak
    return TopicClass.developing


def priority_for(score_pct: float | None, cls: TopicClass, t: Thresholds) -> float | None:
    """Higher = more urgent. Only weak and developing topics get a priority."""
    if cls not in (TopicClass.weak, TopicClass.developing) or score_pct is None:
        return None
    return round(t.mastery_pct - score_pct, 2)


def topic_results(items: list[ItemScore], t: Thresholds) -> list[TopicResult]:
    """Unmarked items count toward n_questions but not toward the score until marked."""
    by_topic: dict[str, list[ItemScore]] = defaultdict(list)
    for it in items:
        by_topic[it.topic_id].append(it)
    out = []
    for topic_id, its in by_topic.items():
        marked = [i for i in its if i.marks is not None]
        obtained = sum(i.marks or 0 for i in marked)
        max_marks = sum(i.max_marks for i in marked)
        pct = topic_score_pct(obtained, max_marks)
        cls = classify_topic(pct, len(its), t)
        out.append(
            TopicResult(
                topic_id,
                obtained,
                max_marks,
                pct,
                len(its),
                len(its) - len(marked),
                cls,
                priority_for(pct, cls, t),
            )
        )
    return sorted(out, key=lambda r: (r.priority is None, -(r.priority or 0), r.topic_id))


def detect_misconceptions(items: list[ItemScore], t: Thresholds) -> dict[str, int]:
    """Misconception = the candidate chose options carrying the same misconception tag at least N times."""
    counts = Counter(i.misconception_id for i in items if i.misconception_id)
    return {m: n for m, n in counts.items() if n >= t.misconception_min}


@dataclass
class Response:
    candidate: str
    total: float  # candidate's total marks (for top/bottom groups)
    chosen: dict[str, str | None]  # question_id -> chosen option key (None = not attempted)


@dataclass
class ItemStats:
    question_id: str
    n_attempted: int
    p: float | None
    d: float | None
    distractor_shares: dict[str, float] = field(default_factory=dict)
    flags: list[str] = field(default_factory=list)


def item_analysis(
    responses: list[Response], keys: dict[str, str], options: dict[str, list[str]], t: Thresholds
) -> list[ItemStats]:
    """p = correct / attempted; D = p(top group) - p(bottom group) with groups of `group_fraction` by total;
    distractor share per option; flag D < 0 or a distractor chosen more often than the key by the top group."""
    n = len(responses)
    g = max(1, round(n * t.group_fraction)) if n else 0
    ranked = sorted(responses, key=lambda r: r.total, reverse=True)
    top, bottom = ranked[:g], ranked[-g:] if g else []

    def p_of(group: list[Response], qid: str) -> float | None:
        att = [r for r in group if r.chosen.get(qid) is not None]
        return None if not att else sum(r.chosen[qid] == keys[qid] for r in att) / len(att)

    out = []
    for qid, key in keys.items():
        attempted = [r for r in responses if r.chosen.get(qid) is not None]
        stats = ItemStats(qid, len(attempted), None, None)
        if attempted:
            stats.p = round(sum(r.chosen[qid] == key for r in attempted) / len(attempted), 4)
            choices = Counter(r.chosen[qid] for r in attempted)
            stats.distractor_shares = {
                k: round(choices.get(k, 0) / len(attempted), 4) for k in options.get(qid, [])
            }
            p_top, p_bottom = p_of(top, qid), p_of(bottom, qid)
            if p_top is not None and p_bottom is not None and n >= 2:
                stats.d = round(p_top - p_bottom, 4)
                if stats.d < 0:
                    stats.flags.append("negative_discrimination")
            top_choices = Counter(r.chosen.get(qid) for r in top if r.chosen.get(qid) is not None)
            if any(k != key and c > top_choices.get(key, 0) for k, c in top_choices.items()):
                stats.flags.append("suspected_key_error")
        out.append(stats)
    return out


def percentile_ranks(scores: dict[str, float]) -> dict[str, float]:
    """Percent of the class scoring strictly below, plus half of ties (mid-rank percentile)."""
    vals = list(scores.values())
    n = len(vals)
    out = {}
    for k, v in scores.items():
        below = sum(x < v for x in vals)
        equal = sum(x == v for x in vals)
        out[k] = round((below + 0.5 * equal) / n * 100, 1) if n else 0.0
    return out

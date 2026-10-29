"""Fixture-based tests with known answers for the pure scoring rules."""

import pytest

from app.scoring.rules import (
    ItemScore,
    Response,
    Thresholds,
    TopicClass,
    classify_topic,
    detect_misconceptions,
    item_analysis,
    percentile_ranks,
    topic_results,
)

T = Thresholds(
    strong_pct=80, weak_pct=60, min_questions=3, mastery_pct=80, misconception_min=2, group_fraction=0.27
)


def items(topic, marks, max_marks=1.0, **kw):
    return [ItemScore(f"{topic}-q{i}", topic, max_marks, m, **kw) for i, m in enumerate(marks)]


@pytest.mark.parametrize(
    ("pct", "n", "expected"),
    [
        (80.0, 3, TopicClass.strong),
        (79.99, 3, TopicClass.developing),
        (60.0, 3, TopicClass.developing),
        (59.99, 3, TopicClass.weak),
        (100.0, 2, TopicClass.insufficient),  # fewer than 3 questions
        (0.0, 2, TopicClass.insufficient),
    ],
)
def test_classification_boundaries(pct, n, expected):
    assert classify_topic(pct, n, T) == expected


def test_known_answer_fixture():
    # Heat transfer 7/8 = 87.5 strong · Entropy 7/10 = 70 developing · First law 9/20 = 45 weak · Cycles 2 qs insufficient
    data = (
        items("heat", [1, 1, 1, 1, 1, 1, 1, 0])
        + items("entropy", [2, 2, 0, 2, 1], max_marks=2)
        + items("first_law", [2, 1, 0, 2, 1, 0, 1, 2, 0, 0], max_marks=2)
        + items("cycles", [1, 1])
    )
    res = {r.topic_id: r for r in topic_results(data, T)}
    assert (res["heat"].score_pct, res["heat"].cls) == (87.5, TopicClass.strong)
    assert (res["entropy"].score_pct, res["entropy"].cls) == (70.0, TopicClass.developing)
    assert (res["first_law"].score_pct, res["first_law"].cls) == (45.0, TopicClass.weak)
    assert (res["cycles"].score_pct, res["cycles"].cls) == (100.0, TopicClass.insufficient)
    # priority = mastery - score, weak/developing only; most urgent first
    assert res["first_law"].priority == 35.0 and res["entropy"].priority == 10.0
    assert res["heat"].priority is None and res["cycles"].priority is None
    assert [r.topic_id for r in topic_results(data, T)][:2] == ["first_law", "entropy"]


def test_unmarked_answers_excluded_from_score_but_counted():
    data = items("essay", [1, None, 0, None], max_marks=1)
    (r,) = topic_results(data, T)
    assert (r.n_questions, r.n_unmarked, r.max_marks, r.score_pct) == (4, 2, 2, 50.0)


def test_misconception_needs_two_choices_with_same_tag():
    data = [
        ItemScore("q1", "t", 1, 0, "B", "m1"),
        ItemScore("q2", "t", 1, 0, "C", "m1"),
        ItemScore("q3", "t", 1, 0, "D", "m2"),
        ItemScore("q4", "t", 1, 1, "A", None),
    ]
    assert detect_misconceptions(data, T) == {"m1": 2}


def test_item_analysis_known_values():
    # 10 candidates; groups of round(10 * 0.27) = 3
    keys = {"q1": "A", "q2": "B"}
    options = {"q1": ["A", "B", "C"], "q2": ["A", "B", "C"]}
    resp = []
    for i in range(10):
        total = 10 - i  # candidate 0 is best
        q1 = "A" if i < 7 else "B"  # top all correct, bottom mostly wrong -> positive D
        q2 = "C" if i < 3 else "B"  # top group all choose C (wrong): negative D and suspected key error
        resp.append(Response(f"c{i}", total, {"q1": q1, "q2": q2}))
    resp.append(Response("absent", 0, {"q1": None, "q2": None}))
    stats = {s.question_id: s for s in item_analysis(resp, keys, options, T)}
    assert stats["q1"].n_attempted == 10 and stats["q1"].p == 0.7
    assert stats["q1"].distractor_shares == {"A": 0.7, "B": 0.3, "C": 0.0}
    assert stats["q2"].p == 0.7
    assert stats["q2"].d is not None and stats["q2"].d < 0
    assert set(stats["q2"].flags) == {"negative_discrimination", "suspected_key_error"}
    assert stats["q1"].flags == []


def test_percentiles():
    assert percentile_ranks({"a": 50, "b": 70, "c": 70, "d": 90}) == {
        "a": 12.5,
        "b": 50.0,
        "c": 50.0,
        "d": 87.5,
    }

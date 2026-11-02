"""Template outputs for the internship agents when AGENT_LLM=mock (dev/test only, never production).

They build plausible content from the payload so the real graph, validators and approval flow all run.
"""

from typing import Any


def blocker(p: dict[str, Any]) -> dict[str, Any]:
    docs = p.get("documents") or []
    top = docs[0] if docs else {"id": "", "title": "", "body": ""}
    sentences = [s.strip() for s in top["body"].replace("\n", " ").split(". ") if s.strip()][:3]
    return {
        "answer": f"This looks like: {top['title']}. Based on your project docs:",
        "steps": sentences or ["Re-read the exact error message and the last change you made."],
        "cited_doc_ids": [top["id"]] if top["id"] else [],
        "confident": bool(docs),
    }


def code_review(p: dict[str, Any]) -> dict[str, Any]:
    findings = p.get("automated_findings") or []
    qs = [
        {
            "line": f.get("line"),
            "question": f"On line {f.get('line')}: {f.get('message')} What could go wrong here, and how would you change it?",
            "why_it_matters": f"Rule '{f.get('rule')}' ({f.get('severity')} severity).",
        }
        for f in findings[:4]
    ]
    if not qs:
        qs = [{"line": None, "question": "Which edge cases does this code not handle yet, and how would you test them?",
               "why_it_matters": "Untested edge cases are the most common source of production bugs."}]
    return {
        "summary": f"Review of '{p.get('task', {}).get('title', 'your task')}': {len(findings)} automated finding(s). "
        "Work through the questions below before your next walkthrough.",
        "strengths": ["The submission is focused on the task.", "Code is split into readable units."],
        "socratic_questions": qs,
        "findings_explained": [{"rule": f["rule"], "explanation": f["message"]} for f in findings[:6]],
        "mentor_walkthrough_questions": [
            "Walk me through how this handles invalid input.",
            "What would you test first, and why?",
        ],
    }


_OPTIONS_BANK = [
    ("Understand the requirement and its edge cases first", None),
    ("Optimise performance before it works", "premature-optimisation"),
    ("Skip tests until the end of the internship", "testing-is-optional"),
    ("Copy a solution without understanding it", "cargo-cult-code"),
]


def weekly_quiz(p: dict[str, Any]) -> dict[str, Any]:
    skills = p.get("allowed_skills") or ["General Engineering"]
    tasks = p.get("tasks_this_week") or [{"title": "this week's work"}]
    n = int(p.get("number_of_questions") or 5)
    questions = []
    for i in range(n):
        skill = skills[i % len(skills)]
        task = tasks[i % len(tasks)]["title"]
        opts = [{"key": k, "text": t, "misconception": m} for k, (t, m) in zip("ABCD", _OPTIONS_BANK, strict=True)]
        questions.append({
            "skill": skill,
            "body": f"[{skill}] While working on '{task}', what is the best first step when a requirement is unclear? (Q{i + 1})",
            "options": opts,
            "correct_key": "A",
            "explanation": "Clarifying the requirement and edge cases first avoids rework.",
        })
    return {"questions": questions}


def appraisal(p: dict[str, Any]) -> dict[str, Any]:
    m = p.get("metrics") or {}
    att = (m.get("attendance") or {}).get("rate_pct")
    tasks = m.get("tasks") or {}
    quiz = (m.get("quizzes") or {}).get("avg_score_pct")
    day = p.get("milestone_day")
    return {
        "qualitative_summary": (
            f"Day {day} summary: {tasks.get('done', 0)} of {tasks.get('assigned', 0)} tasks completed, "
            f"attendance rate {att if att is not None else 'n/a'}%, average weekly quiz score "
            f"{quiz if quiz is not None else 'n/a'}%."
        ),
        "strengths": ["Consistent progress on assigned tasks."] if tasks.get("done") else ["Getting set up well."],
        "growth_areas": ["Ask for help earlier when blocked.", "Add tests alongside new code."],
        "next_goals": ["Complete the next sprint's tasks on time.", "Raise weekly quiz scores in weaker skills."],
        "mentor_brief": "Discuss the weakest skill on the radar chart and agree one concrete goal for next month.",
        "self_appraisal_scaffold": {
            "accomplishments": [t["title"] for t in (p.get("tasks") or []) if t.get("status") == "Done"][:3],
            "challenges": ["(Describe a problem you got stuck on and how you solved it.)"],
            "focus_goals": ["(Pick one skill you want to grow next month.)"],
        },
    }


BUILDERS = {
    "intern_blocker_answer": blocker,
    "intern_code_review": code_review,
    "intern_weekly_quiz": weekly_quiz,
    "intern_appraisal": appraisal,
}

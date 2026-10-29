# EduProctor Intelligence

Online assessments for colleges and course providers. Mentors build topic-tagged assessments, candidates take them with face verification and calm browser-side proctoring, and an AI agent drafts an **Assessment Evaluation Summary** that a mentor approves before the candidate ever sees it.

- Product requirements: [docs/PRD.md](docs/PRD.md) · Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Build plan: [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)
- Design system: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) · Decisions made during the build: [docs/DECISIONS.md](docs/DECISIONS.md)
- Manual identity test: [docs/manual-tests/identity.md](docs/manual-tests/identity.md)

## Setup

Requirements: Python 3.12 with [uv](https://docs.astral.sh/uv/), Node 20+ with pnpm, and either Docker or nothing else (an embedded PostgreSQL is used when Docker is not available).

```bash
cp .env.example .env              # set JWT_SECRET and EVIDENCE_ENCRYPTION_KEY (see comments in the file)

# Option A: Docker services
docker compose up -d db redis chroma mailpit
cd apps/api && uv sync && uv run alembic upgrade head && uv run python -m app.seed && uv run python -m app.demo_seed
uv run uvicorn app.main:app --reload

# Option B: no Docker (embedded PostgreSQL 16, in-process alert bus, file outbox for email)
cd apps/api && uv sync && uv run python -m app.devserver      # migrates, seeds demo data on first run, serves :8000

# Web
cd apps/web && pnpm install && pnpm dev                       # http://localhost:5173
```

`uv` not on PATH? Use `python -m uv` instead. To start over with fresh demo data: `DEV_RESET=1 uv run python -m app.devserver`.

### The AI agent

Set `ENVIRONMENT=dev` for local development (the default is `production`, which disables every dev-only shortcut). Set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` in `.env` (for example `claude-opus-5-5`). Without them, "Suggest questions" and summary drafting return a clear 503. For demos without a key, set `AGENT_LLM=mock`: a rule-based stand-in that drives the same tool loop and validators (development only; refused outside dev/test).

### Identity engine

`IDENTITY_ENGINE=dev` (default) is a pixel comparison for development and tests. **It is not face recognition** and is refused outside dev/test. For real use install the extra (`uv sync --extra identity`) and set `IDENTITY_ENGINE=insightface`. Note that InsightFace's pretrained models are licensed for non-commercial use: obtain a licence or substitute a permissively licensed model before deploying.

## Demo logins (synthetic data)

All passwords: `eduproctor-dev`

| Role | Email | What to look at |
|---|---|---|
| Admin | admin@example.com | Users, courses, notes library (approve/withdraw), agent runs |
| Mentor | mentor1@example.com | Thermodynamics 101: 3 assessments, results, summaries, identity reviews, agent runs |
| Candidate | candidate01@example.com | Dashboard with a published summary, notes, practice set; Unit test 3 to take live |

## 5-minute demo script

1. **Mentor, results (1 min).** Sign in as `mentor1`. Assessments → *Unit test 1 · Foundations* → **Results**. Show topic averages (strong/developing/weak colours), the weak-topic distribution, the score histogram and *Question quality* (p, D and option shares per item; items with D < 0 or a suspected key error are flagged). Open a candidate's **Proctoring** link: summary line *Red flags n/3 · Head glances · Eye glances · Other alerts*, the timeline, and record a decision on a flag.
2. **Mentor, AI summary review (1 min).** *Unit test 2* → **Summaries** → open a row marked *Review*. Left: computed results. Right: the lavender *AI draft* card. Point out that scores are locked, notes come only from the approved library (topics without one show "needs mentor note"), and the integrity note is marked mentor-only. Edit the message, **Save edits**, **Approve**, then **Publish to candidate**. Open **Agent runs** to show that run: each tool call, the recorded reason, tokens, cost and the final mentor decision.
3. **Mentor, send links (30 s).** *Unit test 3* (all candidates are pre-assigned) → **Send links**. The email is in Mailpit (http://localhost:8025) or in `apps/api/storage/outbox/*.eml` when no SMTP server is running.
4. **Candidate, take the assessment (2 min).** Sign in as `candidate01` in another browser and open the link. Consent → enrol 3 photos → liveness prompt (blink or turn) → 12-second calibration → **Start assessment**. Look away for about 4 s: a calm notice *"Flag 1 of 3 – please keep your eyes on the screen."* appears and the small counter updates; a 1–2 s glance shows nothing. Meanwhile the mentor's **Live monitor** shows the glance and the flag as they happen. Submit.
5. **Candidate, dashboard (30 s).** The published Unit test 1 result: score, topic chart, the mentor-approved message, recommended topics with notes, and the practice set with its re-check score. Nothing about glances, flags or integrity appears here.

## Checks

```bash
cd apps/api && uv run pytest -q && uv run ruff check .        # 113 tests incl. the 10 proctoring reference cases
cd apps/web && pnpm lint && pnpm test                          # Vitest incl. the same 10 cases in TypeScript
cd apps/web && UV="uv" pnpm exec playwright test               # E2E full flow + axe accessibility pass
```

The E2E run starts its own API on :8100 (fresh database `eduproctor_e2e`, mock LLM, file outbox) and Vite on :5174 built with `VITE_E2E=1`, which replaces the camera and vision worker with a scripted signal source. That flag is never set in production builds.

## Guarantees enforced in code (CLAUDE.md non-negotiable rules)

- Proctoring never changes session status. Auto-submit happens only at the server deadline (`tests/test_phase5_proctoring.py::test_case8_*`).
- The flag counter is server-side, row-locked and capped at `MAX_FLAGS`; extra look-aways are stored as post-limit, including under concurrent batches (`test_case7_*`).
- Candidate endpoints never return glances, events, snapshots or integrity notes (separate response models; tested).
- Summaries reach candidates only after mentor approval and publication (`/publish` returns 409 otherwise; candidate reads filter `published`).
- The agent has an allow-listed tool registry with no publish tool and no access to marks, events or flags. Every number and ID in a draft is validated against computed data.
- Video never leaves the browser. Only events, small JPEG evidence for red flags and face crops for identity are uploaded, all encrypted at rest and deleted after `RETENTION_DAYS`.
- Every write is audit-logged by a session hook, and named actions (approve, publish, decisions, agent tool calls) get their own audit rows.

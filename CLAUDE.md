# EduProctor Intelligence

Online assessment platform for **colleges and course providers**. Mentors create topic-tagged
assessments; candidates take them with face verification and browser-side proctoring; an AI agent
writes an Assessment Evaluation Summary that the mentor approves before it reaches the candidate.

Full requirements: @docs/PRD.md
Architecture, data model, API, state machines: @docs/ARCHITECTURE.md
Phase-by-phase build plan with acceptance criteria: @docs/BUILD_PLAN.md
Visual design (light, soft palette): @docs/DESIGN_SYSTEM.md

## Vocabulary (use everywhere: UI text, code, DB, API)
- **Mentor** (never "teacher"), **Candidate** (never "student"), **Assessment** (UI), `exam` is fine in code.
- **Glance** = look-away of 1 to under 3 s, mentor-only. **Red flag** = look-away of 3 s or more, or leaving the assessment tab for longer than `tab_switch_s` (2 s); max 3 shown to the candidate.
- **Assessment Evaluation Summary** = AI-drafted, mentor-approved summary of strong, weak and recommended topics.

## Non-negotiable rules (enforce in backend code, not only in the UI)
1. Never auto-disqualify, pause, block or auto-submit an assessment because of a proctoring signal.
2. Red flags are capped at 3 per session for the candidate notice; further look-aways and tab switches are logged as `post_limit`.
3. Glances, the glance log, integrity notes and evidence are never visible to candidates.
4. Nothing from the AI agent is visible to a candidate until a mentor approves it (`status = approved` checked server-side on publish and on read).
5. The agent can never change marks, edit or delete events/flags, or label anyone as cheating.
6. Video never leaves the browser. Only events and short evidence snapshots are uploaded.
7. Scores, topic classification and flag logic are deterministic code with unit tests; the LLM only drafts text and picks from approved content.
8. Candidates are adults (18+); no guardian/minor features.
9. Every mentor decision, approval, publication and agent tool call is written to the audit log.

## Stack
- `apps/web`: React 18 + TypeScript + Vite, Tailwind CSS, shadcn/ui, TanStack Query, React Router, Recharts, `@mediapipe/tasks-vision`.
- `apps/api`: Python 3.12, FastAPI, SQLAlchemy 2 + Alembic, Pydantic v2, PostgreSQL 16, Redis (WebSocket fan-out + jobs), pytest.
- Identity: InsightFace (ArcFace) in the API; liveness = active blink/head-turn challenge in the browser.
- Agent: Anthropic SDK tool use (model from env `ANTHROPIC_MODEL`), ChromaDB + bge-small embeddings for the notes library.
- Infra: Docker Compose for local dev; Playwright for E2E.

## Repository layout
```
apps/web/src/{app,pages,components,features,lib,styles}
apps/api/app/{core,models,schemas,routers,services,agent,proctoring,scoring,jobs}
apps/api/tests
docs/
```

## Commands
- `docker compose up -d db redis chroma` — start services
- `cd apps/api && uv run alembic upgrade head && uv run uvicorn app.main:app --reload`
- `cd apps/api && uv run pytest -q`
- `cd apps/web && pnpm dev` / `pnpm test` / `pnpm lint` / `pnpm exec playwright test`

## Working agreements
- Build in the order of docs/BUILD_PLAN.md; use `/build-phase <n>` to start a phase.
- Before finishing a phase: tests pass, lint passes, acceptance criteria checked one by one.
- Thresholds (1 s, 3 s, max 3 flags, 60%/80% topic thresholds) live in config, never as magic numbers.
- Use only design tokens from the design-system skill; no raw hex colours in components.
- Seed data is synthetic. Never commit real faces, names or emails.
- Secrets via `.env` (see `.env.example`); never log secrets, embeddings or raw images.

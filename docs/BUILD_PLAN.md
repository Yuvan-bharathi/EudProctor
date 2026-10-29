# Build plan

Build one phase at a time with `/build-phase <n>`. A phase is done only when every acceptance
criterion below is checked, tests pass and lint passes. Commit at the end of each phase.

## Phase 0 — Scaffold
- Monorepo, Docker Compose (postgres, redis, chroma), `.env.example`, FastAPI app with health check, Vite React app with Tailwind + shadcn/ui, design tokens from the design-system skill, app shell (sidebar + top bar) in the light theme.
- [ ] `docker compose up` + both dev servers start; `/api/v1/health` returns ok.
- [ ] Token-based theme applied; a `/styleguide` page shows colours, buttons, badges, cards, table, alerts.

## Phase 1 — Auth, roles, audit
- JWT auth, roles admin/mentor/candidate, course membership, audit_log middleware, seed script (1 admin, 2 mentors, 30 synthetic candidates).
- [ ] Role guards tested server-side for every router (candidate cannot hit mentor endpoints).
- [ ] Every write produces an audit_log row.

## Phase 2 — Question bank and assessments
- Topics, questions, options with misconception tags, exam builder, shuffle, assignments, signed single-use links, email (Mailpit in dev).
- Question Bank Agent: "Suggest questions" → drafts the mentor accepts or skips.
- [ ] Link reuse and expiry rejected; link bound to candidate.
- [ ] AI-suggested questions cannot be used until accepted.

## Phase 3 — Candidate assessment page
- Join flow, timer from server deadline, question navigator, autosave (≤10 s, client_seq idempotency), IndexedDB offline buffer, submit, auto-submit on deadline only.
- [ ] 5-minute network drop loses no answers; reconnect resumes with remaining time.

## Phase 4 — Identity
- Consent screen, face enrolment (3–5 images), liveness challenge, ArcFace verification at start and random intervals, mentor review queue for failures.
- [ ] Printed photo / phone-screen photo fail liveness in manual test; genuine user passes within 2 attempts.

## Phase 5 — Proctoring, glances and red flags (use the proctoring-engine skill)
- MediaPipe in a Web Worker, calibration, look-away state machine, browser integrity events, batched event upload, server re-validation, flag counter, candidate notice + counter, Redis → WebSocket mentor live page, mentor candidate details page (summary line, timeline, evidence, review decisions).
- [ ] Unit tests: <1 s → nothing; 1–2.9 s → glance; ≥3 s → flag; 4th sustained look-away → post_limit, counter stays 3; one continuous look-away = one event.
- [ ] No code path pauses, blocks or submits the session on any proctoring event (test asserts status unchanged).
- [ ] Candidate APIs never return glance log, events or snapshots.

## Phase 6 — Scoring and analytics
- Objective scoring, subjective marking queue, topic results, strong/developing/weak, misconceptions, item analysis, class analytics with charts.
- [ ] Known answer fixtures produce expected topic scores and classes; topics with <3 questions = insufficient.

## Phase 7 — Assessment Evaluation Summary (use the assessment-evaluation-agent skill)
- Agent job after scoring, review queue, edit/approve/request-changes, publish, candidate dashboard, practice sets and re-check.
- [ ] Publishing a non-approved summary returns 409; candidate endpoints return published content only, without data_notes or integrity_note.
- [ ] Notes in summaries come only from the approved notes library (test with an empty library → topic flagged, no invented notes).

## Phase 8 — Agent observability
- Agent dashboard (runs, success rate, duration, tokens, cost, approval-without-edit rate) and run detail page (tool calls, args, outputs, errors, final mentor decision).
- [ ] Every agent run and tool call visible; deterministic steps show 0 tokens.

## Phase 9 — Hardening and demo
- Playwright E2E for the full flow, accessibility pass (axe), retention job, demo seed with realistic synthetic results.
- [ ] E2E: mentor creates assessment → candidate takes it with 2 flags and 5 glances → summary approved → visible on candidate dashboard.

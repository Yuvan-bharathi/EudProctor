---
name: build-phase
description: Implement one phase of docs/BUILD_PLAN.md end to end, with tests and an acceptance check. Run manually as /build-phase <number>.
disable-model-invocation: true
---

# Build phase $ARGUMENTS

1. Read `docs/BUILD_PLAN.md` phase $ARGUMENTS and the sections of `docs/PRD.md` and `docs/ARCHITECTURE.md` it touches. Load any skill the phase names.
2. Write a short plan (files to add/change, migrations, endpoints, components, tests) and show it before coding.
3. Implement backend first (models → migration → schemas → services → routers → tests), then frontend (API client → pages → components) using the eduproctor-design-system skill.
4. Run `uv run pytest -q`, `pnpm lint`, `pnpm test`; fix until green.
5. Ask the `guardrail-reviewer` subagent to review the diff; for UI work also ask the `ui-reviewer` subagent. Fix what they report.
6. Go through every acceptance checkbox for the phase and state how it was verified (test name or manual step).
7. Summarise what changed and what is left, then suggest a commit message. Do not start the next phase.

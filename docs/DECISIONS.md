# Build decisions

Choices made where the kit's documents were silent or disagreed. Update PRD/ARCHITECTURE if any of these change.

| Topic | Decision | Why |
|---|---|---|
| Topic priority | `priority = PRIORITY_MASTERY_PCT − topic score` for weak **and** developing topics; mastery defaults to `STRONG_TOPIC_PCT` (80). | PRD §5 says "mastery threshold − score"; the skill said `60 − score`. Using the strong threshold ranks developing topics too. |
| Integrity note | Stored in `content_json.integrity_note`, written only by a separate deterministic step (0 tokens). The agent must submit `""`; mentor edits cannot change it; candidate models have no such field. | The summary schema requires the field, but rule 3 and the skill keep it out of the LLM's hands. |
| Summary "submitted for review" | `submit_for_mentor_review` sets `ready_for_review` and keeps `status = draft`. A draft can be approved only once it is ready (or after a mentor edit). | Matches the state machine `draft → approved → published` without adding a status. |
| Weak topic detail | `weak_topics` keep the schema's topic fields. Wrong question IDs are available to the agent through `get_wrong_answers` but are not stored in the summary. | The JSON schema has no field for them. |
| Practice set size | Agent picks ≤ 10 practice questions in total; publishing tops up to `PRACTICE_MIN_QUESTIONS` (5) from recommended topics when possible. | PRD says a 5–10 question set; the schema allowed up to 10 per topic. |
| Join link | `POST /join/{token}` (not GET): it consumes a single-use link. The candidate must be signed in, and the link is bound to that candidate. | State-changing requests should not be GETs; binding prevents link sharing. |
| Identity block | A mentor may block the **start** after a failed identity review (`identity_blocked`). Random checks during the assessment never change the session. | Rule 1 forbids automatic action on proctoring signals; a human decision before the start is allowed by PRD §3 step 3. |
| Results visibility | Candidates see scores only together with a published summary. | Keeps one mentor-approved release point. |
| Late offline answers | After a deadline auto-submit, answers buffered before the deadline are accepted for `LATE_SYNC_GRACE_S` and the session is re-scored. | PRD requires no answer loss on a 5-minute drop. |
| Mentor WebSocket auth | Single-use ticket (`POST /mentor/exams/{id}/ws-ticket`, 60 s) instead of the access token in the URL. | Keeps long-lived tokens out of URLs and proxy logs. |
| Vision in a worker | MediaPipe runs in a module Web Worker, with an `importScripts` polyfill (sync XHR + global eval); it falls back to the main thread if the worker fails. | tasks-vision loads its WASM loader with `importScripts`, which throws in module workers. |
| No Docker (dev) | `app.devserver` runs an embedded PostgreSQL 16 (pgserver); alerts use an in-process bus when Redis is unreachable; email falls back to a file outbox. | Development machine without Docker. Production uses the compose services. |
| Notes retrieval | SQL enforces `approved`; ChromaDB + bge-small (optional extra) only ranks; a keyword ranker is used when Chroma is unavailable. | Approval must never depend on the index being in sync. |

## Open items

- Refresh-token rotation/revocation and moving tokens out of `localStorage` (httpOnly cookie) — flagged by the Phase 1 review.
- Login rate limiting.
- Real face recognition requires the `identity` extra and a commercially licensed model.
- Legal review for the India DPDP Act 2023 before real deployment (PRD §8).

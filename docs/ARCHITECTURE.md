# Architecture

Modular monolith. Modules: auth, exams, identity, proctoring, scoring, evaluation (agent), notifications, audit.

```
Browser (React)                         API (FastAPI)                       Stores
 ├─ Assessment page ──REST── answers ─▶  exams / sessions  ───────────────▶ PostgreSQL
 ├─ MediaPipe worker ─REST── events ──▶  proctoring.ingest ─┬─ flags/glances ▶ PostgreSQL
 │                                                          └─ publish ────▶ Redis pub/sub
 ├─ Mentor live page ◀──WebSocket────────────────────────────── alerts ◀─────┘
 ├─ Liveness + face crop ─REST───────▶  identity (InsightFace)  ──────────▶ encrypted object store
 └─ Dashboards ◀──REST──                scoring → evaluation agent ─ tools ─▶ ChromaDB (notes)
                                         jobs (Redis queue): scoring, item analysis, emails
```

## Data model (PostgreSQL)
| Table | Key columns |
|---|---|
| users | id, role (admin/mentor/candidate), email, name, is_active, consent_version |
| courses, course_members | course_id, user_id, role |
| topics | id, course_id, name, parent_id |
| questions | id, topic_id, subtopic, type (mcq/short), difficulty, marks, body, status (draft/approved), source (mentor/agent) |
| question_options | id, question_id, key, text, is_correct, misconception_id |
| misconceptions | id, topic_id, description |
| exams | id, course_id, mentor_id, title, duration_min, window_start, window_end, shuffle, flag_threshold_s (3), glance_min_s (1), max_flags (3) |
| exam_questions, exam_assignments | exam_id, question_id, order / exam_id, candidate_id, link_token_hash, link_used_at |
| face_profiles | candidate_id, embedding_ref (encrypted), enrolled_at, consent_version |
| sessions | id, exam_id, candidate_id, status, started_at, deadline_at, submitted_at, flag_count, flag_limit_reached, accommodations |
| answers | session_id, question_id, value, saved_at, client_seq (idempotency) |
| identity_checks | session_id, kind (start/random), liveness_ok, similarity, result, reviewed_by |
| proctor_events | id, session_id, type, severity, started_at, duration_ms, payload, snapshot_ref |
| candidate_flags | id, session_id, flag_no (1–3 or NULL=post_limit), source (head/eyes), direction, started_at, duration_ms, snapshot_ref, notified |
| glance_log | id, session_id, source (head/eyes), direction, started_at, duration_ms |
| flag_reviews | flag_id or event_id, mentor_id, decision (dismiss/concern/escalate), comment, at |
| results, topic_results | session_id, total, percentile / session_id, topic_id, score_pct, n_questions, class (strong/developing/weak/insufficient) |
| item_stats | exam_id, question_id, p, d, distractor_shares, flag |
| notes | id, topic_id, title, url_or_body, level, approved |
| evaluation_summaries | id, session_id, status (draft/changes_requested/approved/published), content_json, version, drafted_run_id, approved_by, approved_at, published_at |
| practice_sets, practice_attempts | id, summary_id, question_ids, due_at, status / practice_id, score, completed_at |
| agent_runs, agent_steps | run_id, agent, status, model, prompt_version, tokens_in/out, cost, started/ended / step_id, run_id, tool, args_json, output_summary, latency_ms, error |
| audit_log | id, actor_type, actor_id, action, entity, entity_id, before_json, after_json, at |

## API (REST, `/api/v1`)
| Method & path | Who | Purpose |
|---|---|---|
| POST /auth/login, /auth/refresh | all | JWT auth |
| CRUD /questions, POST /questions/suggest | mentor | question bank; agent suggestions return drafts |
| POST /questions/{id}/accept, /skip | mentor | accept/skip AI question ideas |
| CRUD /exams, POST /exams/{id}/send-links | mentor | assessments and link emails |
| GET /join/{token} | candidate | redeem link → session |
| POST /identity/enrol, /sessions/{id}/liveness, /sessions/{id}/verify | candidate | identity |
| PUT /sessions/{id}/answers | candidate | idempotent autosave (client_seq) |
| POST /sessions/{id}/events | candidate | batched proctor events (server re-validates durations) |
| GET /sessions/{id}/flag-status | candidate | `{flag_count, max_flags}` only |
| POST /sessions/{id}/submit | candidate | submit |
| WS /ws/mentor/exams/{id} | mentor | live flags/alerts |
| GET /mentor/sessions/{id}/details | mentor | flags, glance log, events, reviews |
| POST /mentor/flags/{id}/review | mentor | decision + comment |
| GET /exams/{id}/results, /item-analysis | mentor | analytics |
| GET /evaluation-summaries?exam_id= | mentor | review queue |
| PATCH /evaluation-summaries/{id} | mentor | edit draft |
| POST /evaluation-summaries/{id}/approve, /request-changes, /publish | mentor | approval flow |
| GET /candidates/me/dashboard, /recommendations | candidate | published content only |
| POST /practice-sets/{id}/submit | candidate | practice |
| GET /agent/runs, /agent/runs/{id} | mentor/admin | observability |

## State machines
Session: `assigned → link_opened → identity_check → (identity_review) → calibrating → in_progress → submitted | expired → scored → analysed`.
Flags never change session status.

Flag counter (per session, server-authoritative):
```
on look_away_end(duration):
  if duration < glance_min_s: drop
  elif duration < flag_threshold_s: insert glance_log
  elif flag_count < max_flags: flag_count += 1; insert candidate_flag(flag_no=flag_count, notified=True); push candidate notice + mentor alert
  else: insert candidate_flag(flag_no=NULL, notified=False); flag_limit_reached = True; push mentor alert
```
The browser shows the notice optimistically but the server count is the truth (re-sync via /flag-status).

Evaluation summary: `draft → changes_requested → draft (v+1) → approved → published`. Publish endpoint rejects anything not `approved`; candidate read endpoints filter `published` only and strip `data_notes` and `integrity_note`.

## Agent design
Agents run as backend jobs with an allow-listed tool registry; every call logged to agent_steps.
| Agent | Tools |
|---|---|
| Question Bank Agent | get_syllabus_topics, find_similar_questions, create_question_draft |
| Assessment Evaluation Agent | get_topic_results, get_wrong_answers, get_misconceptions, find_notes, draft_evaluation_summary, submit_for_mentor_review |
| Practice Agent | select_practice_questions, create_practice_set (only after approval) |
| Integrity Summary Agent | get_session_timeline → writes neutral text into integrity_note (mentor-only) |
`publish_to_candidate_dashboard` is a mentor-triggered endpoint, not an agent tool.

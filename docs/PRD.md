# EduProctor Intelligence — Product Requirements (MVP)

## 1. Purpose
One application where a mentor creates topic-tagged assessments, candidates take them under face
verification and browser-side proctoring, and an AI agent turns results into an Assessment Evaluation
Summary (strong topics, weak topics, recommended topics) that the mentor approves before it is shown
on the candidate's dashboard. Target users: colleges, universities and course providers. Candidates are adults.

## 2. Roles
| Role | Can | Cannot |
|---|---|---|
| Admin | Manage users, courses, notes library, thresholds, retention | Change marks |
| Mentor | Build questions and assessments; accept or skip AI question ideas; assign candidates; watch live flags; view each candidate's red flags and glance log; record decisions on flags; review, edit, approve Assessment Evaluation Summaries; view class analytics | See other mentors' assessments |
| Candidate | Enrol face; open own link; take assessment; see own red-flag counter; see own results and approved recommendations, notes and practice | See glance log, integrity notes, evidence, other candidates |
| AI agent (system) | Read authorised data, draft questions and summaries, retrieve approved notes, publish only after approval | Change marks, edit flags/events, label cheating, publish unapproved content |

## 3. End-to-end flow
1. **Create assessment** — mentor adds topic-tagged questions (topic, subtopic, difficulty, marks, answer, optional misconception tag per wrong option). The Question Bank Agent may suggest questions; each stays in draft until the mentor accepts it. Questions and options can be shuffled; variants per candidate optional.
2. **Send link** — unique, signed, single-use, time-limited link emailed to each candidate's registered email.
3. **Verify and calibrate** — camera check, liveness challenge (blink or turn head on prompt), face match against enrolment (ArcFace cosine similarity), 10–20 s gaze/head-pose calibration. Failed or uncertain match goes to mentor review; mentor decides if the candidate proceeds.
4. **Monitor** — MediaPipe Face Landmarker in the browser computes head pose, gaze, face presence and face count. Browser integrity events: tab switch, fullscreen exit, copy/paste. Only events + evidence snapshots are sent.
5. **Glances and red flags** (see section 4).
6. **Submit and score** — autosave every ≤10 s, server timer is the source of truth, auto-submit only when time ends (never because of flags). Objective questions scored automatically; subjective ones queued for mentor marking.
7. **Evaluate** — topic scores, strong/developing/weak classification, misconceptions, item analysis per question.
8. **Assessment Evaluation Summary** — agent drafts one summary per candidate.
9. **Mentor review and approval** — mandatory. Mentor can edit topics, notes, wording, or ask for a redraft.
10. **Publish** — approved recommended topics, notes and a 5–10 question practice set appear on the candidate dashboard; optional email notice "new recommendations available".
11. **Re-check** — practice score and next assessment show improvement to the mentor.

## 4. Proctoring policy (configurable defaults)
| Look-away duration (head or eyes) | Classified | Candidate sees | Mentor sees |
|---|---|---|---|
| < 1 s | normal | nothing | nothing (not stored) |
| 1 s to < 3 s | **glance** | nothing | glance log entry: wall time, assessment-clock time, type (head/eyes), direction (left/right/up/down), duration |
| ≥ 3 s (flags 1–3) | **red flag** | neutral notice "Flag n of 3 – please keep your eyes on the screen" (auto-hides after ~5 s) + persistent counter | red flag with time, direction, duration, evidence snapshot; live alert |
| ≥ 3 s after flag 3 | **post-limit** | nothing more, counter stays 3 | logged as post-limit; session marked "flag limit reached" |

- One continuous look-away = one event (glance OR flag, never both). The candidate must return to the screen before a new event can start.
- Thresholds: head yaw > ±30° or pitch > ±20° from calibration baseline; gaze outside calibrated screen range. Flag threshold configurable 3–5 s.
- Other events → mentor-only alerts (do not count toward the 3 flags in MVP): FACE_ABSENT (>3 s), MULTIPLE_FACES (≥2 for >2 s), IDENTITY_MISMATCH, LIVENESS_FAIL, TAB_SWITCH (>2 s), FULLSCREEN_EXIT, COPY_PASTE_ATTEMPT (blocked + logged).
- Severity tiers on mentor UI: High (LOOK_AWAY_FLAG, IDENTITY_MISMATCH, LIVENESS_FAIL, MULTIPLE_FACES, FACE_ABSENT > 30 s) → live alert; Medium (repeated TAB_SWITCH) → rising risk; Low (glances, single FULLSCREEN_EXIT, COPY_PASTE) → timeline only.
- Accommodations: per-candidate flag to disable/relax gaze detectors; shown on mentor timeline.
- Camera failure mid-assessment: log CAMERA_UNAVAILABLE, assessment continues, mentor decides.

### Mentor "candidate details" page
Summary line: `Red flags 2 of 3 · Head glances 6 · Eye glances 9 · Other alerts 0`.
Timeline table: time, event, direction, duration, candidate notified (yes/no), evidence link, decision (dismiss / note concern / escalate + comment). Filter by type.

## 5. Evaluation rules
- Topic Score % = marks obtained in topic ÷ max marks in topic × 100.
- Strong topic: ≥ 80%; Weak topic: < 60%; Developing: between. A topic needs ≥ 3 questions to be classified, else "insufficient data".
- Priority = mastery threshold − topic score (higher = more urgent).
- Item analysis per question: difficulty p = correct ÷ attempted; discrimination D = p(top 27%) − p(bottom 27%); distractor share per option. Flag D < 0 or suspected key error to the mentor.
- Misconception: candidate chose options with the same misconception tag ≥ 2 times.

## 6. Assessment Evaluation Summary (schema)
| Section | Content | Shown to candidate after approval |
|---|---|---|
| overall | total score, class percentile, change vs previous | yes |
| strong_topics | topic, score, question count | yes |
| weak_topics | ranked topic, score, wrong question ids | yes |
| misconceptions | plain-language description | yes |
| recommended_topics | priority, reason, note ids (approved library only), practice set | yes |
| data_notes | low question counts, unmarked answers | no |
| integrity_note | red flags n/3, glance counts, open reviews | **never** |

## 7. Candidate dashboard
Upcoming assessments; results with topic chart (strong/developing/weak); mentor-approved recommendations with notes and practice; practice history and re-check scores. No proctoring data.

## 8. Non-functional
- 200 concurrent sessions per deployment; event ingest p95 < 1 s; live alert to mentor < 2 s.
- No answer loss on 5-minute network drop (IndexedDB buffer, idempotent autosave).
- Face embeddings and snapshots encrypted at rest; retention configurable (default 90 days); consent recorded before enrolment; delete on request.
- India DPDP Act 2023: purpose limitation, consent, deletion — confirm with legal before real deployment.
- WCAG 2.2 AA: keyboard navigation, focus states, contrast ≥ 4.5:1 for text.

## 9. Out of scope (MVP)
Automatic disqualification of any kind; school use / under-18 candidates; phone/voice detection (stretch); LMS/LTI integration; continuous video recording.

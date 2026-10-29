---
name: proctoring-engine
description: Browser-side proctoring for EduProctor — MediaPipe Face Landmarker in a Web Worker, calibration, head-pose and gaze look-away detection, glance vs red-flag classification (max 3 flags), integrity events, event upload and server-side re-validation. Use when working on calibration, monitoring, flags, the glance log, proctor_events, the mentor live page or the candidate flag counter.
---

# Proctoring engine

Read `docs/PRD.md` section 4 first. The policy there wins over anything here.

## Hard rules
- Proctoring never pauses, blocks, locks or submits a session. Write a test that asserts this.
- Video frames stay in the browser. Upload only events and, for red flags and high-severity alerts, one JPEG snapshot (≤ 640 px wide, quality 0.7).
- The server is the authority for the flag count. The browser may show a notice optimistically, then re-syncs from `GET /sessions/{id}/flag-status`.
- Candidate-facing code and APIs must never expose glances, events or snapshots.

## Pipeline (apps/web/src/features/proctoring)
1. `camera.ts` — getUserMedia 640×480, handle permission denial and device loss (`CAMERA_UNAVAILABLE` event, assessment continues).
2. `vision.worker.ts` — `@mediapipe/tasks-vision` FaceLandmarker, `runningMode: "VIDEO"`, `numFaces: 2`, `outputFacialTransformationMatrixes: true`. Process ~10 fps (skip frames, don't queue).
3. `signals.ts` — per frame: face count, head yaw/pitch (degrees) from the transformation matrix, gaze ratios from iris landmarks. Smooth with an exponential moving average (α≈0.4).
4. `calibration.ts` — 10–20 s: candidate looks at the four corners and centre; store baseline yaw/pitch and the gaze ratio range that maps to "on screen".
5. `lookAway.ts` — the state machine below. Emits `LOOK_AWAY` events with `{source, direction, startedAt, durationMs}` when a look-away ENDS (or every 1 s while ongoing for the live mentor view).
6. `integrity.ts` — visibilitychange/blur (TAB_SWITCH > 2 s), fullscreenchange (FULLSCREEN_EXIT), copy/cut/paste (prevent + COPY_PASTE_ATTEMPT).
7. `uploader.ts` — batch events every 2 s, IndexedDB buffer when offline, idempotency key per event.

See `reference.md` for landmark indices, angle maths, thresholds, state machine code and test cases.

## Server (apps/api/app/proctoring)
- `POST /sessions/{id}/events` re-validates durations against config; classifies with the same rules (shared constants in `app/core/config.py`):
  `< glance_min_s` drop · `< flag_threshold_s` glance_log · else flag (counter ≤ max_flags) or post-limit.
- Lock the session row (`SELECT … FOR UPDATE`) when incrementing `flag_count` so concurrent batches cannot exceed 3.
- After commit, publish to Redis channel `exam:{exam_id}:alerts`; the mentor WebSocket relays it.
- Accommodations on the session can disable gaze-based detection; record that on the timeline.

## Done when
- Unit tests in `reference.md` → "Test cases" all pass on both the TS state machine and the Python classifier.
- Manual test: look away 2 s → mentor sees a glance, candidate sees nothing; look away 4 s three times → candidate sees "Flag 1/2/3 of 3"; a fourth time → no notice, mentor sees "after limit".

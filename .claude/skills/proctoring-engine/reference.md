# Proctoring reference

## Config defaults (single source: api `app/core/config.py`, mirrored to the web via `GET /exams/{id}/proctoring-config`)
| Key | Default | Notes |
|---|---|---|
| glance_min_s | 1.0 | below = ignored |
| flag_threshold_s | 3.0 | configurable 3–5 |
| max_flags | 3 | candidate notices |
| yaw_limit_deg | 30 | relative to calibration baseline |
| pitch_limit_deg | 20 | relative to baseline |
| face_absent_s | 3 | FACE_ABSENT |
| multi_face_s | 2 | MULTIPLE_FACES |
| tab_switch_s | 2 | TAB_SWITCH |
| return_to_screen_s | 0.5 | must be back on screen this long before a new look-away can start |

## MediaPipe Face Landmarker landmarks (478-point model)
- Iris centres: right eye 468, left eye 473 (iris rings 468–472 and 473–477).
- Right eye corners: 33 (outer), 133 (inner); lids 159 (upper), 145 (lower).
- Left eye corners: 362 (inner), 263 (outer); lids 386 (upper), 374 (lower).
- Horizontal gaze ratio = (iris.x − cornerA.x) / (cornerB.x − cornerA.x), averaged over both eyes; vertical ratio from lids the same way.
- "Eyes off screen" = ratio outside the calibrated range (+ a small margin) while the head is within limits.
- "Head turned" = |yaw − baseline_yaw| > yaw_limit OR |pitch − baseline_pitch| > pitch_limit.
- Head angles: take the 3×3 rotation part of `facialTransformationMatrixes[0]` and convert to Euler angles. Sign conventions differ by camera mirroring — that is why everything is measured relative to the calibration baseline. Verify with a quick debug overlay that turning left/right changes yaw and nodding changes pitch.
- Looking down = pitch beyond limit downward AND vertical gaze ratio low; report direction "down".

## Look-away state machine (TypeScript sketch)
A look-away only ends after the candidate has been back on screen for `return_to_screen_s`;
a shorter return is treated as part of the same look-away (debounce). This makes test 5 and test 9 pass.
```ts
type Source = "head" | "eyes";
type State =
  | { phase: "on" }
  | { phase: "away"; since: number; source: Source; direction: Dir; returnAt?: number };

function step(s: State, now: number, away: boolean, src: Source, dir: Dir, cfg = CFG): [State, LookAwayEvent?] {
  if (s.phase === "on") {
    return away ? [{ phase: "away", since: now, source: src, direction: dir }] : [s];
  }
  if (away) {
    // still (or again) away: cancel any pending return; head wins over eyes as source
    const source = s.source === "head" || src === "head" ? "head" : "eyes";
    return [{ ...s, source, returnAt: undefined }];
  }
  const returnAt = s.returnAt ?? now;
  if (now - returnAt < cfg.return_to_screen_s * 1000) return [{ ...s, returnAt }];
  const durationMs = returnAt - s.since;               // time actually spent away
  if (durationMs < cfg.glance_min_s * 1000) return [{ phase: "on" }];
  return [{ phase: "on" }, { source: s.source, direction: s.direction, startedAt: s.since, durationMs }];
}
```
Classification (shared logic, also in Python):
```
classify(durationMs, flagCount):
  if durationMs < glance_min: "ignore"
  if durationMs < flag_threshold: "glance"
  if flagCount < max_flags: "flag"
  return "post_limit"
```
Show the candidate notice as soon as an ongoing look-away crosses flag_threshold (don't wait for it to end); the event is finalised with the full duration when it ends.

## Event payload
```json
{ "client_event_id": "uuid", "type": "LOOK_AWAY", "source": "head", "direction": "right",
  "started_at": "2026-11-02T10:04:12.480Z", "duration_ms": 3800, "exam_clock_ms": 577000,
  "snapshot_b64": "...optional, flags/high severity only..." }
```

## Test cases (must pass in TS and Python)
| # | Input | Expected |
|---|---|---|
| 1 | look-away 0.8 s | nothing stored |
| 2 | look-away 1.0 s | glance |
| 3 | look-away 2.9 s | glance |
| 4 | look-away 3.0 s, flags=0 | flag #1, candidate notified |
| 5 | one continuous look-away of 12 s | exactly one flag |
| 6 | 4 look-aways of 4 s | flags #1–3 notified, 4th = post_limit, not notified, flag_limit_reached=true |
| 7 | two batches arrive concurrently each with a flag at flags=2 | final flag_count = 3, one post_limit |
| 8 | any number of flags | session status unchanged, still in_progress |
| 9 | look-away 1.5 s, then back 0.2 s, then away 2 s | merged into one 3.7 s look-away → flag (return_to_screen_s not met) |
| 10 | candidate GET /flag-status | returns only {flag_count, max_flags} |

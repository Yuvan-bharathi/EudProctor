# Manual test: identity and liveness (Phase 4)

Acceptance: a printed photo and a phone-screen photo fail liveness; a genuine user passes within 2 attempts.

## Setup
- API with the real engine: install the identity extra (`insightface`, `onnxruntime`) and set `IDENTITY_ENGINE=insightface`.
  The default `dev` engine is a pixel comparison for development only and is **not** face recognition, so
  run the matching checks below with InsightFace.
- Web app on a laptop with a webcam, good front lighting. Seed data: `candidate01@example.com` / `eduproctor-dev`.
- Assign `candidate01` to an assessment and send the link (Mailpit at http://localhost:8025, or the file outbox in
  `apps/api/storage/outbox` when SMTP is not running).

## Cases

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 1 | Genuine user | Open the link, accept consent, enrol 3 photos, press *Start check*, follow the prompt (blink twice / turn head and back). | Passes on attempt 1 or 2. Page moves to *Identity confirmed*. Mentor queue stays empty. |
| 2 | Printed photo | Enrol as the genuine user. On the identity check, hold a printed photo of the same person in front of the camera. | Blink challenge never completes, or the server reports `frames static`. After 2 attempts the page shows *Waiting for your mentor*. The mentor queue shows the check with *Liveness not passed*. |
| 3 | Phone-screen photo | As case 2, with a photo shown on a phone screen. | As case 2. Glare and moiré also tend to lower similarity. |
| 4 | Different person | Enrol as person A, let person B take the check. | Liveness may pass; similarity is below `IDENTITY_UNCERTAIN_THRESHOLD`. After 2 attempts it goes to mentor review. |
| 5 | Mentor allows | In *Identity reviews*, choose *Allow start* with a comment. | The candidate page moves to *Identity confirmed* within about 5 s. An audit_log row `identity.review_decision` exists. |
| 6 | Mentor blocks | Choose *Do not allow start*. | The candidate sees *Your mentor needs to speak with you*. No automatic block happened before the mentor's decision. |
| 7 | Random check mismatch | During the assessment, swap in another person when a random check runs. | The assessment continues without any message to the candidate. The mentor queue shows a *random check* card. |
| 8 | Camera denied | Block camera permission. | A clear message explains how to allow the camera; nothing is uploaded. |
| 9 | Network panel | Watch DevTools > Network during cases 1–7. | Only small JPEG crops (≤ 224 px) in JSON bodies; no video or media streams leave the browser. |
| 10 | Delete on request | As the candidate, call `DELETE /api/v1/identity/enrolment`. | The face profile row and its encrypted blob are removed. |

Record the date, browser, camera, lighting and outcome for each case.

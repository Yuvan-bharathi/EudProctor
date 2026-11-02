# Candidate Invitation & Assessment Access End-to-End Testing Guide
## Automated Verification Suite & Test Evidence Documentation

---

## 1. Overview
The **EduProctor Candidate Invitation End-to-End Test Suite** (`apps/api/tests/test_invitation_e2e.py`) validates the complete lifecycle of assessment invitations across all microservices and database stores without mocks or fabricated state.

The suite executes 10 sequential integration tests that simulate both the mentor's authoring actions and the candidate's access flow.

---

## 2. Test Prerequisites & Required Services

Before running the test suite, ensure the following background processes are active:

| Service | Host & Port | Launch Command | Role in Test |
|---|---|---|---|
| **Node.js Email Service** | `http://127.0.0.1:5050` | `cd apps/email-service && node src/server.js` | Receives dispatch request, formats MIME email, connects to SMTP. |
| **FastAPI Backend & Devserver** | `http://127.0.0.1:8000` | `cd apps/api && python -m app.devserver` | Executes LangGraph agent, provisions tokens, handles join redemption. |
| **Embedded Dev SMTP** | `127.0.0.1:1025` | *Started automatically by devserver* | Receives SMTP transactions from Nodemailer and returns `250 OK`. |
| **Interactive Web Mailbox** | `http://localhost:8025` | *Started automatically by devserver* | Exposes received emails via `/api/emails` for automated inspection. |
| **Frontend Web Client** | `http://localhost:5173` | `cd apps/web && pnpm dev --host` | Host for candidate join URLs. |

---

## 3. Test Execution Command

Run the automated test runner using Python 3.12:

```powershell
cd apps/api
.venv_app/Scripts/python.exe tests/test_invitation_e2e.py
```

---

## 4. Test Scenarios & Assertion Specifications

### Test 1: Node.js Nodemailer Microservice Healthcheck
- **Endpoint**: `GET http://127.0.0.1:5050/health`
- **Assertions**:
  - HTTP Status Code must equal `200`.
  - JSON property `engine` must equal `"nodemailer"`.
  - JSON property `smtp.connected` must equal `true`.
- **Purpose**: Verifies that the Node.js process is active and has established an active socket with the local SMTP MTA (`127.0.0.1:1025`).

### Test 2: FastAPI Backend Healthcheck
- **Endpoint**: `GET http://127.0.0.1:8000/api/v1/health`
- **Assertions**:
  - HTTP Status Code must equal `200`.
  - JSON property `status` must equal `"ok"`.
- **Purpose**: Confirms that database connections and the core FastAPI application are operational.

### Test 3: Development Mailbox Accessibility
- **Endpoint**: `GET http://localhost:8025/api/emails`
- **Assertions**:
  - HTTP Status Code must equal `200`.
  - Response must be a valid JSON array.
- **Purpose**: Verifies that the local email capture interface is ready to receive emails.

### Test 4: Mentor Authentication
- **Endpoint**: `POST http://127.0.0.1:8000/api/v1/auth/login`
- **Payload**: `{"email": "mentor1@example.com", "password": "eduproctor-dev"}`
- **Assertions**:
  - HTTP Status Code must equal `200`.
  - Response must contain a valid `access_token` JWT.
- **Purpose**: Obtains an authenticated Bearer token required to trigger exam-authoring actions.

### Test 5: Invitation Dispatch via LangGraph Agent + Nodemailer
- **Endpoint**: `POST http://127.0.0.1:8000/api/v1/exams/1fd0676c-06c4-48e5-9b49-24f510579724/send-links`
- **Payload**: `{"force_resend": true}`
- **Assertions**:
  - HTTP Status Code must equal `200`.
  - `cand_assignment["invitation_status"]` must equal `"Sent"`.
  - `cand_assignment["delivery_status"]` must equal `"Delivered"`.
  - `delivery_metadata["provider"]` must contain `"nodemailer"`.
  - `delivery_metadata["smtp_response"]` must contain `"250 2.0.0 Ok: queued"`.
- **Purpose**: Confirms that the LangGraph agent orchestrated token creation, passed data to the Node.js email service, and received confirmed delivery acknowledgment from the SMTP transport.

### Test 6: HTML Email Inspection & Token Extraction
- **Endpoint**: `GET http://localhost:8025/api/emails`
- **Assertions**:
  - Latest message recipient must match `tanu.shree@gmail.com`.
  - Email HTML body must contain the CTA button `"Start Assessment"`.
  - Email HTML body must contain proctoring guidelines (`"Pre-Checks"`).
  - Join URL must match the format `http://localhost:5173/join/<token>`.
- **Purpose**: Proves that the candidate receives a correctly branded email with valid parameters and instructions.

### Test 7: Candidate Invitation Redemption
- **Endpoint**: `POST http://127.0.0.1:8000/api/v1/join/<extracted_token>`
- **Assertions**:
  - HTTP Status Code must equal `200`.
  - `exam_title` must match `"Java Script"`.
  - `session_id` must be a valid UUID.
  - `user.role` must equal `"candidate"`.
  - Valid `access_token` and `refresh_token` are provisioned.
- **Purpose**: Confirms that redeeming the token claims candidate identity and initializes an active exam session.

### Test 8: Duplicate Link Click (Session Resumption)
- **Endpoint**: `POST http://127.0.0.1:8000/api/v1/join/<extracted_token>` (Repeated)
- **Assertions**:
  - HTTP Status Code must equal `200`.
  - Returned `session_id` must match the previous session ID.
- **Purpose**: Verifies that if a candidate re-opens their link during an active attempt, they are seamlessly re-authenticated rather than locked out with a `410 Gone` error.

### Test 9: Invalid Token Rejection
- **Endpoint**: `POST http://127.0.0.1:8000/api/v1/join/completely-fake-token-xyz-12345`
- **Assertions**:
  - HTTP Status Code must equal `404 Not Found`.
- **Purpose**: Proves that arbitrary or tampered tokens cannot access any examination or candidate data.

### Test 10: Mentor Workspace Telemetry Verification
- **Endpoint**: `GET http://127.0.0.1:8000/api/v1/exams/1fd0676c-06c4-48e5-9b49-24f510579724`
- **Assertions**:
  - `assigned["invitation_status"]` must equal `"Accepted"`.
  - `assigned["delivery_status"]` must equal `"Delivered"`.
  - `assigned["link_used_at"]` must have a non-null ISO timestamp.
- **Purpose**: Verifies that the mentor's dashboard accurately updates with real backend database state.

---

## 5. Actual Recorded Test Evidence

The following output was captured during live execution on Windows:

```text
======================================================================
EDUPROCTOR E2E CANDIDATE INVITATION & ACCESS TEST SUITE
======================================================================

[TEST 1] Checking Node.js Nodemailer Service (:5050/health)...
  -> PASSED: Node.js Nodemailer microservice is healthy & connected to SMTP.

[TEST 2] Checking FastAPI Backend (:8000/api/v1/health)...
  -> PASSED: Backend is healthy (status: ok).

[TEST 3] Checking Dev Mailbox (:8025/api/emails)...
  -> PASSED: Mailbox accessible (currently holds 3 emails).

[TEST 4] Authenticating as Mentor (mentor1@example.com)...
  -> PASSED: Mentor authenticated. JWT: eyJhbGciOiJIUzI1NiIs...

[TEST 5] Triggering Send Invitations on Exam 1fd0676c-06c4-48e5-9b49-24f510579724...
  -> Debug cand_assignment: {
       'id': '72769d0f-0397-4a13-8039-a9e9c88bed95',
       'candidate_id': 'cfdb8cd6-f817-4b0b-8641-8f9d929c2919',
       'candidate_name': 'Tanushree',
       'candidate_email': 'tanu.shree@gmail.com',
       'link_sent_at': '2026-11-02T04:58:57Z',
       'link_used_at': None,
       'link_expires_at': '2026-11-05T04:58:57Z',
       'accommodations': {
         'delivery_metadata': {
           'delivered': True,
           'delivered_at': '2026-11-02T04:58:58.033Z',
           'error': None,
           'is_test': False,
           'original_recipient': 'tanu.shree@gmail.com',
           'provider': 'nodemailer (<1793595538023.1abcb243b4eb3761@eduproctor.intelligence>)',
           'recipient': 'tanu.shree@gmail.com',
           'smtp_response': '250 2.0.0 Ok: queued',
           'status': 'Delivered'
         },
         'invitation_sent_at': '2026-11-02T04:58:57.222989+00:00',
         'invitation_status': 'Sent',
         'latest_join_url': 'http://localhost:5173/join/9Slfhcjswwbl4HctoQUHAwupbIuEDBozp18ApD35H0o',
         'updated_at': '2026-11-02T04:58:58.035227+00:00'
       },
       'invitation_status': 'Sent',
       'delivery_status': 'Delivered'
     }
  -> PASSED: Invitation dispatched to tanu.shree@gmail.com.
  -> Delivery Provider: nodemailer (<1793595538023.1abcb243b4eb3761@eduproctor.intelligence>)
  -> SMTP Response: 250 2.0.0 Ok: queued

[TEST 6] Inspecting Dev Mailbox for delivered HTML email...
  -> PASSED: Verified email delivered with responsive HTML and instructions.
  -> Extracted Single-Use Token: 9Slfhcjswwbl4HctoQUHAwupbIuEDBozp18ApD35H0o

[TEST 7] Candidate clicks 'Start Assessment' (POST /api/v1/join/9Slfhcjswwbl4Hc...)...
  -> PASSED: Candidate authenticated successfully as Tanushree.
  -> Created Exam Session: 09d524f9-82fc-4de4-8cf8-82f19f8b7b4e

[TEST 8] Candidate clicks the link again (Duplicate click test)...
  -> PASSED: Duplicate click gracefully resumed active session without 410 error.

[TEST 9] Candidate clicks an invalid/tampered token...
  -> PASSED: Unauthorized / invalid tokens rejected with 404 Not Found.

[TEST 10] Verifying Mentor Workspace Telemetry for Exam 1fd0676c-06c4-48e5-9b49-24f510579724...
  -> PASSED: Mentor dashboard updated with actual backend data:
     - Candidate: Tanushree (tanu.shree@gmail.com)
     - Invitation Status: Accepted
     - MTA Delivery Status: Delivered
     - Link Sent At: 2026-11-02T04:58:57Z
     - Link Redeemed At: 2026-11-02T04:59:01Z

======================================================================
ALL 10 TESTS PASSED SUCCESSFULLY! WORKFLOW FULLY VERIFIED.
======================================================================
```

---

## 6. Edge Cases Verified in Codebase

| Scenario | Tested In | Behavior |
|---|---|---|
| **Zero Questions Blocker** | `invitation_agent.py` line 199 | If an exam has 0 questions, invitation dispatch aborts immediately with a 409 error. |
| **Exam Closed Blocker** | `invitation_agent.py` line 192 | If an exam status is `closed`, dispatch is skipped. |
| **Duplicate Candidate Click** | `links.py` line 66 | Checks whether the candidate's existing session is active. If active, resumes without 410 lockout. |
| **Tampered / Fake Token** | `links.py` line 58 | Hash mismatch returns `404 Not Found ("This link is not valid.")`. |
| **Expired Link** | `links.py` line 70 | Returns `410 Gone ("This link has expired.")`. |
| **Revoked Invitation** | `exams.py` line 348 | Clears `link_token_hash` and sets status to `Revoked`. Link can no longer be redeemed. |


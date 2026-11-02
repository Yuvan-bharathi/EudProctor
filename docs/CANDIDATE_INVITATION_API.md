# EduProctor Candidate Invitation & Assessment Access API Reference
## Complete REST API Specification for FastAPI Backend and Node.js Email Microservice

---

## 1. Overview & Service Base URLs

| Service | Base URL | Technology | Responsibility |
|---|---|---|---|
| **EduProctor API Gateway** | `http://127.0.0.1:8000/api/v1` | FastAPI / Python | Core exam lifecycle, token generation, candidate join verification. |
| **Email Microservice** | `http://127.0.0.1:5050` | Node.js / Nodemailer | MIME email formatting, SMTP transmission, delivery tracking. |
| **Dev Mailbox & SMTP** | `http://localhost:8025` | Python RFC 5321 | Local SMTP inbox interface for inspecting dispatched test invitations. |

---

## 2. Authentication & Authorization Models

1. **Mentor / Administrator Endpoints**:
   - Requires HTTP Header: `Authorization: Bearer <JWT_ACCESS_TOKEN>`.
   - Token must carry claim `role: "mentor"` or `role: "admin"`.
2. **Candidate Join Endpoint (`/join/:token`)**:
   - **Publicly Accessible**: Authentication is authorized cryptographically via the single-use 32-byte URL-safe token.
   - Successful redemption provisions candidate session JWTs (`access_token` and `refresh_token`).

---

## 3. FastAPI Backend Endpoints

### 3.1 Batch Dispatch Assessment Invitations
`POST /api/v1/exams/{exam_id}/send-links`

Triggers the **LangGraph Assessment Invitation Agent** to validate candidates, generate cryptographic HMAC-SHA256 tokens, compute expiration timestamps, and dispatch emails via the Node.js Nodemailer microservice.

- **Authentication**: Bearer Token (Mentor / Admin).
- **URL Parameters**:
  - `exam_id` (UUID): Unique identifier of the assessment.
- **Request Body**:
  ```json
  {
    "candidate_ids": null,
    "force_resend": false,
    "test_mode": false,
    "test_recipient": null
  }
  ```
  *Pass `"candidate_ids": ["uuid1", "uuid2"]` to filter specific candidates, or `null` to dispatch to all enrolled candidates. Set `"force_resend": true` to regenerate tokens for candidates who already received links.*

- **Response (`200 OK`)**:
  ```json
  [
    {
      "id": "72769d0f-0397-4a13-8039-a9e9c88bed95",
      "candidate_id": "cfdb8cd6-f817-4b0b-8641-8f9d929c2919",
      "candidate_name": "Tanushree",
      "candidate_email": "tanu.shree@gmail.com",
      "link_sent_at": "2026-11-02T04:58:57Z",
      "link_used_at": null,
      "link_expires_at": "2026-11-05T04:58:57Z",
      "invitation_status": "Sent",
      "delivery_status": "Delivered",
      "accommodations": {
        "delivery_metadata": {
          "delivered": true,
          "delivered_at": "2026-11-02T04:58:58.033Z",
          "error": null,
          "provider": "nodemailer (<1793595538023.1abcb243b4eb3761@eduproctor.intelligence>)",
          "recipient": "tanu.shree@gmail.com",
          "smtp_response": "250 2.0.0 Ok: queued",
          "status": "Delivered"
        },
        "invitation_sent_at": "2026-11-02T04:58:57.222989+00:00",
        "invitation_status": "Sent",
        "latest_join_url": "http://localhost:5173/join/9Slfhcjswwbl4HctoQUHAwupbIuEDBozp18ApD35H0o"
      }
    }
  ]
  ```

- **HTTP Status Codes**:
  - `200 OK`: Invitations dispatched successfully.
  - `401 Unauthorized`: Missing or invalid Bearer token.
  - `403 Forbidden`: User is not a mentor or does not own the exam.
  - `404 Not Found`: Assessment does not exist.
  - `409 Conflict`: Assessment has 0 questions assigned or is closed.

---

### 3.2 Resend Single Candidate Invitation
`POST /api/v1/exams/{exam_id}/candidates/{candidate_id}/resend-invitation`

Issues a fresh single-use token and resends the invitation email to one enrolled candidate.

- **Authentication**: Bearer Token (Mentor / Admin).
- **URL Parameters**:
  - `exam_id` (UUID): Assessment ID.
  - `candidate_id` (UUID): Candidate User ID.
- **Request Body**: None (Empty).
- **Response (`200 OK`)**: `AssignmentOut` object with fresh `link_sent_at` and updated `latest_join_url`.

---

### 3.3 Revoke Candidate Invitation
`POST /api/v1/exams/{exam_id}/candidates/{candidate_id}/revoke-invitation`

Revokes an outstanding single-use invitation. Invalidates the token hash so the link can no longer be redeemed.

- **Authentication**: Bearer Token (Mentor / Admin).
- **URL Parameters**:
  - `exam_id` (UUID): Assessment ID.
  - `candidate_id` (UUID): Candidate User ID.
- **Request Body**: None (Empty).
- **Response (`200 OK`)**:
  ```json
  {
    "id": "72769d0f-0397-4a13-8039-a9e9c88bed95",
    "invitation_status": "Revoked",
    "link_sent_at": null,
    "link_used_at": null
  }
  ```

---

### 3.4 Redeem Candidate Invitation Token
`POST /api/v1/join/{token}`

Redeems a single-use token from the candidate's invitation link. Verifies token validity, marks `link_used_at`, provisions an `ExamSession`, and returns candidate JWT credentials.

- **Authentication**: Public (Cryptographic token parameter).
- **URL Parameters**:
  - `token` (string): 32-byte URL-safe cryptographic token.
- **Request Body**: Empty `{}`.
- **Response (`200 OK`)**:
  ```json
  {
    "assignment_id": "72769d0f-0397-4a13-8039-a9e9c88bed95",
    "exam_id": "1fd0676c-06c4-48e5-9b49-24f510579724",
    "exam_title": "Java Script",
    "duration_min": 60,
    "session_id": "09d524f9-82fc-4de4-8cf8-82f19f8b7b4e",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "cfdb8cd6-f817-4b0b-8641-8f9d929c2919",
      "role": "candidate",
      "name": "Tanushree",
      "email": "tanu.shree@gmail.com",
      "is_active": true
    }
  }
  ```
- **Error Codes**:
  - `404 Not Found`: `"This link is not valid."`
  - `409 Conflict`: `"This assessment has not opened yet."`
  - `410 Gone`: `"This link has expired."` or `"This link has already been used."` *(Active ongoing sessions bypass 410 and resume cleanly).*

---

### 3.5 Retrieve Exam & Telemetry Roster
`GET /api/v1/exams/{exam_id}`

Returns assessment details, questions, and the complete enrolled candidate roster including live invitation and delivery metadata.

- **Authentication**: Bearer Token (Mentor / Admin).
- **Response (`200 OK`)**:
  ```json
  {
    "id": "1fd0676c-06c4-48e5-9b49-24f510579724",
    "title": "Java Script",
    "duration_min": 60,
    "status": "scheduled",
    "assignments": [
      {
        "id": "72769d0f-0397-4a13-8039-a9e9c88bed95",
        "candidate_id": "cfdb8cd6-f817-4b0b-8641-8f9d929c2919",
        "candidate_name": "Tanushree",
        "candidate_email": "tanu.shree@gmail.com",
        "link_sent_at": "2026-11-02T04:58:57Z",
        "link_used_at": "2026-11-02T04:59:01Z",
        "invitation_status": "Accepted",
        "delivery_status": "Delivered"
      }
    ]
  }
  ```

---

## 4. Node.js Nodemailer Microservice Endpoints (`:5050`)

### 4.1 Dispatch Candidate Invitation Email
`POST /send-invitation`

Constructs responsive HTML and plain-text MIME emails and transmits them through the Nodemailer SMTP transport.

- **Authentication**: None (Internal service-to-service communication).
- **Request Headers**: `Content-Type: application/json`.
- **Request Body**:
  ```json
  {
    "to": "tanu.shree@gmail.com",
    "candidateName": "Tanushree",
    "assessmentTitle": "Java Script",
    "domain": "Technical Assessment",
    "durationMin": 60,
    "deadline": "2026-11-05 18:00 UTC",
    "joinUrl": "http://localhost:5173/join/9Slfhcjswwbl4HctoQUHAwupbIuEDBozp18ApD35H0o",
    "assignmentId": "72769d0f-0397-4a13-8039-a9e9c88bed95"
  }
  ```

- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "messageId": "<1793595538023.1abcb243b4eb3761@eduproctor.intelligence>",
    "status": "Delivered",
    "smtpResponse": "250 2.0.0 Ok: queued",
    "accepted": ["tanu.shree@gmail.com"],
    "rejected": [],
    "deliveredAt": "2026-11-02T04:58:58.033Z",
    "recipient": "tanu.shree@gmail.com"
  }
  ```

- **Error Codes**:
  - `400 Bad Request`: Missing required parameter `to`.
  - `500 Internal Server Error`: SMTP connection refused or transport rejected.

---

### 4.2 Microservice Health & SMTP Verification
`GET /health`

Performs active verification of the Nodemailer SMTP socket connection.

- **Response (`200 OK`)**:
  ```json
  {
    "status": "healthy",
    "service": "eduproctor-email-service",
    "engine": "nodemailer",
    "smtp": {
      "host": "127.0.0.1",
      "port": 1025,
      "connected": true,
      "error": null
    },
    "timestamp": "2026-11-02T04:37:48.379Z"
  }
  ```

---

### 4.3 Check Message Delivery Status
`GET /delivery-status/{messageId}`

Queries the delivery store for the lifecycle history of a specific message ID.

- **Response (`200 OK`)**:
  ```json
  {
    "messageId": "<1793595538023.1abcb243b4eb3761@eduproctor.intelligence>",
    "assignmentId": "72769d0f-0397-4a13-8039-a9e9c88bed95",
    "to": "tanu.shree@gmail.com",
    "candidateName": "Tanushree",
    "assessmentTitle": "Java Script",
    "status": "Delivered",
    "queuedAt": "2026-11-02T04:58:57.900Z",
    "sentAt": "2026-11-02T04:58:58.033Z",
    "deliveredAt": "2026-11-02T04:58:58.033Z",
    "smtpResponse": "250 2.0.0 Ok: queued"
  }
  ```

---

### 4.4 Inbound Provider Webhook
`POST /webhook`

Accepts delivery receipts and bounce events from external transactional mail providers (e.g., SendGrid, Resend, Mailgun).

- **Request Body**:
  ```json
  {
    "messageId": "<1793595538023.1abcb243b4eb3761@eduproctor.intelligence>",
    "eventType": "bounce",
    "reason": "550 5.1.1 User unknown"
  }
  ```
- **Response (`200 OK`)**: `{"received": true, "eventType": "bounce"}`.

---

### 4.5 Inspect Delivery Audit Logs
`GET /logs`

Returns the 50 most recent email dispatch events recorded by the microservice.

- **Response (`200 OK`)**:
  ```json
  {
    "count": 1,
    "logs": [
      {
        "messageId": "<1793595538023.1abcb243b4eb3761@eduproctor.intelligence>",
        "to": "tanu.shree@gmail.com",
        "status": "Delivered",
        "deliveredAt": "2026-11-02T04:58:58.033Z"
      }
    ]
  }
  ```


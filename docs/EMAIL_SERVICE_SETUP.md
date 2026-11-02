# Node.js Nodemailer Email Microservice Setup & Configuration Guide
## EduProctor Intelligence Assessment Invitation Subsystem

---

## 1. Overview
The **EduProctor Email Microservice** (`apps/email-service`) is a lightweight, dedicated Node.js service responsible for formatting, queuing, transmitting, and auditing candidate examination invitations via **Nodemailer SMTP transport**.

It decouples email transmission from the Python FastAPI backend, ensuring:
- Non-blocking asynchronous email processing.
- RFC-compliant MIME multi-part generation (HTML + Plain-Text fallback).
- Real-time tracking of message submission, delivery acknowledgments, and bounce handling.
- Zero credential hardcoding: 100% configuration via environment variables.

---

## 2. Directory Structure
```text
apps/email-service/
├── data/
│   └── delivery_logs.json     # Persisted delivery logs and webhook receipts
├── src/
│   ├── config.js              # Environment variable parsing and SMTP resolution
│   ├── deliveryStore.js       # Lifecycle tracking: Queued, Sent, Delivered, Failed, Bounced
│   ├── mailer.js              # Nodemailer transporter initialization and dispatch wrapper
│   ├── server.js              # HTTP REST API server on port 5050
│   └── templates.js           # Responsive HTML & plain-text email layouts
├── package.json               # Dependencies (nodemailer, dotenv)
└── package-lock.json
```

---

## 3. Prerequisites
- **Node.js**: v20.0.0 or later (verified with v20.20.2).
- **npm**: v10.0.0 or later (verified with v10.8.2).
- **SMTP Server**: 
  - **Local Development**: Built-in EduProctor Dev Mail Server (`127.0.0.1:1025`) or Mailpit.
  - **Production**: Authenticated SMTP provider (e.g., Resend, SendGrid, Amazon SES, or Gmail SMTP with App Passwords).

---

## 4. Installation Steps

### Step 1: Navigate to the Microservice Directory
```bash
cd apps/email-service
```

### Step 2: Install Required Dependencies
```bash
npm install
```

Installed packages:
- `nodemailer`: RFC-compliant email delivery engine.
- `dotenv`: Secure environment variable loading from `.env`.

---

## 5. Environment Configuration

The microservice automatically loads `.env` from the project root (`../../.env`) or a local `.env` file in `apps/email-service/.env`.

### 5.1 Local Development Configuration (`.env`)
```env
# Email Microservice Port
EMAIL_SERVICE_PORT=5050
EMAIL_SERVICE_URL=http://127.0.0.1:5050

# Local Embedded SMTP Server (EduProctor Dev Server on port 1025)
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="EduProctor Intelligence <no-reply@eduproctor.example.com>"
```

### 5.2 Production Configuration Examples

#### Option A: Resend SMTP
```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=re_your_api_key_here
EMAIL_FROM="EduProctor Examinations <examinations@yourdomain.com>"
```

#### Option B: Gmail SMTP (App Password)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-address@gmail.com
SMTP_PASS=your-16-char-app-password
EMAIL_FROM="EduProctor Admissions <your-address@gmail.com>"
```

> [!CAUTION]
> Never commit actual passwords, API keys, or `.env` files to version control. The repository `.gitignore` includes `.env` and `.env.*` to protect sensitive credentials.

---

## 6. Running the Microservice

### Standalone Local Execution
```bash
cd apps/email-service
node src/server.js
```

### Expected Startup Output
```text
[EmailService] Node.js Nodemailer microservice listening on http://0.0.0.0:5050
[EmailService] Configured SMTP -> 127.0.0.1:1025
```

---

## 7. Service Verification & API Healthcheck

### Check Microservice & SMTP Connection Status
```bash
curl -s http://127.0.0.1:5050/health
```

#### Healthy Response (`200 OK`)
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

## 8. Testing Email Dispatch Manually

Execute an HTTP POST to test email formatting and delivery:

```powershell
$body = @{
  to = "candidate@example.com"
  candidateName = "Alex Rivera"
  assessmentTitle = "Full Stack Applied Concepts"
  domain = "Frontend & Backend Systems"
  durationMin = 60
  deadline = "2026-11-10 18:00 UTC"
  joinUrl = "http://localhost:5173/join/test-token-abc"
  assignmentId = "assign-001"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:5050/send-invitation" -Method Post -ContentType "application/json" -Body $body
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "messageId": "<1793595538023.1abcb243b4eb3761@eduproctor.intelligence>",
  "status": "Delivered",
  "smtpResponse": "250 2.0.0 Ok: queued",
  "accepted": ["candidate@example.com"],
  "rejected": [],
  "deliveredAt": "2026-11-02T04:58:58.033Z",
  "recipient": "candidate@example.com"
}
```

---

## 9. Delivery Verification & Audit Logs

The service persists all dispatched messages and their statuses in `apps/email-service/data/delivery_logs.json`.

- **Retrieve Recent Logs**:
  ```bash
  curl -s http://127.0.0.1:5050/logs
  ```
- **Inspect Specific Message Delivery**:
  ```bash
  curl -s http://127.0.0.1:5050/delivery-status/<messageId>
  ```

---

## 10. Troubleshooting

| Error | Cause | Solution |
|---|---|---|
| `connect ECONNREFUSED ::1:1025` | Node.js attempted to connect to IPv6 `::1` instead of IPv4 `127.0.0.1`. | Ensure `SMTP_HOST=127.0.0.1` is set in `.env` (handled in `config.js`). |
| `EADDRINUSE: address already in use :::5050` | Another process is occupying port 5050. | Terminate the existing process using `netstat -ano \| findstr :5050` or change `EMAIL_SERVICE_PORT` in `.env`. |
| `Invalid login: 535-5.7.8 Username and Password not accepted` | Incorrect SMTP credentials or 2-Step Verification app password missing. | Verify username/password in `.env`. For Gmail, generate a 16-character App Password. |
| `Connection timeout after 10000ms` | Outbound port blocked by firewall or ISP. | In local testing, ensure the local devserver is running. In production, use port 465 (SSL) or 587 (TLS). |


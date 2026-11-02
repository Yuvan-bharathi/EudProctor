"""Outgoing email service.

Supports:
- SMTP (Mailpit or transactional SMTP)
- File outbox fallback (when SMTP is unavailable in dev)
- In-memory outbox (for automated unit/integration tests)
- Multipart HTML and Plain-Text emails
- YOPmail and Development Test Inbox Routing with safety guards (disabled in production)
"""

import logging
import smtplib
import uuid
from dataclasses import dataclass
from email.message import EmailMessage
from pathlib import Path
from typing import Any

from app.core.config import get_settings

log = logging.getLogger(__name__)


@dataclass
class SentMail:
    to: str
    subject: str
    body: str
    html_body: str | None = None
    is_test: bool = False
    original_to: str | None = None


# Memory backend (tests)
OUTBOX: list[SentMail] = []


def _build_message(
    to: str,
    subject: str,
    body: str,
    html_body: str | None = None,
    original_to: str | None = None,
) -> EmailMessage:
    msg = EmailMessage()
    s = get_settings()
    from_addr = s.email_from_address or s.mail_from
    msg["From"] = from_addr
    msg["To"] = to
    msg["Subject"] = subject
    if original_to and original_to != to:
        msg["X-Original-To"] = original_to
        msg["X-EduProctor-Test-Mode"] = "true"

    # Set plain text content
    msg.set_content(body)

    # Attach HTML alternative if provided
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    return msg


def _write_file(msg: EmailMessage) -> str:
    outbox = Path(get_settings().storage_dir) / "outbox"
    outbox.mkdir(parents=True, exist_ok=True)
    msg_id = f"{uuid.uuid4().hex}.eml"
    file_path = outbox / msg_id
    file_path.write_bytes(bytes(msg))
    return str(file_path)


BREVO_URL = "https://api.brevo.com/v3/smtp/email"


def _send_brevo(
    to: str, original_to: str, subject: str, body: str, html_body: str | None,
    candidate_name: str | None, is_test: bool,
) -> dict[str, Any]:
    """Send via Brevo's transactional email API (POST /v3/smtp/email, `api-key` header)."""
    import json as _json
    import urllib.error
    import urllib.request

    s = get_settings()
    base = {"recipient": to, "original_recipient": original_to, "is_test": is_test, "provider": "brevo-api"}
    if not s.brevo_api_key:
        return {**base, "delivered": False, "status": "Failed",
                "error": "MAIL_BACKEND=brevo but BREVO_API_KEY is not set."}
    sender_email = s.email_from_address or s.mail_from
    payload: dict[str, Any] = {
        "sender": {"name": s.mail_from_name, "email": sender_email},
        "to": [{"email": to, **({"name": candidate_name} if candidate_name and to == original_to else {})}],
        "subject": subject,
    }
    # Brevo takes one body type per request: HTML when we have it, otherwise plain text.
    if html_body:
        payload["htmlContent"] = html_body
    else:
        payload["textContent"] = body
    req = urllib.request.Request(
        BREVO_URL,
        data=_json.dumps(payload).encode(),
        headers={"api-key": s.brevo_api_key, "accept": "application/json", "content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = _json.loads(resp.read() or b"{}")
        return {**base, "delivered": True, "status": "Sent", "error": None,
                "message_id": data.get("messageId")}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:300]
        log.warning("Brevo rejected email to %s: %s %s", to, exc.code, detail)
        return {**base, "delivered": False, "status": "Failed",
                "error": f"Brevo API error {exc.code}: {detail}"}
    except Exception as exc:  # network problems etc.
        log.warning("Brevo delivery to %s failed: %s", to, exc)
        return {**base, "delivered": False, "status": "Failed", "error": f"Brevo API request failed: {exc}"}


def send_mail(
    to: str,
    subject: str,
    body: str,
    html_body: str | None = None,
    candidate_name: str | None = None,
    force_test_recipient: str | None = None,
) -> dict[str, Any]:
    """Dispatches an email with optional HTML and YOPmail test routing.

    Returns delivery metadata dictionary:
    {"delivered": bool, "recipient": str, "is_test": bool, "status": str, "error": str | None}
    """
    s = get_settings()
    is_prod = s.environment == "production"

    actual_to = to.strip()
    is_test = False
    original_to = actual_to

    # YOPmail / Development Test Routing Safeguard:
    # Strictly prohibited in production!
    if not is_prod and (s.email_test_mode or force_test_recipient or actual_to.endswith("@yopmail.com")):
        is_test = True
        if force_test_recipient and force_test_recipient.strip():
            actual_to = force_test_recipient.strip()
        elif s.email_test_recipient and s.email_test_recipient.strip():
            # If not explicitly a direct yopmail address, route to configured test inbox
            if not actual_to.endswith("@yopmail.com"):
                actual_to = s.email_test_recipient.strip()

        # Prefix subject clearly for test transparency
        cand_label = f"{candidate_name} <{original_to}>" if candidate_name else original_to
        if not subject.startswith("[TEST INVITATION"):
            subject = f"[TEST INVITATION for {cand_label}] {subject}"

    # 1. Test In-Memory Backend
    if s.mail_backend == "memory":
        OUTBOX.append(SentMail(to=actual_to, subject=subject, body=body, html_body=html_body, is_test=is_test, original_to=original_to))
        return {
            "delivered": True,
            "recipient": actual_to,
            "original_recipient": original_to,
            "is_test": is_test,
            "status": "Delivered",
            "provider": "memory",
            "error": None,
        }

    # 2. Brevo HTTPS API backend. Use it where outbound SMTP ports are blocked (e.g. Render's free plan
    #    blocks 25/465/587 since Sept 2025): it sends over HTTPS (port 443) instead.
    if s.mail_backend == "brevo":
        return _send_brevo(actual_to, original_to, subject, body, html_body, candidate_name, is_test)

    msg = _build_message(actual_to, subject, body, html_body=html_body, original_to=original_to)

    # 3. File Backend — the message is only written to disk, nobody receives it.
    # Reported as NOT delivered so the mentor dashboard never shows a false "Sent".
    if s.mail_backend == "file":
        out_path = _write_file(msg)
        return {
            "delivered": False,
            "recipient": actual_to,
            "original_recipient": original_to,
            "is_test": is_test,
            "status": "Failed",
            "provider": f"file ({out_path})",
            "error": "MAIL_BACKEND=file: email saved to the local outbox only, not sent. Configure SMTP to deliver.",
        }

    # 4. SMTP Backend
    try:
        smtp_cls = smtplib.SMTP_SSL if s.smtp_use_ssl else smtplib.SMTP
        with smtp_cls(s.smtp_host, s.smtp_port, timeout=15) as smtp:
            if s.smtp_use_tls and not s.smtp_use_ssl:
                smtp.starttls()
            if s.smtp_username:
                smtp.login(s.smtp_username, s.smtp_password)
            refused = smtp.send_message(msg)
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)
        return {
            "delivered": True,
            "recipient": actual_to,
            "original_recipient": original_to,
            "is_test": is_test,
            "status": "Sent",
            "provider": f"smtp://{s.smtp_host}:{s.smtp_port}",
            "error": None,
        }
    except Exception as exc:
        # Keep a copy for debugging, but report the truth: the candidate did NOT get the email.
        log.warning("SMTP delivery to %s failed (%s); copy kept in file outbox", actual_to, exc)
        try:
            _write_file(msg)
        except Exception as file_exc:  # pragma: no cover - disk failure
            log.error("Failed to write to file outbox: %s", file_exc)
        return {
            "delivered": False,
            "recipient": actual_to,
            "original_recipient": original_to,
            "is_test": is_test,
            "status": "Failed",
            "provider": f"smtp://{s.smtp_host}:{s.smtp_port}",
            "error": f"SMTP delivery failed ({s.smtp_host}:{s.smtp_port}): {exc}",
        }

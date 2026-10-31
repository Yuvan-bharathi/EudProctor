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

    msg = _build_message(actual_to, subject, body, html_body=html_body, original_to=original_to)

    # 2. File Backend
    if s.mail_backend == "file":
        out_path = _write_file(msg)
        return {
            "delivered": True,
            "recipient": actual_to,
            "original_recipient": original_to,
            "is_test": is_test,
            "status": "Delivered",
            "provider": f"file ({out_path})",
            "error": None,
        }

    # 3. SMTP Backend (with automatic file outbox fallback on connection drop)
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=5) as smtp:
            smtp.send_message(msg)
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
        log.warning("SMTP unreachable (%s); writing message to file outbox", exc)
        try:
            out_path = _write_file(msg)
            return {
                "delivered": True,
                "recipient": actual_to,
                "original_recipient": original_to,
                "is_test": is_test,
                "status": "Sent",
                "provider": f"file_fallback ({out_path})",
                "error": None,
            }
        except Exception as file_exc:
            log.error("Failed to write to file outbox: %s", file_exc)
            return {
                "delivered": False,
                "recipient": actual_to,
                "original_recipient": original_to,
                "is_test": is_test,
                "status": "Failed",
                "provider": "smtp",
                "error": str(exc),
            }

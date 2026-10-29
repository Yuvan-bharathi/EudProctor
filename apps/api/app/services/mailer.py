"""Outgoing email. SMTP (Mailpit in dev); falls back to a file outbox when SMTP is unreachable."""

import logging
import smtplib
import uuid
from dataclasses import dataclass
from email.message import EmailMessage
from pathlib import Path

from app.core.config import get_settings

log = logging.getLogger(__name__)


@dataclass
class SentMail:
    to: str
    subject: str
    body: str


# memory backend (tests)
OUTBOX: list[SentMail] = []


def _message(to: str, subject: str, body: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = get_settings().mail_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    return msg


def _write_file(msg: EmailMessage) -> None:
    outbox = Path(get_settings().storage_dir) / "outbox"
    outbox.mkdir(parents=True, exist_ok=True)
    (outbox / f"{uuid.uuid4().hex}.eml").write_bytes(bytes(msg))


def send_mail(to: str, subject: str, body: str) -> None:
    s = get_settings()
    if s.mail_backend == "memory":
        OUTBOX.append(SentMail(to, subject, body))
        return
    msg = _message(to, subject, body)
    if s.mail_backend == "file":
        _write_file(msg)
        return
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=5) as smtp:
            smtp.send_message(msg)
    except OSError:
        log.warning("SMTP unreachable; wrote message to file outbox instead")
        _write_file(msg)

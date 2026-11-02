"""Embedded Development Mail Server (SMTP on 1025, Web Inbox on 8025).

Captures all assessment invitation emails sent by EduProctor in real time and
provides an interactive browser inbox at http://localhost:8025 with:
- Full HTML email rendering
- Clickable 'Accept Invitation & Begin Pre-Checks' CTA buttons
- Raw single-use cryptographic token inspection
"""

import email
import json
import logging
import re
import socket
import threading
import time
import uuid
from datetime import datetime, timezone
from email.policy import default as default_policy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

_STORAGE_PATH = Path(__file__).resolve().parent.parent.parent / "dev_mailbox.json"


def _load_persisted() -> list[dict[str, Any]]:
    if _STORAGE_PATH.exists():
        try:
            return json.loads(_STORAGE_PATH.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def _save_persisted(items: list[dict[str, Any]]) -> None:
    try:
        _STORAGE_PATH.write_text(json.dumps(items[:100], indent=2), encoding="utf-8")
    except Exception as exc:
        log.warning("Could not persist mailbox: %s", exc)


RECEIVED_EMAILS: list[dict[str, Any]] = _load_persisted()
_LOCK = threading.Lock()
_SERVERS_STARTED = False

JOIN_LINK_REGEX = re.compile(r"https?://[^\s<>\"']+/join/[A-Za-z0-9_-]+")


def _extract_parts(msg: email.message.EmailMessage) -> tuple[str, str | None, list[str]]:
    plain_text = ""
    html_content: str | None = None
    links: list[str] = []

    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            cdispo = str(part.get("Content-Disposition", ""))
            if "attachment" in cdispo:
                continue
            payload = part.get_payload(decode=True)
            if not payload:
                continue
            charset = part.get_content_charset() or "utf-8"
            decoded = payload.decode(charset, errors="replace")
            if ctype == "text/plain":
                plain_text += decoded
            elif ctype == "text/html":
                html_content = decoded
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            decoded = payload.decode(charset, errors="replace")
            if msg.get_content_type() == "text/html":
                html_content = decoded
            else:
                plain_text = decoded

    combined = (plain_text or "") + " " + (html_content or "")
    for match in JOIN_LINK_REGEX.findall(combined):
        if match not in links:
            links.append(match)

    return plain_text, html_content, links


class SmtpHandler:
    """Minimal RFC 5321 SMTP server handler."""

    def __init__(self, conn: socket.socket, addr: tuple[str, int]) -> None:
        self.conn = conn
        self.addr = addr
        self.mail_from = ""
        self.rcpt_to: list[str] = []

    def handle(self) -> None:
        self.conn.sendall(b"220 EduProctor Dev Mailbox Service Ready\r\n")
        buffer = b""

        while True:
            chunk = self.conn.recv(4096)
            if not chunk:
                break
            buffer += chunk

            while b"\r\n" in buffer:
                line_bytes, buffer = buffer.split(b"\r\n", 1)
                line = line_bytes.decode("utf-8", errors="replace").strip()
                if not line:
                    continue

                upper = line.upper()
                if upper.startswith("EHLO") or upper.startswith("HELO"):
                    self.conn.sendall(b"250-localhost\r\n250-8BITMIME\r\n250-SIZE 10485760\r\n250 OK\r\n")
                elif upper.startswith("MAIL FROM:"):
                    self.mail_from = line[10:].strip("<> ")
                    self.rcpt_to = []
                    self.conn.sendall(b"250 2.1.0 Ok\r\n")
                elif upper.startswith("RCPT TO:"):
                    recipient = line[8:].strip("<> ")
                    self.rcpt_to.append(recipient)
                    self.conn.sendall(b"250 2.1.5 Ok\r\n")
                elif upper == "DATA":
                    self.conn.sendall(b"354 End data with <CR><LF>.<CR><LF>\r\n")
                    # Read until \r\n.\r\n
                    data_buffer = buffer
                    while b"\r\n.\r\n" not in data_buffer:
                        more = self.conn.recv(4096)
                        if not more:
                            break
                        data_buffer += more
                    
                    if b"\r\n.\r\n" in data_buffer:
                        raw_data, buffer = data_buffer.split(b"\r\n.\r\n", 1)
                    else:
                        raw_data = data_buffer
                        buffer = b""

                    self._store_message(raw_data)
                    self.conn.sendall(b"250 2.0.0 Ok: queued\r\n")
                elif upper == "RSET":
                    self.mail_from = ""
                    self.rcpt_to = []
                    self.conn.sendall(b"250 2.0.0 Ok\r\n")
                elif upper == "NOOP":
                    self.conn.sendall(b"250 2.0.0 Ok\r\n")
                elif upper == "QUIT":
                    self.conn.sendall(b"221 2.0.0 Bye\r\n")
                    return
                else:
                    self.conn.sendall(b"500 5.5.1 Command unrecognized\r\n")

    def _store_message(self, raw_bytes: bytes) -> None:
        try:
            msg = email.message_from_bytes(raw_bytes, policy=default_policy)
            plain, html, links = _extract_parts(msg)

            subject = str(msg.get("Subject", "No Subject"))
            to_addr = str(msg.get("To", ", ".join(self.rcpt_to) or "unknown"))
            from_addr = str(msg.get("From", self.mail_from or "unknown"))
            now_iso = datetime.now(timezone.utc).isoformat()
            email_id = uuid.uuid4().hex[:12]

            record = {
                "id": email_id,
                "timestamp": now_iso,
                "time_str": datetime.now().strftime("%I:%M:%S %p"),
                "subject": subject,
                "from": from_addr,
                "to": to_addr,
                "plain_text": plain,
                "html_content": html,
                "join_links": links,
                "primary_join_link": links[0] if links else None,
                "raw_size": len(raw_bytes),
            }

            with _LOCK:
                RECEIVED_EMAILS.insert(0, record)
                if len(RECEIVED_EMAILS) > 100:
                    RECEIVED_EMAILS.pop()
                _save_persisted(RECEIVED_EMAILS)

            log.info("Received invitation email for: %s | Subject: %s", to_addr, subject)
        except Exception as exc:
            log.error("Failed to parse incoming email: %s", exc)


def _run_smtp_server(port: int = 1025) -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("127.0.0.1", port))
    sock.listen(10)
    log.info("EduProctor Dev SMTP server listening on 127.0.0.1:%d", port)

    while True:
        try:
            conn, addr = sock.accept()
            client_thread = threading.Thread(target=SmtpHandler(conn, addr).handle, daemon=True)
            client_thread.start()
        except Exception as e:
            time.sleep(0.1)


class WebInboxHttpHandler(BaseHTTPRequestHandler):
    """Serves the interactive dev webmail inbox at http://localhost:8025."""

    def log_message(self, format: str, *args: Any) -> None:
        # Suppress noisy HTTP request polling logs
        pass

    def do_GET(self) -> None:
        if self.path == "/" or self.path == "/index.html":
            self._serve_inbox_ui()
        elif self.path == "/api/emails":
            self._serve_json(RECEIVED_EMAILS)
        elif self.path.startswith("/emails/") and self.path.endswith("/html"):
            email_id = self.path.split("/")[2]
            with _LOCK:
                match = next((e for e in RECEIVED_EMAILS if e["id"] == email_id), None)
            if match and match.get("html_content"):
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(match["html_content"].encode("utf-8"))
            else:
                self.send_error(404, "HTML content not found")
        else:
            self.send_error(404, "Not Found")

    def do_DELETE(self) -> None:
        if self.path == "/api/emails":
            with _LOCK:
                RECEIVED_EMAILS.clear()
                _save_persisted([])
            self._serve_json({"status": "cleared"})
        else:
            self.send_error(404)

    def _serve_json(self, data: Any) -> None:
        raw = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(raw)

    def _serve_inbox_ui(self) -> None:
        html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EduProctor Dev Mailbox (localhost:8025)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #f1f5f9; color: #1e293b; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    header { background-color: #0f172a; color: white; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; }
    .badge { background-color: #0f766e; color: #ffffff; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
    .actions { display: flex; align-items: center; gap: 10px; }
    button { background-color: #334155; color: white; border: none; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    button:hover { background-color: #475569; }
    .clear-btn { background-color: #991b1b; }
    .clear-btn:hover { background-color: #b91c1c; }
    main { display: flex; flex: 1; overflow: hidden; }
    .sidebar { width: 380px; background: white; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; }
    .sidebar-header { padding: 12px 16px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: flex; justify-content: space-between; }
    .email-list { flex: 1; overflow-y: auto; list-style: none; }
    .email-item { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.1s; }
    .email-item:hover { background-color: #f8fafc; }
    .email-item.active { background-color: #f0fdfa; border-left: 4px solid #0f766e; }
    .email-to { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px; display: flex; justify-content: space-between; }
    .email-time { font-size: 11px; color: #94a3b8; font-weight: normal; }
    .email-subject { font-size: 12px; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px; }
    .tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; background: #e0f2fe; color: #0369a1; }
    .content-pane { flex: 1; display: flex; flex-direction: column; background: #f8fafc; overflow: hidden; }
    .empty-pane { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #64748b; font-size: 14px; gap: 8px; }
    .email-header-card { background: white; padding: 20px 24px; border-bottom: 1px solid #e2e8f0; }
    .email-title { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .meta-grid { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; font-size: 13px; color: #475569; }
    .meta-label { font-weight: 600; color: #64748b; }
    .cta-banner { margin-top: 16px; background: linear-gradient(135deg, #0f766e, #115e59); color: white; padding: 14px 18px; border-radius: 10px; display: flex; align-items: center; justify-content: space-between; }
    .cta-btn { background-color: #ffffff; color: #0f766e; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 700; text-decoration: none; display: inline-block; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .cta-btn:hover { background-color: #f1f5f9; }
    .iframe-wrap { flex: 1; padding: 16px; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: 1px solid #cbd5e1; border-radius: 8px; background: white; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>EduProctor Dev Mailbox</span>
      <span class="badge">SMTP 1025 · HTTP 8025</span>
    </div>
    <div class="actions">
      <span id="counter" style="font-size: 12px; color: #94a3b8;">0 messages</span>
      <button onclick="fetchEmails()">Refresh</button>
      <button class="clear-btn" onclick="clearEmails()">Clear All</button>
    </div>
  </header>

  <main>
    <div class="sidebar">
      <div class="sidebar-header">
        <span>Received Inboxes</span>
        <span>Live Sync</span>
      </div>
      <ul class="email-list" id="emailList">
        <li style="padding: 24px; text-align: center; color: #94a3b8; font-size: 13px;">No emails received yet.<br>Click 'Send Invitations' in EduProctor.</li>
      </ul>
    </div>

    <div class="content-pane" id="contentPane">
      <div class="empty-pane">
        <strong>No email selected</strong>
        <span>Select an assessment invitation from the left pane to view it.</span>
      </div>
    </div>
  </main>

  <script>
    let emails = [];
    let selectedId = null;

    async function fetchEmails() {
      try {
        const res = await fetch('/api/emails');
        emails = await res.json();
        document.getElementById('counter').innerText = `${emails.length} message(s)`;
        renderList();
        if (emails.length > 0 && (!selectedId || !emails.find(e => e.id === selectedId))) {
          selectEmail(emails[0].id);
        } else if (emails.length === 0) {
          selectedId = null;
          renderEmpty();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }

    function renderList() {
      const list = document.getElementById('emailList');
      if (emails.length === 0) {
        list.innerHTML = '<li style="padding: 24px; text-align: center; color: #94a3b8; font-size: 13px;">No emails received yet.<br>Click \\'Send Invitations\\' in EduProctor.</li>';
        return;
      }

      list.innerHTML = emails.map(e => `
        <li class="email-item ${e.id === selectedId ? 'active' : ''}" onclick="selectEmail('${e.id}')">
          <div class="email-to">
            <span>${escapeHtml(e.to)}</span>
            <span class="email-time">${e.time_str || ''}</span>
          </div>
          <div class="email-subject">${escapeHtml(e.subject)}</div>
          <div>
            ${e.primary_join_link ? '<span class="tag">Assessment Invitation</span>' : ''}
          </div>
        </li>
      `).join('');
    }

    function selectEmail(id) {
      selectedId = id;
      renderList();
      const email = emails.find(e => e.id === id);
      if (!email) return;

      const pane = document.getElementById('contentPane');
      const joinBtn = email.primary_join_link ? `
        <div class="cta-banner">
          <div>
            <strong>Single-Use Candidate Invitation Token Generated</strong>
            <p style="font-size: 11px; opacity: 0.9; margin-top: 2px;">
              Launch pre-checks & face verification directly. (If logged in as Mentor, open in an <strong>Incognito Window</strong>)
            </p>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button onclick="navigator.clipboard.writeText('${email.primary_join_link}').then(() => alert('Join link copied! Paste into an Incognito window.'))" class="cta-btn" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4);">Copy Link</button>
            <a href="${email.primary_join_link}" target="_blank" class="cta-btn">Accept & Begin Pre-Checks &rarr;</a>
          </div>
        </div>
      ` : '';

      pane.innerHTML = `
        <div class="email-header-card">
          <div class="email-title">${escapeHtml(email.subject)}</div>
          <div class="meta-grid">
            <span class="meta-label">To:</span><span>${escapeHtml(email.to)}</span>
            <span class="meta-label">From:</span><span>${escapeHtml(email.from)}</span>
            <span class="meta-label">Received:</span><span>${email.timestamp}</span>
            ${email.primary_join_link ? `<span class="meta-label">Join Link:</span><span style="font-family: monospace; font-size: 11px; color: #0f766e;">${email.primary_join_link}</span>` : ''}
          </div>
          ${joinBtn}
        </div>
        <div class="iframe-wrap">
          <iframe src="/emails/${email.id}/html"></iframe>
        </div>
      `;
    }

    function renderEmpty() {
      document.getElementById('contentPane').innerHTML = `
        <div class="empty-pane">
          <strong>No email selected</strong>
          <span>Select an assessment invitation from the left pane to view it.</span>
        </div>
      `;
    }

    async function clearEmails() {
      if (confirm('Clear all captured test emails?')) {
        await fetch('/api/emails', { method: 'DELETE' });
        fetchEmails();
      }
    }

    function escapeHtml(str) {
      return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    fetchEmails();
    setInterval(fetchEmails, 2000);
  </script>
</body>
</html>"""
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))


def _run_http_server(port: int = 8025) -> None:
    httpd = ThreadingHTTPServer(("127.0.0.1", port), WebInboxHttpHandler)
    log.info("EduProctor Dev Web Mailbox UI running on http://127.0.0.1:%d", port)
    httpd.serve_forever()


def start_dev_mail_service(smtp_port: int = 1025, web_port: int = 8025) -> None:
    """Launches both the SMTP listener (port 1025) and Web Inbox server (port 8025) in daemon threads."""
    global _SERVERS_STARTED
    if _SERVERS_STARTED:
        return
    _SERVERS_STARTED = True

    smtp_thread = threading.Thread(target=_run_smtp_server, args=(smtp_port,), daemon=True, name="DevSmtpServer")
    smtp_thread.start()

    http_thread = threading.Thread(target=_run_http_server, args=(web_port,), daemon=True, name="DevWebInbox")
    http_thread.start()

    log.info("Development Mailbox active: SMTP 127.0.0.1:%d | Web UI http://localhost:%d", smtp_port, web_port)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    start_dev_mail_service()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass


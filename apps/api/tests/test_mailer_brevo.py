"""MAIL_BACKEND=brevo: HTTPS email API for hosts that block SMTP ports (e.g. Render free plan)."""

import io
import json
import urllib.error

import pytest

from app.core.config import get_settings
from app.services import mailer


@pytest.fixture
def brevo(monkeypatch):
    monkeypatch.setenv("MAIL_BACKEND", "brevo")
    monkeypatch.setenv("BREVO_API_KEY", "test-key")
    monkeypatch.setenv("EMAIL_FROM_ADDRESS", "sender@example.com")
    monkeypatch.setenv("EMAIL_TEST_MODE", "false")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_brevo_success_sends_html_to_the_candidate(brevo, monkeypatch):
    seen = {}

    def fake_urlopen(req, timeout):
        seen["url"], seen["headers"] = req.full_url, dict(req.header_items())
        seen["body"] = json.loads(req.data)
        return _Resp(b'{"messageId": "<abc@brevo>"}')

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    res = mailer.send_mail("cand@example.com", "Your invitation", "plain", html_body="<p>hi</p>", candidate_name="Cand")
    assert res["delivered"] is True and res["status"] == "Sent" and res["message_id"] == "<abc@brevo>"
    assert seen["url"] == mailer.BREVO_URL
    assert seen["headers"]["Api-key"] == "test-key"
    assert seen["body"]["to"] == [{"email": "cand@example.com", "name": "Cand"}]
    assert seen["body"]["sender"]["email"] == "sender@example.com"
    assert seen["body"]["htmlContent"] == "<p>hi</p>" and "textContent" not in seen["body"]


def test_brevo_rejection_is_reported_as_failed(brevo, monkeypatch):
    def fake_urlopen(req, timeout):
        raise urllib.error.HTTPError(req.full_url, 400, "Bad Request", {},
                                     io.BytesIO(b'{"code":"invalid_parameter","message":"sender not valid"}'))

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    res = mailer.send_mail("cand@example.com", "s", "plain")
    assert res["delivered"] is False and res["status"] == "Failed"
    assert "400" in res["error"] and "sender not valid" in res["error"]


def test_brevo_without_key_fails_clearly(brevo, monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "")
    get_settings.cache_clear()
    res = mailer.send_mail("cand@example.com", "s", "plain")
    assert res["delivered"] is False and "BREVO_API_KEY" in res["error"]

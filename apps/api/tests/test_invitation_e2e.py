"""Comprehensive End-to-End Test Suite for EduProctor Candidate Invitation Workflow.

Tests:
1. Healthcheck of Node.js Nodemailer microservice (Port 5050).
2. Healthcheck of FastAPI Backend (Port 8000).
3. Healthcheck of Dev Mailbox (Port 8025).
4. Mentor login and assessment retrieval.
5. Trigger LangGraph Invitation Agent -> Node.js Nodemailer dispatch.
6. Verification of actual email delivery in mailbox (HTML, CTA button, join token).
7. Candidate link redemption -> session creation & candidate auth tokens.
8. Duplicate link click -> session resumption (no 410 lockout).
9. Invalid token rejection (security 404).
10. Mentor telemetry verification (Sent, Delivered, Accepted).
"""

import json
import re
import sys
import time
import urllib.request
import urllib.error

API_URL = "http://127.0.0.1:8000/api/v1"
EMAIL_SERVICE_URL = "http://127.0.0.1:5050"
MAILBOX_URL = "http://127.0.0.1:8025"
EXAM_ID = "1fd0676c-06c4-48e5-9b49-24f510579724"


def post_json(url: str, data: dict, headers: dict | None = None) -> tuple[int, dict]:
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers=req_headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        try:
            body = json.loads(err.read().decode("utf-8"))
        except Exception:
            body = {"detail": str(err)}
        return err.code, body


def get_json(url: str, headers: dict | None = None) -> tuple[int, dict | list]:
    req_headers = headers or {}
    req = urllib.request.Request(url, headers=req_headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        try:
            body = json.loads(err.read().decode("utf-8"))
        except Exception:
            body = {"detail": str(err)}
        return err.code, body


def run_tests():
    print("=" * 70)
    print("EDUPROCTOR E2E CANDIDATE INVITATION & ACCESS TEST SUITE")
    print("=" * 70)

    # 1. Email Service Healthcheck
    print("\n[TEST 1] Checking Node.js Nodemailer Service (:5050/health)...")
    status, data = get_json(f"{EMAIL_SERVICE_URL}/health")
    assert status == 200, f"Expected 200, got {status}: {data}"
    assert data.get("engine") == "nodemailer", "Engine must be nodemailer"
    assert data.get("smtp", {}).get("connected") is True, "SMTP connection must be verified"
    print("  -> PASSED: Node.js Nodemailer microservice is healthy & connected to SMTP.")

    # 2. FastAPI Healthcheck
    print("\n[TEST 2] Checking FastAPI Backend (:8000/api/v1/health)...")
    status, data = get_json("http://127.0.0.1:8000/api/v1/health")
    assert status == 200, f"Expected 200, got {status}"
    print(f"  -> PASSED: Backend is healthy (status: {data.get('status')}).")

    # 3. Dev Mailbox Healthcheck
    print("\n[TEST 3] Checking Dev Mailbox (:8025/api/emails)...")
    status, emails = get_json(f"{MAILBOX_URL}/api/emails")
    assert status == 200, f"Expected 200, got {status}"
    print(f"  -> PASSED: Mailbox accessible (currently holds {len(emails)} emails).")

    # 4. Mentor Authentication
    print("\n[TEST 4] Authenticating as Mentor (mentor1@example.com)...")
    status, auth = post_json(
        f"{API_URL}/auth/login",
        {"email": "mentor1@example.com", "password": "eduproctor-dev"},
    )
    assert status == 200, f"Login failed: {auth}"
    mentor_token = auth["access_token"]
    print(f"  -> PASSED: Mentor authenticated. JWT: {mentor_token[:20]}...")

    # 5. Send Invitations via LangGraph Agent + Nodemailer
    print(f"\n[TEST 5] Triggering Send Invitations on Exam {EXAM_ID}...")
    status, send_res = post_json(
        f"{API_URL}/exams/{EXAM_ID}/send-links",
        {"force_resend": True},
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert status == 200, f"Send links failed: {send_res}"
    assert len(send_res) >= 1, "Expected at least 1 candidate assignment"
    cand_assignment = send_res[0]
    print("  -> Debug cand_assignment:", cand_assignment)
    assert cand_assignment["invitation_status"] in ("Sent", "Delivered"), f"Status must be 'Sent' or 'Delivered', got {cand_assignment['invitation_status']}"
    assert cand_assignment["delivery_status"] == "Delivered", "Delivery status must be 'Delivered'"
    print(f"  -> PASSED: Invitation dispatched to {cand_assignment['candidate_email']}.")
    print(f"  -> Delivery Provider: {cand_assignment['accommodations']['delivery_metadata']['provider']}")
    print(f"  -> SMTP Response: {cand_assignment['accommodations']['delivery_metadata']['smtp_response']}")

    # 6. Verify Email Arrival & Extract Token
    print("\n[TEST 6] Inspecting Dev Mailbox for delivered HTML email...")
    time.sleep(1)
    status, emails = get_json(f"{MAILBOX_URL}/api/emails")
    assert status == 200 and len(emails) > 0, "No emails in mailbox"
    latest_email = emails[0]
    assert latest_email["to"] == "tanu.shree@gmail.com", f"Expected recipient tanu.shree@gmail.com, got {latest_email['to']}"
    assert "Start Assessment" in latest_email["html_content"], "Email must contain 'Start Assessment' CTA"
    assert "Pre-Checks" in latest_email["html_content"], "Email must contain proctoring instructions"
    join_link = latest_email["primary_join_link"]
    token = join_link.split("/join/")[-1]
    print(f"  -> PASSED: Verified email delivered with responsive HTML and instructions.")
    print(f"  -> Extracted Single-Use Token: {token}")

    # 7. Candidate Link Redemption
    print(f"\n[TEST 7] Candidate clicks 'Start Assessment' (POST /api/v1/join/{token[:15]}...)...")
    status, join_res = post_json(f"{API_URL}/join/{token}", {})
    assert status == 200, f"Join failed: {join_res}"
    assert join_res["exam_title"] == "Java Script", "Exam title mismatch"
    assert join_res["session_id"] is not None, "Session ID must be created"
    assert join_res["user"]["role"] == "candidate", "Role must be candidate"
    session_id = join_res["session_id"]
    print(f"  -> PASSED: Candidate authenticated successfully as {join_res['user']['name']}.")
    print(f"  -> Created Exam Session: {session_id}")

    # 8. Duplicate Link Click (Resumption Test)
    print("\n[TEST 8] Candidate clicks the link again (Duplicate click test)...")
    status, dup_res = post_json(f"{API_URL}/join/{token}", {})
    assert status == 200, f"Duplicate click must succeed and resume: {dup_res}"
    assert dup_res["session_id"] == session_id, "Must return existing session"
    print(f"  -> PASSED: Duplicate click gracefully resumed active session without 410 error.")

    # 9. Invalid Token Security Test
    print("\n[TEST 9] Candidate clicks an invalid/tampered token...")
    status, err_res = post_json(f"{API_URL}/join/completely-fake-token-xyz-12345", {})
    assert status == 404, f"Expected 404, got {status}"
    print(f"  -> PASSED: Unauthorized / invalid tokens rejected with 404 Not Found.")

    # 10. Mentor Workspace Telemetry Check
    print(f"\n[TEST 10] Verifying Mentor Workspace Telemetry for Exam {EXAM_ID}...")
    status, exam_detail = get_json(
        f"{API_URL}/exams/{EXAM_ID}",
        headers={"Authorization": f"Bearer {mentor_token}"},
    )
    assert status == 200, f"Exam fetch failed: {exam_detail}"
    assigned = exam_detail["assignments"][0]
    assert assigned["invitation_status"] == "Accepted", "Status must be 'Accepted'"
    assert assigned["delivery_status"] == "Delivered", "Delivery must be 'Delivered'"
    assert assigned["link_used_at"] is not None, "Redemption timestamp must be present"
    print("  -> PASSED: Mentor dashboard updated with actual backend data:")
    print(f"     - Candidate: {assigned['candidate_name']} ({assigned['candidate_email']})")
    print(f"     - Invitation Status: {assigned['invitation_status']}")
    print(f"     - MTA Delivery Status: {assigned['delivery_status']}")
    print(f"     - Link Sent At: {assigned['link_sent_at']}")
    print(f"     - Link Redeemed At: {assigned['link_used_at']}")

    print("\n" + "=" * 70)
    print("ALL 10 TESTS PASSED SUCCESSFULLY! WORKFLOW FULLY VERIFIED.")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()

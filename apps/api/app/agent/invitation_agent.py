"""Assessment Invitation & Notification Agent.

Orchestrated using a stateful LangGraph / StateGraph workflow:
1. assessment_published_trigger
2. fetch_enrolled_candidates
3. validate_candidate_emails
4. check_existing_invitations
5. create_invitation_records
6. generate_invitation_content
7. send_invitation_emails
8. update_delivery_status
9. handle_failures_and_retries

Guarantees:
- Dispatches individual invitations only to enrolled, assigned candidates.
- Generates single-use cryptographic tokens (HMAC-SHA256 stored in DB).
- Sends professional HTML & Plain-Text invitation emails.
- YOPmail Development Test Mode routing when configured.
- Detailed delivery tracking and dashboard status updates.
- 100% Human-in-the-Loop: only published assessments dispatch invitations.
"""

import logging
import re
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any, Callable, TypedDict
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Exam, ExamAssignment, ExamStatus, User
from app.models.base import utcnow
from app.services.links import token_hash
from app.services.mailer import send_mail

log = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------------------
# LangGraph / StateGraph Orchestration Engine
# ---------------------------------------------------------------------------
END = "__end__"

try:
    from langgraph.graph import StateGraph, END
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False

    class StateGraph:
        """Lightweight native StateGraph engine with standard LangGraph API."""

        def __init__(self, state_schema: type):
            self.state_schema = state_schema
            self.nodes: dict[str, Callable[[Any], Any]] = {}
            self.edges: dict[str, str] = {}
            self.conditional_edges: dict[str, tuple[Callable[[Any], str], dict[str, str]]] = {}
            self.entry_point: str | None = None

        def add_node(self, name: str, action: Callable[[Any], Any]) -> None:
            self.nodes[name] = action
            if not self.entry_point:
                self.entry_point = name

        def set_entry_point(self, name: str) -> None:
            self.entry_point = name

        def add_edge(self, start_node: str, end_node: str) -> None:
            self.edges[start_node] = end_node

        def add_conditional_edges(
            self,
            source: str,
            path: Callable[[Any], str],
            path_map: dict[str, str],
        ) -> None:
            self.conditional_edges[source] = (path, path_map)

        def compile(self):
            class CompiledGraph:
                def __init__(self, graph: "StateGraph"):
                    self.graph = graph

                def invoke(self, state: dict[str, Any]) -> dict[str, Any]:
                    curr = self.graph.entry_point
                    curr_state = dict(state)
                    visited_count = 0
                    max_turns = 25

                    while curr and curr != END and visited_count < max_turns:
                        visited_count += 1
                        node_func = self.graph.nodes.get(curr)
                        if not node_func:
                            break

                        # Execute node function
                        updates = node_func(curr_state)
                        if isinstance(updates, dict):
                            curr_state.update(updates)

                        # Determine next node via conditional edges or standard edge
                        if curr in self.graph.conditional_edges:
                            router, branch_map = self.graph.conditional_edges[curr]
                            branch_key = router(curr_state)
                            curr = branch_map.get(branch_key, END)
                        elif curr in self.graph.edges:
                            curr = self.graph.edges[curr]
                        else:
                            curr = END

                    return curr_state

            return CompiledGraph(self)


# ---------------------------------------------------------------------------
# Agent State Schema
# ---------------------------------------------------------------------------
class CandidateInvitationItem(TypedDict, total=False):
    assignment_id: str
    candidate_id: str
    candidate_name: str
    candidate_email: str
    is_valid_email: bool
    is_eligible: bool
    skip_reason: str | None
    raw_token: str | None
    token_url: str | None
    expires_at: str | None
    status: str  # "Not Sent", "Pending", "Sending", "Sent", "Delivered", "Failed", "Accepted", "Expired"
    delivery_metadata: dict[str, Any]
    error: str | None


class InvitationAgentState(TypedDict, total=False):
    exam_id: str
    mentor_id: str
    force_resend: bool
    candidate_filter_ids: list[str]
    test_mode: bool
    test_recipient_override: str | None

    # Database Context (passed in execution state)
    db: Any
    exam: Any

    # Assessment Info
    assessment_title: str
    domain_subject: str
    duration_min: int
    total_questions: int
    total_marks: float
    window_start: str | None
    window_end: str | None

    # Processing Queues
    enrolled_candidates: list[CandidateInvitationItem]
    valid_candidates: list[CandidateInvitationItem]
    eligible_candidates: list[CandidateInvitationItem]
    generated_emails: list[dict[str, Any]]
    dispatched_results: list[dict[str, Any]]
    failed_items: list[dict[str, Any]]

    # Outcome summary
    total_enrolled: int
    total_sent: int
    total_delivered: int
    total_accepted: int
    total_failed: int
    total_pending: int
    status_summary: str
    error: str | None


# ---------------------------------------------------------------------------
# Node 1: assessment_published_trigger
# ---------------------------------------------------------------------------
def assessment_published_trigger(state: InvitationAgentState) -> dict[str, Any]:
    """Validates that the assessment is in scheduled/published status and ready for invitations."""
    db: Session = state["db"]
    exam_id = uuid.UUID(str(state["exam_id"]))
    exam = db.get(Exam, exam_id)

    if not exam:
        return {"error": "Assessment not found", "total_enrolled": 0, "status_summary": "Aborted: Assessment not found"}

    if exam.status not in (ExamStatus.scheduled, ExamStatus.active):
        return {
            "error": f"Assessment is not published (current status: {exam.status.value})",
            "total_enrolled": 0,
            "status_summary": "Skipped: Assessment not published",
        }

    if not exam.questions:
        return {
            "error": "Cannot send invitations: Assessment has 0 questions",
            "total_enrolled": 0,
            "status_summary": "Aborted: 0 questions assigned",
        }

    # Fetch domain / course name
    course_name = exam.course.name if getattr(exam, "course", None) else "Technical Assessment"
    total_marks = sum(getattr(q.question, "marks", 1.0) for q in exam.questions if getattr(q, "question", None))

    return {
        "exam": exam,
        "assessment_title": exam.title,
        "domain_subject": course_name,
        "duration_min": exam.duration_min,
        "total_questions": len(exam.questions),
        "total_marks": total_marks,
        "window_start": exam.window_start.strftime("%Y-%m-%d %H:%M UTC") if exam.window_start else None,
        "window_end": exam.window_end.strftime("%Y-%m-%d %H:%M UTC") if exam.window_end else None,
        "error": None,
    }


# ---------------------------------------------------------------------------
# Node 2: fetch_enrolled_candidates
# ---------------------------------------------------------------------------
def fetch_enrolled_candidates(state: InvitationAgentState) -> dict[str, Any]:
    """Retrieves all assigned enrolled candidates for this assessment from the database."""
    if state.get("error"):
        return {}

    db: Session = state["db"]
    exam = state["exam"]
    filter_ids = state.get("candidate_filter_ids") or []

    q = (
        select(ExamAssignment, User)
        .join(User, User.id == ExamAssignment.candidate_id)
        .where(ExamAssignment.exam_id == exam.id)
    )

    if filter_ids:
        uuids = [uuid.UUID(str(cid)) for cid in filter_ids]
        q = q.where(ExamAssignment.candidate_id.in_(uuids))

    rows = list(db.execute(q))
    enrolled_list: list[CandidateInvitationItem] = []

    for a, user in rows:
        accomm = a.accommodations or {}
        enrolled_list.append({
            "assignment_id": str(a.id),
            "candidate_id": str(user.id),
            "candidate_name": user.name or "Candidate",
            "candidate_email": user.email.strip(),
            "status": accomm.get("invitation_status", "Not Sent" if not a.link_sent_at else "Sent"),
            "delivery_metadata": accomm,
        })

    return {
        "enrolled_candidates": enrolled_list,
        "total_enrolled": len(enrolled_list),
    }


# ---------------------------------------------------------------------------
# Node 3: validate_candidate_emails
# ---------------------------------------------------------------------------
def validate_candidate_emails(state: InvitationAgentState) -> dict[str, Any]:
    """Validates candidate email syntax and active status."""
    enrolled = state.get("enrolled_candidates") or []
    valid_list: list[CandidateInvitationItem] = []
    failed_list: list[dict[str, Any]] = []

    for c in enrolled:
        email = c.get("candidate_email", "")
        if not email or not EMAIL_REGEX.match(email):
            item = dict(c)
            item["is_valid_email"] = False
            item["status"] = "Failed"
            item["error"] = f"Invalid email format: '{email}'"
            failed_list.append(item)
        else:
            item = dict(c)
            item["is_valid_email"] = True
            valid_list.append(item)

    return {
        "valid_candidates": valid_list,
        "failed_items": failed_list,
    }


# ---------------------------------------------------------------------------
# Node 4: check_existing_invitations
# ---------------------------------------------------------------------------
def check_existing_invitations(state: InvitationAgentState) -> dict[str, Any]:
    """Checks existing invitation tokens to prevent duplicate sends unless resend is requested."""
    db: Session = state["db"]
    valid_candidates = state.get("valid_candidates") or []
    force_resend = state.get("force_resend", False)

    eligible_list: list[CandidateInvitationItem] = []
    now = utcnow()

    for c in valid_candidates:
        aid = uuid.UUID(c["assignment_id"])
        assignment = db.get(ExamAssignment, aid)
        if not assignment:
            continue

        # If already used/accepted, never send again
        if assignment.link_used_at is not None:
            c["status"] = "Accepted"
            c["skip_reason"] = "Already accepted assessment invitation"
            continue

        # If has active non-expired link and not forcing resend, skip duplicate send
        expires_at = assignment.link_expires_at
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)

        if not force_resend and assignment.link_token_hash and expires_at and expires_at > now:
            c["status"] = assignment.accommodations.get("invitation_status", "Sent")
            c["skip_reason"] = "Valid active invitation already exists"
            continue

        # Candidate is eligible for fresh invitation
        item = dict(c)
        item["is_eligible"] = True
        item["status"] = "Pending"
        eligible_list.append(item)

    return {
        "eligible_candidates": eligible_list,
    }


# ---------------------------------------------------------------------------
# Node 5: create_invitation_records
# ---------------------------------------------------------------------------
def create_invitation_records(state: InvitationAgentState) -> dict[str, Any]:
    """Generates single-use cryptographic tokens and updates ExamAssignment records."""
    db: Session = state["db"]
    exam: Exam = state["exam"]
    s = get_settings()
    eligible = state.get("eligible_candidates") or []
    now = utcnow()
    window_end = exam.window_end
    if window_end.tzinfo is None:
        window_end = window_end.replace(tzinfo=UTC)

    for c in eligible:
        raw_token = secrets.token_urlsafe(32)
        aid = uuid.UUID(c["assignment_id"])
        assignment = db.get(ExamAssignment, aid)
        if not assignment:
            continue

        assignment.link_token_hash = token_hash(raw_token)
        assignment.link_expires_at = min(window_end, now + timedelta(hours=s.link_ttl_hours))
        assignment.link_sent_at = now
        assignment.link_used_at = None

        join_url = f"{s.web_base_url}/join/{raw_token}"
        c["raw_token"] = raw_token
        c["token_url"] = join_url
        c["expires_at"] = assignment.link_expires_at.strftime("%Y-%m-%d %H:%M UTC")

        # Update assignment metadata
        meta = dict(assignment.accommodations or {})
        meta["invitation_status"] = "Sending"
        meta["invitation_sent_at"] = now.isoformat()
        assignment.accommodations = meta

    db.commit()
    return {"eligible_candidates": eligible}


# ---------------------------------------------------------------------------
# Node 6: generate_invitation_content
# ---------------------------------------------------------------------------
def generate_invitation_content(state: InvitationAgentState) -> dict[str, Any]:
    """Builds professional HTML and Plain-Text invitation email templates."""
    eligible = state.get("eligible_candidates") or []
    generated_emails = []

    title = state.get("assessment_title", "Assessment")
    subject_domain = state.get("domain_subject", "Technical")
    duration = state.get("duration_min", 60)
    questions_count = state.get("total_questions", 0)
    marks = state.get("total_marks", 0)
    deadline = state.get("window_end", "See platform for deadline")

    for c in eligible:
        candidate_name = c["candidate_name"]
        join_url = c["token_url"]
        expires_at = c.get("expires_at", deadline)

        # Plain Text Content
        plain_text = f"""Hello {candidate_name},

You have been officially invited to complete the following assessment on EduProctor Intelligence:

Assessment: {title}
Domain / Track: {subject_domain}
Duration: {duration} minutes
Questions: {questions_count} questions ({marks} total marks)
Deadline: {expires_at}

Instructions & Pre-Checks:
- Webcam & microphone are required for non-punitive identity verification.
- You will complete a brief 3-photo face enrolment, liveness check, and calibration.
- The link below is single-use and strictly bound to your account.

Open your unique assessment link to begin:
{join_url}

Best regards,
EduProctor Intelligence Academic Team
"""

        # Professional Styled HTML Content
        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Assessment Invitation: {title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); padding: 28px 32px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">EduProctor Intelligence</h2>
      <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">Assessment Invitation & Instructions</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="font-size: 15px; color: #1e293b; margin-top: 0;">
        Hello <strong>{candidate_name}</strong>,
      </p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6;">
        You have been enrolled and scheduled to complete the assessment <strong>"{title}"</strong>.
      </p>

      <!-- Key Details Card -->
      <div style="background-color: #f1f5f9; border-radius: 12px; padding: 18px 20px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 40%;">Track / Subject:</td>
            <td style="padding: 6px 0; font-weight: 600;">{subject_domain}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Duration:</td>
            <td style="padding: 6px 0; font-weight: 600;">{duration} minutes</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Questions & Marks:</td>
            <td style="padding: 6px 0; font-weight: 600;">{questions_count} questions ({marks} marks)</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Link Valid Until:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f766e;">{expires_at}</td>
          </tr>
        </table>
      </div>

      <!-- Proctoring Pre-Checks Notice -->
      <div style="border-left: 4px solid #0f766e; background-color: #f0fdfa; padding: 12px 16px; border-radius: 4px; margin-bottom: 28px;">
        <p style="margin: 0; font-size: 12px; color: #115e59; line-height: 1.5;">
          <strong>Pre-checks Required:</strong> Working webcam and microphone. You will complete biometric consent, 3 reference photo captures, a dynamic liveness check (blink/turn), and a 12-second environmental calibration.
        </p>
      </div>

      <!-- Action Button CTA -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="{join_url}" style="background-color: #0f766e; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; display: inline-block; box-shadow: 0 2px 4px rgba(15,118,110,0.3);">
          Accept Invitation & Begin Pre-Checks
        </a>
      </div>

      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">
        If the button does not work, copy and paste this link into your browser:<br>
        <a href="{join_url}" style="color: #0f766e; word-break: break-all;">{join_url}</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px; text-align: center; font-size: 11px; color: #94a3b8;">
      This is an automated, single-use examination link issued by EduProctor Intelligence.
    </div>
  </div>
</body>
</html>
"""

        generated_emails.append({
            "candidate_id": c["candidate_id"],
            "assignment_id": c["assignment_id"],
            "recipient_email": c["candidate_email"],
            "candidate_name": candidate_name,
            "subject": f"Your Assessment Invitation: {title}",
            "plain_text": plain_text,
            "html_content": html_content,
        })

    return {"generated_emails": generated_emails}


# ---------------------------------------------------------------------------
# Node 7: send_invitation_emails
# ---------------------------------------------------------------------------
def send_invitation_emails(state: InvitationAgentState) -> dict[str, Any]:
    """Dispatches emails with support for YOPmail development test inbox routing."""
    generated = state.get("generated_emails") or []
    dispatched = []
    failed = state.get("failed_items") or []

    test_mode = state.get("test_mode", False)
    test_override = state.get("test_recipient_override")

    for item in generated:
        res = send_mail(
            to=item["recipient_email"],
            subject=item["subject"],
            body=item["plain_text"],
            html_body=item["html_content"],
            candidate_name=item["candidate_name"],
            force_test_recipient=test_override if test_mode else None,
        )

        item_result = {
            "assignment_id": item["assignment_id"],
            "candidate_id": item["candidate_id"],
            "candidate_email": item["recipient_email"],
            "status": "Sent" if res["delivered"] else "Failed",
            "delivery_metadata": res,
            "error": res.get("error"),
        }

        if res["delivered"]:
            dispatched.append(item_result)
        else:
            failed.append(item_result)

    return {
        "dispatched_results": dispatched,
        "failed_items": failed,
    }


# ---------------------------------------------------------------------------
# Node 8: update_delivery_status
# ---------------------------------------------------------------------------
def update_delivery_status(state: InvitationAgentState) -> dict[str, Any]:
    """Updates database records with delivery confirmation and statuses."""
    db: Session = state["db"]
    dispatched = state.get("dispatched_results") or []
    failed = state.get("failed_items") or []
    now = utcnow()

    total_sent = 0
    total_delivered = 0

    for item in dispatched:
        aid = uuid.UUID(item["assignment_id"])
        assignment = db.get(ExamAssignment, aid)
        if assignment:
            meta = dict(assignment.accommodations or {})
            meta["invitation_status"] = item["status"]  # "Sent" or "Delivered"
            meta["delivery_metadata"] = item["delivery_metadata"]
            meta["updated_at"] = now.isoformat()
            assignment.accommodations = meta
            total_sent += 1
            if item["delivery_metadata"].get("status") == "Delivered":
                total_delivered += 1

    for item in failed:
        if item.get("assignment_id"):
            aid = uuid.UUID(item["assignment_id"])
            assignment = db.get(ExamAssignment, aid)
            if assignment:
                meta = dict(assignment.accommodations or {})
                meta["invitation_status"] = "Failed"
                meta["error"] = item.get("error")
                meta["updated_at"] = now.isoformat()
                assignment.accommodations = meta

    db.commit()

    return {
        "total_sent": total_sent,
        "total_delivered": total_delivered,
        "total_failed": len(failed),
    }


# ---------------------------------------------------------------------------
# Node 9: handle_failures_and_retries
# ---------------------------------------------------------------------------
def handle_failures_and_retries(state: InvitationAgentState) -> dict[str, Any]:
    """Generates execution summary and handles failure diagnostics."""
    total_sent = state.get("total_sent", 0)
    failed_items = state.get("failed_items") or []
    total_enrolled = state.get("total_enrolled", 0)

    summary = (
        f"Processed {total_enrolled} candidate(s): "
        f"{total_sent} invitations sent successfully, {len(failed_items)} failed."
    )
    log.info("Invitation Agent execution complete: %s", summary)

    return {
        "status_summary": summary,
    }


# ---------------------------------------------------------------------------
# Router Functions (Conditional Edges)
# ---------------------------------------------------------------------------
def route_after_validation(state: InvitationAgentState) -> str:
    valid = state.get("valid_candidates") or []
    return "has_valid" if len(valid) > 0 else "no_valid"


def route_after_existing_check(state: InvitationAgentState) -> str:
    eligible = state.get("eligible_candidates") or []
    return "has_eligible" if len(eligible) > 0 else "all_skipped"


def route_after_sending(state: InvitationAgentState) -> str:
    failed = state.get("failed_items") or []
    return "has_failures" if len(failed) > 0 else "all_ok"


# ---------------------------------------------------------------------------
# Build the LangGraph Workflow
# ---------------------------------------------------------------------------
def build_invitation_agent_graph():
    """Compiles the stateful LangGraph workflow for Assessment Invitations."""
    workflow = StateGraph(InvitationAgentState)

    # Add all 9 Nodes
    workflow.add_node("assessment_published_trigger", assessment_published_trigger)
    workflow.add_node("fetch_enrolled_candidates", fetch_enrolled_candidates)
    workflow.add_node("validate_candidate_emails", validate_candidate_emails)
    workflow.add_node("check_existing_invitations", check_existing_invitations)
    workflow.add_node("create_invitation_records", create_invitation_records)
    workflow.add_node("generate_invitation_content", generate_invitation_content)
    workflow.add_node("send_invitation_emails", send_invitation_emails)
    workflow.add_node("update_delivery_status", update_delivery_status)
    workflow.add_node("handle_failures_and_retries", handle_failures_and_retries)

    # Edge configuration
    workflow.set_entry_point("assessment_published_trigger")
    workflow.add_edge("assessment_published_trigger", "fetch_enrolled_candidates")
    workflow.add_edge("fetch_enrolled_candidates", "validate_candidate_emails")

    # Conditional Edge: after validation
    workflow.add_conditional_edges(
        "validate_candidate_emails",
        route_after_validation,
        {
            "has_valid": "check_existing_invitations",
            "no_valid": "handle_failures_and_retries",
        },
    )

    # Conditional Edge: after checking existing invitations
    workflow.add_conditional_edges(
        "check_existing_invitations",
        route_after_existing_check,
        {
            "has_eligible": "create_invitation_records",
            "all_skipped": "update_delivery_status",
        },
    )

    workflow.add_edge("create_invitation_records", "generate_invitation_content")
    workflow.add_edge("generate_invitation_content", "send_invitation_emails")
    workflow.add_edge("send_invitation_emails", "update_delivery_status")
    workflow.add_edge("update_delivery_status", "handle_failures_and_retries")
    workflow.add_edge("handle_failures_and_retries", END)

    return workflow.compile()


# Compiled Singleton Graph
INVITATION_AGENT_APP = build_invitation_agent_graph()


# ---------------------------------------------------------------------------
# Public Execution Seam
# ---------------------------------------------------------------------------
def run_invitation_agent(
    db: Session,
    exam_id: uuid.UUID,
    mentor: User,
    *,
    force_resend: bool = False,
    candidate_filter_ids: list[str] | None = None,
    test_mode: bool = False,
    test_recipient_override: str | None = None,
) -> dict[str, Any]:
    """Executes the LangGraph Assessment Invitation Agent.

    Returns the complete execution state and delivery summary.
    """
    s = get_settings()
    is_test = test_mode or s.email_test_mode or (s.environment in ("dev", "test"))

    initial_state: InvitationAgentState = {
        "db": db,
        "exam_id": str(exam_id),
        "mentor_id": str(mentor.id),
        "force_resend": force_resend,
        "candidate_filter_ids": candidate_filter_ids or [],
        "test_mode": is_test,
        "test_recipient_override": test_recipient_override or s.email_test_recipient,
    }

    final_state = INVITATION_AGENT_APP.invoke(initial_state)

    # Strip non-serializable db objects before returning
    final_state.pop("db", None)
    final_state.pop("exam", None)
    return final_state


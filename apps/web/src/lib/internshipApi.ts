/**
 * Typed client for the internship API (`/api/v1/internship`, backend: apps/api/app/routers/internship.py).
 *
 * Rules the UI must keep (implementation plan 6.6-6.10):
 * - AI output reaches an intern only after the mentor approves it in the approval inbox, except live
 *   Blocker Co-Pilot answers (which mentors can read in the blocker history).
 * - Scores, attendance status and skill levels come from the server (deterministic); never compute them in the UI.
 * - No mock or localStorage fallback: show the API error instead.
 */
import { api } from "@/lib/api";

const B = "/internship";

// ------------------------------------------------------------------ types

export type InternTaskStatus = "Assigned" | "In Progress" | "Review" | "Done" | "Rework";
export type DayStatus = "Present" | "Half Day" | "Short" | "Leave" | "Absent" | "In Progress" | "Needs Correction";
export type ReviewStatus =
  | "none"
  | "not_consented"
  | "ai_disabled"
  | "pending_review"
  | "awaiting_mentor"
  | "in_review" // what an intern sees while the mentor hasn't approved yet
  | "published"
  | "rejected"
  | "agent_unavailable"
  | "agent_failed";

export interface SkillScoreRow {
  skill: string;
  score_pct: number;
  n_questions: number;
  /** 1..5 for the radar; null = insufficient data (fewer than min_questions_per_skill) */
  level: number | null;
  updated_at: string;
}

export interface Cohort {
  id: string;
  name: string;
  track: string;
  start_date: string;
  end_date: string;
  timezone: string;
  ai_review_enabled: boolean;
  mentee_count: number;
  mentor_count: number;
}

export interface MentorRow {
  id: string;
  name: string;
  email: string;
  active_mentees: number;
}

export interface Mentee {
  id: string; // user id
  enrollment_id: string;
  name: string;
  email: string;
  username: string | null;
  phone: string | null;
  roll_number: string | null;
  cohort_id: string;
  cohort_name: string;
  track: string;
  mentor_id: string;
  mentor_name: string;
  status: "Active" | "Completed";
  started_on: string;
  current_week: number;
  current_month: number;
  attendance_rate_pct?: number | null;
  today_status?: DayStatus;
  online?: boolean;
  tasks_total?: number;
  tasks_done?: number;
  tasks_in_review?: number;
  skills?: SkillScoreRow[];
}

export interface MyInternship extends Partial<Mentee> {
  enrolled: boolean;
  pending_quizzes?: number;
  rules?: { full_day_hours: number; half_day_hours: number };
}

export interface InternTask {
  id: string;
  cohort_id: string;
  mentee_id: string;
  mentee_name: string;
  mentor_id: string;
  title: string;
  description: string;
  acceptance_criteria: string;
  skill_area: string;
  skill_tags: string[];
  priority: "High" | "Medium" | "Low";
  status: InternTaskStatus;
  due_date: string | null;
  week_number: number;
  month_number: number;
  mentor_feedback: string | null;
  flagged_blocked_at: string | null;
  last_activity_at: string;
  created_at: string;
  latest_submission: {
    id: string;
    review_status: ReviewStatus;
    created_at: string;
    submission_url: string | null;
    notes: string;
  } | null;
}

export interface CodeFinding {
  line: number;
  rule: string;
  severity: "high" | "medium" | "low";
  message: string;
}

export interface CodeReviewContent {
  summary: string;
  strengths: string[];
  socratic_questions: { line?: number | null; question: string; why_it_matters: string }[];
  findings_explained: { rule: string; explanation: string }[];
  mentor_walkthrough_questions: string[];
}

export interface Submission {
  id: string;
  task_id: string;
  notes: string;
  submission_url: string | null;
  filename: string | null;
  language: string | null;
  ai_consent: boolean;
  review_status: ReviewStatus;
  code: string | null;
  created_at: string;
  /** Interns only get this once the mentor has published the review. */
  review: {
    status: "awaiting_mentor" | "published" | "rejected";
    findings: CodeFinding[];
    metrics: Record<string, number>;
    review: CodeReviewContent | null;
    published_at: string | null;
  } | null;
}

export interface AttendanceSessionRow {
  id: string;
  punch_in_at: string;
  punch_out_at: string | null;
  auto_closed: boolean;
  corrected: boolean;
  note: string | null;
}

export interface AttendanceDay {
  date: string;
  status: DayStatus;
  total_hours: number;
  overtime_hours: number;
  open: boolean;
  sessions: AttendanceSessionRow[];
}

export interface AttendancePayload {
  today: AttendanceDay;
  days: AttendanceDay[];
  rate_pct: number | null;
  rules: { full_day_hours: number; half_day_hours: number; timezone: string };
  /** only on correction responses: the corrected day */
  day?: AttendanceDay | null;
}

export interface MenteeAttendanceToday extends AttendanceDay {
  mentee_id: string;
  name: string;
}

export interface LeaveRow {
  id: string;
  mentee_id: string;
  mentee_name: string;
  mentor_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  submitted_at: string;
  decided_at: string | null;
}

export interface StandupRow {
  id: string;
  mentee_id: string;
  mentee_name: string;
  date: string;
  yesterday: string;
  today: string;
  blockers: string;
  task_id: string | null;
  task_title: string | null;
  created_at: string;
}

export interface BlockerAnswer {
  id: string;
  mentee_id: string;
  mentee_name: string;
  task_id: string | null;
  question: string;
  answer: string;
  citations: { id: string; title: string }[];
  /** true = the Co-Pilot couldn't resolve it from docs and alerted the mentor */
  escalated: boolean;
  created_at: string;
}

export interface StallAlertRow {
  id: string;
  mentee_id: string;
  mentee_name: string;
  task_id: string | null;
  task_title: string | null;
  source: "auto" | "self_flag" | "blocker_chat";
  reason: string;
  created_at: string;
  acknowledged_at: string | null;
}

export type AgentKind = "code_review" | "weekly_quiz" | "appraisal";

export interface QuizQuestion {
  id: string;
  skill: string;
  body: string;
  options: { key: "A" | "B" | "C" | "D"; text: string; misconception?: string | null }[];
  /** present for mentors, and for interns only after submitting */
  correct_key?: string;
  explanation?: string;
}

export interface AppraisalContent {
  qualitative_summary: string;
  strengths: string[];
  growth_areas: string[];
  next_goals: string[];
  mentor_brief: string;
  self_appraisal_scaffold: { accomplishments: string[]; challenges: string[]; focus_goals: string[] };
}

export interface ApprovalDraft {
  id: string;
  agent: AgentKind;
  title: string;
  status: "pending" | "approved" | "rejected";
  subject_type: string;
  subject_id: string;
  mentee_id: string;
  mentee_name: string;
  /** code_review: CodeReviewContent; weekly_quiz: {questions: QuizQuestion[], allowed_skills}; appraisal: AppraisalContent & {metrics} */
  content: Record<string, unknown>;
  final_content: Record<string, unknown> | null;
  edited: boolean;
  mentor_note: string | null;
  created_at: string;
  decided_at: string | null;
  /** only on GET /approvals/{id} for code reviews */
  submission?: Submission;
  task?: InternTask;
}

export interface WeeklyQuiz {
  id: string;
  mentee_id: string;
  mentee_name: string;
  week_number: number;
  month_number: number;
  title: string;
  status: "drafting" | "awaiting_mentor" | "available" | "submitted" | "rejected" | "failed";
  duration_min: number;
  question_count: number;
  questions: QuizQuestion[];
  answers: Record<string, string> | null;
  score_pct: number | null;
  results: {
    score_pct: number;
    correct: number;
    total: number;
    skills: { skill: string; correct: number; total: number; score_pct: number }[];
    misconceptions: string[];
    detail: { id: string; chosen: string | null; correct_key: string; correct: boolean; explanation: string }[];
  } | null;
  released_at: string | null;
  submitted_at: string | null;
}

export interface AppraisalMetrics {
  window: { start: string; end: string; milestone_day: number };
  attendance: { rate_pct: number | null; days_worked: number; avg_hours_on_worked_days: number; needs_correction_days: number };
  tasks: { assigned: number; done: number; done_pct: number | null; in_review: number };
  quizzes: { taken: number; avg_score_pct: number | null };
  code_reviews_published: number;
  blocker_questions: number;
  stall_alerts: number;
  skills: SkillScoreRow[];
  breakdown: {
    mcqScorePct: number | null;
    codingScorePct: null; // assessed by the mentor, never computed
    commScorePct: null;
    tasksScorePct: number | null;
    attendanceScorePct: number | null;
  };
  composite_score_pct: number | null;
  composite_note: string;
}

export interface Appraisal {
  id: string;
  mentee_id: string;
  mentee_name: string;
  milestone_day: 30 | 60 | 90;
  month_number: number;
  status: "drafting" | "awaiting_mentor" | "published" | "acknowledged" | "rejected" | "failed";
  metrics: AppraisalMetrics;
  content: AppraisalContent | null;
  mentee_comment: string | null;
  published_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface Overview {
  active_interns: number;
  online_now: number;
  pending_approvals: number;
  open_stall_alerts: number;
  tasks_in_review: number;
  pending_leave: number;
  cohorts: number;
}

export interface CohortDocRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

// ------------------------------------------------------------------ calls

const q = (params: Record<string, string | number | boolean | null | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : "";
};

export const internshipApi = {
  // Sprint 0: setup
  me: () => api<MyInternship>(`${B}/me`),
  overview: () => api<Overview>(`${B}/overview`),
  mentors: () => api<MentorRow[]>(`${B}/mentors`),
  cohorts: () => api<Cohort[]>(`${B}/cohorts`),
  createCohort: (body: { name: string; track: string; start_date: string; end_date: string; timezone?: string; ai_review_enabled?: boolean }) =>
    api<Cohort>(`${B}/cohorts`, { body }),
  patchCohort: (id: string, body: Partial<Omit<Cohort, "id" | "mentee_count" | "mentor_count">>) =>
    api<Cohort>(`${B}/cohorts/${id}`, { method: "PATCH", body }),
  mentees: (cohortId?: string) => api<Mentee[]>(`${B}/mentees${q({ cohort_id: cohortId })}`),
  mentee: (id: string) => api<Mentee>(`${B}/mentees/${id}`),
  enroll: (cohortId: string, body: { name: string; email: string; mentor_id: string; phone?: string; roll_number?: string; started_on?: string }) =>
    api<Mentee & { welcome_email: { delivered: boolean; error: string | null } }>(`${B}/cohorts/${cohortId}/mentees`, { body }),
  patchEnrollment: (enrollmentId: string, body: { mentor_id?: string; status?: "Active" | "Completed" }) =>
    api<Mentee>(`${B}/enrollments/${enrollmentId}`, { method: "PATCH", body }),
  docs: (cohortId: string) =>
    api<{ docs: CohortDocRow[]; builtin: { id: string; title: string }[] }>(`${B}/cohorts/${cohortId}/docs`),
  addDoc: (cohortId: string, body: { title: string; body: string }) => api<CohortDocRow>(`${B}/cohorts/${cohortId}/docs`, { body }),
  deleteDoc: (docId: string) => api<void>(`${B}/docs/${docId}`, { method: "DELETE" }),

  // Sprint 0: tasks & submissions
  tasks: (params: { mentee_id?: string; status?: InternTaskStatus } = {}) => api<InternTask[]>(`${B}/tasks${q(params)}`),
  createTask: (body: {
    mentee_id: string;
    title: string;
    description?: string;
    acceptance_criteria?: string;
    skill_area?: string;
    skill_tags?: string[];
    priority?: "High" | "Medium" | "Low";
    due_date?: string | null;
    week_number?: number;
  }) => api<InternTask>(`${B}/tasks`, { body }),
  patchTask: (id: string, body: Partial<Pick<InternTask, "title" | "description" | "acceptance_criteria" | "skill_area" | "skill_tags" | "priority" | "due_date" | "week_number" | "status" | "mentor_feedback">>) =>
    api<InternTask>(`${B}/tasks/${id}`, { method: "PATCH", body }),
  deleteTask: (id: string) => api<void>(`${B}/tasks/${id}`, { method: "DELETE" }),
  startTask: (id: string) => api<InternTask>(`${B}/tasks/${id}/start`, { method: "POST" }),
  flagBlocked: (id: string, reason: string) => api<InternTask>(`${B}/tasks/${id}/flag-blocked`, { body: { reason } }),
  /** 422 with detail {message, findings[]} when the code contains secrets (the code is not saved). */
  submitTask: (id: string, body: { notes?: string; submission_url?: string; code?: string; filename?: string; language?: string; ai_consent: boolean }) =>
    api<{ task: InternTask; submission: Submission }>(`${B}/tasks/${id}/submit`, { body }),
  submissions: (taskId: string) => api<Submission[]>(`${B}/tasks/${taskId}/submissions`),
  requestAiReview: (submissionId: string) => api<Submission>(`${B}/submissions/${submissionId}/request-ai-review`, { method: "POST" }),

  // Sprint 1: attendance & leave
  punchIn: (note?: string) => api<AttendancePayload>(`${B}/attendance/punch-in`, { body: { note } }),
  punchOut: (note?: string) => api<AttendancePayload>(`${B}/attendance/punch-out`, { body: { note } }),
  myAttendance: (start?: string, end?: string) => api<AttendancePayload>(`${B}/attendance/me${q({ start, end })}`),
  menteesAttendanceToday: (on?: string) => api<MenteeAttendanceToday[]>(`${B}/attendance/mentees${q({ on })}`),
  menteeAttendance: (menteeId: string, start?: string, end?: string) =>
    api<AttendancePayload>(`${B}/attendance/mentees/${menteeId}${q({ start, end })}`),
  correctSession: (sessionId: string, body: { punch_in_at?: string; punch_out_at: string; note: string }) =>
    api<AttendancePayload>(`${B}/attendance/sessions/${sessionId}/correct`, { body }),
  requestLeave: (body: { start_date: string; end_date: string; reason: string }) => api<LeaveRow>(`${B}/leave`, { body }),
  leave: () => api<LeaveRow[]>(`${B}/leave`),
  decideLeave: (id: string, approve: boolean) => api<LeaveRow>(`${B}/leave/${id}/decide`, { body: { approve } }),

  // Sprint 2: standup, Blocker Co-Pilot, stall alerts
  standupToday: () =>
    api<{ entry: StandupRow | null; suggested: { yesterday: string; task_id: string | null; task_title: string | null } }>(`${B}/standup/today`),
  submitStandup: (body: { yesterday: string; today: string; blockers: string; task_id?: string | null }) =>
    api<{ entry: StandupRow; copilot: BlockerAnswer | null }>(`${B}/standup`, { body }),
  standups: (params: { on?: string; mentee_id?: string } = {}) => api<StandupRow[]>(`${B}/standups${q(params)}`),
  askBlocker: (question: string, taskId?: string | null) => api<BlockerAnswer>(`${B}/blocker/ask`, { body: { question, task_id: taskId ?? null } }),
  blockerHistory: (menteeId?: string) => api<BlockerAnswer[]>(`${B}/blocker/history${q({ mentee_id: menteeId })}`),
  stallAlerts: (openOnly = true) => api<StallAlertRow[]>(`${B}/stall-alerts${q({ open_only: openOnly })}`),
  ackStall: (id: string) => api<{ id: string }>(`${B}/stall-alerts/${id}/ack`, { method: "POST" }),
  stallScan: () => api<{ created: number }>(`${B}/stall/scan`, { method: "POST" }),

  // Mentor approval inbox (all agents)
  approvals: (params: { status?: "pending" | "approved" | "rejected" | "all"; agent?: AgentKind } = {}) =>
    api<ApprovalDraft[]>(`${B}/approvals${q({ status: params.status ?? "pending", agent: params.agent })}`),
  approval: (id: string) => api<ApprovalDraft>(`${B}/approvals/${id}`),
  /** content = the mentor's edited version (validated server-side); omit to approve as drafted. */
  decide: (id: string, body: { action: "approve" | "reject"; content?: Record<string, unknown>; note?: string }) =>
    api<ApprovalDraft>(`${B}/approvals/${id}/decide`, { body }),

  // Sprint 4: weekly quiz & skills
  generateQuiz: (menteeId: string, weekNumber?: number) =>
    api<WeeklyQuiz>(`${B}/weekly-quizzes/generate`, { body: { mentee_id: menteeId, week_number: weekNumber } }),
  quizzes: (menteeId?: string) => api<WeeklyQuiz[]>(`${B}/weekly-quizzes${q({ mentee_id: menteeId })}`),
  quiz: (id: string) => api<WeeklyQuiz>(`${B}/weekly-quizzes/${id}`),
  submitQuiz: (id: string, answers: Record<string, string>) => api<WeeklyQuiz>(`${B}/weekly-quizzes/${id}/submit`, { body: { answers } }),
  skills: (menteeId?: string) =>
    api<{ mentee_id: string; skills: SkillScoreRow[]; min_questions_per_skill: number }>(`${B}/skills${q({ mentee_id: menteeId })}`),

  // Sprint 5: appraisals
  generateAppraisal: (menteeId: string, milestoneDay: 30 | 60 | 90) =>
    api<Appraisal>(`${B}/appraisals/generate`, { body: { mentee_id: menteeId, milestone_day: milestoneDay } }),
  appraisals: (menteeId?: string) => api<Appraisal[]>(`${B}/appraisals${q({ mentee_id: menteeId })}`),
  acknowledgeAppraisal: (id: string, comment: string) => api<Appraisal>(`${B}/appraisals/${id}/acknowledge`, { body: { comment } }),
};

/** Human label for a submission's AI review state (intern- and mentor-facing). */
export function reviewStatusLabel(s: ReviewStatus): string {
  switch (s) {
    case "published":
      return "Review published";
    case "awaiting_mentor":
    case "in_review":
    case "pending_review":
      return "Waiting for mentor review";
    case "not_consented":
      return "No AI review (consent not given)";
    case "ai_disabled":
      return "AI review is off for this cohort";
    case "rejected":
      return "Mentor will review personally";
    case "agent_unavailable":
    case "agent_failed":
      return "AI unavailable — mentor will review";
    default:
      return "Submitted";
  }
}

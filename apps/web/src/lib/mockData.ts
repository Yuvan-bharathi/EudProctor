import type {
  CodingChallenge,
  CommunicationAssessment,
  DailyAttendance,
  InternshipCohort,
  InternshipManager,
  InternshipMentee,
  InternshipTask,
  LeaveRequest,
  LearningTopic,
  MonthlyReviewRecord,
  WeeklyCurriculumTopic,
  WeeklyMCQAssessment,
} from "./types";

/**
 * Synthetic mock data for EduProctor Intelligence UI Showcase and fallback demonstrations.
 * Matches the reference designs from the design boards exactly:
 * - Mentor experience: Thermodynamics 101, Unit test 1/2/3, Live monitor, Proctoring timeline, AI Evaluation Summary.
 * - Candidate experience: Dashboard, Instructions, Identity Verification, Assessment Taking (calm proctoring), Practice.
 * - Admin experience: Platform overview, User management, Notes library, Agent runs, Audit logs.
 */

// Simulated realistic webcam snapshots for candidate proctoring evidence (SVG data URI)
export const MOCK_EVIDENCE_IMAGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" fill="%23242B35"/><circle cx="160" cy="110" r="54" fill="%234A5568" opacity="0.6"/><ellipse cx="160" cy="220" rx="90" ry="60" fill="%234A5568" opacity="0.6"/><circle cx="145" cy="105" r="5" fill="%23FFFFFF"/><circle cx="175" cy="105" r="5" fill="%23FFFFFF"/><path d="M 148 135 Q 160 142 172 135" stroke="%23FFFFFF" stroke-width="2.5" fill="none"/><rect x="100" y="50" width="120" height="130" rx="8" fill="none" stroke="%23D9786F" stroke-width="2" stroke-dasharray="4 3"/><text x="105" y="42" fill="%23D9786F" font-family="sans-serif" font-size="11" font-weight="bold">LOOK-AWAY (3.4s) - FLAG 1</text><text x="12" y="228" fill="%23A0AEC0" font-family="monospace" font-size="10">10:14:03 · CAM-01 · 92% CONF</text></svg>`;

export const MOCK_ID_VERIFY_IMAGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="360" height="270" viewBox="0 0 360 270"><rect width="360" height="270" fill="%231E2631"/><circle cx="180" cy="125" r="65" fill="%2368778D" opacity="0.7"/><ellipse cx="180" cy="255" rx="110" ry="70" fill="%2368778D" opacity="0.7"/><circle cx="162" cy="120" r="6" fill="%23E2E8F0"/><circle cx="198" cy="120" r="6" fill="%23E2E8F0"/><path d="M 165 155 Q 180 166 195 155" stroke="%23E2E8F0" stroke-width="3" fill="none"/><ellipse cx="180" cy="130" rx="95" ry="115" fill="none" stroke="%236BAE8A" stroke-width="2.5"/><text x="110" y="25" fill="%236BAE8A" font-family="sans-serif" font-size="12" font-weight="600">FACE ALIGNED · LIVENESS OK</text></svg>`;

export interface AssessmentCardData {
  id: string;
  title: string;
  course: string;
  status: "live" | "completed" | "scheduled" | "draft";
  questions: number;
  duration_min: number;
  started?: number;
  submitted?: number;
  total: number;
  createdBy?: string;
  createdDate?: string;
  targetRole?: string;
  scheduledDate?: string;
  scheduled_start?: string;
  scheduled_end?: string;
}

export const INITIAL_ASSESSMENTS: AssessmentCardData[] = [
  {
    id: "ut-3",
    title: "Unit test 3 - Applied Concepts",
    course: "Full Stack Development",
    status: "live",
    questions: 40,
    duration_min: 60,
    started: 28,
    total: 45,
    createdBy: "Priya Sharma (Tech Lead)",
    createdDate: "14 Jan 2026",
    targetRole: "Full Stack Engineer (SDE-2)",
  },
  {
    id: "ut-2",
    title: "Unit test 2 - Foundations",
    course: "Frontend",
    status: "completed",
    questions: 50,
    duration_min: 60,
    submitted: 45,
    total: 45,
    createdBy: "Rohan Mehta (Frontend Lead)",
    createdDate: "10 Jan 2026",
    targetRole: "Frontend Engineer (React/TS)",
  },
  {
    id: "ut-1",
    title: "Unit test 1 - Basics",
    course: "Backend",
    status: "completed",
    questions: 40,
    duration_min: 45,
    submitted: 45,
    total: 45,
    createdBy: "Priya Sharma (Tech Lead)",
    createdDate: "05 Jan 2026",
    targetRole: "Backend Engineer (Go/Node/Postgres)",
  },
  {
    id: "ut-4",
    title: "Midterm - Data Modeling & SQL",
    course: "Data Analyst",
    status: "scheduled",
    questions: 45,
    duration_min: 75,
    total: 40,
    createdBy: "Sneha Reddy (Hiring Manager)",
    createdDate: "12 Jan 2026",
    targetRole: "Data Analyst & SQL Specialist",
  },
  {
    id: "ut-5",
    title: "Final - Agentic AI & RAG Systems",
    course: "AI Engineer",
    status: "draft",
    questions: 35,
    duration_min: 90,
    total: 35,
    createdBy: "Vikram Singh (AI Lead)",
    createdDate: "15 Jan 2026",
    targetRole: "Agentic AI & LLM Systems",
  },
];

const STORAGE_ASSESSMENTS_KEY = "eduproctor_mock_assessments";
const STORAGE_EXAM_DETAILS_KEY_PREFIX = "eduproctor_exam_detail_";

export function getPersistedAssessments(): AssessmentCardData[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return INITIAL_ASSESSMENTS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_ASSESSMENTS_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_ASSESSMENTS_KEY, JSON.stringify(INITIAL_ASSESSMENTS));
      return INITIAL_ASSESSMENTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let modified = false;
      const sanitized = parsed.map((item: AssessmentCardData) => {
        const copy = { ...item };
        if (copy.createdBy && copy.createdBy.includes("Dr. ")) {
          copy.createdBy = copy.createdBy.replace(/Dr\.\s*/g, "");
          modified = true;
        }
        return copy;
      });
      if (modified) {
        window.localStorage.setItem(STORAGE_ASSESSMENTS_KEY, JSON.stringify(sanitized));
      }
      return sanitized;
    }
    return INITIAL_ASSESSMENTS;
  } catch {
    return INITIAL_ASSESSMENTS;
  }
}

export function saveAssessmentToStorage(
  newCard: AssessmentCardData,
  initialDetail?: Record<string, unknown>
): AssessmentCardData[] {
  const current = getPersistedAssessments();
  const existingIdx = current.findIndex((a) => a.id === newCard.id);
  let updated: AssessmentCardData[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...updated[existingIdx], ...newCard };
  } else {
    updated = [newCard, ...current];
  }

  // Keep in-memory array in sync
  mockAssessments = updated;

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_ASSESSMENTS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to persist assessments to localStorage", e);
    }
  }

  // Also initialize or update its exam detail
  if (initialDetail || !getStoredExamDetail(newCard.id)) {
    saveExamDetailToStorage(newCard.id, {
      id: newCard.id,
      course_id: "c1",
      course_name: newCard.course,
      title: newCard.title,
      duration_min: newCard.duration_min,
      window_start: new Date().toISOString(),
      window_end: new Date(Date.now() + 7 * 864e5).toISOString(),
      shuffle: true,
      flag_threshold_s: 3,
      glance_min_s: 1,
      max_flags: 3,
      status: newCard.status === "completed" ? "closed" : newCard.status === "live" ? "scheduled" : "draft",
      questions: mockQuestionsList,
      assignments: mockAssignmentsList,
      ...initialDetail,
    });
  }

  return updated;
}

export function getStoredExamDetail<T = Record<string, unknown>>(examId: string): T | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_EXAM_DETAILS_KEY_PREFIX}${examId}`);
    if (raw) {
      return JSON.parse(raw) as T;
    }
  } catch {
    // fallback
  }
  return null;
}

export function saveExamDetailToStorage<T = Record<string, unknown>>(examId: string, detail: Partial<T>): T {
  const existing = getStoredExamDetail<Record<string, unknown>>(examId);
  const assessments = getPersistedAssessments();
  const baseCard = assessments.find((a) => a.id === examId) ?? assessments[0];

  const merged = {
    id: examId,
    course_id: existing?.course_id ?? "c1",
    course_name: (detail as Record<string, unknown>)?.course_name ?? existing?.course_name ?? baseCard?.course ?? "Full Stack Development",
    title: (detail as Record<string, unknown>)?.title ?? existing?.title ?? baseCard?.title ?? "New Assessment",
    duration_min: (detail as Record<string, unknown>)?.duration_min ?? existing?.duration_min ?? baseCard?.duration_min ?? 60,
    window_start: (detail as Record<string, unknown>)?.window_start ?? existing?.window_start ?? new Date().toISOString(),
    window_end: (detail as Record<string, unknown>)?.window_end ?? existing?.window_end ?? new Date(Date.now() + 7 * 864e5).toISOString(),
    shuffle: (detail as Record<string, unknown>)?.shuffle ?? existing?.shuffle ?? true,
    flag_threshold_s: (detail as Record<string, unknown>)?.flag_threshold_s ?? existing?.flag_threshold_s ?? 3,
    glance_min_s: (detail as Record<string, unknown>)?.glance_min_s ?? existing?.glance_min_s ?? 1,
    max_flags: (detail as Record<string, unknown>)?.max_flags ?? existing?.max_flags ?? 3,
    status: (detail as Record<string, unknown>)?.status ?? existing?.status ?? (baseCard?.status === "completed" ? "closed" : baseCard?.status === "live" ? "scheduled" : "draft"),
    questions: (detail as Record<string, unknown>)?.questions ?? existing?.questions ?? mockQuestionsList,
    assignments: (detail as Record<string, unknown>)?.assignments ?? existing?.assignments ?? mockAssignmentsList,
    ...detail,
  };

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(`${STORAGE_EXAM_DETAILS_KEY_PREFIX}${examId}`, JSON.stringify(merged));
    } catch (e) {
      console.warn("Failed to persist exam detail to localStorage", e);
    }
  }

  // Keep card counts and title in sync with persisted list
  if (baseCard) {
    if (Array.isArray(merged.questions)) baseCard.questions = merged.questions.length;
    if (typeof merged.title === "string") baseCard.title = merged.title;
    if (typeof merged.course_name === "string") baseCard.course = merged.course_name;
    if (typeof merged.duration_min === "number") baseCard.duration_min = merged.duration_min;
    if (Array.isArray(merged.assignments)) baseCard.total = merged.assignments.length;

    mockAssessments = assessments;
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_ASSESSMENTS_KEY, JSON.stringify(assessments));
      } catch (e) {
        console.warn("Failed to persist updated base card", e);
      }
    }
  }

  return merged as unknown as T;
}

export function publishAndScheduleAssessment(
  assessmentId: string,
  scheduleDetails: {
    scheduledDate: string;
    windowStart: string;
    windowEnd: string;
    sendTestLinkEmails?: boolean;
  }
): { success: boolean; assessment: AssessmentCardData; dispatchedEmailsCount: number } {
  const list = getPersistedAssessments();
  const idx = list.findIndex((a) => a.id === assessmentId);
  const startTime = new Date(scheduleDetails.windowStart);
  const now = new Date();
  const isCurrentlyLive = startTime.getTime() <= now.getTime();
  const newStatus: "live" | "scheduled" = isCurrentlyLive ? "live" : "scheduled";

  let updatedAssessment: AssessmentCardData;
  if (idx >= 0) {
    updatedAssessment = {
      ...list[idx],
      status: newStatus,
      scheduledDate: scheduleDetails.scheduledDate,
      scheduled_start: scheduleDetails.windowStart,
      scheduled_end: scheduleDetails.windowEnd,
    };
    list[idx] = updatedAssessment;
  } else {
    updatedAssessment = {
      id: assessmentId,
      title: "Scheduled Assessment",
      course: "Full Stack Development",
      status: newStatus,
      questions: 40,
      duration_min: 60,
      total: 45,
      scheduledDate: scheduleDetails.scheduledDate,
      scheduled_start: scheduleDetails.windowStart,
      scheduled_end: scheduleDetails.windowEnd,
    };
    list.unshift(updatedAssessment);
  }

  // Persist updated assessments
  mockAssessments = list;
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(STORAGE_ASSESSMENTS_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("eduproctor_assessments_updated"));
  }

  // Update exam detail
  const existingDetail = getStoredExamDetail(assessmentId) || {};
  saveExamDetailToStorage(assessmentId, {
    ...existingDetail,
    id: assessmentId,
    status: newStatus === "live" ? "scheduled" : "scheduled",
    card_status: newStatus,
    window_start: scheduleDetails.windowStart,
    window_end: scheduleDetails.windowEnd,
  });

  const candidateCount = updatedAssessment.total || 45;

  if (scheduleDetails.sendTestLinkEmails !== false) {
    // 1. Log AI Email Sending Agent run
    saveAgentRunToStorage({
      id: `run-${Date.now()}`,
      assessment: updatedAssessment.title,
      runTime: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      agent: "Email Sending Agent",
      status: "Completed",
      tokensIn: 1100,
      tokensOut: 280,
      costUsd: 0.0028,
      latencyMs: 380,
      toolCalls: 1,
      summaryTitle: `Dispatched unique test links with proctoring access keys to ${candidateCount} candidates for scheduled slot: ${scheduleDetails.scheduledDate}`,
    });

    // 2. Log system Audit log
    saveAuditLogToStorage({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      actor: "mentor1@example.com",
      role: "Mentor",
      action: "Published & Scheduled Assessment",
      target: `${updatedAssessment.title} (${candidateCount} candidates notified)`,
      ip: "192.168.1.45",
      status: "Success",
    });
  }

  return {
    success: true,
    assessment: updatedAssessment,
    dispatchedEmailsCount: candidateCount,
  };
}

export let mockAssessments: AssessmentCardData[] = getPersistedAssessments();

export const mockMentorDashboard = {
  activeAssessments: 3,
  candidates: 128,
  submissions: 84,
  pendingReviews: 5,
  performanceData: [
    { topic: "Full Stack Dev", strong: 32, developing: 12, weak: 6 },
    { topic: "Frontend", strong: 28, developing: 18, weak: 8 },
    { topic: "Backend", strong: 24, developing: 16, weak: 11 },
    { topic: "Data Analyst", strong: 26, developing: 14, weak: 7 },
    { topic: "AI Engineer", strong: 30, developing: 15, weak: 5 },
  ],
  recentActivity: [
    {
      id: "1",
      title: "AI summary ready for review",
      detail: "Frontend · Unit test 2 Foundations",
      time: "10 min ago",
      type: "ai_review",
    },
    {
      id: "2",
      title: "New submission",
      detail: "Full Stack Development · Unit test 3",
      time: "28 min ago",
      type: "submission",
    },
    {
      id: "3",
      title: "Assessment link sent",
      detail: "Backend · Unit test 1 Basics",
      time: "2 hours ago",
      type: "link_sent",
    },
    {
      id: "4",
      title: "Note approved",
      detail: "AI Engineer · RAG & Vector Embeddings",
      time: "3 hours ago",
      type: "note_approved",
    },
  ],
};

export interface LiveCandidateRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  status: "In progress" | "Not started" | "Completed";
  flags: number;
  maxFlags: number;
  lastActivity: string;
  isGlancing?: boolean;
  glanceDetail?: string;
}

export const mockLiveCandidates: LiveCandidateRow[] = [
  {
    id: "c-1",
    name: "Arjun Mehta",
    email: "candidate01@example.com",
    phone: "+91 98765 43210",
    avatar: "AM",
    status: "In progress",
    flags: 1,
    maxFlags: 3,
    lastActivity: "2 min ago",
    isGlancing: true,
    glanceDetail: "looking away 1.8s",
  },
  {
    id: "c-2",
    name: "Kavya Nair",
    email: "candidate02@example.com",
    phone: "+91 98765 43211",
    avatar: "KN",
    status: "In progress",
    flags: 0,
    maxFlags: 3,
    lastActivity: "3 min ago",
  },
  {
    id: "c-3",
    name: "Neha Kapoor",
    email: "candidate03@example.com",
    phone: "+91 98765 43212",
    avatar: "NK",
    status: "In progress",
    flags: 2,
    maxFlags: 3,
    lastActivity: "1 min ago",
  },
  {
    id: "c-4",
    name: "Rohit Desai",
    email: "candidate04@example.com",
    phone: "+91 98765 43213",
    avatar: "RD",
    status: "Not started",
    flags: 0,
    maxFlags: 3,
    lastActivity: "—",
  },
  {
    id: "c-5",
    name: "Ananya Patel",
    email: "candidate05@example.com",
    phone: "+91 98765 43214",
    avatar: "AP",
    status: "Completed",
    flags: 0,
    maxFlags: 3,
    lastActivity: "18 min ago",
  },
];

export interface ProctoringTimelineItem {
  id: string;
  time: string;
  event: string;
  eventPill: "glance" | "red_flag" | "alert" | "blocked";
  direction?: string;
  duration: string;
  candidateNotified: "Yes" | "No";
  severity: "info" | "high" | "medium";
  hasEvidence?: boolean;
  evidenceUrl?: string;
  decision?: "dismiss" | "concern" | "escalate" | null;
  comment?: string;
}

export const mockProctoringTimeline: ProctoringTimelineItem[] = [
  {
    id: "p-1",
    time: "10:12:15",
    event: "Head glance (2.1 s)",
    eventPill: "glance",
    direction: "Left",
    duration: "2.1 s",
    candidateNotified: "No",
    severity: "info",
    hasEvidence: false,
    decision: null,
  },
  {
    id: "p-2",
    time: "10:14:03",
    event: "Look-away (3.4 s) · Red flag 1 of 3",
    eventPill: "red_flag",
    direction: "Right",
    duration: "3.4 s",
    candidateNotified: "Yes",
    severity: "high",
    hasEvidence: true,
    evidenceUrl: MOCK_EVIDENCE_IMAGE,
    decision: "concern",
    comment: "Turned to right side for 3.4 seconds.",
  },
  {
    id: "p-3",
    time: "10:16:22",
    event: "Tab switch detected",
    eventPill: "alert",
    direction: "—",
    duration: "1.2 s",
    candidateNotified: "Yes",
    severity: "medium",
    hasEvidence: false,
    decision: null,
  },
  {
    id: "p-4",
    time: "10:18:10",
    event: "Head glance (1.8 s)",
    eventPill: "glance",
    direction: "Down",
    duration: "1.8 s",
    candidateNotified: "No",
    severity: "info",
    hasEvidence: false,
    decision: null,
  },
  {
    id: "p-5",
    time: "10:20:05",
    event: "Copy attempt (blocked)",
    eventPill: "blocked",
    direction: "—",
    duration: "—",
    candidateNotified: "Yes",
    severity: "medium",
    hasEvidence: false,
    decision: null,
  },
];

export const mockCandidateDashboard = {
  upcomingAssessments: 2,
  recentResults: 1,
  practiceTopics: 5,
  completedPracticeSets: 3,
  nextAssessment: {
    id: "ut-3",
    title: "Unit test 3 - Applied Concepts",
    course: "Full Stack Development",
    scheduled: "15 Jan 2026, 10:00 AM",
    duration: "60 minutes",
    questions: 40,
    status: "Scheduled",
  },
  recentResult: {
    id: "ut-1",
    title: "Unit test 1 - Basics",
    course: "Backend",
    score: 82,
    status: "Published",
    publishedDate: "12 Jan 2026",
  },
};

export interface TopicMasteryItem {
  topic: string;
  scorePct: number;
  level: "Strong" | "Developing" | "Weak";
}

export interface RecommendedLearningTopic {
  targetArea: string;
  scorePct: number;
  recommendation: string;
  approvedNoteTitle: string;
  approvedNoteDescription: string;
  practiceCount: number;
  practiceTopicSlug: string;
}

export interface EmailReportPreview {
  to: string;
  from: string;
  subject: string;
  sentAt: string;
  candidateName: string;
  candidateEmail: string;
  examTitle: string;
  courseName: string;
  mentorName: string;
  overallScorePct: number;
  pointsObtained: number;
  totalPoints: number;
  classPercentile: number;
  topicMastery: TopicMasteryItem[];
  targetArea: string;
  recommendation: string;
  approvedNoteTitle: string;
  practiceLink: string;
}

export interface CandidateAssessmentResult {
  id: string;
  examId: string;
  examTitle: string;
  courseName: string;
  mentorName: string;
  candidateName: string;
  candidateEmail: string;
  submittedAt: string;
  publishedAt: string | null;
  status: "published" | "pending_review";
  overallScorePct: number;
  pointsObtained: number;
  totalPoints: number;
  classPercentile: number;
  classAveragePct: number;
  topicProgressPct: number;
  topicMastery: TopicMasteryItem[];
  recommendations: RecommendedLearningTopic[];
  emailSent: boolean;
  emailSentAt?: string | null;
}

export const INITIAL_CANDIDATE_RESULTS: CandidateAssessmentResult[] = [
  {
    id: "res-ut-1",
    examId: "ut-1",
    examTitle: "Unit test 1 - Basics",
    courseName: "Thermodynamics 101",
    mentorName: "Priya Sharma",
    candidateName: "Arjun Mehta",
    candidateEmail: "candidate01@example.com",
    submittedAt: "12 Jan 2026, 11:30 AM",
    publishedAt: "12 Jan 2026, 02:15 PM",
    status: "published",
    overallScorePct: 78,
    pointsObtained: 39,
    totalPoints: 50,
    classPercentile: 84,
    classAveragePct: 71,
    topicProgressPct: 6,
    topicMastery: [
      { topic: "Heat transfer", scorePct: 88, level: "Strong" },
      { topic: "Entropy & Second Law", scorePct: 70, level: "Developing" },
      { topic: "First law", scorePct: 45, level: "Weak" },
    ],
    recommendations: [
      {
        targetArea: "First Law Sign Conventions",
        scorePct: 45,
        recommendation:
          "You mixed up heat and work sign conventions during isobaric expansion problems. Study the approved note below and complete the 8-question practice set to measure your improvement.",
        approvedNoteTitle: "Energy balance basics",
        approvedNoteDescription: "Core syllabus • Approved by mentor",
        practiceCount: 8,
        practiceTopicSlug: "First Law",
      },
    ],
    emailSent: true,
    emailSentAt: "12 Jan 2026, 02:16 PM",
  },
  {
    id: "res-ut-2",
    examId: "ut-2",
    examTitle: "Unit test 2 - Foundations",
    courseName: "Frontend",
    mentorName: "Rohan Mehta",
    candidateName: "Arjun Mehta",
    candidateEmail: "candidate01@example.com",
    submittedAt: "14 Jan 2026, 03:20 PM",
    publishedAt: null,
    status: "pending_review",
    overallScorePct: 82,
    pointsObtained: 41,
    totalPoints: 50,
    classPercentile: 88,
    classAveragePct: 73,
    topicProgressPct: 8,
    topicMastery: [
      { topic: "CSS Grid & Flexbox", scorePct: 92, level: "Strong" },
      { topic: "DOM Events & Bubbling", scorePct: 78, level: "Developing" },
      { topic: "Custom Hook Lifecycles", scorePct: 48, level: "Weak" },
    ],
    recommendations: [
      {
        targetArea: "React Hooks & Dependency Arrays",
        scorePct: 48,
        recommendation:
          "You missed cleanup cycles in useEffect event listeners and stale closures. Review the approved note on modern React lifecycle hooks and attempt the 8 practice questions.",
        approvedNoteTitle: "Modern React Hook Dependencies",
        approvedNoteDescription: "Frontend Core • Approved by mentor",
        practiceCount: 8,
        practiceTopicSlug: "React Hooks",
      },
    ],
    emailSent: false,
  },
  {
    id: "res-ut-3",
    examId: "ut-3",
    examTitle: "Unit test 3 - Applied Concepts",
    courseName: "Full Stack Development",
    mentorName: "Priya Sharma",
    candidateName: "Arjun Mehta",
    candidateEmail: "candidate01@example.com",
    submittedAt: "15 Jan 2026, 10:15 AM",
    publishedAt: null,
    status: "pending_review",
    overallScorePct: 85,
    pointsObtained: 34,
    totalPoints: 40,
    classPercentile: 91,
    classAveragePct: 74,
    topicProgressPct: 9,
    topicMastery: [
      { topic: "Next.js App Router & SSR", scorePct: 90, level: "Strong" },
      { topic: "REST & API Route Handlers", scorePct: 75, level: "Developing" },
      { topic: "Database Transaction Isolation", scorePct: 42, level: "Weak" },
    ],
    recommendations: [
      {
        targetArea: "PostgreSQL Isolation Levels & Deadlocks",
        scorePct: 42,
        recommendation:
          "You encountered confusion between Repeatable Read and Serializable concurrency anomalies. Review transaction isolation semantics before completing the 8 targeted practice items.",
        approvedNoteTitle: "PostgreSQL Indexing & Optimization",
        approvedNoteDescription: "Backend Core • Approved by mentor",
        practiceCount: 8,
        practiceTopicSlug: "Database Isolation",
      },
    ],
    emailSent: false,
  },
];

export const STORAGE_CANDIDATE_RESULTS_KEY = "eduproctor_candidate_results";
export const STORAGE_AGENT_RUNS_KEY = "eduproctor_agent_runs";
export const STORAGE_AUDIT_LOGS_KEY = "eduproctor_audit_logs";

export function getPersistedResults(): CandidateAssessmentResult[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return INITIAL_CANDIDATE_RESULTS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_CANDIDATE_RESULTS_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_CANDIDATE_RESULTS_KEY, JSON.stringify(INITIAL_CANDIDATE_RESULTS));
      return INITIAL_CANDIDATE_RESULTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let modified = false;
      const sanitized = parsed.map((item: CandidateAssessmentResult) => {
        const copy = { ...item };
        if (copy.mentorName && copy.mentorName.includes("Dr. ")) {
          copy.mentorName = copy.mentorName.replace(/Dr\.\s*/g, "");
          modified = true;
        }
        if (copy.candidateName && copy.candidateName.includes("Dr. ")) {
          copy.candidateName = copy.candidateName.replace(/Dr\.\s*/g, "");
          modified = true;
        }
        return copy;
      });
      if (modified) {
        window.localStorage.setItem(STORAGE_CANDIDATE_RESULTS_KEY, JSON.stringify(sanitized));
      }
      return sanitized;
    }
    return INITIAL_CANDIDATE_RESULTS;
  } catch {
    return INITIAL_CANDIDATE_RESULTS;
  }
}

export function saveResultsToStorage(results: CandidateAssessmentResult[]): CandidateAssessmentResult[] {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_CANDIDATE_RESULTS_KEY, JSON.stringify(results));
      window.dispatchEvent(new CustomEvent("eduproctor_results_updated", { detail: results }));
    } catch (e) {
      console.warn("Failed to persist results to localStorage", e);
    }
  }
  return results;
}

export function getCandidateResultByExamId(examId: string): CandidateAssessmentResult | undefined {
  const all = getPersistedResults();
  return all.find((r) => r.examId === examId);
}

export function saveCandidateSubmission(
  examId: string,
  answers: Record<number, string>,
  totalQuestions: number
): CandidateAssessmentResult {
  const allResults = getPersistedResults();
  const assessments = getPersistedAssessments();
  const exam = assessments.find((a) => a.id === examId) ?? assessments[0];

  const answeredCount = Object.keys(answers).length;
  const scorePct = totalQuestions > 0 ? Math.min(100, Math.max(40, Math.round((answeredCount / totalQuestions) * 100))) : 80;
  const pointsObtained = Math.round((scorePct / 100) * totalQuestions);

  const existingIdx = allResults.findIndex((r) => r.examId === examId);
  const now = new Date().toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const updatedResult: CandidateAssessmentResult = {
    id: existingIdx >= 0 ? allResults[existingIdx].id : `res-${examId}-${Date.now().toString().slice(-4)}`,
    examId,
    examTitle: exam?.title ?? "Unit test",
    courseName: exam?.course ?? "Full Stack Development",
    mentorName: "Priya Sharma",
    candidateName: "Arjun Mehta",
    candidateEmail: "candidate01@example.com",
    submittedAt: now,
    publishedAt: null,
    status: "pending_review",
    overallScorePct: scorePct,
    pointsObtained,
    totalPoints: totalQuestions,
    classPercentile: Math.min(99, scorePct + 6),
    classAveragePct: Math.max(50, scorePct - 7),
    topicProgressPct: Math.max(1, Math.floor(scorePct / 10)),
    topicMastery: [
      { topic: `${exam?.course ?? "Core"} Architecture`, scorePct: Math.min(96, scorePct + 10), level: "Strong" },
      { topic: "API & Data Flow Integration", scorePct: Math.max(65, scorePct - 8), level: "Developing" },
      { topic: "Edge Cases & Concurrency", scorePct: Math.max(40, scorePct - 35), level: "Weak" },
    ],
    recommendations: [
      {
        targetArea: `${exam?.course ?? "Core"} Sign Conventions & State Management`,
        scorePct: Math.max(40, scorePct - 35),
        recommendation: `Target misconception regarding asynchronous execution and boundaries in ${exam?.course ?? "this subject"}. Study the approved note below and complete the 8-question practice set to measure your improvement.`,
        approvedNoteTitle: "Energy balance basics",
        approvedNoteDescription: "Core syllabus • Approved by mentor",
        practiceCount: 8,
        practiceTopicSlug: exam?.course ?? "Full Stack Development",
      },
    ],
    emailSent: false,
  };

  let newResults: CandidateAssessmentResult[];
  if (existingIdx >= 0) {
    newResults = [...allResults];
    newResults[existingIdx] = updatedResult;
  } else {
    newResults = [updatedResult, ...allResults];
  }

  saveResultsToStorage(newResults);

  // Trigger Assessment Evaluation Agent Run
  saveAgentRunToStorage({
    id: `run-eval-${Date.now().toString().slice(-4)}`,
    assessment: exam?.title ?? "Assessment",
    runTime: "Just now",
    agent: "Assessment Evaluation Agent",
    status: "Completed",
    tokensIn: 1820,
    tokensOut: 490,
    costUsd: 0.0094,
    latencyMs: 1320,
    toolCalls: 4,
    summaryTitle: `Generated evaluation summary and topic mastery for candidate Arjun Mehta (${exam?.title ?? "Exam"}).`,
  });

  return updatedResult;
}

export function publishCandidateResult(examId: string): {
  result: CandidateAssessmentResult;
  agentRun: AgentRunRow;
  emailPreview: EmailReportPreview;
} {
  const allResults = getPersistedResults();
  let target = allResults.find((r) => r.examId === examId);

  const now = new Date().toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!target) {
    target = {
      id: `res-${examId}`,
      examId,
      examTitle: "Unit test 1 - Basics",
      courseName: "Thermodynamics 101",
      mentorName: "Priya Sharma",
      candidateName: "Arjun Mehta",
      candidateEmail: "candidate01@example.com",
      submittedAt: now,
      publishedAt: now,
      status: "published",
      overallScorePct: 78,
      pointsObtained: 39,
      totalPoints: 50,
      classPercentile: 84,
      classAveragePct: 71,
      topicProgressPct: 6,
      topicMastery: [
        { topic: "Heat transfer", scorePct: 88, level: "Strong" },
        { topic: "Entropy & Second Law", scorePct: 70, level: "Developing" },
        { topic: "First law", scorePct: 45, level: "Weak" },
      ],
      recommendations: [
        {
          targetArea: "First Law Sign Conventions",
          scorePct: 45,
          recommendation:
            "You mixed up heat and work sign conventions during isobaric expansion problems. Study the approved note below and complete the 8-question practice set to measure your improvement.",
          approvedNoteTitle: "Energy balance basics",
          approvedNoteDescription: "Core syllabus • Approved by mentor",
          practiceCount: 8,
          practiceTopicSlug: "First Law",
        },
      ],
      emailSent: true,
      emailSentAt: now,
    };
  }

  // ACTION 1: Publish the result so it becomes visible on Candidate's portal in "My Results"
  const publishedResult: CandidateAssessmentResult = {
    ...target,
    status: "published",
    publishedAt: now,
    emailSent: true,
    emailSentAt: now,
  };

  const updatedResults = allResults.map((r) => (r.examId === examId ? publishedResult : r));
  if (!allResults.some((r) => r.examId === examId)) {
    updatedResults.unshift(publishedResult);
  }
  saveResultsToStorage(updatedResults);

  // ACTION 2: Trigger AI Email Dispatch Agent to dispatch personalized student scorecard & practice link
  const agentRun: AgentRunRow = {
    id: `run-email-${Date.now().toString().slice(-4)}`,
    assessment: publishedResult.examTitle,
    runTime: "Just now",
    agent: "Email & Practice Dispatch Agent",
    status: "Completed",
    tokensIn: 1540,
    tokensOut: 620,
    costUsd: 0.0084,
    latencyMs: 910,
    toolCalls: 3,
    summaryTitle: `Dispatched student performance report & closed-loop practice link to ${publishedResult.candidateEmail}.`,
  };
  saveAgentRunToStorage(agentRun);

  // Register in System Audit Trail
  saveAuditLogToStorage({
    id: `aud-${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
    actor: "mentor1@example.com",
    role: "Mentor",
    action: "Published Result & Dispatched Email Report",
    target: `${publishedResult.candidateName} (${publishedResult.candidateEmail}) · ${publishedResult.examTitle}`,
    ip: "192.168.1.45",
    status: "Success",
  });

  const emailPreview: EmailReportPreview = {
    to: publishedResult.candidateEmail,
    from: "EduProctor Intelligence Agent <agent@eduproctor.ai>",
    subject: `Your Assessment Results & Recommended Practice: ${publishedResult.examTitle}`,
    sentAt: now,
    candidateName: publishedResult.candidateName,
    candidateEmail: publishedResult.candidateEmail,
    examTitle: publishedResult.examTitle,
    courseName: publishedResult.courseName,
    mentorName: publishedResult.mentorName,
    overallScorePct: publishedResult.overallScorePct,
    pointsObtained: publishedResult.pointsObtained,
    totalPoints: publishedResult.totalPoints,
    classPercentile: publishedResult.classPercentile,
    topicMastery: publishedResult.topicMastery,
    targetArea: publishedResult.recommendations[0]?.targetArea ?? "First Law Sign Conventions",
    recommendation:
      publishedResult.recommendations[0]?.recommendation ??
      "Review the approved note and attempt the targeted practice set.",
    approvedNoteTitle: publishedResult.recommendations[0]?.approvedNoteTitle ?? "Energy balance basics",
    practiceLink: `/candidate/practice?topic=${encodeURIComponent(publishedResult.recommendations[0]?.practiceTopicSlug || "fundamentals")}&examId=${publishedResult.examId}`,
  };

  return {
    result: publishedResult,
    agentRun,
    emailPreview,
  };
}

export const mockAdminOverview = {
  courses: 12,
  mentors: 48,
  candidates: 1240,
  assessments: 36,
  timeRange: "Last 30 days",
  completionRate: {
    completed: 82,
    inProgress: 12,
    notStarted: 6,
  },
  assessmentsOverTime: [
    { date: "9 Jan", count: 18 },
    { date: "16 Jan", count: 26 },
    { date: "23 Jan", count: 32 },
    { date: "29 Jan", count: 36 },
  ],
};

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: "Mentor" | "Candidate" | "Admin";
  status: "Active" | "Inactive";
}

export const mockAdminUsers: AdminUserRow[] = [
  { id: "u-1", name: "Priya Sharma", email: "priya@college.edu", role: "Mentor", status: "Active" },
  { id: "u-2", name: "Arjun Mehta", email: "arjun@example.com", role: "Candidate", status: "Active" },
  { id: "u-3", name: "Kavya Nair", email: "kavya@example.com", role: "Candidate", status: "Active" },
  { id: "u-4", name: "Rohit Desai", email: "rohit@college.edu", role: "Mentor", status: "Inactive" },
  { id: "u-5", name: "Neha Kapoor", email: "neha@example.com", role: "Candidate", status: "Active" },
];

export interface NoteLibraryRow {
  id: string;
  title: string;
  topic: string;
  level: "Intro" | "Core" | "Advanced";
  status: "Approved" | "Pending review" | "Withdrawn";
}

export const mockNotesLibrary: NoteLibraryRow[] = [
  { id: "n-1", title: "React Server Components & SSR", topic: "Full Stack Development", level: "Core", status: "Approved" },
  { id: "n-2", title: "Modern CSS Grid & Flexbox", topic: "Frontend", level: "Intro", status: "Approved" },
  { id: "n-3", title: "PostgreSQL Indexing & Optimization", topic: "Backend", level: "Advanced", status: "Approved" },
  { id: "n-4", title: "Window Functions & CTEs in SQL", topic: "Data Analyst", level: "Core", status: "Approved" },
  { id: "n-5", title: "RAG Architecture & Vector Embeddings", topic: "AI Engineer", level: "Advanced", status: "Approved" },
  { id: "n-6", title: "Microservices Auth with JWT & Redis", topic: "Backend", level: "Core", status: "Pending review" },
  { id: "n-7", title: "Prompt Engineering & Few-Shot In-Context", topic: "AI Engineer", level: "Intro", status: "Approved" },
];

export interface AgentRunRow {
  id: string;
  assessment: string;
  runTime: string;
  agent: string;
  status: "Completed" | "Failed" | "Running";
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  toolCalls: number;
  summaryTitle: string;
}

export const INITIAL_AGENT_RUNS: AgentRunRow[] = [
  {
    id: "run-01",
    assessment: "Unit test 2",
    runTime: "14 Jan, 10:32",
    agent: "Assessment Evaluation Agent",
    status: "Completed",
    tokensIn: 1840,
    tokensOut: 480,
    costUsd: 0.0096,
    latencyMs: 1420,
    toolCalls: 4,
    summaryTitle: "Generated evaluation summary for Unit test 2 cohort.",
  },
  {
    id: "run-02",
    assessment: "Unit test 1",
    runTime: "10 Jan, 15:28",
    agent: "Assessment Evaluation Agent",
    status: "Completed",
    tokensIn: 1620,
    tokensOut: 410,
    costUsd: 0.0084,
    latencyMs: 1250,
    toolCalls: 3,
    summaryTitle: "Computed topic mastery and recommended practice notes.",
  },
  {
    id: "run-03",
    assessment: "Mock test 1",
    runTime: "08 Jan, 11:05",
    agent: "Question Bank Agent",
    status: "Failed",
    tokensIn: 920,
    tokensOut: 110,
    costUsd: 0.0036,
    latencyMs: 820,
    toolCalls: 1,
    summaryTitle: "Failed: Approved note library returned zero matches for topic 'Radiation'.",
  },
  {
    id: "run-04",
    assessment: "Unit test 3",
    runTime: "14 Jan, 09:12",
    agent: "Assessment Evaluation Agent",
    status: "Running",
    tokensIn: 2100,
    tokensOut: 520,
    costUsd: 0.0135,
    latencyMs: 1850,
    toolCalls: 5,
    summaryTitle: "Evaluating session submissions and drafting topic pills...",
  },
];

export function getPersistedAgentRuns(): AgentRunRow[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return INITIAL_AGENT_RUNS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_AGENT_RUNS_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_AGENT_RUNS_KEY, JSON.stringify(INITIAL_AGENT_RUNS));
      return INITIAL_AGENT_RUNS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_AGENT_RUNS;
  } catch {
    return INITIAL_AGENT_RUNS;
  }
}

export function saveAgentRunToStorage(run: AgentRunRow): AgentRunRow[] {
  const current = getPersistedAgentRuns();
  const updated = [run, ...current];
  mockAgentRuns = updated;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_AGENT_RUNS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("eduproctor_agent_runs_updated", { detail: updated }));
    } catch (e) {
      console.warn("Failed to persist agent runs to localStorage", e);
    }
  }
  return updated;
}

export let mockAgentRuns: AgentRunRow[] = getPersistedAgentRuns();

export interface AuditLogRow {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  ip: string;
  status: "Success" | "Flagged" | "Rejected";
}

export const INITIAL_AUDIT_LOGS: AuditLogRow[] = [
  {
    id: "aud-1",
    timestamp: "2025-01-15 10:22:14",
    actor: "mentor1@example.com",
    role: "Mentor",
    action: "Approved Evaluation Summary",
    target: "Summary #sum-402 (Unit test 2)",
    ip: "192.168.1.45",
    status: "Success",
  },
  {
    id: "aud-2",
    timestamp: "2025-01-15 10:14:03",
    actor: "system_detector",
    role: "Proctor Engine",
    action: "Raised Red Flag 1/3",
    target: "candidate01 (Look-away 3.4s)",
    ip: "192.168.1.108",
    status: "Flagged",
  },
  {
    id: "aud-3",
    timestamp: "2025-01-15 09:00:00",
    actor: "mentor1@example.com",
    role: "Mentor",
    action: "Sent Assessment Access Links",
    target: "Unit test 3 (45 candidates)",
    ip: "192.168.1.45",
    status: "Success",
  },
  {
    id: "aud-4",
    timestamp: "2025-01-14 18:30:22",
    actor: "admin@example.com",
    role: "Admin",
    action: "Approved Learning Note",
    target: "Note: Heat transfer modes",
    ip: "10.0.0.12",
    status: "Success",
  },
  {
    id: "aud-5",
    timestamp: "2025-01-14 16:15:08",
    actor: "candidate01@example.com",
    role: "Candidate",
    action: "Completed Liveness & Face Verification",
    target: "Session #ses-912",
    ip: "192.168.1.108",
    status: "Success",
  },
];

export function getPersistedAuditLogs(): AuditLogRow[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return INITIAL_AUDIT_LOGS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_AUDIT_LOGS_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_AUDIT_LOGS_KEY, JSON.stringify(INITIAL_AUDIT_LOGS));
      return INITIAL_AUDIT_LOGS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let modified = false;
      const sanitized = parsed.map((item: AuditLogRow) => {
        const copy = { ...item };
        if (copy.actor && copy.actor.includes("Dr. ")) {
          copy.actor = copy.actor.replace(/Dr\.\s*/g, "");
          modified = true;
        }
        return copy;
      });
      if (modified) {
        window.localStorage.setItem(STORAGE_AUDIT_LOGS_KEY, JSON.stringify(sanitized));
      }
      return sanitized;
    }
    return INITIAL_AUDIT_LOGS;
  } catch {
    return INITIAL_AUDIT_LOGS;
  }
}

export function saveAuditLogToStorage(log: AuditLogRow): AuditLogRow[] {
  const current = getPersistedAuditLogs();
  const updated = [log, ...current];
  mockAuditLogs = updated;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_AUDIT_LOGS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("eduproctor_audit_logs_updated", { detail: updated }));
    } catch (e) {
      console.warn("Failed to persist audit logs to localStorage", e);
    }
  }
  return updated;
}

export let mockAuditLogs: AuditLogRow[] = getPersistedAuditLogs();

// Enhanced Admin Overview data matching reference design images 1, 2, 3, 4
export interface ActivityPoint {
  date: string;
  scheduled: number;
  completed: number;
  flagged: number;
}

export const mockAssessmentActivity: ActivityPoint[] = [
  { date: "Jan 1", scheduled: 48, completed: 32, flagged: 18 },
  { date: "Jan 5", scheduled: 62, completed: 40, flagged: 22 },
  { date: "Jan 10", scheduled: 95, completed: 58, flagged: 26 },
  { date: "Jan 15", scheduled: 78, completed: 52, flagged: 24 },
  { date: "Jan 20", scheduled: 110, completed: 74, flagged: 32 },
  { date: "Jan 25", scheduled: 125, completed: 88, flagged: 35 },
  { date: "Jan 31", scheduled: 175, completed: 112, flagged: 45 },
];

export const mockAssessmentOutcomes = {
  total: 6920,
  strong: { pct: 38, count: 2630 },
  developing: { pct: 42, count: 2906 },
  weak: { pct: 20, count: 1384 },
};

export const mockUserDistribution = {
  total: 1248,
  candidates: { pct: 86, count: 1082 },
  mentors: { pct: 10, count: 124 },
  admins: { pct: 2, count: 28 },
  inactive: { pct: 2, count: 14 },
};

export interface SystemHealthService {
  id: string;
  name: string;
  status: "Healthy" | "Degraded" | "Down";
  latency: string;
  uptime: string;
  description: string;
}

export const mockSystemHealth: SystemHealthService[] = [
  {
    id: "api",
    name: "API Server",
    status: "Healthy",
    latency: "32 ms",
    uptime: "99.98%",
    description: "REST & GraphQL gateways handling auth and session orchestration.",
  },
  {
    id: "db",
    name: "Database (PostgreSQL)",
    status: "Healthy",
    latency: "18 ms",
    uptime: "99.99%",
    description: "Primary relational storage with multi-AZ replication.",
  },
  {
    id: "redis",
    name: "Queue (Redis)",
    status: "Healthy",
    latency: "12 ms",
    uptime: "100.0%",
    description: "In-memory message broker for glance events and telemetry queuing.",
  },
  {
    id: "agent",
    name: "Agent Service",
    status: "Healthy",
    latency: "41 ms",
    uptime: "99.95%",
    description: "Evaluator agent pipeline generating draft summaries.",
  },
  {
    id: "proctor",
    name: "Proctoring Engine",
    status: "Healthy",
    latency: "15 ms",
    uptime: "99.97%",
    description: "Client-side MediaPipe landmark analyzer & glance classifier.",
  },
  {
    id: "storage",
    name: "Storage (Evidence)",
    status: "Healthy",
    latency: "26 ms",
    uptime: "100.0%",
    description: "Encrypted object store holding temporary mentor-only glance snapshots.",
  },
];

export interface TopCourseItem {
  course: string;
  assessments: number;
  candidates: number;
  completionRate: number;
}

export const mockTopCourses: TopCourseItem[] = [
  { course: "Full Stack Development", assessments: 48, candidates: 412, completionRate: 84 },
  { course: "Frontend", assessments: 36, candidates: 328, completionRate: 88 },
  { course: "Backend", assessments: 42, candidates: 350, completionRate: 79 },
  { course: "Data Analyst", assessments: 30, candidates: 290, completionRate: 82 },
  { course: "AI Engineer", assessments: 34, candidates: 315, completionRate: 76 },
];

export interface PendingActionItem {
  id: string;
  title: string;
  desc: string;
  count: number;
  severity: "danger" | "warning" | "info";
  path: string;
}

export const mockPendingActions: PendingActionItem[] = [
  {
    id: "p1",
    title: "Summaries Awaiting Review",
    desc: "AI draft summaries need mentor approval",
    count: 6,
    severity: "danger",
    path: "/mentor/sessions/s1/summary",
  },
  {
    id: "p2",
    title: "Flagged Sessions to Review",
    desc: "High severity flags pending review",
    count: 14,
    severity: "danger",
    path: "/mentor/exams/ut-3/live",
  },
  {
    id: "p3",
    title: "New Mentor Requests",
    desc: "New faculty accounts waiting for verification",
    count: 3,
    severity: "warning",
    path: "/admin/users",
  },
  {
    id: "p4",
    title: "New Course Requests",
    desc: "Pending syllabus & curriculum approvals",
    count: 2,
    severity: "info",
    path: "/admin/notes",
  },
  {
    id: "p5",
    title: "Agent Runs with Errors",
    desc: "Failed or incomplete runs requiring retry",
    count: 4,
    severity: "danger",
    path: "/admin/agent",
  },
];

export interface FlaggedSessionRecent {
  id: string;
  candidateName: string;
  email: string;
  avatar: string;
  assessment: string;
  course: string;
  flags: number;
  lastFlag: string;
  status: "Under Review" | "Reviewed";
}

export const mockFlaggedSessionsRecent: FlaggedSessionRecent[] = [
  {
    id: "fs1",
    candidateName: "Aarav Kumar",
    email: "aarav.k@college.edu",
    avatar: "AK",
    assessment: "Unit test 3",
    course: "Thermodynamics 101",
    flags: 3,
    lastFlag: "10:24 AM",
    status: "Under Review",
  },
  {
    id: "fs2",
    candidateName: "Sneha Reddy",
    email: "sneha.r@college.edu",
    avatar: "SR",
    assessment: "Unit test 2",
    course: "Thermodynamics 101",
    flags: 2,
    lastFlag: "9:18 AM",
    status: "Reviewed",
  },
  {
    id: "fs3",
    candidateName: "Rohan Mehta",
    email: "rohan.m@college.edu",
    avatar: "RM",
    assessment: "Mid term 1",
    course: "Fluid Mechanics",
    flags: 1,
    lastFlag: "9:03 AM",
    status: "Reviewed",
  },
  {
    id: "fs4",
    candidateName: "Ananya Patel",
    email: "ananya.p@college.edu",
    avatar: "AP",
    assessment: "Unit test 1",
    course: "Heat Transfer",
    flags: 3,
    lastFlag: "8:47 AM",
    status: "Under Review",
  },
  {
    id: "fs5",
    candidateName: "Vikram Singh",
    email: "vikram.s@college.edu",
    avatar: "VS",
    assessment: "Unit test 1",
    course: "Engineering Math",
    flags: 1,
    lastFlag: "8:12 AM",
    status: "Reviewed",
  },
];

export interface PlatformActivityItem {
  id: string;
  time: string;
  type: string;
  details: string;
  user: string;
  status: "Success" | "Failed";
}

export const mockPlatformActivity: PlatformActivityItem[] = [
  {
    id: "pa-1",
    time: "10:24 AM",
    type: "Assessment Created",
    details: "Unit test 3 - Thermodynamics 101",
    user: "Priya Sharma",
    status: "Success",
  },
  {
    id: "pa-2",
    time: "10:18 AM",
    type: "Note Approved",
    details: "Heat Transfer Basics",
    user: "Rohan Mehta",
    status: "Success",
  },
  {
    id: "pa-3",
    time: "09:56 AM",
    type: "Agent Run Completed",
    details: "AI Summary Drafted",
    user: "System (Agent)",
    status: "Success",
  },
  {
    id: "pa-4",
    time: "09:42 AM",
    type: "User Added",
    details: "aarav.kumar@college.edu",
    user: "Admin",
    status: "Success",
  },
  {
    id: "pa-5",
    time: "09:15 AM",
    type: "Assessment Published",
    details: "Mid term 1",
    user: "Sneha Reddy",
    status: "Success",
  },
  {
    id: "pa-6",
    time: "08:51 AM",
    type: "Agent Run Failed",
    details: "Evaluation summary (timeout)",
    user: "System (Agent)",
    status: "Failed",
  },
];

export const mockAgentUsage = {
  totalRuns: 248,
  change: "+16% vs last month",
  tools: [
    { name: "Summary Drafting", count: 162, pct: 65 },
    { name: "Question Suggestions", count: 48, pct: 19 },
    { name: "Note Retrieval", count: 28, pct: 11 },
    { name: "Other Tools", count: 10, pct: 5 },
  ],
};

// Mock data for Exam Results & Item Analysis (/mentor/results, /mentor/exams/:examId/results)
export const mockExamAnalytics = {
  n_scored: 45,
  average_pct: 81,
  score_buckets: [
    { range: "0-49%", count: 2 },
    { range: "50-69%", count: 10 },
    { range: "70-84%", count: 23 },
    { range: "85-100%", count: 10 },
  ],
  topics: [
    {
      topic_id: "t1",
      name: "Full Stack Development",
      average_pct: 84,
      average_cls: "strong" as const,
      strong: 32,
      developing: 10,
      weak: 3,
      insufficient: 0,
    },
    {
      topic_id: "t2",
      name: "Frontend",
      average_pct: 82,
      average_cls: "strong" as const,
      strong: 30,
      developing: 11,
      weak: 4,
      insufficient: 0,
    },
    {
      topic_id: "t3",
      name: "Backend",
      average_pct: 76,
      average_cls: "developing" as const,
      strong: 24,
      developing: 16,
      weak: 5,
      insufficient: 0,
    },
    {
      topic_id: "t4",
      name: "Data Analyst",
      average_pct: 79,
      average_cls: "strong" as const,
      strong: 27,
      developing: 13,
      weak: 5,
      insufficient: 0,
    },
    {
      topic_id: "t5",
      name: "AI Engineer",
      average_pct: 75,
      average_cls: "developing" as const,
      strong: 23,
      developing: 17,
      weak: 5,
      insufficient: 0,
    },
  ],
};

export const mockExamResults = [
  {
    session_id: "s1",
    candidate_name: "Arjun Mehta",
    status: "completed",
    score_pct: 85,
    percentile: 88,
    n_unmarked: 0,
    topics: [
      { topic_id: "t1", name: "Full Stack Development", score_pct: 90, cls: "strong" as const, n_unmarked: 0 },
      { topic_id: "t2", name: "Frontend", score_pct: 80, cls: "strong" as const, n_unmarked: 0 },
      { topic_id: "t3", name: "Backend", score_pct: 75, cls: "developing" as const, n_unmarked: 0 },
    ],
  },
  {
    session_id: "s2",
    candidate_name: "Kavya Nair",
    status: "completed",
    score_pct: 92,
    percentile: 96,
    n_unmarked: 0,
    topics: [
      { topic_id: "t1", name: "Full Stack Development", score_pct: 95, cls: "strong" as const, n_unmarked: 0 },
      { topic_id: "t2", name: "Frontend", score_pct: 90, cls: "strong" as const, n_unmarked: 0 },
      { topic_id: "t3", name: "Backend", score_pct: 88, cls: "strong" as const, n_unmarked: 0 },
    ],
  },
  {
    session_id: "s3",
    candidate_name: "Neha Kapoor",
    status: "completed",
    score_pct: 68,
    percentile: 45,
    n_unmarked: 0,
    topics: [
      { topic_id: "t1", name: "Full Stack Development", score_pct: 65, cls: "developing" as const, n_unmarked: 0 },
      { topic_id: "t2", name: "Frontend", score_pct: 60, cls: "developing" as const, n_unmarked: 0 },
      { topic_id: "t3", name: "Backend", score_pct: 55, cls: "weak" as const, n_unmarked: 0 },
    ],
  },
  {
    session_id: "s4",
    candidate_name: "Rohit Desai",
    status: "completed",
    score_pct: 74,
    percentile: 62,
    n_unmarked: 0,
    topics: [
      { topic_id: "t1", name: "Full Stack Development", score_pct: 78, cls: "developing" as const, n_unmarked: 0 },
      { topic_id: "t2", name: "Frontend", score_pct: 72, cls: "developing" as const, n_unmarked: 0 },
      { topic_id: "t3", name: "Backend", score_pct: 70, cls: "developing" as const, n_unmarked: 0 },
    ],
  },
  {
    session_id: "s5",
    candidate_name: "Ananya Patel",
    status: "completed",
    score_pct: 81,
    percentile: 79,
    n_unmarked: 0,
    topics: [
      { topic_id: "t1", name: "Full Stack Development", score_pct: 85, cls: "strong" as const, n_unmarked: 0 },
      { topic_id: "t2", name: "Frontend", score_pct: 80, cls: "strong" as const, n_unmarked: 0 },
      { topic_id: "t3", name: "Backend", score_pct: 78, cls: "developing" as const, n_unmarked: 0 },
    ],
  },
];

export const mockItemAnalysis = [
  {
    question_id: "q-101",
    body: "Which React Hook executes synchronously after all DOM mutations but before browser paint?",
    topic: "Frontend",
    n_attempted: 45,
    p: 0.82,
    d: 0.38,
    distractor_shares: { A: 0.08, B: 0.82, C: 0.06, D: 0.04 },
    correct_key: "B",
    flags: [] as string[],
  },
  {
    question_id: "q-102",
    body: "What database isolation level strictly prevents phantom reads in SQL transactions?",
    topic: "Backend",
    n_attempted: 45,
    p: 0.64,
    d: 0.44,
    distractor_shares: { A: 0.14, B: 0.12, C: 0.64, D: 0.10 },
    correct_key: "C",
    flags: [] as string[],
  },
  {
    question_id: "q-103",
    body: "In RAG architectures, why are embeddings normalized before computing cosine similarity?",
    topic: "AI Engineer",
    n_attempted: 44,
    p: 0.72,
    d: 0.28,
    distractor_shares: { A: 0.72, B: 0.14, C: 0.10, D: 0.04 },
    correct_key: "A",
    flags: [] as string[],
  },
];

export const mockQuestionsList = [
  {
    id: "q-1",
    course_id: "c1",
    topic_id: "t1",
    subtopic: "Full Stack Architecture",
    type: "mcq" as const,
    difficulty: 2,
    marks: 2,
    body: "In modern Next.js/React full-stack architectures, what is the primary benefit of React Server Components (RSC)?",
    answer_text: null,
    status: "approved" as const,
    source: "mentor" as const,
    agent_run_id: null,
    options: [
      { id: "o-1", key: "A", text: "Allows client-side DOM mutation without virtual DOM", is_correct: false, misconception_id: null },
      { id: "o-2", key: "B", text: "Zero client-bundle impact while executing directly on the server with direct DB access", is_correct: true, misconception_id: null },
      { id: "o-3", key: "C", text: "Replaces WebSocket connections for real-time video streaming", is_correct: false, misconception_id: null },
      { id: "o-4", key: "D", text: "Forces all components to re-render synchronously on state changes", is_correct: false, misconception_id: null },
    ],
  },
  {
    id: "q-2",
    course_id: "c1",
    topic_id: "t2",
    subtopic: "Frontend State Management",
    type: "mcq" as const,
    difficulty: 2,
    marks: 2,
    body: "Which React Hook should be used when you need to read layout from the DOM and synchronously re-render before browser paint?",
    answer_text: null,
    status: "approved" as const,
    source: "mentor" as const,
    agent_run_id: null,
    options: [
      { id: "o-5", key: "A", text: "useLayoutEffect", is_correct: true, misconception_id: null },
      { id: "o-6", key: "B", text: "useEffect", is_correct: false, misconception_id: null },
      { id: "o-7", key: "C", text: "useMemo", is_correct: false, misconception_id: null },
      { id: "o-8", key: "D", text: "useTransition", is_correct: false, misconception_id: null },
    ],
  },
  {
    id: "q-3",
    course_id: "c1",
    topic_id: "t3",
    subtopic: "Backend & Database",
    type: "mcq" as const,
    difficulty: 3,
    marks: 4,
    body: "What transaction isolation level completely prevents dirty reads, non-repeatable reads, and phantom reads?",
    answer_text: null,
    status: "approved" as const,
    source: "mentor" as const,
    agent_run_id: null,
    options: [
      { id: "o-9", key: "A", text: "Read Committed", is_correct: false, misconception_id: null },
      { id: "o-10", key: "B", text: "Repeatable Read", is_correct: false, misconception_id: null },
      { id: "o-11", key: "C", text: "Serializable", is_correct: true, misconception_id: null },
      { id: "o-12", key: "D", text: "Read Uncommitted", is_correct: false, misconception_id: null },
    ],
  },
  {
    id: "q-4",
    course_id: "c1",
    topic_id: "t4",
    subtopic: "Data Analysis & SQL",
    type: "mcq" as const,
    difficulty: 2,
    marks: 3,
    body: "In SQL analytics, what is the key difference between RANK() and DENSE_RANK() window functions when handling ties?",
    answer_text: null,
    status: "approved" as const,
    source: "mentor" as const,
    agent_run_id: null,
    options: [
      { id: "o-13", key: "A", text: "RANK leaves gaps in sequence after ties, whereas DENSE_RANK assigns consecutive ranks without gaps", is_correct: true, misconception_id: null },
      { id: "o-14", key: "B", text: "DENSE_RANK ignores partitions while RANK respects PARTITION BY", is_correct: false, misconception_id: null },
      { id: "o-15", key: "C", text: "RANK can only be used with numeric columns", is_correct: false, misconception_id: null },
      { id: "o-16", key: "D", text: "DENSE_RANK sorts rows in descending order strictly", is_correct: false, misconception_id: null },
    ],
  },
  {
    id: "q-5",
    course_id: "c1",
    topic_id: "t5",
    subtopic: "AI Engineering & LLMs",
    type: "mcq" as const,
    difficulty: 3,
    marks: 3,
    body: "In Retrieval-Augmented Generation (RAG) pipelines, what is the primary purpose of text chunking with overlap?",
    answer_text: null,
    status: "approved" as const,
    source: "mentor" as const,
    agent_run_id: null,
    options: [
      { id: "o-17", key: "A", text: "Preserves semantic context across chunk boundaries so search retrieval doesn't miss cross-sentence relations", is_correct: true, misconception_id: null },
      { id: "o-18", key: "B", text: "Encrypts embedding vectors for cross-tenant multi-tenancy", is_correct: false, misconception_id: null },
      { id: "o-19", key: "C", text: "Reduces token consumption to exactly zero tokens", is_correct: false, misconception_id: null },
      { id: "o-20", key: "D", text: "Translates high-dimensional vectors to 2D coordinates", is_correct: false, misconception_id: null },
    ],
  },
];

export const mockAssignmentsList = [
  {
    id: "asg-1",
    candidate_id: "u-2",
    candidate_name: "Arjun Mehta",
    candidate_email: "candidate01@example.com",
    candidate_phone: "+91 98765 43210",
    link_sent_at: "2026-01-15T09:00:00Z",
    link_used_at: "2026-01-15T10:02:00Z",
    link_expires_at: "2026-01-15T11:00:00Z",
    accommodations: {},
    status: "Completed",
    score_pct: 85,
    flags: 1,
    glances: 10,
    session_id: "s1",
  },
  {
    id: "asg-2",
    candidate_id: "u-3",
    candidate_name: "Kavya Nair",
    candidate_email: "candidate02@example.com",
    candidate_phone: "+91 98765 43211",
    link_sent_at: "2026-01-15T09:00:00Z",
    link_used_at: "2026-01-15T10:04:00Z",
    link_expires_at: "2026-01-15T11:00:00Z",
    accommodations: {},
    status: "In progress",
    score_pct: null,
    flags: 0,
    glances: 2,
    session_id: "s2",
  },
  {
    id: "asg-3",
    candidate_id: "u-4",
    candidate_name: "Rohit Desai",
    candidate_email: "candidate04@example.com",
    candidate_phone: "+91 98765 43213",
    link_sent_at: "2026-01-15T09:00:00Z",
    link_used_at: null,
    link_expires_at: "2026-01-15T11:00:00Z",
    accommodations: {},
    status: "Not started",
    score_pct: null,
    flags: 0,
    glances: 0,
    session_id: "s4",
  },
  {
    id: "asg-4",
    candidate_id: "u-5",
    candidate_name: "Neha Kapoor",
    candidate_email: "candidate03@example.com",
    candidate_phone: "+91 98765 43212",
    link_sent_at: "2026-01-15T09:00:00Z",
    link_used_at: "2026-01-15T10:01:00Z",
    link_expires_at: "2026-01-15T11:00:00Z",
    accommodations: {},
    status: "In progress",
    score_pct: null,
    flags: 2,
    glances: 7,
    session_id: "s3",
  },
  {
    id: "asg-5",
    candidate_id: "u-6",
    candidate_name: "Ananya Patel",
    candidate_email: "ananya.p@college.edu",
    candidate_phone: "+91 98765 43214",
    link_sent_at: "2026-01-15T09:00:00Z",
    link_used_at: "2026-01-15T10:03:00Z",
    link_expires_at: "2026-01-15T11:00:00Z",
    accommodations: {},
    status: "Completed",
    score_pct: 81,
    flags: 0,
    glances: 4,
    session_id: "s5",
  },
];

export const mockCandidatesList = [
  { id: "u-2", name: "Arjun Mehta", email: "candidate01@example.com", phone: "+91 98765 43210" },
  { id: "u-3", name: "Kavya Nair", email: "candidate02@example.com", phone: "+91 98765 43211" },
  { id: "u-4", name: "Rohit Desai", email: "candidate04@example.com", phone: "+91 98765 43213" },
  { id: "u-5", name: "Neha Kapoor", email: "candidate03@example.com", phone: "+91 98765 43212" },
  { id: "u-6", name: "Ananya Patel", email: "ananya.p@college.edu", phone: "+91 98765 43214" },
  { id: "u-7", name: "Vikram Singh", email: "vikram.s@college.edu", phone: "+91 98765 43215" },
  { id: "u-8", name: "Sneha Reddy", email: "sneha.r@college.edu", phone: "+91 98765 43216" },
];

export interface CandidateBatch {
  id: string;
  name: string;
  code: string;
  targetRole: string;
  totalCandidates: number;
  activeScreening: string;
  status: "Active" | "Scheduled" | "Completed";
  createdDate: string;
  hiringManager: string;
  completionRate: number;
  candidateIds: string[];
}

export const mockCandidateBatches: CandidateBatch[] = [
  {
    id: "batch-1",
    name: "Batch 2026 · Campus Drive",
    code: "CAMPUS-FSD-26",
    targetRole: "Full Stack Engineer (SDE-1)",
    totalCandidates: 28,
    activeScreening: "Unit test 3 - Applied Concepts",
    status: "Active",
    createdDate: "10 Jan 2026",
    hiringManager: "Priya Sharma",
    completionRate: 85,
    candidateIds: ["u-2", "u-3", "u-5"],
  },
  {
    id: "batch-2",
    name: "Batch 2026 · Lateral Hires",
    code: "LATERAL-DEV-26",
    targetRole: "Frontend Specialist (React/TS)",
    totalCandidates: 18,
    activeScreening: "Unit test 2 - Foundations",
    status: "Active",
    createdDate: "08 Jan 2026",
    hiringManager: "Rohan Mehta",
    completionRate: 92,
    candidateIds: ["u-4", "u-6"],
  },
  {
    id: "batch-3",
    name: "Batch 2025 · Data Analytics Cohort",
    code: "DATA-ANALYST-25",
    targetRole: "Data Analyst & SQL Modeling",
    totalCandidates: 22,
    activeScreening: "Midterm - Data Modeling & SQL",
    status: "Scheduled",
    createdDate: "12 Jan 2026",
    hiringManager: "Sneha Reddy",
    completionRate: 64,
    candidateIds: ["u-7"],
  },
  {
    id: "batch-4",
    name: "Batch 2026 · AI Systems Fellowship",
    code: "AI-FELLOWS-26",
    targetRole: "Agentic AI & RAG Engineer",
    totalCandidates: 15,
    activeScreening: "Final - Agentic AI & RAG Systems",
    status: "Scheduled",
    createdDate: "14 Jan 2026",
    hiringManager: "Vikram Singh",
    completionRate: 70,
    candidateIds: ["u-8"],
  },
];

export const mockPracticeSetData = {
  id: "ps-1",
  exam_title: "Full Stack Development · Concept Practice",
  topic: "Full Stack, Frontend, Backend & AI Fundamentals",
  questions: [
    {
      id: "pq-1",
      body: "In Next.js App Router, which file convention defines the unique UI for a route segment?",
      options: [
        { key: "A", text: "route.ts" },
        { key: "B", text: "page.tsx" },
        { key: "C", text: "layout.tsx" },
        { key: "D", text: "template.tsx" },
      ],
      explanation: "page.tsx defines the unique UI rendered for a route in Next.js App Router.",
    },
    {
      id: "pq-2",
      body: "Which React hook executes synchronously after all DOM mutations but before browser paint?",
      options: [
        { key: "A", text: "useLayoutEffect" },
        { key: "B", text: "useEffect" },
        { key: "C", text: "useMemo" },
        { key: "D", text: "useTransition" },
      ],
      explanation: "useLayoutEffect runs synchronously immediately after DOM mutations, before paint.",
    },
    {
      id: "pq-3",
      body: "In relational databases, which ACID property ensures transactions are fully committed or rolled back?",
      options: [
        { key: "A", text: "Atomicity" },
        { key: "B", text: "Consistency" },
        { key: "C", text: "Isolation" },
        { key: "D", text: "Durability" },
      ],
      explanation: "Atomicity ensures 'all or nothing' transaction execution.",
    },
    {
      id: "pq-4",
      body: "In SQL analytics, which clause filters the results of an aggregation produced by GROUP BY?",
      options: [
        { key: "A", text: "WHERE" },
        { key: "B", text: "HAVING" },
        { key: "C", text: "FILTER" },
        { key: "D", text: "OVER" },
      ],
      explanation: "HAVING filters groups produced by GROUP BY, while WHERE filters individual rows before grouping.",
    },
    {
      id: "pq-5",
      body: "In RAG pipelines, what is the role of a vector database like Pinecone or Chroma?",
      options: [
        { key: "A", text: "Indexing high-dimensional embeddings for approximate nearest neighbor (ANN) semantic search" },
        { key: "B", text: "Rendering CSS stylesheets on edge servers" },
        { key: "C", text: "Executing raw Python bytecode in client browsers" },
        { key: "D", text: "Managing OAuth2 refresh tokens" },
      ],
      explanation: "Vector databases index embeddings and perform approximate nearest neighbor semantic search.",
    },
  ],
};

/* =========================================================================
 * V3 INTERNSHIP PROGRAMME DATASETS (3-MONTH ENTERPRISE ECOSYSTEM)
 * ========================================================================= */

export const mockInternshipCohorts: InternshipCohort[] = [
  {
    id: "cohort-mern-26",
    name: "Cohort 2026 · MERN Full Stack",
    track: "MERN",
    startDate: "01 Jan 2026",
    endDate: "31 Mar 2026",
    totalMentees: 4,
    activeManagers: 2,
    scorecardWeights: {
      mcq: 0.25,
      coding: 0.30,
      comm: 0.20,
      tasks: 0.20,
      attendance: 0.05,
    },
  },
  {
    id: "cohort-data-26",
    name: "Cohort 2026 · Data Analytics",
    track: "Data Analyst",
    startDate: "15 Jan 2026",
    endDate: "15 Apr 2026",
    totalMentees: 2,
    activeManagers: 1,
    scorecardWeights: {
      mcq: 0.25,
      coding: 0.30,
      comm: 0.20,
      tasks: 0.20,
      attendance: 0.05,
    },
  },
  {
    id: "cohort-ai-26",
    name: "Cohort 2026 · AI/ML Systems",
    track: "AI/ML",
    startDate: "01 Feb 2026",
    endDate: "30 Apr 2026",
    totalMentees: 2,
    activeManagers: 1,
    scorecardWeights: {
      mcq: 0.25,
      coding: 0.30,
      comm: 0.20,
      tasks: 0.20,
      attendance: 0.05,
    },
  },
];

export const mockInternshipManagers: InternshipManager[] = [
  {
    id: "mgr-priya",
    name: "Priya Sharma",
    email: "mentor1@example.com",
    phone: "+91 98765 00001",
    department: "Full Stack & Cloud Architecture",
    track: "MERN",
    avatar: "PS",
    activeMenteeIds: ["mentee-arjun", "mentee-kavya"], // Strictly 2 mentees
  },
  {
    id: "mgr-rohan",
    name: "Rohan Mehta",
    email: "rohan.m@college.edu",
    phone: "+91 98765 00002",
    department: "Frontend & UI Systems",
    track: "MERN",
    avatar: "RM",
    activeMenteeIds: ["mentee-rohit", "mentee-ananya"], // Strictly 2 mentees
  },
  {
    id: "mgr-sneha",
    name: "Sneha Reddy",
    email: "sneha.r@college.edu",
    phone: "+91 98765 00003",
    department: "Data & Intelligent Systems",
    track: "Data Analyst",
    avatar: "SR",
    activeMenteeIds: ["mentee-vikram", "mentee-devendra"], // Strictly 2 mentees
  },
];

export const mockInternshipMentees: InternshipMentee[] = [
  {
    id: "mentee-arjun",
    name: "Arjun Mehta",
    email: "candidate01@example.com",
    phone: "+91 98765 43210",
    rollNumber: "EP-2026-MERN-01",
    avatar: "AM",
    track: "MERN",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
    cohortId: "cohort-mern-26",
    cohortName: "Cohort 2026 · MERN Full Stack",
    currentMonth: 2,
    status: "Active",
    attendanceRatePct: 96,
    tasksCompletedCount: 14,
    compositeScorePct: 86.4,
    skills: [
      {
        id: "sk-react",
        name: "React & Next.js",
        description: "Components, Hooks, State management, RSC/Next.js architecture",
        currentLevel: 4,
        targetLevel: 5,
        evidence: "Implemented custom useDebounce and virtualized infinite scroll grid.",
        lastAssessedDate: "20 Jan 2026",
      },
      {
        id: "sk-node",
        name: "Node.js & Express",
        description: "Middleware pipeline, auth (JWT), async concurrency, error handling",
        currentLevel: 3,
        targetLevel: 4,
        evidence: "Authored robust rate-limiting middleware with sliding token window.",
        lastAssessedDate: "18 Jan 2026",
      },
      {
        id: "sk-mongo",
        name: "MongoDB",
        description: "Document modeling, compound indexing, aggregation pipeline",
        currentLevel: 3,
        targetLevel: 4,
        evidence: "Built complex multi-stage aggregation pipeline with $facet and $lookup.",
        lastAssessedDate: "22 Jan 2026",
      },
      {
        id: "sk-api",
        name: "REST APIs & Sockets",
        description: "API contracts, error codes, WebSocket event duplexing",
        currentLevel: 4,
        targetLevel: 5,
        evidence: "Designed OpenAPI 3.0 specs and real-time live telemetry stream channel.",
        lastAssessedDate: "25 Jan 2026",
      },
      {
        id: "sk-git",
        name: "Git & Clean Code",
        description: "Branching strategies, PR hygiene, modular clean architecture",
        currentLevel: 4,
        targetLevel: 5,
        evidence: "Clean commit history, 0 merge conflicts across 8 PR reviews.",
        lastAssessedDate: "27 Jan 2026",
      },
    ],
  },
  {
    id: "mentee-kavya",
    name: "Kavya Nair",
    email: "candidate02@example.com",
    phone: "+91 98765 43211",
    rollNumber: "EP-2026-MERN-02",
    avatar: "KN",
    track: "MERN",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
    cohortId: "cohort-mern-26",
    cohortName: "Cohort 2026 · MERN Full Stack",
    currentMonth: 2,
    status: "Active",
    attendanceRatePct: 98,
    tasksCompletedCount: 16,
    compositeScorePct: 92.1,
    skills: [
      {
        id: "sk-react-2",
        name: "React & Next.js",
        description: "Components, Hooks, State management, RSC/Next.js architecture",
        currentLevel: 4,
        targetLevel: 5,
        evidence: "High-performance dashboard components with strict memoization.",
        lastAssessedDate: "21 Jan 2026",
      },
      {
        id: "sk-node-2",
        name: "Node.js & Express",
        description: "Middleware pipeline, auth (JWT), async concurrency, error handling",
        currentLevel: 4,
        targetLevel: 5,
        evidence: "Engineered scalable event emitter and circuit breaker for API calls.",
        lastAssessedDate: "20 Jan 2026",
      },
      {
        id: "sk-mongo-2",
        name: "MongoDB",
        description: "Document modeling, compound indexing, aggregation pipeline",
        currentLevel: 4,
        targetLevel: 5,
        evidence: "Optimized indexing strategies dropping query latency by 58%.",
        lastAssessedDate: "23 Jan 2026",
      },
      {
        id: "sk-api-2",
        name: "REST APIs & Sockets",
        description: "API contracts, error codes, WebSocket event duplexing",
        currentLevel: 5,
        targetLevel: 5,
        evidence: "Full duplex telemetry gateway handling 1,000 mock events/sec.",
        lastAssessedDate: "26 Jan 2026",
      },
      {
        id: "sk-git-2",
        name: "Git & Clean Code",
        description: "Branching strategies, PR hygiene, modular clean architecture",
        currentLevel: 4,
        targetLevel: 5,
        evidence: "Peer review lead for cohort feature branches.",
        lastAssessedDate: "28 Jan 2026",
      },
    ],
  },
  {
    id: "mentee-rohit",
    name: "Rohit Desai",
    email: "candidate04@example.com",
    phone: "+91 98765 43212",
    rollNumber: "EP-2026-MERN-03",
    avatar: "RD",
    track: "MERN",
    managerId: "mgr-rohan",
    managerName: "Rohan Mehta",
    cohortId: "cohort-mern-26",
    cohortName: "Cohort 2026 · MERN Full Stack",
    currentMonth: 2,
    status: "Active",
    attendanceRatePct: 92,
    tasksCompletedCount: 12,
    compositeScorePct: 83.0,
    skills: [
      {
        id: "sk-rd-1",
        name: "React & Next.js",
        description: "Components, Hooks, State management",
        currentLevel: 3,
        targetLevel: 4,
        evidence: "Built responsive accessible modal and tab navigation components.",
        lastAssessedDate: "19 Jan 2026",
      },
      {
        id: "sk-rd-2",
        name: "Node.js & Express",
        description: "API routing, validation, error middleware",
        currentLevel: 3,
        targetLevel: 4,
        evidence: "Implemented Zod validation pipeline for Express endpoints.",
        lastAssessedDate: "18 Jan 2026",
      },
      {
        id: "sk-rd-3",
        name: "MongoDB",
        description: "Schema relations, indexing, updates",
        currentLevel: 3,
        targetLevel: 4,
        evidence: "Normalized user profile and session history schemas.",
        lastAssessedDate: "21 Jan 2026",
      },
    ],
  },
  {
    id: "mentee-ananya",
    name: "Ananya Patel",
    email: "ananya.p@college.edu",
    phone: "+91 98765 43214",
    rollNumber: "EP-2026-MERN-04",
    avatar: "AP",
    track: "MERN",
    managerId: "mgr-rohan",
    managerName: "Rohan Mehta",
    cohortId: "cohort-mern-26",
    cohortName: "Cohort 2026 · MERN Full Stack",
    currentMonth: 2,
    status: "Active",
    attendanceRatePct: 95,
    tasksCompletedCount: 13,
    compositeScorePct: 84.5,
    skills: [
      {
        id: "sk-ap-1",
        name: "React & Next.js",
        description: "Components, Tailwind CSS, Accessibility",
        currentLevel: 4,
        targetLevel: 5,
        evidence: "Created zero-warning WCAG 2.1 AA compliant UI component library.",
        lastAssessedDate: "20 Jan 2026",
      },
      {
        id: "sk-ap-2",
        name: "Node.js & Express",
        description: "API design and error handling",
        currentLevel: 3,
        targetLevel: 4,
        evidence: "Integrated OAuth2 Google sign-in flow with Express sessions.",
        lastAssessedDate: "19 Jan 2026",
      },
    ],
  },
  {
    id: "mentee-vikram",
    name: "Vikram Singh",
    email: "vikram.s@college.edu",
    phone: "+91 98765 43215",
    rollNumber: "EP-2026-DATA-01",
    avatar: "VS",
    track: "Data Analyst",
    managerId: "mgr-sneha",
    managerName: "Sneha Reddy",
    cohortId: "cohort-data-26",
    cohortName: "Cohort 2026 · Data Analytics",
    currentMonth: 1,
    status: "Active",
    attendanceRatePct: 94,
    tasksCompletedCount: 9,
    compositeScorePct: 79.2,
    skills: [
      {
        id: "sk-sql",
        name: "SQL & Window Functions",
        description: "Joins, CTEs, Window functions, aggregations",
        currentLevel: 3,
        targetLevel: 4,
        evidence: "Built complex multi-stage CTE for user retention cohort analysis.",
        lastAssessedDate: "22 Jan 2026",
      },
      {
        id: "sk-excel",
        name: "Excel & Power Query",
        description: "Pivot Tables, XLOOKUP, dynamic arrays, transformation",
        currentLevel: 4,
        targetLevel: 5,
        evidence: "Automated financial variance reconciliation with Power Query.",
        lastAssessedDate: "16 Jan 2026",
      },
      {
        id: "sk-pandas",
        name: "Python & pandas",
        description: "Data wrangling, cleaning, exploratory data analysis",
        currentLevel: 2,
        targetLevel: 4,
        evidence: "Cleaned 50k missing record dataset with vectorized operations.",
        lastAssessedDate: "24 Jan 2026",
      },
      {
        id: "sk-stats",
        name: "Statistics & Inference",
        description: "Hypothesis testing, distributions, p-values, A/B metrics",
        currentLevel: 3,
        targetLevel: 4,
        evidence: "Conducted two-tailed t-test for landing page conversion delta.",
        lastAssessedDate: "25 Jan 2026",
      },
      {
        id: "sk-bi",
        name: "Power BI / Tableau",
        description: "KPI cards, DAX expressions, executive dashboards",
        currentLevel: 3,
        targetLevel: 4,
        evidence: "Designed 4-page interactive C-level executive KPI scorecard.",
        lastAssessedDate: "27 Jan 2026",
      },
    ],
  },
  {
    id: "mentee-devendra",
    name: "Devendra Joshi",
    email: "devendra.j@college.edu",
    phone: "+91 98765 43216",
    rollNumber: "EP-2026-AI-01",
    avatar: "DJ",
    track: "AI/ML",
    managerId: "mgr-sneha",
    managerName: "Sneha Reddy",
    cohortId: "cohort-ai-26",
    cohortName: "Cohort 2026 · AI/ML Systems",
    currentMonth: 1,
    status: "Active",
    attendanceRatePct: 97,
    tasksCompletedCount: 10,
    compositeScorePct: 88.7,
    skills: [
      {
        id: "sk-py-ml",
        name: "Python for ML & NumPy",
        description: "Vectorized linear algebra, broadcasting, algorithmic optimization",
        currentLevel: 4,
        targetLevel: 5,
        evidence: "Implemented batch cosine similarity without python loops.",
        lastAssessedDate: "23 Jan 2026",
      },
      {
        id: "sk-sklearn",
        name: "scikit-learn & Ensembles",
        description: "Feature pipelines, Random Forest, XGBoost, Cross-validation",
        currentLevel: 3,
        targetLevel: 4,
        evidence: "Tuned XGBoost classifier reaching 0.91 ROC-AUC on churn data.",
        lastAssessedDate: "24 Jan 2026",
      },
      {
        id: "sk-eval",
        name: "Model Validation & Metrics",
        description: "Precision-Recall trade-offs, confusion matrices, bias/variance",
        currentLevel: 4,
        targetLevel: 5,
        evidence: "Evaluated threshold tuning under severe 98:2 class imbalance.",
        lastAssessedDate: "25 Jan 2026",
      },
      {
        id: "sk-pytorch",
        name: "PyTorch Basics",
        description: "Tensors, Autograd, custom training loops, optimizers",
        currentLevel: 2,
        targetLevel: 4,
        evidence: "Wrote custom feedforward neural network training loop from scratch.",
        lastAssessedDate: "26 Jan 2026",
      },
      {
        id: "sk-rag",
        name: "LLM & RAG Systems",
        description: "Embeddings, vector databases, chunking strategies with overlap",
        currentLevel: 3,
        targetLevel: 5,
        evidence: "Built LangChain hybrid retrieval pipeline with Chroma DB.",
        lastAssessedDate: "27 Jan 2026",
      },
    ],
  },
];

export const mockDailyAttendance: DailyAttendance[] = [
  {
    id: "att-1",
    menteeId: "mentee-arjun",
    date: "2026-01-29",
    checkInTime: "09:04 AM",
    checkOutTime: "06:12 PM",
    totalHours: 8.5,
    status: "Present",
    notes: "Punctual check-in. Worked on MongoDB aggregation pipeline.",
  },
  {
    id: "att-2",
    menteeId: "mentee-arjun",
    date: "2026-01-28",
    checkInTime: "08:58 AM",
    checkOutTime: "06:05 PM",
    totalHours: 8.4,
    status: "Present",
  },
  {
    id: "att-3",
    menteeId: "mentee-kavya",
    date: "2026-01-29",
    checkInTime: "09:00 AM",
    checkOutTime: "06:20 PM",
    totalHours: 8.7,
    status: "Present",
  },
  {
    id: "att-4",
    menteeId: "mentee-rohit",
    date: "2026-01-29",
    checkInTime: "09:35 AM",
    checkOutTime: "06:30 PM",
    totalHours: 8.0,
    status: "Late",
    notes: "Transit delay.",
  },
];

export const mockLeaveRequests: LeaveRequest[] = [
  {
    id: "leave-1",
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    startDate: "2026-02-05",
    endDate: "2026-02-05",
    reason: "Dentist appointment",
    status: "Approved",
    submittedAt: "2026-01-28T10:15:00Z",
  },
  {
    id: "leave-2",
    menteeId: "mentee-rohit",
    menteeName: "Rohit Desai",
    managerId: "mgr-rohan",
    startDate: "2026-02-08",
    endDate: "2026-02-09",
    reason: "Family wedding attendance",
    status: "Pending",
    submittedAt: "2026-01-29T08:30:00Z",
  },
];

export const mockInternshipTasks: InternshipTask[] = [
  {
    id: "task-101",
    menteeId: "mentee-arjun",
    managerId: "mgr-priya",
    title: "Implement Token Bucket Rate Limiter in Express",
    description: "Create an Express middleware that limits requests to 60/min per IP with Redis sliding tokens.",
    track: "MERN",
    skillArea: "Node.js & Express",
    status: "Done",
    priority: "High",
    dueDate: "2026-01-22",
    submissionUrl: "https://github.com/interns/mern-demo/pull/14",
    managerFeedback: "Excellent sliding window calculation. Good unit tests covering edge cases.",
    monthNumber: 2,
    weekNumber: 5,
  },
  {
    id: "task-102",
    menteeId: "mentee-arjun",
    managerId: "mgr-priya",
    title: "Optimize MongoDB Aggregation for Telemetry Summaries",
    description: "Group candidate glance logs by minute intervals and project count using $facet.",
    track: "MERN",
    skillArea: "MongoDB",
    status: "Review",
    priority: "High",
    dueDate: "2026-01-30",
    submissionUrl: "https://github.com/interns/mern-demo/pull/18",
    submissionNotes: "Pipeline completed and benchmarked against 100k synthetic documents.",
    monthNumber: 2,
    weekNumber: 6,
  },
  {
    id: "task-103",
    menteeId: "mentee-arjun",
    managerId: "mgr-priya",
    title: "Build Responsive Code Editor Component with Theme Toggle",
    description: "Implement Monaco or custom code editor with line numbering and syntax coloring for JS/Python/SQL.",
    track: "MERN",
    skillArea: "React & Next.js",
    status: "In Progress",
    priority: "Medium",
    dueDate: "2026-02-03",
    monthNumber: 2,
    weekNumber: 7,
  },
  {
    id: "task-104",
    menteeId: "mentee-arjun",
    managerId: "mgr-priya",
    title: "Write Architectural RFC for In-Browser Code Sandboxing",
    description: "Draft 2-page RFC contrasting Web Workers vs WebAssembly Pyodide for secure client execution.",
    track: "MERN",
    skillArea: "Communication & Architecture",
    status: "Assigned",
    priority: "Medium",
    dueDate: "2026-02-08",
    monthNumber: 2,
    weekNumber: 8,
  },
  {
    id: "task-105",
    menteeId: "mentee-kavya",
    managerId: "mgr-priya",
    title: "Build Zero-Leakage Cross-Validation Evaluator",
    description: "Ensure test split scalers and encoders are strictly fitted only on training folds.",
    track: "MERN",
    skillArea: "Software Engineering",
    status: "Done",
    priority: "High",
    dueDate: "2026-01-24",
    submissionUrl: "https://github.com/interns/mern-demo/pull/12",
    managerFeedback: "Flawless separation of fit and transform steps.",
    monthNumber: 2,
    weekNumber: 5,
  },
  {
    id: "task-106",
    menteeId: "mentee-vikram",
    managerId: "mgr-sneha",
    title: "SQL Window Function Dashboard: Rolling 7-Day Revenue",
    description: "Calculate rolling average and detect revenue anomalies using standard deviation over 7-day partition.",
    track: "Data Analyst",
    skillArea: "SQL",
    status: "In Progress",
    priority: "High",
    dueDate: "2026-02-02",
    monthNumber: 1,
    weekNumber: 2,
  },
];

export const mockLearningTopics: LearningTopic[] = [
  {
    id: "top-1",
    menteeId: "mentee-arjun",
    managerId: "mgr-priya",
    title: "MongoDB Indexing Strategies & ESR Rule",
    description: "Master Equality, Sort, Range (ESR) rule to create optimal compound indexes.",
    track: "MERN",
    status: "Mastered",
    targetDate: "2026-01-20",
    resources: [
      { title: "Official MongoDB ESR Index Guide", url: "https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-rule/", type: "doc" },
      { title: "Query Explain Plan Deepdive", url: "https://internal.eduproctor.com/notes/mongo-indexes", type: "practice" },
    ],
  },
  {
    id: "top-2",
    menteeId: "mentee-arjun",
    managerId: "mgr-priya",
    title: "React Concurrent Features & Transitions",
    description: "Understand useTransition, useDeferredValue, and avoiding UI freezes during heavy computations.",
    track: "MERN",
    status: "In Progress",
    targetDate: "2026-02-04",
    resources: [
      { title: "React 18 Concurrent Rendering Spec", url: "https://react.dev/reference/react/useTransition", type: "doc" },
      { title: "Interactive UI Responsiveness Lab", url: "https://internal.eduproctor.com/practice/react-concurrency", type: "practice" },
    ],
  },
];

export const mockMonthlyReviews: MonthlyReviewRecord[] = [
  {
    id: "rev-arjun-m1",
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
    monthNumber: 1,
    compositeScorePct: 84.0,
    breakdown: {
      mcqScorePct: 88,
      codingScorePct: 82,
      commScorePct: 80,
      tasksScorePct: 85,
      attendanceScorePct: 98,
    },
    qualitativeSummary: "Arjun completed Month 1 foundations with strong technical enthusiasm. Adapted quickly to our React coding guidelines and Git PR review cadence.",
    strengths: [
      "Rapid grasp of modern Next.js/React architecture",
      "Proactive participation in daily standups and sprint planning",
      "High test coverage in submitted Express PRs",
    ],
    growthAreas: [
      "Deepen understanding of MongoDB aggregation pipelines vs client-side mapping",
      "Refine commit messages to follow Conventional Commits standard",
    ],
    managerNotes: "1-on-1 conducted on Jan 30. Arjun acknowledged targets and is geared up for Month 2 applied microservices.",
    nextMonthGoals: [
      "Implement sliding window rate limiter",
      "Master MongoDB $facet and $lookup aggregations",
      "Deliver 1 architectural RFC with clean structure",
    ],
    managerSignedAt: "2026-01-30T16:00:00Z",
    menteeAcknowledgedAt: "2026-01-30T17:15:00Z",
    status: "acknowledged",
  },
  {
    id: "rev-arjun-m2",
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
    monthNumber: 2,
    compositeScorePct: 87.2,
    breakdown: {
      mcqScorePct: 90,
      codingScorePct: 88,
      commScorePct: 85,
      tasksScorePct: 86,
      attendanceScorePct: 96,
    },
    qualitativeSummary: "Outstanding progress in Month 2. Delivered production-grade Express middleware and showed remarkable improvement in MongoDB aggregation complexity.",
    strengths: [
      "High autonomy in tackling ambiguous API requirements",
      "Code readability and JSDoc documentation are exemplary",
      "Maintained zero-flag integrity across all coding assessments",
    ],
    growthAreas: [
      "Continue refining architecture documentation brevity",
      "Prepare for Month 3 Capstone project end-to-end design defense",
    ],
    managerNotes: "Drafted by AI Synthesis Agent; finalized and approved by Priya Sharma.",
    nextMonthGoals: [
      "Deliver Month 3 Capstone Full-Stack project",
      "Lead cross-mentee code review session",
      "Achieve Level 5 in React & REST API contracts",
    ],
    managerSignedAt: "2026-02-28T15:30:00Z",
    menteeAcknowledgedAt: null, // Pending mentee acknowledgment
    status: "approved",
  },
];

export const mockCodingChallenges: CodingChallenge[] = [
  {
    id: "code-mern-01",
    title: "Implement Sliding Window Rate Limiter",
    track: "MERN",
    language: "javascript",
    difficulty: 2,
    description: `Implement an in-memory sliding window rate limiter class in JavaScript.

**Requirements**:
1. Class \`RateLimiter(windowMs, maxRequests)\`
2. Method \`isAllowed(clientId, timestamp)\`: Returns \`true\` if the client has not exceeded \`maxRequests\` within the last \`windowMs\` milliseconds; otherwise \`false\`.
3. Efficiently remove expired timestamps to prevent memory leakage.`,
    starterCode: `class RateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.clients = new Map(); // clientId -> array of timestamps
  }

  isAllowed(clientId, timestamp = Date.now()) {
    // Write your solution here:
    
  }
}

// Example usage:
// const limiter = new RateLimiter(60000, 3);
// console.log(limiter.isAllowed("user_1", 1000)); // true
`,
    testCases: [
      { id: "tc-1", input: "limiter.isAllowed('u1', 1000)", expectedOutput: "true", isHidden: false },
      { id: "tc-2", input: "limiter.isAllowed('u1', 2000)", expectedOutput: "true", isHidden: false },
      { id: "tc-3", input: "limiter.isAllowed('u1', 3000)", expectedOutput: "true", isHidden: false },
      { id: "tc-4", input: "limiter.isAllowed('u1', 4000)", expectedOutput: "false", isHidden: true },
      { id: "tc-5", input: "limiter.isAllowed('u1', 65000)", expectedOutput: "true", isHidden: true },
    ],
    solution: `class RateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.clients = new Map();
  }

  isAllowed(clientId, timestamp = Date.now()) {
    if (!this.clients.has(clientId)) {
      this.clients.set(clientId, []);
    }
    const timestamps = this.clients.get(clientId);
    const windowStart = timestamp - this.windowMs;
    while (timestamps.length > 0 && timestamps[0] <= windowStart) {
      timestamps.shift();
    }
    if (timestamps.length < this.maxRequests) {
      timestamps.push(timestamp);
      return true;
    }
    return false;
  }
}`,
    rubric: {
      correctnessWeight: 0.5,
      complexityWeight: 0.25,
      qualityWeight: 0.25,
    },
  },
  {
    id: "code-data-01",
    title: "SQL Window Analytics: Gap-Free Ranking & 7-Day Moving Avg",
    track: "Data Analyst",
    language: "sql",
    difficulty: 2,
    description: `Write a SQL query that calculates the 7-day rolling revenue average and gap-free daily rank per department.

**Requirements**:
1. Output columns: \`department\`, \`sale_date\`, \`daily_amount\`, \`rolling_7d_avg\`, \`dept_rank\`.
2. Use \`DENSE_RANK()\` over \`daily_amount DESC\` partitioned by department.
3. Use \`AVG(daily_amount) OVER (PARTITION BY department ORDER BY sale_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)\`.`,
    starterCode: `-- Given table: sales(department VARCHAR, sale_date DATE, daily_amount NUMERIC)
SELECT
  department,
  sale_date,
  daily_amount
  -- Add rolling average and dense rank here:
FROM sales
ORDER BY department, sale_date;
`,
    testCases: [
      { id: "tc-sql-1", input: "Sample sales table for Jan 2026", expectedOutput: "7-day rolling window with non-null values", isHidden: false },
      { id: "tc-sql-2", input: "Edge case: Tied amounts check", expectedOutput: "Consecutive ranks without skipped integer positions", isHidden: true },
    ],
    solution: `SELECT
  department,
  sale_date,
  daily_amount,
  ROUND(AVG(daily_amount) OVER (
    PARTITION BY department 
    ORDER BY sale_date 
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ), 2) AS rolling_7d_avg,
  DENSE_RANK() OVER (
    PARTITION BY department 
    ORDER BY daily_amount DESC
  ) AS dept_rank
FROM sales
ORDER BY department, sale_date;`,
    rubric: {
      correctnessWeight: 0.5,
      complexityWeight: 0.25,
      qualityWeight: 0.25,
    },
  },
  {
    id: "code-ai-01",
    title: "Vectorized Cosine Similarity & Top-K RAG Chunk Retrieval",
    track: "AI/ML",
    language: "python",
    difficulty: 3,
    description: `Implement an optimized vectorized cosine similarity search function in Python.

**Requirements**:
1. Function \`retrieve_top_k(query_vec, doc_embeddings, top_k=3)\`
2. \`query_vec\` is a 1D numpy array of shape \`(D,)\`.
3. \`doc_embeddings\` is a 2D numpy array of shape \`(N, D)\`.
4. Return the indices of the top-k highest similarity documents without using any Python for-loops.`,
    starterCode: `import numpy as np

def retrieve_top_k(query_vec, doc_embeddings, top_k=3):
    """
    Vectorized Cosine Similarity:
    cos_sim = (A . B) / (||A|| * ||B||)
    """
    # Write your vectorized numpy implementation here:
    pass

# Example test:
# q = np.array([1.0, 0.0, 0.5])
# docs = np.array([[1.0, 0.0, 0.5], [0.0, 1.0, 0.0], [0.9, 0.1, 0.4]])
# print(retrieve_top_k(q, docs, top_k=2)) # [0, 2]
`,
    testCases: [
      { id: "tc-py-1", input: "retrieve_top_k(q, docs, top_k=2)", expectedOutput: "[0, 2]", isHidden: false },
      { id: "tc-py-2", input: "Zero vector edge case handling", expectedOutput: "Safe epsilon division check", isHidden: true },
    ],
    solution: `import numpy as np

def retrieve_top_k(query_vec, doc_embeddings, top_k=3):
    norm_q = np.linalg.norm(query_vec) + 1e-9
    norm_docs = np.linalg.norm(doc_embeddings, axis=1) + 1e-9
    dot_products = np.dot(doc_embeddings, query_vec)
    similarities = dot_products / (norm_docs * norm_q)
    top_indices = np.argsort(similarities)[::-1][:top_k]
    return top_indices.tolist()`,
    rubric: {
      correctnessWeight: 0.5,
      complexityWeight: 0.25,
      qualityWeight: 0.25,
    },
  },
];

export const mockCommunicationAssessments: CommunicationAssessment[] = [
  {
    id: "comm-01",
    title: "Technical Incident Post-Mortem & Architecture Defense",
    track: "MERN",
    format: "written",
    scenario: "A high-concurrency surge caused database connection exhaustion in the telemetry ingestion service.",
    promptInstructions: "Draft a 3-paragraph Root Cause Analysis (RCA) and mitigation plan explaining the connection pool exhaustion, why horizontal scaling alone failed, and how you implemented connection pooling with exponential backoff.",
    rubric: {
      structurePct: 0.3,
      precisionPct: 0.3,
      brevityPct: 0.25,
      actionabilityPct: 0.15,
    },
  },
  {
    id: "comm-02",
    title: "Executive Data Storytelling: Presenting Metric Drift",
    track: "Data Analyst",
    format: "recorded",
    scenario: "Marketing campaign conversion dropped 14% week-over-week despite higher impressions.",
    promptInstructions: "Record a 3-minute executive summary explaining the distinction between total traffic and qualified intent traffic, presenting the root cause and recommending budget reallocation.",
    rubric: {
      structurePct: 0.3,
      precisionPct: 0.3,
      brevityPct: 0.25,
      actionabilityPct: 0.15,
    },
  },
];

/* =========================================================================
 * LOCALSTORAGE PERSISTENCE HELPERS FOR INTERNSHIP PROGRAMME
 * ========================================================================= */

const INTERNSHIP_MENTEES_KEY = "eduproctor_internship_mentees";
const INTERNSHIP_TASKS_KEY = "eduproctor_internship_tasks";
const INTERNSHIP_ATTENDANCE_KEY = "eduproctor_internship_attendance";
const INTERNSHIP_REVIEWS_KEY = "eduproctor_internship_reviews";
const APP_MODULE_KEY = "eduproctor_active_module";

export type AppModuleMode = "interview" | "internship";

export function getActiveAppModule(): AppModuleMode {
  if (typeof window === "undefined") return "internship";
  const stored = localStorage.getItem(APP_MODULE_KEY);
  return (stored as AppModuleMode) || "internship";
}

export function setActiveAppModule(mode: AppModuleMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(APP_MODULE_KEY, mode);
  window.dispatchEvent(new Event("eduproctor_module_changed"));
}

export const FULL_STACK_12_WEEK_PLAN: WeeklyCurriculumTopic[] = [
  {
    week: 1,
    month: 1,
    weekInMonth: 1,
    theme: "Frontend Fundamentals - HTML & CSS",
    skillArea: "HTML5 & CSS3",
    defaultTaskTitle: "Responsive Landing Page with Modern UI/UX, Flexbox & Grid",
    acceptanceCriteria:
      "HTML5 semantic elements, forms, accessibility standards (WCAG). CSS3 flexbox and CSS grid layouts, mobile-first responsive approach, CSS animations and transitions, cross-browser compatibility, and modern BEM CSS methodology.",
    deliverables: "Responsive landing page with modern UI/UX design and portfolio website demonstrating HTML5 & CSS3 mastery.",
  },
  {
    week: 2,
    month: 1,
    weekInMonth: 2,
    theme: "Modern Frontend Framework - React",
    skillArea: "React Components & State",
    defaultTaskTitle: "Interactive React Application with Custom Hooks & State Management",
    acceptanceCriteria:
      "React fundamentals: components, props, and state management. React Hooks: useState, useEffect, useContext, useRef, useMemo. Component lifecycle, controlled form validation, dynamic list rendering, and performance optimization.",
    deliverables: "Interactive React application with multiple component hierarchies and dynamic form with validation.",
  },
  {
    week: 3,
    month: 1,
    weekInMonth: 3,
    theme: "Developer Tools & Workflow Management",
    skillArea: "Tailwind CSS & Git Workflow",
    defaultTaskTitle: "Style Application with Tailwind CSS & Configure GitHub Workflow",
    acceptanceCriteria:
      "Tailwind CSS utility-first layout and responsive design system. Git branching strategies, merging, rebasing, conflict resolution. GitHub pull requests, code reviews, and Postman API test collection automation.",
    deliverables: "Styled React application using Tailwind CSS, GitHub repository with clean commit history, and Postman collection.",
  },
  {
    week: 4,
    month: 1,
    weekInMonth: 4,
    theme: "Backend Integration & Real-Time Communication (Major Assignment)",
    skillArea: "REST APIs & Appwrite / BaaS",
    defaultTaskTitle: "Full-Featured React App with Appwrite Backend Auth & CRUD Operations",
    acceptanceCriteria:
      "RESTful API architecture and async/await patterns. Error handling and loading states. WebSocket protocol for bidirectional communication. Appwrite BaaS: User authentication, database CRUD operations, file storage, and API security.",
    deliverables: "Full-featured React application with Appwrite backend, user authentication, complete CRUD operations, and technical documentation.",
  },
  {
    week: 5,
    month: 2,
    weekInMonth: 1,
    theme: "Backend Development - Node.js Fundamentals",
    skillArea: "Node.js & Express.js",
    defaultTaskTitle: "Design Modular RESTful API with Express.js Middleware & Route Parameters",
    acceptanceCriteria:
      "Node.js runtime and event-driven architecture. NPM package management and ES6 modules. Express.js routing, route parameters, middleware architecture, request validation, data sanitization, streams, and CORS security headers.",
    deliverables: "RESTful API with Express.js serving structured JSON data and API documentation with endpoint specifications.",
  },
  {
    week: 6,
    month: 2,
    weekInMonth: 2,
    theme: "Security & Database Management",
    skillArea: "JWT Auth & Dual DB (MySQL + MongoDB)",
    defaultTaskTitle: "Implement JWT Refresh Tokens, RBAC & Dual Database Support",
    acceptanceCriteria:
      "Authentication vs Authorization, JWT generation and validation, refresh token strategy, bcrypt password hashing. Role-based access control (RBAC). MySQL normalization and transactions. MongoDB aggregation pipeline, Mongoose ODM, and indexing.",
    deliverables: "Secure API with user authentication system, RBAC implementation, dual database support (MySQL & MongoDB), and security audit report.",
  },
  {
    week: 7,
    month: 2,
    weekInMonth: 3,
    theme: "Full Stack Application Development (Major Assignment)",
    skillArea: "Full Stack Architecture & WebSockets",
    defaultTaskTitle: "Build Production-Ready Full Stack App with Real-Time WebSocket Chat",
    acceptanceCriteria:
      "Full stack architecture and project structure. Frontend-backend integration patterns, protected routes, file uploads (local & cloud storage), Swagger/OpenAPI documentation, environment config, real-time chat with WebSocket, and deployment guide.",
    deliverables: "Production-ready full stack application featuring user auth, complete CRUD, database integration, file upload, and real-time chat.",
  },
  {
    week: 8,
    month: 2,
    weekInMonth: 4,
    theme: "Advanced Frontend - TypeScript & State Management",
    skillArea: "TypeScript & Redux Toolkit",
    defaultTaskTitle: "TypeScript React Application with Redux Toolkit State Management",
    acceptanceCriteria:
      "TypeScript interfaces, type aliases, generics, and utility types. Typed props, state, and custom hooks. Redux Toolkit store configuration, slices, createAsyncThunk for API calls, and Redux DevTools integration.",
    deliverables: "TypeScript React application with Redux state management, type-safe API integration, and comprehensive type definitions.",
  },
  {
    week: 9,
    month: 3,
    weekInMonth: 1,
    theme: "Business Intelligence & Data Visualization",
    skillArea: "Domo BI & Data Visualization",
    defaultTaskTitle: "Construct Interactive Domo Business Intelligence Dashboard from REST API",
    acceptanceCriteria:
      "Business Intelligence fundamentals and KPI frameworks. Domo platform datasets, ETL data flows, Beast Mode calculations, automated alerts based on metrics, KPI tracking, and data storytelling.",
    deliverables: "Interactive Domo dashboard consuming data from custom API, multiple visualization types, automated alerts, and executive summary report.",
  },
  {
    week: 10,
    month: 3,
    weekInMonth: 2,
    theme: "Advanced Database & Query Optimization",
    skillArea: "Advanced SQL & Indexing",
    defaultTaskTitle: "Optimize Database Schema & Complex SQL Queries with Window Functions",
    acceptanceCriteria:
      "Advanced SQL techniques: complex joins, subqueries, CTEs, window functions (ROW_NUMBER, RANK, LEAD, LAG). Normalization (1NF to BCNF) and star schema. Query execution plans (EXPLAIN), B-tree/composite indexing, and transaction isolation.",
    deliverables: "Optimized database schema with documentation, complex query library with performance benchmarks, and database migration scripts.",
  },
  {
    week: 11,
    month: 3,
    weekInMonth: 3,
    theme: "Production Readiness & DevOps Fundamentals",
    skillArea: "Docker, CI/CD & Cloud Deployment",
    defaultTaskTitle: "Dockerize Full Stack Application with GitHub Actions CI/CD Pipeline",
    acceptanceCriteria:
      "Containerization with multi-stage Dockerfile and Docker Compose. GitHub Actions CI/CD workflow automation. Cloud deployment (AWS/Azure/GCP). Application logging and Sentry error monitoring. HTTPS, rate limiting, and Helmet.js headers.",
    deliverables: "Dockerized full stack application, cloud deployment, CI/CD pipeline with automated testing, monitoring implementation, and security checklist.",
  },
  {
    week: 12,
    month: 3,
    weekInMonth: 4,
    theme: "Interview Preparation & Capstone Project (Final Capstone)",
    skillArea: "Capstone Defense & Architecture",
    defaultTaskTitle: "Deliver Comprehensive Capstone Project & Technical Architecture Defense",
    acceptanceCriteria:
      "Complete production full stack application (React + TypeScript + Redux, Node.js + Express, MySQL/MongoDB, Domo analytics, Docker containerization). Technical architecture defense, code review defense, and portfolio presentation.",
    deliverables: "Comprehensive capstone project demonstrating all learned skills, portfolio website showcasing all projects, and technical presentation to stakeholders.",
  },
];

export function getInternshipManagerForUser(user: { id?: string; email?: string; name?: string } | null): InternshipManager {
  if (!user) return mockInternshipManagers[0];
  const found = mockInternshipManagers.find(
    (m) =>
      (user.email && m.email.toLowerCase() === user.email.toLowerCase()) ||
      (user.id && m.id === user.id) ||
      (user.name && m.name.toLowerCase().includes(user.name.toLowerCase().replace("dr. ", "").trim())) ||
      (user.email && user.email.includes("mentor") && m.id === "mgr-priya"),
  );
  return found || mockInternshipManagers[0];
}

export function getInternshipMenteeForUser(user: { id?: string; email?: string; name?: string } | null): InternshipMentee {
  const mentees = getPersistedMentees();
  if (!user) return mentees[0];
  const found = mentees.find(
    (m) =>
      (user.email && m.email.toLowerCase() === user.email.toLowerCase()) ||
      (user.id && m.id === user.id) ||
      (user.name && m.name.toLowerCase().includes(user.name.toLowerCase().replace("dr. ", "").trim())) ||
      (user.email && user.email.includes("candidate") && m.id === "mentee-arjun"),
  );
  return found || mentees[0];
}

export function getPersistedMentees(): InternshipMentee[] {
  if (typeof window === "undefined") return mockInternshipMentees;
  const raw = localStorage.getItem(INTERNSHIP_MENTEES_KEY);
  if (!raw) {
    localStorage.setItem(INTERNSHIP_MENTEES_KEY, JSON.stringify(mockInternshipMentees));
    return mockInternshipMentees;
  }
  try {
    let list: InternshipMentee[] = JSON.parse(raw);
    let modified = false;
    list = list.map((m) => {
      const updated = { ...m };
      if (updated.managerName && updated.managerName.includes("Dr. ")) {
        updated.managerName = updated.managerName.replace("Dr. ", "");
        modified = true;
      }
      if (updated.name && updated.name.includes("Dr. ")) {
        updated.name = updated.name.replace("Dr. ", "");
        modified = true;
      }
      if (updated.managerId === "mgr-1" || !updated.managerId) {
        updated.managerId = "mgr-priya";
        updated.managerName = "Priya Sharma";
        modified = true;
      }
      return updated;
    });
    if (modified) {
      localStorage.setItem(INTERNSHIP_MENTEES_KEY, JSON.stringify(list));
    }
    return list.length > 0 ? list : mockInternshipMentees;
  } catch {
    return mockInternshipMentees;
  }
}

export function saveMenteeToStorage(mentee: InternshipMentee) {
  const mentees = getPersistedMentees();
  const idx = mentees.findIndex((m) => m.id === mentee.id);
  const updated = idx >= 0 ? [...mentees.slice(0, idx), mentee, ...mentees.slice(idx + 1)] : [mentee, ...mentees];
  localStorage.setItem(INTERNSHIP_MENTEES_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("eduproctor_mentees_updated"));
  return updated;
}

export function getPersistedTasks(): InternshipTask[] {
  if (typeof window === "undefined") return mockInternshipTasks;
  const raw = localStorage.getItem(INTERNSHIP_TASKS_KEY);
  if (!raw) {
    localStorage.setItem(INTERNSHIP_TASKS_KEY, JSON.stringify(mockInternshipTasks));
    return mockInternshipTasks;
  }
  try {
    let list: InternshipTask[] = JSON.parse(raw);
    let modified = false;
    list = list.map((t) => {
      const updated = { ...t };
      if (updated.managerId === "mgr-1" || !updated.managerId) {
        updated.managerId = "mgr-priya";
        modified = true;
      }
      if (updated.menteeId === "mentee-1" || !updated.menteeId) {
        updated.menteeId = "mentee-arjun";
        modified = true;
      }
      if (!updated.weekNumber) {
        // Assign default week based on month
        updated.weekNumber = updated.monthNumber === 1 ? 2 : updated.monthNumber === 2 ? 6 : 10;
        modified = true;
      }
      return updated;
    });
    if (modified) {
      localStorage.setItem(INTERNSHIP_TASKS_KEY, JSON.stringify(list));
    }
    return list.length > 0 ? list : mockInternshipTasks;
  } catch {
    return mockInternshipTasks;
  }
}

export function saveTaskToStorage(task: InternshipTask) {
  const tasks = getPersistedTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  const updated = idx >= 0 ? [...tasks.slice(0, idx), task, ...tasks.slice(idx + 1)] : [task, ...tasks];
  localStorage.setItem(INTERNSHIP_TASKS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("eduproctor_tasks_updated"));
  return updated;
}

export function getPersistedAttendance(): DailyAttendance[] {
  if (typeof window === "undefined") return mockDailyAttendance;
  const raw = localStorage.getItem(INTERNSHIP_ATTENDANCE_KEY);
  if (!raw) {
    localStorage.setItem(INTERNSHIP_ATTENDANCE_KEY, JSON.stringify(mockDailyAttendance));
    return mockDailyAttendance;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return mockDailyAttendance;
  }
}

export function recordAttendanceCheckIn(menteeId: string): DailyAttendance {
  const list = getPersistedAttendance();
  const today = new Date().toISOString().split("T")[0];
  const nowTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const existingIdx = list.findIndex((a) => a.menteeId === menteeId && a.date === today);
  if (existingIdx >= 0) {
    return list[existingIdx];
  }

  const newRecord: DailyAttendance = {
    id: `att-${Date.now()}`,
    menteeId,
    date: today,
    checkInTime: nowTime,
    checkOutTime: null,
    totalHours: 0,
    status: "Present",
  };

  const updated = [newRecord, ...list];
  localStorage.setItem(INTERNSHIP_ATTENDANCE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("eduproctor_attendance_updated"));
  return newRecord;
}

export function recordAttendanceCheckOut(menteeId: string): DailyAttendance | null {
  const list = getPersistedAttendance();
  const today = new Date().toISOString().split("T")[0];
  const nowTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const existingIdx = list.findIndex((a) => a.menteeId === menteeId && a.date === today);
  if (existingIdx < 0) return null;

  const current = list[existingIdx];
  const updatedRecord: DailyAttendance = {
    ...current,
    checkOutTime: nowTime,
    totalHours: 8.5,
  };

  const updated = [...list.slice(0, existingIdx), updatedRecord, ...list.slice(existingIdx + 1)];
  localStorage.setItem(INTERNSHIP_ATTENDANCE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("eduproctor_attendance_updated"));
  return updatedRecord;
}

export function getPersistedMonthlyReviews(): MonthlyReviewRecord[] {
  if (typeof window === "undefined") return mockMonthlyReviews;
  const raw = localStorage.getItem(INTERNSHIP_REVIEWS_KEY);
  if (!raw) {
    localStorage.setItem(INTERNSHIP_REVIEWS_KEY, JSON.stringify(mockMonthlyReviews));
    return mockMonthlyReviews;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return mockMonthlyReviews;
  }
}

export function saveMonthlyReview(review: MonthlyReviewRecord) {
  const list = getPersistedMonthlyReviews();
  const idx = list.findIndex((r) => r.id === review.id);
  const updated = idx >= 0 ? [...list.slice(0, idx), review, ...list.slice(idx + 1)] : [review, ...list];
  localStorage.setItem(INTERNSHIP_REVIEWS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("eduproctor_reviews_updated"));
  return updated;
}

/* =========================================================================
 * WEEKLY MCQ ASSESSMENTS & AI EVALUATION AGENT ENGINE (12-WEEK ROADMAP)
 * ========================================================================= */

export const STORAGE_WEEKLY_MCQS_KEY = "eduproctor_weekly_mcqs";

export const INITIAL_WEEKLY_MCQS: WeeklyMCQAssessment[] = [
  {
    id: "mcq-w1",
    weekNumber: 1,
    monthNumber: 1,
    weekInMonth: 1,
    title: "Week 1 MCQ: HTML5, CSS3, Flexbox & Responsive UI",
    theme: "Frontend Fundamentals - HTML & CSS",
    skillArea: "HTML5 & CSS3",
    questionCount: 15,
    durationMinutes: 20,
    passingScorePct: 70,
    status: "published",
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
    scorePct: 93,
    pointsObtained: 14,
    totalPoints: 15,
    submittedAt: "2026-01-18 11:30 AM",
    reviewedAt: "2026-01-18 02:15 PM",
    publishedAt: "2026-01-18 02:20 PM",
    managerNotes: "Priya Sharma: Outstanding grasp of modern semantic markup and mobile-first Flexbox layouts. Off to a brilliant start in Month 1.",
    agentAnalysis: {
      accuracyPct: 93.3,
      integrityScorePct: 100,
      flagsCount: 0,
      topicMastery: [
        { topic: "HTML5 Semantic Elements & WCAG", scorePct: 100, status: "Strong" },
        { topic: "CSS3 Flexbox & Grid Alignments", scorePct: 95, status: "Strong" },
        { topic: "Media Queries & Responsive Units", scorePct: 86, status: "Strong" },
      ],
      summary: "Candidate achieved 93% accuracy on Week 1 fundamentals. Highly disciplined architectural CSS styling and clean layout structure. Zero proctoring flags logged.",
      strengths: [
        "Flawless semantic element selection for accessibility",
        "Mastery of CSS Flexbox justify-content and align-items axes",
        "Fast response pace (average 38s per question)",
      ],
      gapAreas: ["Revisit CSS specificity hierarchy for chained pseudo-selectors"],
      managerReviewNote: "AI Evaluation Synthesis for Priya Sharma: Arjun has exceeded Week 1 proficiency targets. Ready for immediate advancement into React components.",
      recommendedNotes: [
        { title: "CSS Specificity & BEM Naming Guide", desc: "Avoiding specificity conflicts in modular codebases", count: 6 },
      ],
    },
  },
  {
    id: "mcq-w2",
    weekNumber: 2,
    monthNumber: 1,
    weekInMonth: 2,
    title: "Week 2 MCQ: React Core, Components, Hooks & State Flow",
    theme: "Modern Frontend Framework - React",
    skillArea: "React Components & State",
    questionCount: 20,
    durationMinutes: 30,
    passingScorePct: 75,
    status: "submitted", // Under AI & Manager Review!
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
    scorePct: 85,
    pointsObtained: 17,
    totalPoints: 20,
    submittedAt: "2026-01-25 04:45 PM",
    reviewedAt: null,
    publishedAt: null,
    agentAnalysis: {
      accuracyPct: 85.0,
      integrityScorePct: 100,
      flagsCount: 0,
      topicMastery: [
        { topic: "React Components, Props & Reconciliation", scorePct: 92, status: "Strong" },
        { topic: "useState & useEffect Lifecycle", scorePct: 90, status: "Strong" },
        { topic: "Optimization: useMemo & useCallback", scorePct: 65, status: "Developing" },
        { topic: "Controlled Forms & Input Validation", scorePct: 90, status: "Strong" },
      ],
      summary: "Arjun demonstrated solid command of core React primitives. He missed questions 14 and 18 regarding useCallback memoization with stale closure dependencies. Overall assessment is strong with 0 integrity flags.",
      strengths: [
        "Immaculate understanding of hook execution order and purity",
        "Proficient in lifting state and Context API patterns",
        "Zero look-away flags during the 30-minute proctored session",
      ],
      gapAreas: [
        "useCallback dependency array updates with state closures",
        "React.memo shallow prop comparison nuances",
      ],
      managerReviewNote: "AI Evaluation Synthesis for Priya Sharma: Arjun scored 85% on Week 2 React check. His foundational hooks knowledge is solid; recommend quick mentoring on useCallback stale closures before he integrates complex state into the sprint project.",
      recommendedNotes: [
        { title: "React Hooks Memoization Deepdive", desc: "Avoiding stale closures and needless re-renders", count: 8 },
      ],
    },
  },
  {
    id: "mcq-w3",
    weekNumber: 3,
    monthNumber: 1,
    weekInMonth: 3,
    title: "Week 3 MCQ: Tailwind CSS Architecture, Git Branching & Conflict Resolution",
    theme: "Developer Tools & Workflow Management",
    skillArea: "Tailwind CSS & Git Workflow",
    questionCount: 15,
    durationMinutes: 20,
    passingScorePct: 70,
    status: "available",
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
  },
  {
    id: "mcq-w4",
    weekNumber: 4,
    monthNumber: 1,
    weekInMonth: 4,
    title: "Week 4 MCQ: REST APIs, Appwrite BaaS & Real-Time WebSockets",
    theme: "Backend Integration & Real-Time Communication (Major Assignment)",
    skillArea: "REST APIs & Appwrite / BaaS",
    questionCount: 20,
    durationMinutes: 30,
    passingScorePct: 75,
    status: "available",
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
  },
  {
    id: "mcq-w5",
    weekNumber: 5,
    monthNumber: 2,
    weekInMonth: 1,
    title: "Week 5 MCQ: Node.js Runtime, Event Loop & Express Middleware Pipelines",
    theme: "Backend Development - Node.js Fundamentals",
    skillArea: "Node.js & Express.js",
    questionCount: 20,
    durationMinutes: 30,
    passingScorePct: 75,
    status: "available",
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
  },
  {
    id: "mcq-w6",
    weekNumber: 6,
    monthNumber: 2,
    weekInMonth: 2,
    title: "Week 6 MCQ: JWT Token Rotation, RBAC & Dual Database Indexing",
    theme: "Security & Database Management",
    skillArea: "JWT Auth & Dual DB (MySQL + MongoDB)",
    questionCount: 20,
    durationMinutes: 30,
    passingScorePct: 75,
    status: "available",
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
  },
  {
    id: "mcq-w7",
    weekNumber: 7,
    monthNumber: 2,
    weekInMonth: 3,
    title: "Week 7 MCQ: Full Stack Architecture, Socket.io & Real-Time State Sync",
    theme: "Full Stack Application Development (Major Assignment)",
    skillArea: "Full Stack Architecture & WebSockets",
    questionCount: 20,
    durationMinutes: 30,
    passingScorePct: 75,
    status: "available",
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
  },
  {
    id: "mcq-w8",
    weekNumber: 8,
    monthNumber: 2,
    weekInMonth: 4,
    title: "Week 8 MCQ: TypeScript Type Safety, Generics & Redux Toolkit",
    theme: "Advanced Frontend - TypeScript & State Management",
    skillArea: "TypeScript & Redux Toolkit",
    questionCount: 20,
    durationMinutes: 30,
    passingScorePct: 75,
    status: "available",
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
  },
  {
    id: "mcq-w9",
    weekNumber: 9,
    monthNumber: 3,
    weekInMonth: 1,
    title: "Week 9 MCQ: Business Intelligence, Domo Data Pipelines & Aggregations",
    theme: "Business Intelligence & Data Visualization",
    skillArea: "Domo BI & Data Visualization",
    questionCount: 20,
    durationMinutes: 30,
    passingScorePct: 75,
    status: "available",
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
  },
  {
    id: "mcq-w10",
    weekNumber: 10,
    monthNumber: 3,
    weekInMonth: 2,
    title: "Week 10 MCQ: Advanced SQL Queries, Window Functions & Index Tuning",
    theme: "Advanced Database & Query Optimization",
    skillArea: "Advanced SQL & Indexing",
    questionCount: 25,
    durationMinutes: 35,
    passingScorePct: 75,
    status: "available",
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
  },
  {
    id: "mcq-w11",
    weekNumber: 11,
    monthNumber: 3,
    weekInMonth: 3,
    title: "Week 11 MCQ: Docker Containerization, Multi-Stage Builds & GitHub CI/CD",
    theme: "Production Readiness & DevOps Fundamentals",
    skillArea: "Docker, CI/CD & Cloud Deployment",
    questionCount: 20,
    durationMinutes: 30,
    passingScorePct: 75,
    status: "available",
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
  },
  {
    id: "mcq-w12",
    weekNumber: 12,
    monthNumber: 3,
    weekInMonth: 4,
    title: "Week 12 MCQ: Full-Stack Capstone Architecture, Security & Production Defense",
    theme: "Interview Preparation & Capstone Project (Final Capstone)",
    skillArea: "Capstone Defense & Architecture",
    questionCount: 30,
    durationMinutes: 45,
    passingScorePct: 80,
    status: "available",
    menteeId: "mentee-arjun",
    menteeName: "Arjun Mehta",
    managerId: "mgr-priya",
    managerName: "Priya Sharma",
  },
];

export function getPersistedWeeklyMCQs(): WeeklyMCQAssessment[] {
  if (typeof window === "undefined") return INITIAL_WEEKLY_MCQS;
  const raw = localStorage.getItem(STORAGE_WEEKLY_MCQS_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_WEEKLY_MCQS_KEY, JSON.stringify(INITIAL_WEEKLY_MCQS));
    return INITIAL_WEEKLY_MCQS;
  }
  try {
    const list: WeeklyMCQAssessment[] = JSON.parse(raw);
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
    return INITIAL_WEEKLY_MCQS;
  } catch {
    return INITIAL_WEEKLY_MCQS;
  }
}

export function saveWeeklyMCQToStorage(mcq: WeeklyMCQAssessment): WeeklyMCQAssessment[] {
  const current = getPersistedWeeklyMCQs();
  const idx = current.findIndex((m) => m.id === mcq.id);
  const updated = idx >= 0 ? [...current.slice(0, idx), mcq, ...current.slice(idx + 1)] : [mcq, ...current];
  localStorage.setItem(STORAGE_WEEKLY_MCQS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("eduproctor_weekly_mcqs_updated"));
  return updated;
}

export function submitMenteeWeeklyMCQ(
  mcqId: string,
  answeredCount: number,
  totalQuestions: number,
  menteeName = "Arjun Mehta"
): WeeklyMCQAssessment {
  const all = getPersistedWeeklyMCQs();
  const target = all.find((m) => m.id === mcqId) || all[0];
  const scorePct = totalQuestions > 0 ? Math.min(100, Math.max(50, Math.round((answeredCount / totalQuestions) * 100))) : 85;
  const pointsObtained = Math.round((scorePct / 100) * totalQuestions);

  const now = new Date().toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const updated: WeeklyMCQAssessment = {
    ...target,
    status: "submitted",
    scorePct,
    pointsObtained,
    totalPoints: totalQuestions,
    submittedAt: now,
    agentAnalysis: {
      accuracyPct: scorePct,
      integrityScorePct: 100,
      flagsCount: 0,
      topicMastery: [
        { topic: `${target.skillArea} Core Principles`, scorePct: Math.min(96, scorePct + 8), status: "Strong" },
        { topic: `${target.skillArea} Practical Workflows`, scorePct: Math.max(68, scorePct - 4), status: "Strong" },
        { topic: "Edge Cases & Optimization", scorePct: Math.max(45, scorePct - 25), status: "Developing" },
      ],
      summary: `${menteeName} completed the Week ${target.weekNumber} assessment with ${scorePct}% accuracy. Strong foundational reasoning across ${target.skillArea}. Zero integrity flags recorded.`,
      strengths: [
        `High precision on standard ${target.skillArea} patterns`,
        "Consistent pacing throughout all question sets",
        "Clean proctoring telemetry with 0 look-away flags",
      ],
      gapAreas: [
        `Complex edge cases and boundary conditions in ${target.skillArea}`,
      ],
      managerReviewNote: `AI Synthesis Agent review for Priya Sharma: ${menteeName} achieved a solid ${scorePct}% on Week ${target.weekNumber} (${target.theme}). Ready for sprint deliverable sign-off.`,
      recommendedNotes: [
        { title: `${target.skillArea} Advanced Cheatsheet`, desc: `Targeted review on ${target.theme}`, count: 8 },
      ],
    },
  };

  saveWeeklyMCQToStorage(updated);

  // Trigger AI Agent run record
  saveAgentRunToStorage({
    id: `run-mcq-${Date.now().toString().slice(-4)}`,
    assessment: target.title,
    runTime: "Just now",
    agent: "Assessment Evaluation Agent",
    status: "Completed",
    tokensIn: 1750,
    tokensOut: 520,
    costUsd: 0.0089,
    latencyMs: 1240,
    toolCalls: 3,
    summaryTitle: `AI evaluated Week ${target.weekNumber} MCQ for ${menteeName}. Formulated manager review synthesis.`,
  });

  return updated;
}

export function publishWeeklyMCQResult(mcqId: string, managerFeedback?: string): WeeklyMCQAssessment {
  const all = getPersistedWeeklyMCQs();
  const target = all.find((m) => m.id === mcqId) || all[0];

  const now = new Date().toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const updated: WeeklyMCQAssessment = {
    ...target,
    status: "published",
    publishedAt: now,
    managerNotes: managerFeedback || target.managerNotes || "Priya Sharma: Approved scorecard and verified topic mastery.",
  };

  saveWeeklyMCQToStorage(updated);

  // Trigger Email Sending Agent
  saveAgentRunToStorage({
    id: `run-mail-${Date.now().toString().slice(-4)}`,
    assessment: target.title,
    runTime: "Just now",
    agent: "Email Sending Agent",
    status: "Completed",
    tokensIn: 620,
    tokensOut: 240,
    costUsd: 0.0034,
    latencyMs: 780,
    toolCalls: 1,
    summaryTitle: `Dispatched official Week ${target.weekNumber} scorecard & practice notes to ${target.menteeName} (${target.menteeId}).`,
  });

  return updated;
}






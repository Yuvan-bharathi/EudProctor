export interface Course {
  id: string;
  name: string;
  code: string;
}

export interface Topic {
  id: string;
  course_id: string;
  name: string;
  parent_id: string | null;
}

export interface Misconception {
  id: string;
  topic_id: string;
  description: string;
}

export interface QuestionOption {
  id: string;
  key: string;
  text: string;
  is_correct: boolean;
  misconception_id: string | null;
}

export type QuestionStatus = "draft" | "approved" | "skipped";

export interface Question {
  id: string;
  course_id: string;
  topic_id: string;
  subtopic: string | null;
  type: "mcq" | "short";
  difficulty: number;
  marks: number;
  body: string;
  answer_text: string | null;
  status: QuestionStatus;
  source: "mentor" | "agent";
  agent_run_id: string | null;
  options: QuestionOption[];
}

export interface Exam {
  id: string;
  course_id: string;
  course_name?: string;
  title: string;
  duration_min: number;
  window_start: string;
  window_end: string;
  shuffle: boolean;
  flag_threshold_s: number;
  glance_min_s: number;
  max_flags: number;
  status: "draft" | "scheduled" | "closed";
}

export type InvitationStatus =
  | "Not Sent"
  | "Pending"
  | "Sending"
  | "Sent"
  | "Delivered"
  | "Failed"
  | "Accepted"
  | "Expired"
  | "Revoked";

export interface Assignment {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone?: string;
  link_sent_at: string | null;
  link_used_at: string | null;
  link_expires_at: string | null;
  accommodations: Record<string, unknown>;
  invitation_status?: InvitationStatus | string;
  delivery_status?: string | null;
  status?: string;
  score_pct?: number | null;
  flags?: number;
  glances?: number;
  session_id?: string;
}

export interface ExamDetail extends Exam {
  questions: Question[];
  assignments: Assignment[];
}

export interface CandidateUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  roll_number?: string;
  batch?: string;
}

export const difficultyLabel: Record<number, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };

/* =========================================================================
 * V3 INTERNSHIP PROGRAMME DATA MODELS & TYPES
 * ========================================================================= */

export type InternshipTrack = "MERN" | "Data Analyst" | "AI/ML";
export type SkillLevel = 1 | 2 | 3 | 4 | 5;

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  1: "Awareness",
  2: "Guided / Novice",
  3: "Independent / Competent",
  4: "Advanced / Proficient",
  5: "Architect / Production",
};

export interface SkillItem {
  id: string;
  name: string;
  description: string;
  currentLevel: SkillLevel;
  targetLevel: SkillLevel;
  evidence: string;
  lastAssessedDate: string;
  level?: SkillLevel;
  evidenceNotes?: string;
}

export interface InternshipCohort {
  id: string;
  name: string;
  track: InternshipTrack;
  startDate: string;
  endDate: string;
  totalMentees: number;
  activeManagers: number;
  menteeCount?: number;
  managerCount?: number;
  scorecardWeights: {
    mcq: number; // default 0.25
    coding: number; // default 0.30
    comm: number; // default 0.20
    tasks: number; // default 0.20
    attendance: number; // default 0.05
  };
}

export interface InternshipManager {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  track: InternshipTrack;
  avatar: string;
  activeMenteeIds: string[]; // Strictly capped at max 2 mentees
}

export interface InternshipMentee {
  id: string;
  name: string;
  email: string;
  phone: string;
  rollNumber: string;
  avatar: string;
  track: InternshipTrack;
  managerId: string;
  managerName: string;
  cohortId: string;
  cohortName: string;
  currentMonth: 1 | 2 | 3;
  status: "Active" | "Completed" | "Converted";
  attendanceRatePct: number;
  tasksCompletedCount: number;
  compositeScorePct: number;
  skills: SkillItem[];
}

export interface DailyAttendance {
  id: string;
  menteeId: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalHours: number;
  status: "Present" | "Late" | "Leave" | "Absent";
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  menteeId: string;
  menteeName: string;
  managerId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  submittedAt: string;
}

export type TaskStatus = "Assigned" | "In Progress" | "Review" | "Done" | "Rework";
export type TaskPriority = "High" | "Medium" | "Low";

export interface InternshipTask {
  id: string;
  menteeId: string;
  managerId: string;
  title: string;
  description: string;
  track: InternshipTrack;
  skillArea: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  submissionUrl?: string;
  submissionNotes?: string;
  managerFeedback?: string;
  monthNumber: 1 | 2 | 3;
  weekNumber?: number; // 1 to 12
}

export interface WeeklyCurriculumTopic {
  week: number;
  month: 1 | 2 | 3;
  weekInMonth: 1 | 2 | 3 | 4;
  theme: string;
  skillArea: string;
  defaultTaskTitle: string;
  acceptanceCriteria: string;
  deliverables: string;
}

export interface WeeklyMCQAssessment {
  id: string; // e.g. "mcq-w1", "mcq-w2"
  weekNumber: number; // 1 to 12
  monthNumber: 1 | 2 | 3;
  weekInMonth: 1 | 2 | 3 | 4;
  title: string;
  theme: string;
  skillArea: string;
  questionCount: number;
  durationMinutes: number;
  passingScorePct: number;
  status: "available" | "in_progress" | "submitted" | "reviewed" | "published";
  menteeId: string;
  menteeName: string;
  managerId: string;
  managerName: string;
  scorePct?: number;
  pointsObtained?: number;
  totalPoints?: number;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  publishedAt?: string | null;
  managerNotes?: string;
  agentAnalysis?: {
    accuracyPct: number;
    integrityScorePct: number;
    flagsCount: number;
    topicMastery: { topic: string; scorePct: number; status: "Strong" | "Developing" | "Weak" }[];
    summary: string;
    strengths: string[];
    gapAreas: string[];
    managerReviewNote: string;
    recommendedNotes: { title: string; desc: string; count: number }[];
  };
}

export interface LearningTopic {
  id: string;
  menteeId: string;
  managerId: string;
  title: string;
  description: string;
  track: InternshipTrack;
  status: "Not Started" | "In Progress" | "Mastered";
  targetDate: string;
  resources: {
    title: string;
    url: string;
    type: "doc" | "video" | "practice";
  }[];
}

export interface MonthlyReviewRecord {
  id: string;
  menteeId: string;
  menteeName: string;
  managerId: string;
  managerName: string;
  monthNumber: 1 | 2 | 3;
  compositeScorePct: number;
  breakdown: {
    mcqScorePct: number;
    codingScorePct: number;
    commScorePct: number;
    tasksScorePct: number;
    attendanceScorePct: number;
  };
  qualitativeSummary: string;
  strengths: string[];
  growthAreas: string[];
  managerNotes: string;
  nextMonthGoals: string[];
  managerSignedAt: string | null;
  menteeAcknowledgedAt: string | null;
  status: "draft" | "approved" | "acknowledged";
}

export interface CodingTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface CodingChallenge {
  id: string;
  title: string;
  track: InternshipTrack;
  language: "javascript" | "python" | "sql";
  difficulty: 1 | 2 | 3;
  description: string;
  starterCode: string;
  testCases: CodingTestCase[];
  solution: string;
  rubric: {
    correctnessWeight: number; // 50%
    complexityWeight: number; // 25%
    qualityWeight: number; // 25%
  };
}

export interface CommunicationAssessment {
  id: string;
  title: string;
  track: InternshipTrack;
  format: "written" | "recorded";
  scenario: string;
  promptInstructions: string;
  rubric: {
    structurePct: number;
    precisionPct: number;
    brevityPct: number;
    actionabilityPct: number;
  };
}


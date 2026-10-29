export type SessionStatus =
  | "link_opened"
  | "identity_check"
  | "identity_review"
  | "identity_blocked"
  | "calibrating"
  | "in_progress"
  | "submitted"
  | "expired"
  | "scored"
  | "analysed";

export interface CandidateQuestion {
  id: string;
  number: number;
  type: "mcq" | "short";
  body: string;
  marks: number;
  options: { key: string; text: string }[];
}

export interface CandidateSession {
  id: string;
  exam_id: string;
  exam_title: string;
  duration_min: number;
  status: SessionStatus;
  started_at: string | null;
  deadline_at: string | null;
  submitted_at: string | null;
  server_now: string;
  max_flags: number;
  flag_count: number;
  questions: CandidateQuestion[];
  answers: Record<string, { value: Record<string, unknown>; client_seq: number }>;
  next_identity_check_in_s?: number | null;
}

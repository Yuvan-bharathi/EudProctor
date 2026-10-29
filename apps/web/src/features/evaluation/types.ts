import type { TopicClass } from "@/components/TopicChip";

export interface SummaryTopic {
  topic_id: string;
  name: string;
  score_pct: number;
  n_questions: number;
}

export interface Recommendation {
  topic_id: string;
  priority: number;
  reason: string;
  note_ids: string[];
  practice_question_ids?: string[];
  needs_mentor_note?: boolean;
}

/** Mentor view of the summary content (includes mentor-only fields). */
export interface SummaryContent {
  overall: { score_pct: number | null; class_percentile?: number | null; change_vs_previous_pct?: number | null };
  strong_topics: SummaryTopic[];
  developing_topics?: SummaryTopic[];
  weak_topics: SummaryTopic[];
  misconceptions?: { misconception_id: string; explanation: string }[];
  recommended_topics: Recommendation[];
  message: string;
  data_notes: string[];
  integrity_note: string;
}

export type SummaryStatus = "draft" | "changes_requested" | "approved" | "published";

export interface SummaryOut {
  id: string;
  session_id: string;
  status: SummaryStatus;
  version: number;
  ready_for_review: boolean;
  edited_by_mentor: boolean;
  mentor_comment: string | null;
  content: SummaryContent;
  approved_by_name: string | null;
  approved_at: string | null;
  published_at: string | null;
  drafted_run_id: string | null;
}

export interface QueueRow {
  summary_id: string | null;
  session_id: string;
  candidate_name: string;
  session_status: string;
  status: SummaryStatus | null;
  version: number | null;
  ready_for_review: boolean;
  updated_at: string | null;
}

/** Candidate dashboard types: no mentor-only fields exist here. */
export interface CandidateResult {
  exam_id: string;
  exam_title: string;
  submitted_at: string | null;
  published_at: string;
  approved_by_name: string | null;
  topics: { topic_id: string; name: string; score_pct: number | null; n_questions: number; cls: TopicClass }[];
  summary: {
    overall: { score_pct: number | null; class_percentile: number | null; change_vs_previous_pct: number | null };
    strong_topics: SummaryTopic[];
    weak_topics: SummaryTopic[];
    misconceptions: { explanation: string }[];
    recommended_topics: { topic_id: string; priority: number; reason: string; notes: { note_id: string; title: string; url_or_body: string; level: string }[] }[];
    message: string;
  };
  practice: { id: string; status: string; n_questions: number; due_at: string | null; attempts: { score_pct: number; completed_at: string }[] } | null;
}

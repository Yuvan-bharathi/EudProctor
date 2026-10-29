import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleX } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { TopicAverageChart } from "@/components/charts";
import { StatCard } from "@/components/StatCard";
import { QueryState } from "@/components/States";
import { type TopicClass, TopicChip } from "@/components/TopicChip";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";

export interface SessionResult {
  session_id: string;
  candidate_name: string;
  exam_title: string;
  score_pct: number | null;
  percentile: number | null;
  total_obtained: number;
  total_max: number;
  n_unmarked: number;
  topics: { topic_id: string; name: string; score_pct: number | null; cls: TopicClass; n_questions: number; priority: number | null }[];
  misconceptions: { misconception_id: string; description: string; count: number }[];
  answers: {
    number: number;
    body: string;
    topic: string;
    type: string;
    max_marks: number;
    marks_awarded: number | null;
    chosen_key: string | null;
    correct_key: string | null;
    text: string | null;
    misconception: string | null;
  }[];
}

export function ResultSummary({ r }: { r: SessionResult }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Score" value={r.score_pct !== null ? `${r.score_pct}%` : "–"} />
        <StatCard label="Marks" value={`${r.total_obtained} / ${r.total_max}`} />
        <StatCard label="Class percentile" value={r.percentile ?? "–"} />
        <StatCard label="Answers to mark" value={r.n_unmarked} />
      </div>
      <Card className="space-y-3">
        <CardTitle>Topics</CardTitle>
        <div className="flex flex-wrap gap-2">
          {r.topics.map((t) => (
            <TopicChip key={t.topic_id} name={t.name} cls={t.cls} scorePct={t.score_pct} />
          ))}
        </div>
        <TopicAverageChart
          data={r.topics.filter((t) => t.score_pct !== null).map((t) => ({ name: t.name, average_pct: t.score_pct, average_cls: t.cls }))}
        />
      </Card>
    </div>
  );
}

export function CandidateResultPage() {
  const { sessionId } = useParams();
  const q = useQuery({ queryKey: ["session-result", sessionId], queryFn: () => api<SessionResult>(`/mentor/sessions/${sessionId}/result`) });
  usePageTitle(q.data ? `${q.data.candidate_name} · result` : "Result");
  return (
    <QueryState query={q} emptyMessage="">
      {(r) => (
        <div className="space-y-6">
          <p className="text-sm text-text">
            {r.exam_title} ·{" "}
            <Link className="text-primary-700 underline underline-offset-2" to={`/mentor/sessions/${r.session_id}`}>
              proctoring details
            </Link>
          </p>
          <ResultSummary r={r} />
          {r.misconceptions.length > 0 && (
            <Card className="space-y-2">
              <CardTitle>Misconceptions</CardTitle>
              <ul className="list-disc pl-5 text-sm text-text">
                {r.misconceptions.map((m) => (
                  <li key={m.misconception_id}>
                    {m.description} <span className="text-muted">(chosen {m.count} times)</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Table>
            <THead>
              <tr><TH>#</TH><TH>Question</TH><TH>Answer</TH><TH>Marks</TH></tr>
            </THead>
            <TBody>
              {r.answers.map((a) => {
                const correct = a.marks_awarded !== null && a.marks_awarded >= a.max_marks;
                return (
                  <TR key={a.number}>
                    <TD>{a.number}</TD>
                    <TD className="max-w-md">
                      <span className="block truncate">{a.body}</span>
                      <span className="text-xs text-muted">{a.topic}</span>
                    </TD>
                    <TD className="text-sm">
                      {a.type === "mcq" ? (
                        <span className="inline-flex items-center gap-1">
                          {correct ? <CheckCircle2 className="size-4 text-success-700" aria-label="Correct" /> : <CircleX className="size-4 text-danger-700" aria-label="Incorrect" />}
                          {a.chosen_key ?? "Not answered"}
                          {!correct && a.correct_key && <span className="text-muted"> (key {a.correct_key})</span>}
                        </span>
                      ) : (
                        <span className="line-clamp-2 text-text">{a.text || "Not answered"}</span>
                      )}
                      {a.misconception && <Badge tone="warning" className="ml-2">{a.misconception}</Badge>}
                    </TD>
                    <TD>{a.marks_awarded === null ? <Badge tone="warning">To mark</Badge> : `${a.marks_awarded} / ${a.max_marks}`}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </QueryState>
  );
}

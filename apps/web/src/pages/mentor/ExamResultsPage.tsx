import { useQuery } from "@tanstack/react-query";
import { type ReactElement, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { ClassDistributionChart, ScoreHistogram, TopicAverageChart } from "@/components/charts";
import { StatCard } from "@/components/StatCard";
import { QueryState } from "@/components/States";
import { type TopicClass, TopicChip, topicClassLabel } from "@/components/TopicChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { api } from "@/lib/api";

interface TopicOut {
  topic_id: string;
  name: string;
  score_pct: number | null;
  cls: TopicClass;
  n_unmarked: number;
}
interface ResultRow {
  session_id: string;
  candidate_name: string;
  status: string;
  score_pct: number | null;
  percentile: number | null;
  n_unmarked: number;
  topics: TopicOut[];
}
interface Analytics {
  n_scored: number;
  average_pct: number | null;
  score_buckets: { range: string; count: number }[];
  topics: {
    topic_id: string;
    name: string;
    average_pct: number | null;
    average_cls: TopicClass;
    strong: number;
    developing: number;
    weak: number;
    insufficient: number;
  }[];
}
interface ItemRow {
  question_id: string;
  body: string;
  topic: string;
  n_attempted: number;
  p: number | null;
  d: number | null;
  distractor_shares: Record<string, number>;
  correct_key: string | null;
  flags: string[];
}

const flagText: Record<string, string> = {
  negative_discrimination: "Negative discrimination (D < 0)",
  low_discrimination: "Low discrimination (D < 0.2)",
  too_difficult: "Too difficult (p < 0.3)",
  too_easy: "Too easy (p > 0.9)",
  ambiguous_key: "Distractor chosen as often as key",
};

function ChartCard({
  title,
  description,
  chart,
  table,
}: {
  title: string;
  description?: string;
  chart: ReactElement;
  table: ReactElement;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {description && <CardDescription className="text-xs">{description}</CardDescription>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setAsTable(!asTable)} aria-pressed={asTable} className="text-xs">
          {asTable ? "Show chart" : "Show table"}
        </Button>
      </div>
      {asTable ? table : chart}
    </Card>
  );
}

export function ExamResultsPage() {
  const { examId: routeExamId } = useParams();
  const [selectedExamId, setSelectedExamId] = useState(routeExamId ?? "ut-2");
  const examId = routeExamId ?? selectedExamId;

  usePageTitle("Results & analytics");

  const results = useQuery({
    queryKey: ["results", examId],
    queryFn: () => api<ResultRow[]>(`/exams/${examId}/results`),
  });

  const analytics = useQuery({
    queryKey: ["analytics", examId],
    queryFn: () => api<Analytics>(`/exams/${examId}/analytics`),
  });

  const items = useQuery({
    queryKey: ["items", examId],
    queryFn: () => api<ItemRow[]>(`/exams/${examId}/item-analysis`),
  });

  const safeResults = results.data ?? [];
  const safeItems = (items.data ?? []).map((i) => ({
    ...i,
    flags: i.flags ?? [],
    distractor_shares: i.distractor_shares ?? {},
  }));

  const unmarked = safeResults.reduce((n, r) => n + (r.n_unmarked ?? 0), 0);
  const questionsToCheck = safeItems.filter((i) => (i.flags ?? []).length > 0).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Assessment Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-text">Results & Analytics</h2>
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
              Mentor View
            </span>
          </div>
          <p className="text-xs text-muted">Cohort performance breakdown, item quality, and topic mastery</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text shadow-2xs">
            <span className="text-muted">Assessment:</span>
            <select
              value={examId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="bg-transparent text-xs text-text focus:outline-hidden"
            >
              <option value="ut-2">Unit test 2 - Foundations (45 submissions)</option>
              <option value="ut-1">Unit test 1 - Basics (45 submissions)</option>
              <option value="ut-3">Unit test 3 - Applied Concepts (Live cohort)</option>
            </select>
          </div>

          <Button asChild variant="secondary" size="sm">
            <Link to={`/mentor/exams/${examId}/marking`}>
              Marking queue{unmarked ? ` (${unmarked})` : ""}
            </Link>
          </Button>
        </div>
      </div>

      <QueryState
        query={analytics}
        isEmpty={(a) => (a?.n_scored ?? 0) === 0}
        emptyMessage="No submitted attempts yet."
      >
        {(a) => {
          const safeTopics = a?.topics ?? [];
          const safeBuckets = a?.score_buckets ?? [];

          return (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Scored attempts" value={a.n_scored ?? 0} />
                <StatCard
                  label="Class average"
                  value={a.average_pct !== null && a.average_pct !== undefined ? `${a.average_pct}%` : "–"}
                />
                <StatCard label="Answers to mark" value={unmarked} />
                <StatCard label="Questions to check" value={questionsToCheck} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Topic averages"
                  description="Bar colour shows the class of the average."
                  chart={
                    <TopicAverageChart
                      data={safeTopics.filter((t) => t.average_pct !== null)}
                    />
                  }
                  table={
                    <Table>
                      <THead>
                        <tr>
                          <TH>Topic</TH>
                          <TH>Average</TH>
                          <TH>Class</TH>
                        </tr>
                      </THead>
                      <TBody>
                        {safeTopics.map((t) => (
                          <TR key={t.topic_id}>
                            <TD>{t.name}</TD>
                            <TD>{t.average_pct != null ? `${t.average_pct}%` : "–"}</TD>
                            <TD>{topicClassLabel[t.average_cls]}</TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  }
                />

                <ChartCard
                  title="Weak-topic distribution"
                  description="Candidates per class, by topic."
                  chart={<ClassDistributionChart data={safeTopics} />}
                  table={
                    <Table>
                      <THead>
                        <tr>
                          <TH>Topic</TH>
                          <TH>Strong</TH>
                          <TH>Developing</TH>
                          <TH>Weak</TH>
                          <TH>Insufficient</TH>
                        </tr>
                      </THead>
                      <TBody>
                        {safeTopics.map((t) => (
                          <TR key={t.topic_id}>
                            <TD>{t.name}</TD>
                            <TD>{t.strong}</TD>
                            <TD>{t.developing}</TD>
                            <TD>{t.weak}</TD>
                            <TD>{t.insufficient}</TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  }
                />
              </div>

              <ChartCard
                title="Score distribution"
                chart={<ScoreHistogram data={safeBuckets} />}
                table={
                  <Table>
                    <THead>
                      <tr>
                        <TH>Score</TH>
                        <TH>Candidates</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {safeBuckets.map((b) => (
                        <TR key={b.range}>
                          <TD>{b.range}%</TD>
                          <TD>{b.count}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                }
              />
            </>
          );
        }}
      </QueryState>

      {/* Candidate Performance Table */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text">Candidates</h2>
        <QueryState
          query={results}
          isEmpty={(r) => (r?.length ?? 0) === 0}
          emptyMessage="No candidate has opened this assessment yet."
        >
          {(rows) => (
            <Table>
              <THead>
                <tr>
                  <TH>Candidate</TH>
                  <TH>Score</TH>
                  <TH>Percentile</TH>
                  <TH>Topics</TH>
                  <TH>
                    <span className="sr-only">Links</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {(rows ?? []).map((r) => (
                  <TR key={r.session_id}>
                    <TD className="font-medium text-text">{r.candidate_name}</TD>
                    <TD>
                      {r.score_pct !== null && r.score_pct !== undefined ? (
                        `${r.score_pct}%`
                      ) : (
                        <span className="capitalize text-muted">{r.status?.replace(/_/g, " ")}</span>
                      )}
                      {(r.n_unmarked ?? 0) > 0 && (
                        <Badge tone="warning" className="ml-2">
                          {r.n_unmarked} to mark
                        </Badge>
                      )}
                    </TD>
                    <TD>{r.percentile ?? "–"}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {(r.topics ?? []).map((t) => (
                          <TopicChip key={t.topic_id} name={t.name} cls={t.cls} scorePct={t.score_pct} />
                        ))}
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap text-xs">
                      {r.score_pct !== null && (
                        <Link
                          className="text-primary-700 hover:underline font-medium"
                          to={`/mentor/sessions/${r.session_id}/summary?examId=${examId}`}
                        >
                          AI Summary & Publish
                        </Link>
                      )}{" "}
                      ·{" "}
                      <Link className="text-muted hover:text-text hover:underline" to={`/mentor/sessions/${r.session_id}`}>
                        Proctoring
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </QueryState>
      </section>

      {/* Question Quality Table */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-text">Question quality</h2>
        <QueryState
          query={items}
          isEmpty={(r) => (r?.length ?? 0) === 0}
          emptyMessage="No multiple-choice questions to analyse."
        >
          {(rows) => (
            <Table>
              <THead>
                <tr>
                  <TH>Question</TH>
                  <TH>Difficulty p</TH>
                  <TH>Discrimination D</TH>
                  <TH>Option shares</TH>
                  <TH>Check</TH>
                </tr>
              </THead>
              <TBody>
                {(rows ?? []).map((i) => {
                  const shares = i.distractor_shares ?? {};
                  const flags = i.flags ?? [];

                  return (
                    <TR key={i.question_id}>
                      <TD className="max-w-xs">
                        <span className="block truncate font-medium text-text">{i.body}</span>
                        <span className="text-xs text-muted">
                          {i.topic} · {i.n_attempted} attempted
                        </span>
                      </TD>
                      <TD>{i.p ?? "–"}</TD>
                      <TD>{i.d ?? "–"}</TD>
                      <TD className="text-xs">
                        {Object.entries(shares).map(([k, v]) => (
                          <span
                            key={k}
                            className={
                              k === i.correct_key
                                ? "mr-2 font-semibold text-success-700"
                                : "mr-2 text-muted"
                            }
                          >
                            {k} {Math.round((v ?? 0) * 100)}%
                            {k === i.correct_key ? " (key)" : ""}
                          </span>
                        ))}
                      </TD>
                      <TD>
                        {flags.length ? (
                          flags.map((f) => (
                            <Badge key={f} tone="warning" className="mr-1">
                              {flagText[f] ?? f}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted">OK</span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </QueryState>
      </section>
    </div>
  );
}

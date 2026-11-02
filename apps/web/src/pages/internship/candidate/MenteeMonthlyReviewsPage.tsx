import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, CheckCircle2, ClipboardList, FileText, Target, TrendingUp } from "lucide-react";
import { useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import { internshipApi, type Appraisal, type AppraisalContent, type AppraisalMetrics } from "@/lib/internshipApi";
import { SKILL_LEVEL_LABELS, type SkillLevel } from "@/lib/types";

const MILESTONES = [30, 60, 90] as const;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function pct(v: number | null | undefined): string {
  return v == null ? "Not available" : `${v}%`;
}

function MetricTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-3 text-center">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <p className="mt-1 text-lg font-bold text-text">{value}</p>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm text-text">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

function MetricsSection({ metrics }: { metrics: AppraisalMetrics }) {
  const b = metrics.breakdown;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <TrendingUp className="size-4 text-muted" aria-hidden="true" />
            Your numbers for this period
          </CardTitle>
          <CardDescription>
            Calculated from your records between {formatDate(metrics.window.start)} and{" "}
            {formatDate(metrics.window.end)}.
          </CardDescription>
        </div>
      </CardHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-3 text-center sm:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">Composite score</span>
          <p className="mt-1 text-3xl font-bold text-primary-700">{pct(metrics.composite_score_pct)}</p>
          {metrics.composite_note && <p className="mt-0.5 text-[11px] text-primary-700">{metrics.composite_note}</p>}
        </div>
        <MetricTile label="Weekly checks" value={pct(b.mcqScorePct)} />
        <MetricTile label="Tasks" value={pct(b.tasksScorePct)} />
        <MetricTile label="Attendance" value={pct(b.attendanceScorePct)} />
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-lg border border-border bg-surface-muted p-2 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Coding</span>
            <p className="text-xs text-text">Assessed by your mentor</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-muted p-2 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Communication</span>
            <p className="text-xs text-text">Assessed by your mentor</p>
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-border pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Attendance rate</dt>
          <dd className="font-medium text-text">{pct(metrics.attendance.rate_pct)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Days worked</dt>
          <dd className="font-medium text-text">{metrics.attendance.days_worked}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Average hours on worked days</dt>
          <dd className="font-medium text-text">{metrics.attendance.avg_hours_on_worked_days}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Tasks done</dt>
          <dd className="font-medium text-text">
            {metrics.tasks.done} of {metrics.tasks.assigned}
            {metrics.tasks.done_pct != null && ` (${metrics.tasks.done_pct}%)`}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Tasks in review</dt>
          <dd className="font-medium text-text">{metrics.tasks.in_review}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Weekly checks taken</dt>
          <dd className="font-medium text-text">{metrics.quizzes.taken}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Weekly check average</dt>
          <dd className="font-medium text-text">{pct(metrics.quizzes.avg_score_pct)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">Code reviews published</dt>
          <dd className="font-medium text-text">{metrics.code_reviews_published}</dd>
        </div>
      </dl>

      {metrics.skills.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Skills at review time</h3>
          <ul className="flex flex-wrap gap-2">
            {metrics.skills.map((s) => (
              <li key={s.skill}>
                <Badge tone={s.level != null ? "primary" : "neutral"}>
                  {s.skill}:{" "}
                  {s.level != null
                    ? `Level ${s.level} (${SKILL_LEVEL_LABELS[s.level as SkillLevel] ?? ""})`
                    : "Insufficient data"}{" "}
                  · {s.score_pct}%
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function ContentSection({ content, milestone }: { content: AppraisalContent; milestone: number }) {
  // mentor_brief is the mentor's private 1:1 prep note and is deliberately never rendered here.
  const scaffold = content.self_appraisal_scaffold;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="space-y-5">
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <FileText className="size-4 text-muted" aria-hidden="true" />
            Summary from your mentor
          </CardTitle>
          <p className="mt-2 whitespace-pre-line rounded-lg bg-surface-muted p-3 text-sm leading-relaxed text-text">
            {content.qualitative_summary}
          </p>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-success-700">Strengths</h3>
          <List items={content.strengths} empty="None listed." />
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-warning-800">Growth areas</h3>
          <List items={content.growth_areas} empty="None listed." />
        </div>
      </Card>

      <Card className="space-y-5">
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <Target className="size-4 text-muted" aria-hidden="true" />
            Goals after Day {milestone}
          </CardTitle>
          {content.next_goals.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No goals listed.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {content.next_goals.map((goal, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-muted p-2.5 text-sm text-text"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700">
                    {i + 1}
                  </span>
                  <span>{goal}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <ClipboardList className="size-4 text-muted" aria-hidden="true" />
            Self-appraisal prompts
          </CardTitle>
          <CardDescription className="mt-0.5">Use these to prepare for your review conversation.</CardDescription>
          <div className="mt-3 space-y-3">
            <div>
              <h4 className="mb-1 text-xs font-semibold text-muted">Accomplishments</h4>
              <List items={scaffold?.accomplishments ?? []} empty="None listed." />
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold text-muted">Challenges</h4>
              <List items={scaffold?.challenges ?? []} empty="None listed." />
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold text-muted">Focus goals</h4>
              <List items={scaffold?.focus_goals ?? []} empty="None listed." />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AcknowledgePanel({ appraisal }: { appraisal: Appraisal }) {
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const ack = useMutation({
    mutationFn: () => internshipApi.acknowledgeAppraisal(appraisal.id, comment),
    onSuccess: () => {
      setComment("");
      void qc.invalidateQueries({ queryKey: ["internship", "appraisals"] });
    },
  });

  if (appraisal.status === "acknowledged") {
    return (
      <div className="space-y-2">
        <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-success-700">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          You acknowledged this review on {formatDate(appraisal.acknowledged_at)}.
        </p>
        {appraisal.mentee_comment && (
          <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm text-text">
            <span className="mb-1 block text-xs font-semibold text-muted">Your comment</span>
            <p className="whitespace-pre-line">{appraisal.mentee_comment}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        ack.mutate();
      }}
    >
      <div>
        <Label htmlFor={`ack-comment-${appraisal.id}`}>Your comment (optional)</Label>
        <Textarea
          id={`ack-comment-${appraisal.id}`}
          value={comment}
          maxLength={4000}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Anything you'd like your mentor to know about this review"
          disabled={ack.isPending}
        />
      </div>
      {ack.isError && <ErrorState message={errorMessage(ack.error)} />}
      <Button type="submit" disabled={ack.isPending}>
        <CheckCircle2 aria-hidden="true" />
        {ack.isPending ? "Acknowledging…" : "Acknowledge review"}
      </Button>
    </form>
  );
}

function AppraisalView({ appraisal }: { appraisal: Appraisal }) {
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-text">Day {appraisal.milestone_day} review</h2>
              {appraisal.status === "acknowledged" ? (
                <Badge tone="success">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Acknowledged
                </Badge>
              ) : (
                <Badge tone="info">Published by your mentor</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">Published on {formatDate(appraisal.published_at)}</p>
          </div>
          <div className="w-full md:max-w-md">
            <AcknowledgePanel key={appraisal.id} appraisal={appraisal} />
          </div>
        </div>
      </Card>

      <MetricsSection metrics={appraisal.metrics} />

      {appraisal.content ? (
        <ContentSection content={appraisal.content} milestone={appraisal.milestone_day} />
      ) : (
        <EmptyState message="Your mentor has not added written feedback to this review." />
      )}
    </div>
  );
}

export function MenteeMonthlyReviewsPage() {
  usePageTitle("Monthly Reviews & Growth");
  const appraisalsQ = useQuery({
    queryKey: ["internship", "appraisals"],
    queryFn: () => internshipApi.appraisals(),
  });
  const [selected, setSelected] = useState<30 | 60 | 90 | null>(null);

  const list = appraisalsQ.data ?? [];
  const latest = list.length > 0 ? list[list.length - 1].milestone_day : null;
  const milestone = selected ?? latest;
  const active = list.find((a) => a.milestone_day === milestone);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="primary">
            <Award className="size-3.5" aria-hidden="true" />
            Day 30 / 60 / 90 reviews
          </Badge>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-text sm:text-2xl">My Reviews</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Your mentor reviews your progress at Day 30, 60 and 90. A review appears here once your mentor has
            approved and published it. The numbers are calculated from your attendance, tasks and weekly checks.
          </p>
        </div>

        {list.length > 0 && (
          <div className="flex items-center gap-1 rounded-xl bg-surface-muted p-1" role="tablist" aria-label="Review">
            {MILESTONES.map((m) => {
              const has = list.some((a) => a.milestone_day === m);
              const isActive = milestone === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSelected(m)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${
                    isActive ? "bg-surface text-primary-700 shadow-sm" : "text-muted hover:text-text"
                  }`}
                >
                  Day {m}
                  {!has && " (not yet)"}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {appraisalsQ.isPending ? (
        <LoadingState rows={4} label="Loading reviews" />
      ) : appraisalsQ.isError ? (
        <ErrorState message={errorMessage(appraisalsQ.error)} onRetry={() => appraisalsQ.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState message="No reviews yet. Your Day 30 review will appear here after your mentor publishes it." />
      ) : active ? (
        <AppraisalView appraisal={active} />
      ) : (
        <EmptyState message={`Your Day ${milestone} review has not been published yet.`} />
      )}
    </div>
  );
}

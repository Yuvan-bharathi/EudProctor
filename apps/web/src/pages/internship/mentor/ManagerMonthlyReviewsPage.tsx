import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, MessageSquareQuote, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import { type Appraisal, type AppraisalMetrics, internshipApi } from "@/lib/internshipApi";

type Tone = NonNullable<BadgeProps["tone"]>;
const MILESTONES = [30, 60, 90] as const;

const STATUS: Record<Appraisal["status"], { tone: Tone; label: string }> = {
  drafting: { tone: "primary", label: "Drafting" },
  awaiting_mentor: { tone: "ai", label: "Awaiting your approval" },
  published: { tone: "success", label: "Published" },
  acknowledged: { tone: "success", label: "Acknowledged by intern" },
  rejected: { tone: "neutral", label: "Rejected" },
  failed: { tone: "danger", label: "Draft failed" },
};

const INBOX = "/mentor/internship/coding";

function pct(v: number | null | undefined) {
  return v === null || v === undefined ? "—" : `${Math.round(v)}%`;
}

export function ManagerMonthlyReviewsPage() {
  usePageTitle("Monthly Reviews & Calibration");
  const [filter, setFilter] = useState("");

  const menteesQ = useQuery({ queryKey: ["internship", "mentees"], queryFn: () => internshipApi.mentees() });
  const appraisalsQ = useQuery({ queryKey: ["internship", "appraisals"], queryFn: () => internshipApi.appraisals() });

  const appraisals = (appraisalsQ.data ?? []).filter((a) => !filter || a.mentee_id === filter);

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="ai">
          <Sparkles aria-hidden="true" />
          Day 30 / 60 / 90 appraisals
        </Badge>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-text sm:text-2xl">Milestone Appraisals</h1>
        <p className="text-sm text-muted">
          Generate an AI-drafted appraisal from deterministic metrics. Nothing reaches the intern until you approve it in
          the{" "}
          <Link to={INBOX} className="font-medium text-primary-700 underline-offset-4 hover:underline">
            AI Approval Inbox
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Generate a draft</CardTitle>
            <CardDescription>
              Pick an intern and milestone. Re-generating is only possible after a draft was rejected or failed.
            </CardDescription>
          </div>
        </CardHeader>
        {menteesQ.isPending ? (
          <LoadingState rows={2} label="Loading interns" />
        ) : menteesQ.isError ? (
          <ErrorState message={errorMessage(menteesQ.error)} onRetry={() => menteesQ.refetch()} />
        ) : menteesQ.data.length === 0 ? (
          <EmptyState message="No interns are assigned to you yet." />
        ) : (
          <ul className="divide-y divide-border">
            {menteesQ.data.map((m) => (
              <GenerateRow
                key={m.enrollment_id}
                menteeId={m.id}
                name={m.name}
                meta={`${m.cohort_name} · Week ${m.current_week} · Month ${m.current_month}`}
                existing={(appraisalsQ.data ?? []).filter((a) => a.mentee_id === m.id)}
              />
            ))}
          </ul>
        )}
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-base font-semibold text-text">Appraisals</h2>
          <div>
            <Label htmlFor="ap-filter">Intern</Label>
            <Select id="ap-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All interns</option>
              {(menteesQ.data ?? []).map((m) => (
                <option key={m.enrollment_id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {appraisalsQ.isPending ? (
          <LoadingState rows={3} label="Loading appraisals" />
        ) : appraisalsQ.isError ? (
          <ErrorState message={errorMessage(appraisalsQ.error)} onRetry={() => appraisalsQ.refetch()} />
        ) : appraisals.length === 0 ? (
          <EmptyState message="No appraisals yet. Generate a Day 30 draft above to start." />
        ) : (
          appraisals.map((a) => <AppraisalCard key={a.id} a={a} />)
        )}
      </div>
    </div>
  );
}

function GenerateRow({
  menteeId,
  name,
  meta,
  existing,
}: {
  menteeId: string;
  name: string;
  meta: string;
  existing: Appraisal[];
}) {
  const qc = useQueryClient();
  const gen = useMutation({
    mutationFn: (day: 30 | 60 | 90) => internshipApi.generateAppraisal(menteeId, day),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internship"] }),
  });

  return (
    <li className="py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-medium text-text">{name}</p>
          <p className="text-xs text-muted">{meta}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MILESTONES.map((day) => {
            const ap = existing.find((a) => a.milestone_day === day);
            const canGenerate = !ap || ap.status === "rejected" || ap.status === "failed";
            if (!canGenerate && ap) {
              return (
                <Badge key={day} tone={STATUS[ap.status].tone}>
                  Day {day}: {STATUS[ap.status].label}
                </Badge>
              );
            }
            const busy = gen.isPending && gen.variables === day;
            return (
              <Button key={day} size="sm" variant="secondary" disabled={gen.isPending} onClick={() => gen.mutate(day)}>
                {busy ? "Drafting…" : ap ? `Re-generate Day ${day}` : `Generate Day ${day}`}
              </Button>
            );
          })}
        </div>
      </div>
      {gen.isError && (
        <div className="mt-2">
          <ErrorState message={errorMessage(gen.error)} />
        </div>
      )}
      {gen.isSuccess && (
        <p className="mt-2 text-xs text-muted">
          Day {gen.data.milestone_day} draft status: <strong className="text-text">{STATUS[gen.data.status].label}</strong>
          {gen.data.status === "awaiting_mentor" && (
            <>
              {" · "}
              <Link to={INBOX} className="font-medium text-primary-700 hover:underline">
                Review it in the approval inbox
              </Link>
            </>
          )}
        </p>
      )}
    </li>
  );
}

function AppraisalCard({ a }: { a: Appraisal }) {
  const s = STATUS[a.status];
  const showContent = (a.status === "published" || a.status === "acknowledged") && a.content;
  // metrics is {} until the agent has computed them (drafting / failed)
  const hasMetrics = !!a.metrics && "attendance" in a.metrics;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>
            {a.mentee_name} · Day {a.milestone_day} appraisal
          </CardTitle>
          <CardDescription>
            {hasMetrics
              ? `Window ${a.metrics.window.start} to ${a.metrics.window.end}`
              : `Created ${new Date(a.created_at).toLocaleDateString()}`}
            {a.published_at && ` · published ${new Date(a.published_at).toLocaleDateString()}`}
          </CardDescription>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={s.tone}>{s.label}</Badge>
          {a.status === "awaiting_mentor" && (
            <Link to={INBOX} className={buttonVariants({ size: "sm" })}>
              <ClipboardCheck aria-hidden="true" />
              Review in AI Approval Inbox
            </Link>
          )}
        </div>
      </CardHeader>

      {hasMetrics ? <Metrics m={a.metrics} /> : <p className="text-sm text-muted">Metrics are not available yet.</p>}

      {showContent && a.content && (
        <div className="mt-4 space-y-3 rounded-lg border border-border p-4 text-sm">
          <h3 className="font-semibold text-text">Published appraisal</h3>
          <p className="whitespace-pre-wrap text-text">{a.content.qualitative_summary}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <BulletList title="Strengths" items={a.content.strengths ?? []} />
            <BulletList title="Growth areas" items={a.content.growth_areas ?? []} />
            <BulletList title="Next goals" items={a.content.next_goals ?? []} />
          </div>
          {a.content.mentor_brief && (
            <div>
              <p className="text-xs font-medium text-muted">Mentor brief (for you)</p>
              <p className="whitespace-pre-wrap">{a.content.mentor_brief}</p>
            </div>
          )}
        </div>
      )}

      {a.status === "acknowledged" && (
        <div className="mt-4 rounded-lg bg-surface-muted p-4 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <MessageSquareQuote className="size-4" aria-hidden="true" />
            Intern acknowledgement
            {a.acknowledged_at && ` · ${new Date(a.acknowledged_at).toLocaleDateString()}`}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-text">{a.mentee_comment || "Acknowledged without a comment."}</p>
        </div>
      )}
    </Card>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted">{title}</p>
      {items.length === 0 ? (
        <p className="text-muted">—</p>
      ) : (
        <ul className="list-disc space-y-0.5 pl-4">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Metrics({ m }: { m: AppraisalMetrics }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Attendance" value={pct(m.attendance.rate_pct)} hint={`${m.attendance.days_worked} days · ${m.attendance.avg_hours_on_worked_days.toFixed(1)} h avg`} />
        <Metric label="Tasks done" value={`${m.tasks.done} / ${m.tasks.assigned}`} hint={`${pct(m.tasks.done_pct)} · ${m.tasks.in_review} in review`} />
        <Metric label="Weekly quizzes" value={pct(m.quizzes.avg_score_pct)} hint={`${m.quizzes.taken} taken`} />
        <Metric
          label="Activity"
          value={`${m.code_reviews_published} reviews`}
          hint={`${m.blocker_questions} blocker questions · ${m.stall_alerts} stall alerts`}
        />
      </div>
      {m.attendance.needs_correction_days > 0 && (
        <p className="text-xs text-warning-800">
          {m.attendance.needs_correction_days} day(s) still need an attendance correction.
        </p>
      )}
      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Score breakdown</p>
        <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
          <Pair label="MCQ" value={pct(m.breakdown.mcqScorePct)} />
          <Pair label="Tasks" value={pct(m.breakdown.tasksScorePct)} />
          <Pair label="Attendance" value={pct(m.breakdown.attendanceScorePct)} />
          <Pair label="Coding" value="Assessed by you in the 1:1" muted />
          <Pair label="Communication" value="Assessed by you in the 1:1" muted />
        </dl>
        <p className="mt-2 text-xs text-muted">
          Composite (computed parts only): <strong className="text-text">{pct(m.composite_score_pct)}</strong>
          {m.composite_note && ` · ${m.composite_note}`}
        </p>
      </div>
      {(m.skills ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {m.skills.map((s) => (
            <Badge key={s.skill} tone={s.level === null ? "neutral" : "primary"}>
              {s.skill}: {s.level === null ? "insufficient data" : `L${s.level}`}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="text-lg font-bold text-text">{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

function Pair({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={muted ? "text-xs italic text-muted" : "font-semibold text-text"}>{value}</dd>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { CalendarCheck2, Circle, Code2, Layers, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { errorMessage } from "@/lib/api";
import { type DayStatus, internshipApi, type Overview } from "@/lib/internshipApi";

type Tone = NonNullable<BadgeProps["tone"]>;

const DAY_TONE: Record<DayStatus, Tone> = {
  Present: "success",
  "Half Day": "warning",
  Short: "warning",
  Leave: "info",
  Absent: "danger",
  "In Progress": "primary",
  "Needs Correction": "danger",
};

const COUNTERS: { key: keyof Overview; label: string; hint: string }[] = [
  { key: "active_interns", label: "Active interns", hint: "Across all cohorts" },
  { key: "online_now", label: "Online now", hint: "Currently punched in" },
  { key: "pending_approvals", label: "Pending AI approvals", hint: "Drafts waiting for a mentor" },
  { key: "open_stall_alerts", label: "Open stall alerts", hint: "Not yet acknowledged" },
  { key: "tasks_in_review", label: "Tasks in review", hint: "Submitted, awaiting mentor" },
  { key: "pending_leave", label: "Pending leave", hint: "Awaiting a mentor decision" },
  { key: "cohorts", label: "Cohorts", hint: "All cohorts" },
];

function pct(v: number | null | undefined) {
  return v === null || v === undefined ? "—" : `${Math.round(v)}%`;
}

export function AdminInternshipDashboardPage() {
  usePageTitle("Internship Programme Dashboard");
  const overviewQ = useQuery({ queryKey: ["internship", "overview"], queryFn: () => internshipApi.overview() });
  const cohortsQ = useQuery({ queryKey: ["internship", "cohorts"], queryFn: () => internshipApi.cohorts() });
  const menteesQ = useQuery({ queryKey: ["internship", "mentees"], queryFn: () => internshipApi.mentees() });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="primary">
            <ShieldCheck aria-hidden="true" />
            Programme administration
          </Badge>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-text sm:text-2xl">Internship Programme Overview</h1>
          <p className="text-sm text-muted">Live counters, cohorts and every enrolled intern.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/internship/cohorts" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <Layers aria-hidden="true" />
            Cohorts & pairings
          </Link>
          <Link to="/admin/internship/attendance" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <CalendarCheck2 aria-hidden="true" />
            Attendance audit
          </Link>
          <Link to="/admin/internship/coding-bank" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <Code2 aria-hidden="true" />
            Coding bank
          </Link>
        </div>
      </div>

      {overviewQ.isPending ? (
        <LoadingState rows={2} label="Loading overview" />
      ) : overviewQ.isError ? (
        <ErrorState message={errorMessage(overviewQ.error)} onRetry={() => overviewQ.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          {COUNTERS.map((c) => {
            const v = overviewQ.data[c.key];
            const alert = (c.key === "open_stall_alerts" || c.key === "pending_approvals") && v > 0;
            return (
              <Card key={c.key} className="p-4">
                <p className="text-xs font-medium text-muted">{c.label}</p>
                <p className={`mt-2 text-2xl font-bold ${alert ? "text-warning-800" : "text-text"}`}>{v}</p>
                <p className="text-xs text-muted">{c.hint}</p>
              </Card>
            );
          })}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Cohorts</h2>
          <Link to="/admin/internship/cohorts" className="text-sm font-medium text-primary-700 hover:underline">
            Manage cohorts →
          </Link>
        </div>
        {cohortsQ.isPending ? (
          <LoadingState rows={2} label="Loading cohorts" />
        ) : cohortsQ.isError ? (
          <ErrorState message={errorMessage(cohortsQ.error)} onRetry={() => cohortsQ.refetch()} />
        ) : cohortsQ.data.length === 0 ? (
          <EmptyState
            message="No cohorts yet."
            action={
              <Link to="/admin/internship/cohorts" className={buttonVariants({ size: "sm" })}>
                Create a cohort
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cohortsQ.data.map((c) => (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-text">{c.name}</h3>
                    <p className="text-xs text-muted">{c.track}</p>
                  </div>
                  <Badge tone={c.ai_review_enabled ? "ai" : "neutral"}>
                    {c.ai_review_enabled ? "AI review on" : "AI review off"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {c.start_date} → {c.end_date}
                </p>
                <p className="mt-1 text-sm text-text">
                  {c.mentee_count} intern{c.mentee_count === 1 ? "" : "s"} · {c.mentor_count} mentor
                  {c.mentor_count === 1 ? "" : "s"}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>All interns</CardTitle>
            <CardDescription>Attendance, task progress and today's status for every enrolment.</CardDescription>
          </div>
        </CardHeader>
        {menteesQ.isPending ? (
          <LoadingState rows={4} label="Loading interns" />
        ) : menteesQ.isError ? (
          <ErrorState message={errorMessage(menteesQ.error)} onRetry={() => menteesQ.refetch()} />
        ) : menteesQ.data.length === 0 ? (
          <EmptyState message="No interns enrolled yet." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Intern</TH>
                <TH>Cohort</TH>
                <TH>Mentor</TH>
                <TH>Week / Month</TH>
                <TH>Today</TH>
                <TH>Attendance</TH>
                <TH>Tasks</TH>
                <TH>Enrolment</TH>
              </tr>
            </THead>
            <TBody>
              {menteesQ.data.map((m) => (
                <TR key={m.enrollment_id}>
                  <TD>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-muted">
                      {m.username ? `@${m.username} · ` : ""}
                      {m.email}
                    </p>
                  </TD>
                  <TD>
                    <p>{m.cohort_name}</p>
                    <p className="text-xs text-muted">{m.track}</p>
                  </TD>
                  <TD>{m.mentor_name}</TD>
                  <TD className="whitespace-nowrap">
                    W{m.current_week} · M{m.current_month}
                  </TD>
                  <TD>
                    <div className="flex flex-col items-start gap-1">
                      {m.today_status && <Badge tone={DAY_TONE[m.today_status]}>{m.today_status}</Badge>}
                      {m.online && (
                        <span className="inline-flex items-center gap-1 text-xs text-success-700">
                          <Circle className="size-2 fill-success-500 text-success-500" aria-hidden="true" />
                          Online
                        </span>
                      )}
                    </div>
                  </TD>
                  <TD>{pct(m.attendance_rate_pct)}</TD>
                  <TD className="whitespace-nowrap">
                    {m.tasks_done ?? 0} / {m.tasks_total ?? 0}
                    {(m.tasks_in_review ?? 0) > 0 && <p className="text-xs text-muted">{m.tasks_in_review} in review</p>}
                  </TD>
                  <TD>
                    <Badge tone={m.status === "Active" ? "primary" : "success"}>{m.status}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

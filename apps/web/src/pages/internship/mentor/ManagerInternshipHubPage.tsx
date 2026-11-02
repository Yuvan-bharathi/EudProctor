import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Inbox,
  ListTodo,
  MessageCircleQuestion,
  ScanSearch,
  Sparkles,
  Users,
  Wifi,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { errorMessage } from "@/lib/api";
import { type AgentKind, type DayStatus, type StallAlertRow, internshipApi } from "@/lib/internshipApi";
import { cn } from "@/lib/utils";

const INBOX = "/mentor/internship/coding";

const AGENT_LABEL: Record<AgentKind, string> = {
  code_review: "Code review",
  weekly_quiz: "Weekly quiz",
  appraisal: "Appraisal",
};

const STALL_SOURCE: Record<StallAlertRow["source"], { label: string; tone: BadgeProps["tone"] }> = {
  auto: { label: "Auto-detected", tone: "neutral" },
  self_flag: { label: "Self-flagged", tone: "warning" },
  blocker_chat: { label: "Co-Pilot escalation", tone: "ai" },
};

const DAY_STATUS_TONE: Record<DayStatus, BadgeProps["tone"]> = {
  Present: "success",
  "Half Day": "warning",
  Short: "warning",
  Leave: "info",
  Absent: "danger",
  "In Progress": "primary",
  "Needs Correction": "danger",
};

function localToday() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ManagerInternshipHubPage() {
  usePageTitle("Internship Hub");
  const qc = useQueryClient();
  const today = localToday();
  const [scanResult, setScanResult] = useState<string | null>(null);

  const overview = useQuery({ queryKey: ["internship", "overview"], queryFn: internshipApi.overview });
  const stalls = useQuery({ queryKey: ["internship", "stall-alerts", "open"], queryFn: () => internshipApi.stallAlerts(true) });
  const approvals = useQuery({
    queryKey: ["internship", "approvals", "pending", "all"],
    queryFn: () => internshipApi.approvals({ status: "pending" }),
  });
  const attendance = useQuery({
    queryKey: ["internship", "attendance-today"],
    queryFn: () => internshipApi.menteesAttendanceToday(),
  });
  const standups = useQuery({
    queryKey: ["internship", "standups", today],
    queryFn: () => internshipApi.standups({ on: today }),
  });
  const blockers = useQuery({ queryKey: ["internship", "blocker-history"], queryFn: () => internshipApi.blockerHistory() });
  const mentees = useQuery({ queryKey: ["internship", "mentees"], queryFn: () => internshipApi.mentees() });

  const ack = useMutation({
    mutationFn: (id: string) => internshipApi.ackStall(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internship", "stall-alerts"] });
      qc.invalidateQueries({ queryKey: ["internship", "overview"] });
    },
  });
  const scan = useMutation({
    mutationFn: internshipApi.stallScan,
    onMutate: () => setScanResult(null),
    onSuccess: (r) => {
      setScanResult(
        r.created === 0 ? "Scan complete: no new stalled tasks." : `Scan complete: ${r.created} new stall alert${r.created === 1 ? "" : "s"}.`,
      );
      qc.invalidateQueries({ queryKey: ["internship", "stall-alerts"] });
      qc.invalidateQueries({ queryKey: ["internship", "overview"] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text sm:text-2xl">Internship Hub</h1>
          <p className="text-sm text-muted">Today’s picture of your interns: alerts, approvals, attendance and standups.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link to={INBOX}>
              <Inbox /> AI Approval Inbox
            </Link>
          </Button>
          <Button asChild>
            <Link to="/mentor/internship/tasks">
              <ListTodo /> Manage tasks
            </Link>
          </Button>
        </div>
      </div>

      {/* Counters */}
      {overview.isPending ? (
        <LoadingState rows={1} />
      ) : overview.isError ? (
        <ErrorState message={errorMessage(overview.error)} onRetry={() => overview.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Active interns" value={overview.data.active_interns} icon={<Users />} />
          <StatCard label="Online now" value={overview.data.online_now} icon={<Wifi />} />
          <StatCard
            label="Pending approvals"
            value={overview.data.pending_approvals}
            icon={<Sparkles />}
            to={INBOX}
            highlight={overview.data.pending_approvals > 0 ? "ai" : undefined}
          />
          <StatCard
            label="Open stall alerts"
            value={overview.data.open_stall_alerts}
            icon={<AlertTriangle />}
            highlight={overview.data.open_stall_alerts > 0 ? "warning" : undefined}
          />
          <StatCard label="Tasks in review" value={overview.data.tasks_in_review} icon={<Clock />} to="/mentor/internship/tasks" />
          <StatCard
            label="Pending leave"
            value={overview.data.pending_leave}
            icon={<CalendarCheck2 />}
            to="/mentor/internship/attendance"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Stall alerts */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Stall alerts</CardTitle>
              <CardDescription>Interns who may be stuck. Acknowledge once you’ve reached out.</CardDescription>
            </div>
            <Button variant="secondary" size="sm" onClick={() => scan.mutate()} disabled={scan.isPending}>
              <ScanSearch /> {scan.isPending ? "Scanning…" : "Scan for stalled tasks now"}
            </Button>
          </CardHeader>
          <div className="space-y-3">
            {scanResult && (
              <p role="status" className="flex items-center gap-2 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
                <CheckCircle2 className="size-4" aria-hidden="true" /> {scanResult}
              </p>
            )}
            {scan.isError && <ErrorState message={errorMessage(scan.error)} />}
            {ack.isError && <ErrorState message={errorMessage(ack.error)} />}
            {stalls.isPending ? (
              <LoadingState />
            ) : stalls.isError ? (
              <ErrorState message={errorMessage(stalls.error)} onRetry={() => stalls.refetch()} />
            ) : stalls.data.length === 0 ? (
              <EmptyState message="No open stall alerts." />
            ) : (
              <ul className="space-y-2">
                {stalls.data.map((s) => (
                  <li key={s.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-text">{s.mentee_name}</span>
                          <Badge tone={STALL_SOURCE[s.source].tone}>{STALL_SOURCE[s.source].label}</Badge>
                        </div>
                        {s.task_title && <p className="mt-1 text-xs text-muted">Task: {s.task_title}</p>}
                        {s.reason && <p className="mt-1 text-sm text-text">{s.reason}</p>}
                        <p className="mt-1 text-xs text-subtle">{fmtDateTime(s.created_at)}</p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={ack.isPending && ack.variables === s.id}
                        onClick={() => ack.mutate(s.id)}
                      >
                        Acknowledge
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Pending approvals preview */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Waiting for your approval</CardTitle>
              <CardDescription>AI drafts reach interns only after you approve them.</CardDescription>
            </div>
            <Link to={INBOX} className="text-sm font-medium text-primary-700 underline-offset-4 hover:underline">
              Open inbox
            </Link>
          </CardHeader>
          {approvals.isPending ? (
            <LoadingState />
          ) : approvals.isError ? (
            <ErrorState message={errorMessage(approvals.error)} onRetry={() => approvals.refetch()} />
          ) : approvals.data.length === 0 ? (
            <EmptyState message="Nothing is waiting for approval." />
          ) : (
            <ul className="space-y-2">
              {approvals.data.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <Link
                    to={INBOX}
                    className="flex items-center justify-between gap-3 rounded-lg border border-ai-100 bg-ai-50 p-3 hover:bg-ai-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text">{d.title}</p>
                      <p className="text-xs text-muted">
                        {d.mentee_name} · {fmtDateTime(d.created_at)}
                      </p>
                    </div>
                    <Badge tone="ai">{AGENT_LABEL[d.agent]}</Badge>
                  </Link>
                </li>
              ))}
              {approvals.data.length > 5 && (
                <li className="text-xs text-muted">and {approvals.data.length - 5} more in the inbox</li>
              )}
            </ul>
          )}
        </Card>

        {/* Attendance today */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Attendance today</CardTitle>
              <CardDescription>Status and hours as recorded by punch-in / punch-out.</CardDescription>
            </div>
            <Link
              to="/mentor/internship/attendance"
              className="text-sm font-medium text-primary-700 underline-offset-4 hover:underline"
            >
              Full log
            </Link>
          </CardHeader>
          {attendance.isPending ? (
            <LoadingState />
          ) : attendance.isError ? (
            <ErrorState message={errorMessage(attendance.error)} onRetry={() => attendance.refetch()} />
          ) : attendance.data.length === 0 ? (
            <EmptyState message="No interns assigned to you yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">Intern</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Hours</th>
                    <th className="px-3 py-2 font-medium">First punch-in</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.data.map((a) => (
                    <tr key={a.mentee_id} className="border-t border-border">
                      <td className="px-3 py-2 text-text">{a.name}</td>
                      <td className="px-3 py-2">
                        <Badge tone={DAY_STATUS_TONE[a.status] ?? "neutral"}>{a.status}</Badge>
                        {a.open && <span className="ml-2 text-xs text-muted">punched in</span>}
                      </td>
                      <td className="px-3 py-2 text-text">{a.total_hours}</td>
                      <td className="px-3 py-2 text-muted">{a.sessions[0] ? fmtTime(a.sessions[0].punch_in_at) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Standups today */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Today’s standups</CardTitle>
              <CardDescription>{today}</CardDescription>
            </div>
          </CardHeader>
          {standups.isPending ? (
            <LoadingState />
          ) : standups.isError ? (
            <ErrorState message={errorMessage(standups.error)} onRetry={() => standups.refetch()} />
          ) : standups.data.length === 0 ? (
            <EmptyState message="No standups submitted yet today." />
          ) : (
            <ul className="space-y-3">
              {standups.data.map((s) => (
                <li key={s.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-text">{s.mentee_name}</span>
                    {s.task_title && <span className="text-xs text-muted">Task: {s.task_title}</span>}
                  </div>
                  <dl className="mt-2 space-y-1">
                    <div>
                      <dt className="inline text-xs font-medium text-muted">Yesterday: </dt>
                      <dd className="inline text-text">{s.yesterday || "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline text-xs font-medium text-muted">Today: </dt>
                      <dd className="inline text-text">{s.today || "—"}</dd>
                    </div>
                    <div className={cn(s.blockers.trim() && "rounded-md bg-warning-50 px-2 py-1")}>
                      <dt className={cn("inline text-xs font-medium", s.blockers.trim() ? "text-warning-800" : "text-muted")}>
                        Blockers:{" "}
                      </dt>
                      <dd className={cn("inline", s.blockers.trim() ? "text-warning-800" : "text-muted")}>
                        {s.blockers.trim() || "None"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Co-Pilot conversations */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageCircleQuestion className="size-4 text-ai-500" aria-hidden="true" /> Recent Blocker Co-Pilot conversations
            </CardTitle>
            <CardDescription>Live AI answers your interns received. Escalated ones need you.</CardDescription>
          </div>
        </CardHeader>
        {blockers.isPending ? (
          <LoadingState />
        ) : blockers.isError ? (
          <ErrorState message={errorMessage(blockers.error)} onRetry={() => blockers.refetch()} />
        ) : blockers.data.length === 0 ? (
          <EmptyState message="No Co-Pilot conversations yet." />
        ) : (
          <ul className="space-y-3">
            {blockers.data.slice(0, 8).map((b) => (
              <li
                key={b.id}
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  b.escalated ? "border-warning-500 bg-warning-50" : "border-border",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-text">{b.mentee_name}</span>
                  <div className="flex items-center gap-2">
                    {b.escalated && (
                      <Badge tone="warning">
                        <AlertTriangle aria-hidden="true" /> Escalated to you
                      </Badge>
                    )}
                    <span className="text-xs text-subtle">{fmtDateTime(b.created_at)}</span>
                  </div>
                </div>
                <p className="mt-2 text-text">
                  <span className="font-medium">Q:</span> {b.question}
                </p>
                <p className="mt-1 line-clamp-3 whitespace-pre-line text-muted">
                  <span className="font-medium text-ai-700">Co-Pilot:</span> {b.answer}
                </p>
                {b.citations.length > 0 && (
                  <p className="mt-1 text-xs text-subtle">Sources: {b.citations.map((c) => c.title).join(", ")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Interns */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Your interns</h2>
          <Link to="/mentor/internship/mentees" className="text-sm font-medium text-primary-700 underline-offset-4 hover:underline">
            Skill matrices
          </Link>
        </div>
        {mentees.isPending ? (
          <LoadingState />
        ) : mentees.isError ? (
          <ErrorState message={errorMessage(mentees.error)} onRetry={() => mentees.refetch()} />
        ) : mentees.data.length === 0 ? (
          <EmptyState message="No interns are assigned to you yet." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {mentees.data.map((m) => (
              <Card key={m.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">
                      {m.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-text">{m.name}</h3>
                        <Badge tone="primary">{m.track}</Badge>
                        {m.online && <Badge tone="success">Online</Badge>}
                      </div>
                      <p className="text-xs text-muted">{m.email}</p>
                      <p className="text-xs text-subtle">
                        {m.cohort_name}
                        {m.roll_number && ` · Roll ${m.roll_number}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge>
                      Week {m.current_week} · Month {m.current_month}
                    </Badge>
                    {m.today_status && (
                      <div className="mt-1">
                        <Badge tone={DAY_STATUS_TONE[m.today_status] ?? "neutral"}>{m.today_status}</Badge>
                      </div>
                    )}
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 rounded-lg bg-surface-muted p-3 text-center">
                  <div>
                    <dt className="text-xs text-muted">Attendance</dt>
                    <dd className="text-sm font-semibold text-text">
                      {m.attendance_rate_pct === null || m.attendance_rate_pct === undefined ? "—" : `${m.attendance_rate_pct}%`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Tasks done</dt>
                    <dd className="text-sm font-semibold text-text">
                      {m.tasks_done ?? "—"} / {m.tasks_total ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">In review</dt>
                    <dd className="text-sm font-semibold text-text">{m.tasks_in_review ?? "—"}</dd>
                  </div>
                </dl>
                {m.skills && m.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.skills.slice(0, 5).map((s) => (
                      <Badge key={s.skill} tone={s.level === null ? "neutral" : "primary"}>
                        {s.skill}: {s.level === null ? "Insufficient data" : `L${s.level}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  to,
  highlight,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  to?: string;
  highlight?: "ai" | "warning";
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <span
          className={cn(
            "[&_svg]:size-4",
            highlight === "ai" ? "text-ai-500" : highlight === "warning" ? "text-warning-500" : "text-muted",
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-text">{value}</p>
    </>
  );
  const cls = cn(
    "block rounded-xl border p-4",
    highlight === "ai" ? "border-ai-100 bg-ai-50" : highlight === "warning" ? "border-warning-500 bg-warning-50" : "border-border bg-surface",
  );
  return to ? (
    <Link
      to={to}
      className={cn(cls, "hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500")}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck2, CheckCircle2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { errorMessage } from "@/lib/api";
import {
  type AttendanceDay,
  type AttendanceSessionRow,
  type DayStatus,
  internshipApi,
  type LeaveRow,
  type MenteeAttendanceToday,
} from "@/lib/internshipApi";

// ------------------------------------------------------------------ shared helpers (also used by the admin audit page)

type Tone = NonNullable<BadgeProps["tone"]>;

export const DAY_STATUSES: DayStatus[] = [
  "Needs Correction",
  "In Progress",
  "Present",
  "Half Day",
  "Short",
  "Leave",
  "Absent",
];

export const DAY_TONE: Record<DayStatus, Tone> = {
  Present: "success",
  "Half Day": "warning",
  Short: "warning",
  Leave: "info",
  Absent: "danger",
  "In Progress": "primary",
  "Needs Correction": "danger",
};

export function DayStatusBadge({ status }: { status: DayStatus }) {
  return (
    <Badge tone={DAY_TONE[status]}>
      {status === "Needs Correction" && <AlertTriangle aria-hidden="true" />}
      {status}
    </Badge>
  );
}

export function localDate(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${localDate(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

/** Needs Correction first, then newest first. Ordering only — statuses come from the server. */
function correctionFirst<T extends { status: DayStatus }>(rows: T[], tie: (a: T, b: T) => number) {
  return [...rows].sort(
    (a, b) => Number(b.status === "Needs Correction") - Number(a.status === "Needs Correction") || tie(a, b),
  );
}

export function SessionList({
  sessions,
  onCorrect,
}: {
  sessions: AttendanceSessionRow[];
  onCorrect: (s: AttendanceSessionRow) => void;
}) {
  if (sessions.length === 0) return <span className="text-xs text-muted">No sessions</span>;
  return (
    <ul className="space-y-1">
      {sessions.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-text">
            {fmtTime(s.punch_in_at)} – {s.punch_out_at ? fmtTime(s.punch_out_at) : "open"}
          </span>
          {s.auto_closed && <Badge tone="warning">Auto-closed</Badge>}
          {s.corrected && <Badge tone="info">Corrected</Badge>}
          {s.note && <span className="text-muted">“{s.note}”</span>}
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => onCorrect(s)}>
            Correct
          </Button>
        </li>
      ))}
    </ul>
  );
}

export interface CorrectionTarget {
  session: AttendanceSessionRow;
  date: string;
  name: string;
}

export function CorrectionDialog({ target, onClose }: { target: CorrectionTarget; onClose: () => void }) {
  const qc = useQueryClient();
  const [punchIn, setPunchIn] = useState(toLocalInput(target.session.punch_in_at));
  const [punchOut, setPunchOut] = useState(toLocalInput(target.session.punch_out_at));
  const [note, setNote] = useState("");
  const [result, setResult] = useState<AttendanceDay | null>(null);

  const m = useMutation({
    mutationFn: () => {
      // only send punch_in_at when the mentor actually changed it (the input drops seconds)
      const changedIn =
        punchIn && punchIn !== toLocalInput(target.session.punch_in_at) ? new Date(punchIn).toISOString() : undefined;
      return internshipApi.correctSession(target.session.id, {
        punch_out_at: new Date(punchOut).toISOString(),
        punch_in_at: changedIn,
        note: note.trim(),
      });
    },
    onSuccess: (data) => {
      setResult(data.day ?? null);
      void qc.invalidateQueries({ queryKey: ["internship"] });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!punchOut || !note.trim()) return;
    m.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4" role="dialog" aria-modal="true" aria-labelledby="correct-title">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-start justify-between border-b border-border pb-3">
          <div>
            <h3 id="correct-title" className="font-semibold text-text">
              Correct session
            </h3>
            <p className="text-xs text-muted">
              {target.name} · {target.date}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>

        {m.isSuccess ? (
          <div className="mt-4 space-y-3">
            <p className="flex items-center gap-2 text-sm text-success-700">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Session corrected.
            </p>
            {result && (
              <div className="rounded-lg bg-surface-muted p-3 text-sm">
                <p>
                  {result.date}: <DayStatusBadge status={result.status} /> · {result.total_hours.toFixed(2)} h
                  {result.overtime_hours > 0 && ` (+${result.overtime_hours.toFixed(2)} h overtime)`}
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="secondary" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <p className="text-xs text-muted">Times are in your browser's local time zone.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="c-in">Punch in</Label>
                <Input id="c-in" type="datetime-local" value={punchIn} onChange={(e) => setPunchIn(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="c-out">Punch out (required)</Label>
                <Input id="c-out" type="datetime-local" required value={punchOut} onChange={(e) => setPunchOut(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="c-note">Reason for the correction (required, kept in the audit log)</Label>
              <Textarea id="c-note" required rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {m.isError && <ErrorState message={errorMessage(m.error)} />}
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={m.isPending || !punchOut || !note.trim()}>
                {m.isPending ? "Saving…" : "Save correction"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** One intern's attendance for a calendar month, Needs Correction days first. */
export function AttendanceMonthView({ menteeId, name, onClose }: { menteeId: string; name: string; onClose?: () => void }) {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [target, setTarget] = useState<CorrectionTarget | null>(null);
  const { start, end } = monthRange(month);
  const q = useQuery({
    queryKey: ["internship", "attendance", "mentee", menteeId, start, end],
    queryFn: () => internshipApi.menteeAttendance(menteeId, start, end),
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{name}: month view</CardTitle>
          <CardDescription>
            {q.data
              ? `Present ≥ ${q.data.rules.full_day_hours} h, Half Day ${q.data.rules.half_day_hours}–${q.data.rules.full_day_hours} h, Short < ${q.data.rules.half_day_hours} h · ${q.data.rules.timezone}`
              : "Daily status from punch-in/out sessions."}
          </CardDescription>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor={`month-${menteeId}`}>Month</Label>
            <Input id={`month-${menteeId}`} type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-40" />
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close month view">
              <X />
            </Button>
          )}
        </div>
      </CardHeader>
      {q.isPending ? (
        <LoadingState rows={4} label="Loading month" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Attendance rate (whole internship): <strong className="text-text">{q.data.rate_pct === null ? "—" : `${Math.round(q.data.rate_pct)}%`}</strong>
          </p>
          {q.data.days.length === 0 ? (
            <EmptyState message="No attendance days in this month." />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH>Status</TH>
                  <TH>Hours</TH>
                  <TH>Sessions</TH>
                </tr>
              </THead>
              <TBody>
                {correctionFirst(q.data.days, (a, b) => b.date.localeCompare(a.date)).map((d) => (
                  <TR key={d.date} className={d.status === "Needs Correction" ? "bg-danger-50" : undefined}>
                    <TD className="whitespace-nowrap font-medium">{d.date}</TD>
                    <TD>
                      <DayStatusBadge status={d.status} />
                    </TD>
                    <TD className="whitespace-nowrap font-mono">
                      {d.total_hours.toFixed(2)} h{d.overtime_hours > 0 && <span className="text-muted"> (+{d.overtime_hours.toFixed(2)})</span>}
                    </TD>
                    <TD>
                      <SessionList sessions={d.sessions} onCorrect={(s) => setTarget({ session: s, date: d.date, name })} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      )}
      {target && <CorrectionDialog target={target} onClose={() => setTarget(null)} />}
    </Card>
  );
}

/** Attendance of every visible intern for one date, with status filter; Needs Correction rows first. */
export function DayGrid({
  on,
  statusFilter = "all",
  onViewMonth,
}: {
  on: string;
  statusFilter?: DayStatus | "all";
  onViewMonth: (row: MenteeAttendanceToday) => void;
}) {
  const [target, setTarget] = useState<CorrectionTarget | null>(null);
  const q = useQuery({
    queryKey: ["internship", "attendance", "day", on],
    queryFn: () => internshipApi.menteesAttendanceToday(on),
  });
  if (q.isPending) return <LoadingState rows={3} label="Loading attendance" />;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const rows = correctionFirst(
    q.data.filter((r) => statusFilter === "all" || r.status === statusFilter),
    (a, b) => a.name.localeCompare(b.name),
  );
  if (q.data.length === 0) return <EmptyState message="No active interns." />;
  if (rows.length === 0) return <EmptyState message={`No interns with status “${statusFilter}” on ${on}.`} />;
  return (
    <>
      <Table>
        <THead>
          <tr>
            <TH>Intern</TH>
            <TH>Status</TH>
            <TH>Hours</TH>
            <TH>Sessions</TH>
            <TH>
              <span className="sr-only">Actions</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.mentee_id} className={r.status === "Needs Correction" ? "bg-danger-50" : undefined}>
              <TD className="font-medium">{r.name}</TD>
              <TD>
                <DayStatusBadge status={r.status} />
                {r.open && <p className="mt-1 text-xs text-success-700">Punched in now</p>}
              </TD>
              <TD className="whitespace-nowrap font-mono">
                {r.total_hours.toFixed(2)} h{r.overtime_hours > 0 && <span className="text-muted"> (+{r.overtime_hours.toFixed(2)})</span>}
              </TD>
              <TD>
                <SessionList sessions={r.sessions} onCorrect={(s) => setTarget({ session: s, date: r.date, name: r.name })} />
              </TD>
              <TD className="text-right">
                <Button size="sm" variant="secondary" onClick={() => onViewMonth(r)}>
                  Month view
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {target && <CorrectionDialog target={target} onClose={() => setTarget(null)} />}
    </>
  );
}

// ------------------------------------------------------------------ page

const LEAVE_TONE: Record<LeaveRow["status"], Tone> = { Pending: "warning", Approved: "success", Rejected: "danger" };

export function ManagerAttendancePage() {
  usePageTitle("Attendance & Leaves");
  const [on, setOn] = useState(localDate());
  const [month, setMonthFor] = useState<{ id: string; name: string } | null>(null);
  const [standupMentee, setStandupMentee] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="primary">
            <CalendarCheck2 aria-hidden="true" />
            Attendance & leave
          </Badge>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-text sm:text-2xl">Mentee Attendance & Daily Check-Ins</h1>
          <p className="text-sm text-muted">
            Punch-in/out sessions, leave requests and daily standups. Days needing correction are listed first.
          </p>
        </div>
        <div>
          <Label htmlFor="att-date">Date</Label>
          <Input id="att-date" type="date" max={localDate()} value={on} onChange={(e) => e.target.value && setOn(e.target.value)} className="w-44" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Attendance on {on}</CardTitle>
            <CardDescription>Statuses are calculated by the server from punch sessions.</CardDescription>
          </div>
        </CardHeader>
        <DayGrid on={on} onViewMonth={(r) => setMonthFor({ id: r.mentee_id, name: r.name })} />
      </Card>

      {month && <AttendanceMonthView key={month.id} menteeId={month.id} name={month.name} onClose={() => setMonthFor(null)} />}

      <LeaveRequests />

      <Standups on={on} menteeId={standupMentee} setMenteeId={setStandupMentee} />
    </div>
  );
}

function LeaveRequests() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["internship", "leave"], queryFn: () => internshipApi.leave() });
  const decide = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => internshipApi.decideLeave(v.id, v.approve),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internship"] }),
  });
  const pending = q.data?.filter((r) => r.status === "Pending").length ?? 0;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Leave requests</CardTitle>
          <CardDescription>{q.data ? `${pending} pending` : "Time-off requests from your interns"}</CardDescription>
        </div>
      </CardHeader>
      {decide.isError && (
        <div className="mb-3">
          <ErrorState message={errorMessage(decide.error)} />
        </div>
      )}
      {q.isPending ? (
        <LoadingState rows={2} label="Loading leave requests" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState message="No leave requests." />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Intern</TH>
              <TH>From</TH>
              <TH>To</TH>
              <TH>Reason</TH>
              <TH>Submitted</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {q.data.map((r) => {
              const busy = decide.isPending && decide.variables?.id === r.id;
              return (
                <TR key={r.id}>
                  <TD className="font-medium">{r.mentee_name}</TD>
                  <TD className="whitespace-nowrap">{r.start_date}</TD>
                  <TD className="whitespace-nowrap">{r.end_date}</TD>
                  <TD className="max-w-xs text-muted">{r.reason}</TD>
                  <TD className="whitespace-nowrap text-xs text-muted">{new Date(r.submitted_at).toLocaleString()}</TD>
                  <TD>
                    <Badge tone={LEAVE_TONE[r.status]}>{r.status}</Badge>
                  </TD>
                  <TD className="text-right">
                    {r.status === "Pending" ? (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => decide.mutate({ id: r.id, approve: false })}>
                          Reject
                        </Button>
                        <Button size="sm" disabled={busy} onClick={() => decide.mutate({ id: r.id, approve: true })}>
                          Approve
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">
                        {r.decided_at ? `Decided ${new Date(r.decided_at).toLocaleDateString()}` : "Decided"}
                      </span>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

function Standups({ on, menteeId, setMenteeId }: { on: string; menteeId: string; setMenteeId: (v: string) => void }) {
  const mentees = useQuery({ queryKey: ["internship", "mentees"], queryFn: () => internshipApi.mentees() });
  const q = useQuery({
    queryKey: ["internship", "standups", on, menteeId],
    queryFn: () => internshipApi.standups({ on, mentee_id: menteeId || undefined }),
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Daily standups</CardTitle>
          <CardDescription>What each intern did yesterday, plans today and is blocked on ({on}).</CardDescription>
        </div>
        <div>
          <Label htmlFor="standup-mentee">Intern</Label>
          <Select id="standup-mentee" value={menteeId} onChange={(e) => setMenteeId(e.target.value)}>
            <option value="">All interns</option>
            {(mentees.data ?? []).map((m) => (
              <option key={m.enrollment_id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
      </CardHeader>
      {q.isPending ? (
        <LoadingState rows={2} label="Loading standups" />
      ) : q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState message={`No standups submitted on ${on}.`} />
      ) : (
        <ul className="space-y-3">
          {q.data.map((s) => (
            <li key={s.id} className="rounded-lg border border-border p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-text">{s.mentee_name}</p>
                <span className="text-xs text-muted">
                  {s.task_title ? `Task: ${s.task_title} · ` : ""}
                  {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium text-muted">Yesterday</dt>
                  <dd className="whitespace-pre-wrap">{s.yesterday || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted">Today</dt>
                  <dd className="whitespace-pre-wrap">{s.today || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted">Blockers</dt>
                  <dd className={`whitespace-pre-wrap ${s.blockers ? "text-warning-800" : ""}`}>{s.blockers || "None"}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

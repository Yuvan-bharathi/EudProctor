import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CalendarCheck2, CheckCircle2, ChevronLeft, ChevronRight, Clock, Info, LogOut } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { usePageTitle } from "@/app/layouts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import { internshipApi, type AttendanceDay, type DayStatus, type LeaveRow } from "@/lib/internshipApi";

// ------------------------------------------------------------------ helpers

const DAY_TONE: Record<DayStatus, BadgeProps["tone"]> = {
  Present: "success",
  "Half Day": "warning",
  Short: "danger",
  Leave: "info",
  Absent: "neutral",
  "In Progress": "primary",
  "Needs Correction": "warning",
};

const LEAVE_TONE: Record<LeaveRow["status"], BadgeProps["tone"]> = {
  Pending: "warning",
  Approved: "success",
  Rejected: "danger",
};

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function monthRange(year: number, month: number) {
  return { start: isoDate(new Date(year, month, 1)), end: isoDate(new Date(year, month + 1, 0)) };
}

function fmtTime(iso: string | null | undefined, timeZone?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone });
  } catch {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

function fmtDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

function fmtElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

// ------------------------------------------------------------------ page

export function MenteeAttendancePage() {
  usePageTitle("Attendance & Leave");
  const me = useQuery({ queryKey: ["internship", "me"], queryFn: internshipApi.me });

  if (me.isPending) return <LoadingState rows={6} label="Loading attendance" />;
  if (me.isError) return <ErrorState message={errorMessage(me.error)} onRetry={() => me.refetch()} />;
  if (!me.data.enrolled)
    return <EmptyState message="You're not enrolled in an internship yet, so there's no attendance to show." />;

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="primary">
          <CalendarCheck2 className="size-3.5" aria-hidden="true" />
          <span>Attendance</span>
        </Badge>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-text sm:text-2xl">Punch In / Out & Leave</h1>
        <p className="text-xs text-muted">
          Punch in when you start working and punch out when you stop. Only time between punches counts, so breaks
          aren't included. No webcam or biometrics are used.
        </p>
      </div>

      <TodayCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <LeaveForm />
          <LeaveList />
        </div>
        <div className="lg:col-span-8">
          <MonthLog />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ sections

function TodayCard() {
  const qc = useQueryClient();
  const att = useQuery({
    queryKey: ["internship", "attendance", "current"],
    queryFn: () => internshipApi.myAttendance(),
    refetchInterval: 60_000,
  });
  const today = att.data?.today;
  const tz = att.data?.rules.timezone;
  const full = att.data?.rules.full_day_hours;
  const openSession = today?.sessions.find((s) => !s.punch_out_at);
  const now = useNow(!!openSession);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["internship", "attendance"] });
    qc.invalidateQueries({ queryKey: ["internship", "me"] });
  };
  const punchIn = useMutation({ mutationFn: () => internshipApi.punchIn(), onSuccess: invalidate });
  const punchOut = useMutation({ mutationFn: () => internshipApi.punchOut(), onSuccess: invalidate });
  const actionError = punchIn.error ?? punchOut.error;

  const progressPct = today && full ? Math.min(100, (today.total_hours / full) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      {att.isPending ? (
        <LoadingState rows={2} label="Loading today" />
      ) : att.isError ? (
        <ErrorState message={errorMessage(att.error)} onRetry={() => att.refetch()} />
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary-700">
                Today:{" "}
                {new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "short", day: "numeric" })}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-text">
                  {openSession
                    ? `Working since ${fmtTime(openSession.punch_in_at, tz)}`
                    : today && today.sessions.length > 0
                      ? "Punched out"
                      : "Ready to start your day?"}
                </h2>
                {today && <Badge tone={DAY_TONE[today.status]}>{today.status}</Badge>}
              </div>
              {openSession && (
                <p className="text-xs text-muted">
                  Current session:{" "}
                  <span className="font-mono text-sm font-semibold text-text">
                    {fmtElapsed(now - new Date(openSession.punch_in_at).getTime())}
                  </span>
                </p>
              )}
            </div>

            {openSession ? (
              <Button variant="secondary" onClick={() => punchOut.mutate()} disabled={punchOut.isPending}>
                <LogOut aria-hidden="true" />
                {punchOut.isPending ? "Punching out…" : "Punch Out"}
              </Button>
            ) : (
              <Button onClick={() => punchIn.mutate()} disabled={punchIn.isPending}>
                <Clock aria-hidden="true" />
                {punchIn.isPending ? "Punching in…" : "Punch In"}
              </Button>
            )}
          </div>

          {today && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  Logged today: <strong className="text-text">{today.total_hours} h</strong>
                  {full != null && <> of {full} h</>}
                  {today.overtime_hours > 0 && <> · {today.overtime_hours} h extra</>}
                </span>
                {openSession && <span>Hours refresh every minute</span>}
              </div>
              {full != null && (
                <div
                  className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
                  role="progressbar"
                  aria-label="Hours logged today"
                  aria-valuemin={0}
                  aria-valuemax={full}
                  aria-valuenow={today.total_hours}
                >
                  <div className="h-full rounded-full bg-primary-500" style={{ width: `${progressPct}%` }} />
                </div>
              )}
              {today.sessions.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">
                  {today.sessions.map((s) => (
                    <li key={s.id} className="rounded-full border border-border bg-surface-muted px-2.5 py-0.5 font-mono">
                      {fmtTime(s.punch_in_at, tz)} – {s.punch_out_at ? fmtTime(s.punch_out_at, tz) : "now"}
                    </li>
                  ))}
                </ul>
              )}
              {today.status === "Needs Correction" && <CorrectionNote />}
            </div>
          )}
        </>
      )}
      {actionError && (
        <div className="mt-3">
          <ErrorState message={errorMessage(actionError)} />
        </div>
      )}
    </div>
  );
}

function CorrectionNote() {
  return (
    <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-warning-50 p-2 text-xs text-warning-800">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>
        A punch-out was missed, so the session was closed automatically. Your mentor will confirm the correct time; until
        then this day shows "Needs Correction".
      </span>
    </p>
  );
}

function MonthLog() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const { start, end } = monthRange(cursor.year, cursor.month);
  const att = useQuery({
    queryKey: ["internship", "attendance", start, end],
    queryFn: () => internshipApi.myAttendance(start, end),
  });

  const now = new Date();
  const isCurrentMonth = cursor.year === now.getFullYear() && cursor.month === now.getMonth();
  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const tz = att.data?.rules.timezone;
  const rules = att.data?.rules;
  // The server clamps the range to your enrolment start and today; if that leaves nothing it returns just today.
  const days = (att.data?.days ?? []).filter((d) => d.date >= start && d.date <= end).slice().reverse();

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text">Attendance log</h3>
          <p className="text-xs text-muted">Daily sessions, hours and status</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="min-w-28 text-center text-sm font-medium text-text">
            {new Date(cursor.year, cursor.month, 1).toLocaleDateString([], { month: "long", year: "numeric" })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next month"
            onClick={() => shift(1)}
            disabled={isCurrentMonth}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      {att.isPending ? (
        <div className="mt-4">
          <LoadingState rows={5} label="Loading month" />
        </div>
      ) : att.isError ? (
        <div className="mt-4">
          <ErrorState message={errorMessage(att.error)} onRetry={() => att.refetch()} />
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Attendance rate this month:</span>
            <strong className="text-sm text-text">{att.data.rate_pct == null ? "—" : `${att.data.rate_pct}%`}</strong>
          </div>

          {rules && (
            <div className="mt-3 rounded-lg bg-info-50 p-3 text-xs text-info-700">
              <p className="font-semibold">How a day is counted</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>
                  <strong>Present</strong>: {rules.full_day_hours} h or more · <strong>Half Day</strong>:{" "}
                  {rules.half_day_hours}–{rules.full_day_hours} h · <strong>Short</strong>: under {rules.half_day_hours} h
                </li>
                <li>Only time between punch in and punch out counts; you can punch in and out several times a day.</li>
                <li>
                  <strong>Needs Correction</strong>: a punch-out was forgotten; your mentor confirms the real time.
                </li>
                <li>Days are counted in the cohort's time zone ({rules.timezone}).</li>
              </ul>
            </div>
          )}

          {days.length === 0 ? (
            <div className="mt-4">
              <EmptyState message="No attendance records for this month." />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-surface-muted text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Sessions</th>
                    <th className="px-2 py-2 font-medium">Total hours</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {days.map((d) => (
                    <DayRow key={d.date} day={d} tz={tz} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DayRow({ day, tz }: { day: AttendanceDay; tz?: string }) {
  return (
    <tr className="align-top hover:bg-surface-muted">
      <td className="px-2 py-3 font-semibold whitespace-nowrap text-text">{fmtDay(day.date)}</td>
      <td className="px-2 py-3 font-mono text-text">
        {day.sessions.length === 0 ? (
          <span className="text-muted">—</span>
        ) : (
          <ul className="space-y-0.5">
            {day.sessions.map((s) => (
              <li key={s.id}>
                {fmtTime(s.punch_in_at, tz)} – {s.punch_out_at ? fmtTime(s.punch_out_at, tz) : "now"}
                {s.auto_closed && <span className="ml-1 font-sans text-warning-800">(auto-closed)</span>}
                {s.corrected && <span className="ml-1 font-sans text-muted">(corrected by mentor)</span>}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-2 py-3 font-mono font-semibold text-text">
        {day.total_hours} h{day.overtime_hours > 0 && <span className="font-normal text-muted"> (+{day.overtime_hours})</span>}
      </td>
      <td className="px-2 py-3">
        <Badge tone={DAY_TONE[day.status]}>{day.status}</Badge>
        {day.status === "Needs Correction" && (
          <p className="mt-1 max-w-48 text-[11px] text-muted">Forgot to punch out. Your mentor will confirm the time.</p>
        )}
      </td>
    </tr>
  );
}

function LeaveForm() {
  const qc = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  const request = useMutation({
    mutationFn: () => internshipApi.requestLeave({ start_date: startDate, end_date: endDate, reason: reason.trim() }),
    onSuccess: () => {
      setSent(true);
      setStartDate("");
      setEndDate("");
      setReason("");
      qc.invalidateQueries({ queryKey: ["internship", "leave"] });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSent(false);
    request.mutate();
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
        <Calendar className="size-4 text-muted" aria-hidden="true" />
        Request leave
      </h3>
      <p className="mt-1 text-xs text-muted">Your mentor approves or declines the request.</p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3.5">
        <div>
          <Label htmlFor="lv-start">Start date</Label>
          <Input id="lv-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="lv-end">End date</Label>
          <Input
            id="lv-end"
            type="date"
            required
            min={startDate || undefined}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="lv-reason">Reason</Label>
          <Textarea
            id="lv-reason"
            rows={3}
            required
            placeholder="e.g. University semester examination"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {request.isError && <ErrorState message={errorMessage(request.error)} />}
        {sent && (
          <p role="status" className="flex items-center gap-1.5 rounded-lg bg-success-50 p-2 text-xs text-success-700">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Leave request sent to your mentor.
          </p>
        )}
        <Button type="submit" className="w-full" disabled={request.isPending || !reason.trim()}>
          {request.isPending ? "Sending…" : "Submit leave request"}
        </Button>
      </form>
    </div>
  );
}

function LeaveList() {
  const leave = useQuery({ queryKey: ["internship", "leave"], queryFn: internshipApi.leave });
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">My leave requests</h4>
      {leave.isPending ? (
        <LoadingState rows={2} label="Loading leave requests" />
      ) : leave.isError ? (
        <ErrorState message={errorMessage(leave.error)} onRetry={() => leave.refetch()} />
      ) : leave.data.length === 0 ? (
        <p className="text-xs text-muted">No leave requests yet.</p>
      ) : (
        <ul className="space-y-2">
          {leave.data.map((l) => (
            <li key={l.id} className="rounded-lg border border-border bg-surface-muted p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-text">
                  {l.start_date === l.end_date ? l.start_date : `${l.start_date} to ${l.end_date}`}
                </span>
                <Badge tone={LEAVE_TONE[l.status]}>{l.status}</Badge>
              </div>
              <p className="mt-1 text-[11px] text-muted">{l.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

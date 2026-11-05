import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { type DayStatus, internshipApi } from "@/lib/internshipApi";
import {
  AttendanceMonthView,
  DAY_STATUSES,
  DAY_TONE,
  DayGrid,
  localDate,
} from "@/pages/internship/mentor/ManagerAttendancePage";

export function AdminAttendanceAuditPage() {
  usePageTitle("Attendance Audit Trail");
  const [on, setOn] = useState(localDate());
  const [status, setStatus] = useState<DayStatus | "all">("all");
  const [month, setMonthFor] = useState<{ id: string; name: string } | null>(null);

  // Same query key as DayGrid, so this only reads the cached rows for the counts.
  const dayQ = useQuery({
    queryKey: ["internship", "attendance", "day", on],
    queryFn: () => internshipApi.menteesAttendanceToday(on),
  });
  const counts = new Map<DayStatus, number>();
  for (const r of dayQ.data ?? []) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const needsCorrection = counts.get("Needs Correction") ?? 0;
  const viewMonth = (r: { mentee_id: string; name: string }) => setMonthFor({ id: r.mentee_id, name: r.name });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="primary">
            <ClipboardList aria-hidden="true" />
            Attendance audit
          </Badge>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-text sm:text-2xl">Attendance Audit Trail</h1>
          <p className="text-sm text-muted">
            Punch-in/out sessions for every active intern. Admins can correct sessions; every correction needs a note and
            is recorded.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="audit-date">Date</Label>
            <Input id="audit-date" type="date" max={localDate()} value={on} onChange={(e) => e.target.value && setOn(e.target.value)} className="w-44" />
          </div>
          <div>
            <Label htmlFor="audit-status">Status</Label>
            <Select id="audit-status" value={status} onChange={(e) => setStatus(e.target.value as DayStatus | "all")}>
              <option value="all">All statuses</option>
              {DAY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {dayQ.data && dayQ.data.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Status counts">
          {DAY_STATUSES.filter((s) => counts.has(s)).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(status === s ? "all" : s)}
              aria-pressed={status === s}
              className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              <Badge tone={DAY_TONE[s]} className={status === s ? "ring-2 ring-primary-500" : undefined}>
                {s}: {counts.get(s)}
              </Badge>
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-danger-600" aria-hidden="true" />
              Needs correction on {on}
              {dayQ.data && <Badge tone={needsCorrection > 0 ? "danger" : "success"}>{needsCorrection}</Badge>}
            </CardTitle>
            <CardDescription>
              Usually a session that was never punched out and was auto-closed. Fix the punch-out time with a note.
            </CardDescription>
          </div>
        </CardHeader>
        <DayGrid on={on} statusFilter="Needs Correction" onViewMonth={viewMonth} />
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>All interns on {on}</CardTitle>
            <CardDescription>
              {status === "all" ? "Every status; Needs Correction rows are listed first." : `Filtered to “${status}”.`}
            </CardDescription>
          </div>
        </CardHeader>
        <DayGrid on={on} statusFilter={status} onViewMonth={viewMonth} />
      </Card>

      {month && <AttendanceMonthView key={month.id} menteeId={month.id} name={month.name} onClose={() => setMonthFor(null)} />}
    </div>
  );
}

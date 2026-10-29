import {
  CalendarCheck2,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";
import { useState } from "react";
import { usePageTitle } from "@/app/layouts";
import {
  getPersistedAttendance,
  mockInternshipMentees,
} from "@/lib/mockData";
import type { DailyAttendance } from "@/lib/types";

export function AdminAttendanceAuditPage() {
  usePageTitle("Attendance Audit Trail");

  const [attendance] = useState<DailyAttendance[]>(() => getPersistedAttendance());
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filtered = attendance.filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    return true;
  });

  const handleExportCSV = () => {
    const headers = "ID,MenteeId,Date,CheckIn,CheckOut,TotalHours,Status\n";
    const rows = filtered
      .map(
        (a) =>
          `${a.id},${a.menteeId},${a.date},${a.checkInTime || ""},${a.checkOutTime || ""},${a.totalHours},${a.status}`,
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `internship_attendance_audit_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Attendance audit log exported to CSV successfully.");
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            <CalendarCheck2 className="size-3.5" />
            <span>Digital Audit Trail</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 sm:text-2xl">
            Programme Attendance & Timesheet Audit
          </h1>
          <p className="text-xs text-slate-500">
            Audit logs for all check-in/out timestamps across cohorts without biometric surveillance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs"
          >
            <option value="all">All Statuses</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Leave">Leave</option>
          </select>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" />
            <span>Export CSV Timesheet</span>
          </button>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Verified Timesheet Entries</h3>
            <p className="text-xs text-slate-500">Showing {filtered.length} logged records</p>
          </div>
          <span className="text-xs font-bold text-emerald-700">Audit Compliance: 100%</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="pb-2.5">Date</th>
                <th className="pb-2.5">Intern Name</th>
                <th className="pb-2.5">Check-In</th>
                <th className="pb-2.5">Check-Out</th>
                <th className="pb-2.5">Logged Hours</th>
                <th className="pb-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((rec) => {
                const mentee = mockInternshipMentees.find((m) => m.id === rec.menteeId);
                return (
                  <tr key={rec.id} className="hover:bg-slate-50/50">
                    <td className="py-3 font-semibold text-slate-900">{rec.date}</td>
                    <td className="py-3 font-medium text-slate-800">
                      {mentee?.name || rec.menteeId}
                    </td>
                    <td className="py-3 font-mono text-slate-700">{rec.checkInTime || "—"}</td>
                    <td className="py-3 font-mono text-slate-700">{rec.checkOutTime || "—"}</td>
                    <td className="py-3 font-mono font-semibold text-slate-900">
                      {rec.totalHours > 0 ? `${rec.totalHours} hrs` : "Working"}
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          rec.status === "Present"
                            ? "bg-emerald-100 text-emerald-800"
                            : rec.status === "Late"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

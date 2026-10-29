import {
  Calendar,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { useAuth } from "@/features/auth/store";
import {
  getInternshipMenteeForUser,
  getPersistedAttendance,
  mockLeaveRequests,
  recordAttendanceCheckIn,
  recordAttendanceCheckOut,
} from "@/lib/mockData";
import type { DailyAttendance, LeaveRequest } from "@/lib/types";

export function MenteeAttendancePage() {
  usePageTitle("Daily Check-In & Leaves");
  const { user } = useAuth();
  const mentee = getInternshipMenteeForUser(user);
  const menteeId = mentee.id;
  const [attendance, setAttendance] = useState<DailyAttendance[]>(() =>
    getPersistedAttendance(),
  );
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(mockLeaveRequests);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Leave Form
  const [startDate, setStartDate] = useState("2026-11-20");
  const [endDate, setEndDate] = useState("2026-11-21");
  const [reason, setReason] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];
  const todayAttendance = attendance.find(
    (a) => a.menteeId === menteeId && a.date === todayStr,
  );

  useEffect(() => {
    const handleAttUpdate = () => setAttendance(getPersistedAttendance());
    window.addEventListener("eduproctor_attendance_updated", handleAttUpdate);
    return () => {
      window.removeEventListener("eduproctor_attendance_updated", handleAttUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCheckIn = () => {
    recordAttendanceCheckIn(menteeId);
    showToast("Checked in successfully for today!");
  };

  const handleCheckOut = () => {
    recordAttendanceCheckOut(menteeId);
    showToast("Checked out successfully for today! Total hours: 8.5 hrs.");
  };

  const handleApplyLeave = (e: React.FormEvent) => {
    e.preventDefault();
    const newReq: LeaveRequest = {
      id: `leave-${Date.now()}`,
      menteeId,
      menteeName: "Arjun Mehta",
      managerId: "mgr-1",
      startDate,
      endDate,
      reason,
      status: "Pending",
      submittedAt: todayStr,
    };
    setLeaveRequests([newReq, ...leaveRequests]);
    setReason("");
    showToast("Leave request submitted to Priya Sharma for review.");
  };

  const myLeaves = leaveRequests.filter((r) => r.menteeId === menteeId);
  const myAttendance = attendance.filter((a) => a.menteeId === menteeId);

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            <CalendarCheck2 className="size-3.5" />
            <span>Digital Attendance Portal</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 sm:text-2xl">
            Daily Check-In & Leave Management
          </h1>
          <p className="text-xs text-slate-500">
            Respectful digital attendance without invasive webcam surveillance or biometrics. Contributes 5% to your monthly graduation evaluation.
          </p>
        </div>
      </div>

      {/* Today's Action Card */}
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-slate-50 p-5 shadow-2xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Today: {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "short", day: "numeric" })}
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              {todayAttendance?.checkInTime
                ? `Logged in at ${todayAttendance.checkInTime} · Working`
                : "Good morning! Ready to start your workday?"}
            </h2>
            <p className="text-xs text-slate-500">
              Standard 8.0 hr work day. Check in when beginning tasks, check out when concluding.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!todayAttendance?.checkInTime ? (
              <button
                type="button"
                onClick={handleCheckIn}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
              >
                <Clock className="size-4" />
                <span>Check In Now (09:15 AM)</span>
              </button>
            ) : !todayAttendance?.checkOutTime ? (
              <button
                type="button"
                onClick={handleCheckOut}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <LogOut className="size-4 text-slate-600" />
                <span>Check Out (Complete Day)</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-2 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span>8.5 Hours Logged & Saved</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2-Columns: Leave Application & History Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 4 Cols: Leave Request Form */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Calendar className="size-4 text-emerald-600" />
              Apply for Planned Leave
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Requests are routed directly to your manager for approval.
            </p>

            <form onSubmit={handleApplyLeave} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Leave
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. University final semester examination"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
              >
                Submit Leave Application
              </button>
            </form>
          </div>

          {/* Past Leave Requests Status */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              My Leave Requests
            </h4>
            <div className="space-y-2">
              {myLeaves.map((l) => (
                <div
                  key={l.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      {l.startDate} to {l.endDate}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        l.status === "Approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {l.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600 truncate">{l.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 8 Cols: Full Attendance History */}
        <div className="lg:col-span-8">
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Attendance Log & History</h3>
                <p className="text-xs text-slate-500">Record of daily check-ins, check-outs, and hours worked</p>
              </div>
              <span className="text-xs font-bold text-emerald-700">
                Overall: 98% Compliance
              </span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="pb-2.5">Date</th>
                    <th className="pb-2.5">Check-In</th>
                    <th className="pb-2.5">Check-Out</th>
                    <th className="pb-2.5">Logged Hours</th>
                    <th className="pb-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myAttendance.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/50">
                      <td className="py-3 font-semibold text-slate-900">{rec.date}</td>
                      <td className="py-3 font-mono text-slate-700">{rec.checkInTime || "—"}</td>
                      <td className="py-3 font-mono text-slate-700">{rec.checkOutTime || "—"}</td>
                      <td className="py-3 font-mono font-semibold text-slate-900">
                        {rec.totalHours > 0 ? `${rec.totalHours} hrs` : "In Progress"}
                      </td>
                      <td className="py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            rec.status === "Present"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


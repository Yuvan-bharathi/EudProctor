import {
  CalendarCheck2,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { useAuth } from "@/features/auth/store";
import {
  getInternshipManagerForUser,
  getPersistedAttendance,
  getPersistedMentees,
  mockLeaveRequests,
} from "@/lib/mockData";
import type { DailyAttendance, InternshipMentee, LeaveRequest } from "@/lib/types";

export function ManagerAttendancePage() {
  usePageTitle("Attendance & Leaves");
  const { user } = useAuth();

  const [attendance, setAttendance] = useState<DailyAttendance[]>(() =>
    getPersistedAttendance(),
  );
  const [mentees] = useState<InternshipMentee[]>(() => getPersistedMentees());
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(mockLeaveRequests);
  const [selectedMenteeId, setSelectedMenteeId] = useState<string>("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleAttUpdate = () => setAttendance(getPersistedAttendance());
    window.addEventListener("eduproctor_attendance_updated", handleAttUpdate);
    return () => {
      window.removeEventListener("eduproctor_attendance_updated", handleAttUpdate);
    };
  }, []);

  const currentManager = getInternshipManagerForUser(user);
  const managerId = currentManager.id;
  const filteredMentees = mentees.filter((m) => m.managerId === managerId);
  const myMentees = filteredMentees.length > 0 ? filteredMentees : mentees.slice(0, 2);
  const myMenteeIds = myMentees.map((m) => m.id);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLeaveDecision = (reqId: string, status: "Approved" | "Rejected") => {
    setLeaveRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status } : r)),
    );
    showToast(`Leave request marked as ${status}.`);
  };

  const filteredAttendance = attendance.filter((a) => {
    if (!myMenteeIds.includes(a.menteeId)) return false;
    if (selectedMenteeId !== "all" && a.menteeId !== selectedMenteeId) return false;
    return true;
  });

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
            <span>Attendance & Leave Administration</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 sm:text-2xl">
            Mentee Attendance & Daily Check-Ins
          </h1>
          <p className="text-xs text-slate-500">
            Digital check-in/out without intrusive biometrics or location tracking. Contributes 5% to the monthly scorecard.
          </p>
        </div>

        {/* Mentee filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Filter:</span>
          <select
            value={selectedMenteeId}
            onChange={(e) => setSelectedMenteeId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs"
          >
            <option value="all">All Mentees ({myMentees.length})</option>
            {myMentees.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3 Overview Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Cohort Attendance Rate</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">97.4%</p>
          <span className="text-[11px] text-emerald-700 font-medium">Full attendance compliance</span>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Pending Leave Requests</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {leaveRequests.filter((r) => r.status === "Pending").length}
          </p>
          <span className="text-[11px] text-amber-700 font-medium">Requires manager action</span>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Daily Expected Hours</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">8.0 hrs</p>
          <span className="text-[11px] text-slate-500">Standard working hours</span>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Leave Requests</h3>
            <p className="text-xs text-slate-500">Review planned time-off requests submitted by your mentees</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="pb-2.5">Mentee</th>
                <th className="pb-2.5">Start Date</th>
                <th className="pb-2.5">End Date</th>
                <th className="pb-2.5">Reason</th>
                <th className="pb-2.5">Submitted</th>
                <th className="pb-2.5">Status</th>
                <th className="pb-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaveRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/50">
                  <td className="py-3 font-semibold text-slate-900">{req.menteeName}</td>
                  <td className="py-3 text-slate-700">{req.startDate}</td>
                  <td className="py-3 text-slate-700">{req.endDate}</td>
                  <td className="py-3 text-slate-600 max-w-xs truncate">{req.reason}</td>
                  <td className="py-3 text-slate-500">{req.submittedAt}</td>
                  <td className="py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        req.status === "Approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : req.status === "Rejected"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {req.status === "Pending" ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLeaveDecision(req.id, "Rejected")}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLeaveDecision(req.id, "Approved")}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                        >
                          Approve
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">Resolved</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Attendance Logs Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Daily Check-In / Check-Out Log</h3>
            <p className="text-xs text-slate-500">Verified system timestamps and hours logged</p>
          </div>
          <span className="text-xs text-slate-500">
            {filteredAttendance.length} records logged
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="pb-2.5">Date</th>
                <th className="pb-2.5">Mentee</th>
                <th className="pb-2.5">Check-In</th>
                <th className="pb-2.5">Check-Out</th>
                <th className="pb-2.5">Logged Hours</th>
                <th className="pb-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAttendance.map((rec) => {
                const mentee = mentees.find((m) => m.id === rec.menteeId);
                return (
                  <tr key={rec.id} className="hover:bg-slate-50/50">
                    <td className="py-3 font-semibold text-slate-900">{rec.date}</td>
                    <td className="py-3 text-slate-800">
                      <div className="flex items-center gap-2">
                        {mentee?.avatar && (
                          mentee.avatar.startsWith("http") || mentee.avatar.startsWith("/") ? (
                            <img
                              src={mentee.avatar}
                              alt=""
                              className="size-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-800">
                              {mentee.avatar}
                            </div>
                          )
                        )}
                        <span>{mentee?.name || rec.menteeId}</span>
                      </div>
                    </td>
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

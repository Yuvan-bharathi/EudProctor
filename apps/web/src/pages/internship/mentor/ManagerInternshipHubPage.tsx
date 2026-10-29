import {
  Award,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  ListTodo,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { useAuth } from "@/features/auth/store";
import {
  getInternshipManagerForUser,
  getPersistedMentees,
  getPersistedTasks,
  mockLeaveRequests,
  saveTaskToStorage,
} from "@/lib/mockData";
import type { InternshipMentee, InternshipTask, LeaveRequest } from "@/lib/types";

export function ManagerInternshipHubPage() {
  usePageTitle("Internship Programme Hub");
  const { user } = useAuth();

  const [mentees, setMentees] = useState<InternshipMentee[]>(() => getPersistedMentees());
  const [tasks, setTasks] = useState<InternshipTask[]>(() => getPersistedTasks());
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(mockLeaveRequests);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleMenteeUpdate = () => setMentees(getPersistedMentees());
    const handleTaskUpdate = () => setTasks(getPersistedTasks());
    window.addEventListener("eduproctor_mentees_updated", handleMenteeUpdate);
    window.addEventListener("eduproctor_tasks_updated", handleTaskUpdate);
    return () => {
      window.removeEventListener("eduproctor_mentees_updated", handleMenteeUpdate);
      window.removeEventListener("eduproctor_tasks_updated", handleTaskUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const currentManager = getInternshipManagerForUser(user);
  const managerId = currentManager.id;
  const filteredMentees = mentees.filter((m) => m.managerId === managerId);
  const myMentees = filteredMentees.length > 0 ? filteredMentees : mentees.slice(0, 2);
  const filteredTasks = tasks.filter((t) => t.managerId === managerId);
  const myTasks = filteredTasks.length > 0 ? filteredTasks : tasks;
  const pendingTasks = myTasks.filter((t) => t.status === "Review");

  const handleApproveTask = (task: InternshipTask) => {
    const updated: InternshipTask = {
      ...task,
      status: "Done",
      managerFeedback: "Excellent work! Verified requirements and test cases passed.",
    };
    saveTaskToStorage(updated);
    showToast(`Approved task: "${task.title}"`);
  };

  const handleReworkTask = (task: InternshipTask) => {
    const updated: InternshipTask = {
      ...task,
      status: "Rework",
      managerFeedback: "Please refine the error handling and re-submit with edge case tests.",
    };
    saveTaskToStorage(updated);
    showToast(`Requested rework for: "${task.title}"`);
  };

  const handleLeaveDecision = (reqId: string, status: "Approved" | "Rejected") => {
    setLeaveRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status } : r)),
    );
    showToast(`Leave request ${status.toLowerCase()} successfully.`);
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-teal-50/40 to-slate-50 p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              <Sparkles className="size-3 text-emerald-600" />
              <span>EduProctor Intelligence v3 · Internship Edition</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Manager Internship Hub
            </h1>
            <p className="max-w-2xl text-xs text-slate-600 sm:text-sm">
              Coaching <span className="font-semibold text-emerald-700">{myMentees.length} of 2 Mentees</span> (1:2 ratio policy). Tracking 3-month skill progression, sprint submissions, and monthly calibration scorecards.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 flex-wrap">
            <Link
              to="/mentor/internship/tasks"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-50"
            >
              <Sparkles className="size-4 text-emerald-600" />
              <span>Weekly MCQs & AI Reviews</span>
            </Link>
            <Link
              to="/mentor/internship/mentees"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900"
            >
              <Users className="size-4 text-slate-500" />
              <span>Skill Matrices</span>
            </Link>
            <Link
              to="/mentor/internship/tasks"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
            >
              <ListTodo className="size-4" />
              <span>Assign Sprint Task</span>
            </Link>
          </div>
        </div>

        {/* 3-Month Program Timeline Pill */}
        <div className="mt-5 grid grid-cols-1 gap-2 pt-4 border-t border-emerald-100/80 sm:grid-cols-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-white/70 px-3 py-2 text-xs">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">M1</span>
            <div>
              <p className="font-semibold text-slate-800">Month 1: Foundations</p>
              <p className="text-[11px] text-slate-500">Core concepts · Level 1–2</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-emerald-100/70 border border-emerald-300/60 px-3 py-2 text-xs">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">M2</span>
            <div>
              <p className="font-semibold text-emerald-900">Month 2: Applied Skills (Active)</p>
              <p className="text-[11px] text-emerald-700">Production tasks · Level 2–3</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-white/70 px-3 py-2 text-xs">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">M3</span>
            <div>
              <p className="font-semibold text-slate-800">Month 3: Capstone & Review</p>
              <p className="text-[11px] text-slate-500">Hiring conversion · Level 3–5</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-medium text-slate-500">Paired Mentees</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{myMentees.length}</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Max 2 Limit
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">100% capacity · 1:2 strict ratio</p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-medium text-slate-500">Tasks in Review</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{pendingTasks.length}</span>
            <span className="text-xs font-medium text-amber-700">Awaiting Feedback</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{myTasks.length} total sprint tasks active</p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-medium text-slate-500">Weekly Attendance</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <CalendarCheck2 className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">96.5%</span>
            <span className="text-xs font-medium text-emerald-600">On Track</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">5% weight in monthly scorecard</p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-medium text-slate-500">Average Composite Score</span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Award className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {myMentees.length > 0
                ? Math.round(
                    myMentees.reduce((acc, m) => acc + m.compositeScorePct, 0) / myMentees.length,
                  )
                : 85}
              %
            </span>
            <span className="text-xs font-medium text-purple-700">Month 2 Avg</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">MCQ (25%) + Code (30%) + Comm (20%)</p>
        </div>
      </div>

      {/* Mentees Spotlight Section (Max 2 Mentees strictly) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Assigned Mentees (2 Active)
          </h2>
          <span className="text-xs text-slate-500">
            Strict 1:2 manager mentorship constraint enforced
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {myMentees.map((mentee) => (
            <div
              key={mentee.id}
              className="group relative flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs transition-all hover:border-emerald-300 hover:shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {mentee.avatar?.startsWith("http") || mentee.avatar?.startsWith("/") ? (
                      <img
                        src={mentee.avatar}
                        alt={mentee.name}
                        className="size-12 rounded-full border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex size-12 items-center justify-center rounded-full border border-slate-200 bg-emerald-100 text-sm font-bold text-emerald-800">
                        {mentee.avatar || mentee.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{mentee.name}</h3>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          {mentee.track}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{mentee.email} · {mentee.phone}</p>
                      <p className="text-[11px] text-slate-400">Roll: {mentee.rollNumber} · {mentee.cohortName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-800">
                      Month {mentee.currentMonth} of 3
                    </span>
                    <p className="mt-1 text-[11px] font-semibold text-emerald-600">
                      Score: {mentee.compositeScorePct}%
                    </p>
                  </div>
                </div>

                {/* 5-pillar mini breakdown */}
                <div className="mt-4 rounded-lg bg-slate-50 p-3">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                    <span>Skill Progress</span>
                    <span className="font-semibold text-slate-800">
                      {mentee.tasksCompletedCount} tasks done · {mentee.attendanceRatePct}% attendance
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {mentee.skills.slice(0, 4).map((sk) => (
                      <span
                        key={sk.name}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700"
                      >
                        {sk.name}: <span className="font-bold text-emerald-700">L{sk.currentLevel ?? 1}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <Link
                  to="/mentor/internship/mentees"
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  View Full Skill Matrix →
                </Link>
                <div className="flex items-center gap-2">
                  <Link
                    to="/mentor/internship/coding"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Code2 className="size-3.5 text-slate-500" />
                    <span>Review Code</span>
                  </Link>
                  <Link
                    to="/mentor/internship/reviews"
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    <Award className="size-3.5" />
                    <span>Monthly Review</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2-Column: Pending Task Reviews & Leave Approvals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sprint Tasks Pending Review */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-900">Sprint Tasks Awaiting Manager Review</h3>
              <p className="text-xs text-slate-500">Evaluate PR submissions against quality rubric</p>
            </div>
            <Link
              to="/mentor/internship/tasks"
              className="text-xs font-medium text-emerald-700 hover:underline"
            >
              All Tasks →
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {pendingTasks.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-6 text-center text-xs text-slate-500">
                <CheckCircle2 className="mx-auto mb-2 size-6 text-emerald-500" />
                All pending sprint submissions have been reviewed!
              </div>
            ) : (
              pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 transition-all hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-xs text-slate-900">{task.title}</h4>
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          Review
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2">{task.description}</p>
                      {task.submissionUrl && (
                        <a
                          href={task.submissionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline"
                        >
                          <ExternalLink className="size-3" />
                          <span>{task.submissionUrl}</span>
                        </a>
                      )}
                      {task.submissionNotes && (
                        <p className="mt-1 text-[11px] italic text-slate-500">
                          Notes: "{task.submissionNotes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-200/60 pt-2.5">
                    <button
                      type="button"
                      onClick={() => handleReworkTask(task)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 cursor-pointer"
                    >
                      Request Rework
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveTask(task)}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                    >
                      Approve & Mark Done
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leave Requests & Attendance Approvals */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-900">Leave Requests & Attendance Approvals</h3>
              <p className="text-xs text-slate-500">Daily check-in / check-out verification (No biometrics)</p>
            </div>
            <Link
              to="/mentor/internship/attendance"
              className="text-xs font-medium text-emerald-700 hover:underline"
            >
              Full Log →
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {leaveRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 transition-all hover:bg-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900">{req.menteeName}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          req.status === "Approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : req.status === "Rejected"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      <span className="font-medium text-slate-700">Dates:</span> {req.startDate} to {req.endDate}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      <span className="font-medium">Reason:</span> {req.reason}
                    </p>
                  </div>

                  {req.status === "Pending" && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleLeaveDecision(req.id, "Rejected")}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLeaveDecision(req.id, "Approved")}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                      >
                        Approve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


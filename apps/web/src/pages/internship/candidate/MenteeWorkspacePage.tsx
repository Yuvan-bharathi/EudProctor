import {
  Award,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Code2,
  FileQuestion,
  LogOut,
  Mail,
  Phone,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { useAuth } from "@/features/auth/store";
import {
  FULL_STACK_12_WEEK_PLAN,
  getInternshipMenteeForUser,
  getPersistedAttendance,
  getPersistedTasks,
  getPersistedWeeklyMCQs,
  recordAttendanceCheckIn,
  recordAttendanceCheckOut,
} from "@/lib/mockData";
import type { DailyAttendance, InternshipTask, WeeklyMCQAssessment } from "@/lib/types";

export function MenteeWorkspacePage() {
  usePageTitle("Mentee Workspace");
  const { user } = useAuth();

  const [tasks, setTasks] = useState<InternshipTask[]>(() => getPersistedTasks());
  const [attendance, setAttendance] = useState<DailyAttendance[]>(() =>
    getPersistedAttendance(),
  );
  const [weeklyMcqs, setWeeklyMcqs] = useState<WeeklyMCQAssessment[]>(() =>
    getPersistedWeeklyMCQs(),
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const myProfile = getInternshipMenteeForUser(user);
  const menteeId = myProfile.id;
  const myTasks = tasks.filter((t) => t.menteeId === menteeId);

  // Active curriculum sprint week (e.g. Week 2 or latest active)
  const activeCurriculumWeek = FULL_STACK_12_WEEK_PLAN[1]; // Week 2
  const activeWeeklyMcq = weeklyMcqs.find((m) => m.weekNumber === 2) || weeklyMcqs[0];

  const todayStr = new Date().toISOString().split("T")[0];
  const todayAttendance = attendance.find(
    (a) => a.menteeId === menteeId && a.date === todayStr,
  );

  useEffect(() => {
    const handleAttUpdate = () => setAttendance(getPersistedAttendance());
    const handleTaskUpdate = () => setTasks(getPersistedTasks());
    const handleMcqUpdate = () => setWeeklyMcqs(getPersistedWeeklyMCQs());

    window.addEventListener("eduproctor_attendance_updated", handleAttUpdate);
    window.addEventListener("eduproctor_tasks_updated", handleTaskUpdate);
    window.addEventListener("eduproctor_weekly_mcqs_updated", handleMcqUpdate);

    return () => {
      window.removeEventListener("eduproctor_attendance_updated", handleAttUpdate);
      window.removeEventListener("eduproctor_tasks_updated", handleTaskUpdate);
      window.removeEventListener("eduproctor_weekly_mcqs_updated", handleMcqUpdate);
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
    showToast("Checked out successfully for today! Hours logged: 8.5 hrs.");
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
              <Rocket className="size-3 text-emerald-600" />
              <span>Internship Programme · Track: {myProfile?.track}</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Welcome back, {myProfile?.name.split(" ")[0]}!
            </h1>
            <p className="max-w-2xl text-xs text-slate-600 sm:text-sm">
              You are currently in <strong className="text-emerald-700">Month 2: Applied Skills</strong>. Complete daily check-ins, sprint deliverables, and prepare for Month 3 readiness calibration.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/candidate/internship/coding"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
            >
              <Code2 className="size-4" />
              <span>Launch Coding IDE</span>
            </Link>
          </div>
        </div>

        {/* Attendance Check-In Widget Banner */}
        <div className="mt-5 rounded-xl border border-emerald-200 bg-white/90 p-4 backdrop-blur-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                <CalendarCheck2 className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Today's Attendance Status
                  </h3>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      todayAttendance?.checkInTime
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {todayAttendance?.checkInTime ? "Checked In" : "Not Checked In"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {todayAttendance?.checkInTime
                    ? `Checked in at ${todayAttendance.checkInTime} · ${todayAttendance.checkOutTime ? `Checked out at ${todayAttendance.checkOutTime} (${todayAttendance.totalHours} hrs)` : "Working"}`
                    : "Standard workday check-in (Contributes 5% to graduation scorecard)"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!todayAttendance?.checkInTime ? (
                <button
                  type="button"
                  onClick={handleCheckIn}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
                >
                  <Clock className="size-4" />
                  <span>Check In (09:15 AM)</span>
                </button>
              ) : !todayAttendance?.checkOutTime ? (
                <button
                  type="button"
                  onClick={handleCheckOut}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  <LogOut className="size-4 text-slate-600" />
                  <span>Check Out for Today</span>
                </button>
              ) : (
                <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                  ✔ Today's 8.5 Hours Logged
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Attendance Rate</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {myProfile?.attendanceRatePct}%
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">5% weight in monthly review</span>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Tasks Completed</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {myProfile?.tasksCompletedCount}
          </p>
          <span className="text-[11px] text-slate-500">Sprint deliverables</span>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Composite Score</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {myProfile?.compositeScorePct}%
          </p>
          <span className="text-[11px] text-purple-700 font-medium">Month 2 Standing</span>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-2xs">
          <span className="text-xs font-medium text-slate-500">Average Skill Level</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            Level 3.0
          </p>
          <span className="text-[11px] text-emerald-700 font-medium">Independent (L1–L5 scale)</span>
        </div>
      </div>

      {/* Section: This Week's Knowledge Check (MCQ) & Active Curriculum Topic */}
      <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <FileQuestion className="size-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  This Week's Knowledge Check · Month {activeCurriculumWeek.month}, Week {activeCurriculumWeek.weekInMonth} (Week {activeCurriculumWeek.week})
                </h2>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                  {activeCurriculumWeek.skillArea}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Theme: <strong>{activeCurriculumWeek.theme}</strong> · Evaluated by AI Assessment Evaluation Agent
              </p>
            </div>
          </div>

          <Link
            to="/candidate/internship/mcq"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <span>View All 12 Weekly MCQs</span>
            <span>→</span>
          </Link>
        </div>

        {/* Weekly MCQ Card */}
        {activeWeeklyMcq && (
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 transition-all hover:border-emerald-300 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">{activeWeeklyMcq.title}</span>
                {activeWeeklyMcq.status === "published" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    <CheckCircle2 className="size-3" />
                    Published (Score: {activeWeeklyMcq.scorePct}%)
                  </span>
                )}
                {activeWeeklyMcq.status === "submitted" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                    <Clock className="size-3" />
                    Under AI & Manager Review (Provisional: {activeWeeklyMcq.scorePct}%)
                  </span>
                )}
                {activeWeeklyMcq.status === "available" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800">
                    <Sparkles className="size-3" />
                    Ready to Start
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <FileQuestion className="size-3 text-slate-400" />
                  {activeWeeklyMcq.questionCount} Questions
                </span>
                <span className="flex items-center gap-1">
                  <Timer className="size-3 text-slate-400" />
                  {activeWeeklyMcq.durationMinutes} Minutes Time Limit
                </span>
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <ShieldCheck className="size-3 text-emerald-600" />
                  Calm AI Proctoring (0 Flags)
                </span>
              </div>

              {activeWeeklyMcq.agentAnalysis && (
                <div className="mt-2 rounded-lg bg-white p-2.5 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <span className="flex items-center gap-1 text-emerald-700">
                      <Sparkles className="size-3" />
                      AI Evaluation Summary (Drafted for Manager {activeWeeklyMcq.managerName})
                    </span>
                    <span>Accuracy: {activeWeeklyMcq.agentAnalysis.accuracyPct}%</span>
                  </div>
                  <p className="italic text-slate-600">"{activeWeeklyMcq.agentAnalysis.summary}"</p>
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <Link
                to="/candidate/internship/mcq"
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all ${
                  activeWeeklyMcq.status === "available"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {activeWeeklyMcq.status === "available" ? (
                  <>
                    <Play className="size-3.5" />
                    <span>Start Weekly MCQ Assessment</span>
                  </>
                ) : (
                  <>
                    <Award className="size-3.5" />
                    <span>View Scorecard & AI Review</span>
                  </>
                )}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 2-Column: Manager-Assigned Sprint Tasks & Manager Contact */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Sprint Tasks */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Manager-Assigned Week Tasks
              </h2>
              <p className="text-xs text-slate-500">
                Deliverables assigned by Priya Sharma for your current curriculum sprints
              </p>
            </div>
            <Link
              to="/candidate/internship/tasks"
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              View Full Sprint Kanban →
            </Link>
          </div>

          <div className="space-y-3">
            {myTasks.slice(0, 3).map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all hover:border-emerald-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-100">
                        Month {task.monthNumber}, Week {task.weekNumber ? (task.weekNumber <= 4 ? task.weekNumber : task.weekNumber <= 8 ? task.weekNumber - 4 : task.weekNumber - 8) : 1}
                      </span>
                      <h3 className="font-semibold text-xs text-slate-900">{task.title}</h3>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          task.status === "Done"
                            ? "bg-emerald-100 text-emerald-800"
                            : task.status === "Review"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600 line-clamp-2">
                      {task.description}
                    </p>
                    <div className="mt-2.5 flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Area: <strong className="text-slate-600">{task.skillArea}</strong></span>
                      <span>Due: <strong className="text-slate-600">{task.dueDate}</strong></span>
                      <span>Priority: <strong className="text-rose-600">{task.priority}</strong></span>
                    </div>
                  </div>

                  <Link
                    to="/candidate/internship/tasks"
                    className="shrink-0 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    View / Submit →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Manager Card */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            Assigned Manager (1:2 Ratio)
          </h2>

          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-800 text-base">
                PS
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Priya Sharma</h3>
                <p className="text-xs text-slate-500">Engineering Manager · MERN</p>
                <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-700">
                  Managing 2 Mentees Max
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Mail className="size-3.5 text-slate-400" />
                <span>priya.sharma@example.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-3.5 text-slate-400" />
                <span>+91 98765 43210</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link
                to="/candidate/internship/skills"
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <TrendingUp className="size-3.5 text-slate-500" />
                <span>My Skill Competency Matrix</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


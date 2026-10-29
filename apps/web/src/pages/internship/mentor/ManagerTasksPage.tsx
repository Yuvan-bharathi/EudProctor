import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileQuestion,
  Filter,
  ListTodo,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { useAuth } from "@/features/auth/store";
import {
  FULL_STACK_12_WEEK_PLAN,
  getInternshipManagerForUser,
  getPersistedMentees,
  getPersistedTasks,
  getPersistedWeeklyMCQs,
  mockLearningTopics,
  publishWeeklyMCQResult,
  saveTaskToStorage,
} from "@/lib/mockData";
import type {
  InternshipMentee,
  InternshipTask,
  LearningTopic,
  TaskPriority,
  TaskStatus,
  WeeklyMCQAssessment,
} from "@/lib/types";

const KANBAN_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: "Assigned", label: "Assigned", color: "bg-slate-100 text-slate-700" },
  { status: "In Progress", label: "In Progress", color: "bg-blue-100 text-blue-700" },
  { status: "Review", label: "Pending Review", color: "bg-amber-100 text-amber-800" },
  { status: "Rework", label: "Rework Required", color: "bg-rose-100 text-rose-800" },
  { status: "Done", label: "Done / Verified", color: "bg-emerald-100 text-emerald-800" },
];

export function ManagerTasksPage() {
  usePageTitle("Tasks & Learning Plan");
  const { user } = useAuth();

  const [tasks, setTasks] = useState<InternshipTask[]>(() => getPersistedTasks());
  const [mentees] = useState<InternshipMentee[]>(() => getPersistedMentees());
  const [learningTopics] = useState<LearningTopic[]>(mockLearningTopics);
  const [weeklyMcqs, setWeeklyMcqs] = useState<WeeklyMCQAssessment[]>(() => getPersistedWeeklyMCQs());
  const [activeTab, setActiveTab] = useState<"kanban" | "weekly_mcqs" | "learning">("kanban");
  const [filterMenteeId, setFilterMenteeId] = useState<string>("all");
  const [filterMcqStatus, setFilterMcqStatus] = useState<string>("all");
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<InternshipTask | null>(null);
  const [reviewingMcq, setReviewingMcq] = useState<WeeklyMCQAssessment | null>(null);
  const [managerReviewFeedback, setManagerReviewFeedback] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentManager = getInternshipManagerForUser(user);
  const managerId = currentManager.id;
  const filteredMentees = mentees.filter((m) => m.managerId === managerId);
  const myMentees = filteredMentees.length > 0 ? filteredMentees : mentees.slice(0, 2);

  const pendingMcqCount = weeklyMcqs.filter((m) => m.status === "submitted").length;

  // New task form state
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [newTitle, setNewTitle] = useState(FULL_STACK_12_WEEK_PLAN[0].defaultTaskTitle);
  const [newDesc, setNewDesc] = useState(FULL_STACK_12_WEEK_PLAN[0].acceptanceCriteria);
  const [newMenteeId, setNewMenteeId] = useState("");
  const [newSkillArea, setNewSkillArea] = useState(FULL_STACK_12_WEEK_PLAN[0].skillArea);
  const [newPriority, setNewPriority] = useState<TaskPriority>("High");
  const [newDueDate, setNewDueDate] = useState("2026-11-15");
  const [newMonth, setNewMonth] = useState<1 | 2 | 3>(1);

  const handleWeekSelect = (weekNum: number) => {
    setSelectedWeek(weekNum);
    const plan = FULL_STACK_12_WEEK_PLAN.find((w) => w.week === weekNum);
    if (plan) {
      setNewMonth(plan.month);
      setNewTitle(plan.defaultTaskTitle);
      setNewSkillArea(plan.skillArea);
      setNewDesc(plan.acceptanceCriteria);
    }
  };

  useEffect(() => {
    if (myMentees.length > 0 && !newMenteeId) {
      setNewMenteeId(myMentees[0].id);
    }
  }, [myMentees, newMenteeId]);

  useEffect(() => {
    const handleTaskUpdate = () => setTasks(getPersistedTasks());
    const handleMcqUpdate = () => setWeeklyMcqs(getPersistedWeeklyMCQs());

    window.addEventListener("eduproctor_tasks_updated", handleTaskUpdate);
    window.addEventListener("eduproctor_weekly_mcqs_updated", handleMcqUpdate);

    return () => {
      window.removeEventListener("eduproctor_tasks_updated", handleTaskUpdate);
      window.removeEventListener("eduproctor_weekly_mcqs_updated", handleMcqUpdate);
    };
  }, []);

  const handleOpenReviewMcq = (mcq: WeeklyMCQAssessment) => {
    setReviewingMcq(mcq);
    setManagerReviewFeedback(
      mcq.managerNotes ||
        `Priya Sharma: Verified topic mastery. Arjun demonstrated 85% accuracy on React core. Let's do a 10-minute sync on useCallback dependency arrays before merging PR #14.`
    );
  };

  const handleApproveAndPublishMcq = () => {
    if (!reviewingMcq) return;
    const updated = publishWeeklyMCQResult(reviewingMcq.id, managerReviewFeedback);
    setWeeklyMcqs(getPersistedWeeklyMCQs());
    setReviewingMcq(null);
    showToast(`Published! Scorecard & targeted practice recommendations dispatched to ${updated.menteeName}.`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredTasks = tasks.filter((t) => {
    if (t.managerId !== managerId) return false;
    if (filterMenteeId !== "all" && t.menteeId !== filterMenteeId) return false;
    return true;
  });

  const handleStatusChange = (task: InternshipTask, newStatus: TaskStatus) => {
    const updated: InternshipTask = { ...task, status: newStatus };
    saveTaskToStorage(updated);
    if (selectedTask?.id === task.id) {
      setSelectedTask(updated);
    }
    showToast(`Task moved to ${newStatus}`);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMentee = myMentees.find((m) => m.id === newMenteeId) || myMentees[0];

    const newTask: InternshipTask = {
      id: `task-${Date.now()}`,
      menteeId: targetMentee.id,
      managerId,
      title: newTitle,
      description: newDesc,
      track: targetMentee.track,
      skillArea: newSkillArea,
      status: "Assigned",
      priority: newPriority,
      dueDate: newDueDate,
      monthNumber: newMonth,
      weekNumber: selectedWeek,
    };

    saveTaskToStorage(newTask);
    setIsAssignModalOpen(false);
    showToast(`Assigned Month ${newMonth}, Week ${selectedWeek <= 4 ? selectedWeek : selectedWeek <= 8 ? selectedWeek - 4 : selectedWeek - 8} task to ${targetMentee.name}`);
  };

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
            <ListTodo className="size-3.5" />
            <span>Internship Sprint Backlog</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 sm:text-2xl">
            Tasks & Learning Plan
          </h1>
          <p className="text-xs text-slate-500">
            Track Kanban sprint deliverables, review code PRs, and curate learning topics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab switcher */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("kanban")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "kanban"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sprint Kanban
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("weekly_mcqs")}
              className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "weekly_mcqs"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Weekly MCQs & AI Reviews</span>
              {pendingMcqCount > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  {pendingMcqCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("learning")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "learning"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Curated Topics
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAssignModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Assign Sprint Task</span>
          </button>
        </div>
      </div>

      {activeTab === "kanban" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <Filter className="size-3.5 text-slate-400" />
              <span>Filter Mentee:</span>
              <select
                value={filterMenteeId}
                onChange={(e) => setFilterMenteeId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800"
              >
                <option value="all">All Mentees ({myMentees.length})</option>
                {myMentees.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs text-slate-500">
              Showing <strong>{filteredTasks.length}</strong> tasks across 5 workflow stages
            </span>
          </div>

          {/* Kanban Columns (5 stages) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {KANBAN_COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.status);
              return (
                <div
                  key={col.status}
                  className="flex flex-col rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 shadow-2xs"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                    <span className="font-semibold text-xs text-slate-800">{col.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${col.color}`}>
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Task Cards in Column */}
                  <div className="space-y-2.5 min-h-[460px]">
                    {colTasks.map((task) => {
                      const menteeObj = mentees.find((m) => m.id === task.menteeId);
                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTask(task)}
                          className="group relative rounded-xl border border-slate-200 bg-white p-3 shadow-2xs transition-all hover:border-emerald-400 hover:shadow-xs cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-[10px] font-semibold gap-1">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800 font-bold">
                                Month {task.monthNumber}, Week {task.weekNumber ? (task.weekNumber <= 4 ? task.weekNumber : task.weekNumber <= 8 ? task.weekNumber - 4 : task.weekNumber - 8) : 1}
                              </span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 truncate max-w-[90px]">
                                {task.skillArea}
                              </span>
                            </div>
                            <span
                              className={`rounded px-1.5 py-0.5 ${
                                task.priority === "High"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>

                          <h4 className="mt-2 text-xs font-semibold text-slate-900 group-hover:text-emerald-700">
                            {task.title}
                          </h4>
                          <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                            {task.description}
                          </p>

                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                            <div className="flex items-center gap-1.5">
                              {menteeObj && (
                                menteeObj.avatar?.startsWith("http") || menteeObj.avatar?.startsWith("/") ? (
                                  <img
                                    src={menteeObj.avatar}
                                    alt={menteeObj.name}
                                    className="size-4 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="flex size-4 items-center justify-center rounded-full bg-emerald-100 text-[8px] font-bold text-emerald-800">
                                    {menteeObj.avatar || menteeObj.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )
                              )}
                              <span>{menteeObj?.name.split(" ")[0]}</span>
                            </div>
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3 text-slate-400" />
                              {task.dueDate}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {colTasks.length === 0 && (
                      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 text-center text-[11px] text-slate-400">
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Weekly MCQs & AI Evaluation Reviews */}
      {activeTab === "weekly_mcqs" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-2xs gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
              <div className="flex items-center gap-2">
                <Filter className="size-3.5 text-slate-400" />
                <span>Mentee:</span>
                <select
                  value={filterMenteeId}
                  onChange={(e) => setFilterMenteeId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800"
                >
                  <option value="all">All Mentees ({myMentees.length})</option>
                  {myMentees.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span>Status:</span>
                <select
                  value={filterMcqStatus}
                  onChange={(e) => setFilterMcqStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800"
                >
                  <option value="all">All Statuses ({weeklyMcqs.length})</option>
                  <option value="submitted">Pending Manager Review ({pendingMcqCount})</option>
                  <option value="published">Published</option>
                  <option value="available">Scheduled / Available</option>
                </select>
              </div>
            </div>

            <span className="text-xs text-slate-500">
              Continuous assessment across the <strong>12-Week Curriculum</strong>
            </span>
          </div>

          {/* Weekly MCQs Cards Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {weeklyMcqs
              .filter((mcq) => {
                if (filterMenteeId !== "all" && mcq.menteeId !== filterMenteeId) return false;
                if (filterMcqStatus !== "all" && mcq.status !== filterMcqStatus) return false;
                return true;
              })
              .map((mcq) => {
                const isSubmitted = mcq.status === "submitted";
                const isPublished = mcq.status === "published";

                return (
                  <div
                    key={mcq.id}
                    className={`flex flex-col justify-between rounded-xl border bg-white p-5 shadow-2xs transition-all ${
                      isSubmitted
                        ? "border-amber-300 bg-amber-50/20 shadow-xs"
                        : isPublished
                          ? "border-emerald-200"
                          : "border-slate-200"
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800">
                          Month {mcq.monthNumber} · Week {mcq.weekInMonth} (W{mcq.weekNumber})
                        </span>

                        {isSubmitted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-200 animate-pulse">
                            <Clock className="size-3 text-amber-700" />
                            Needs Sign-off ({mcq.scorePct}%)
                          </span>
                        )}

                        {isPublished && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="size-3" />
                            Published ({mcq.scorePct}%)
                          </span>
                        )}

                        {mcq.status === "available" && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            Scheduled
                          </span>
                        )}
                      </div>

                      <h3 className="mt-2.5 text-sm font-bold text-slate-900 leading-snug">{mcq.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">{mcq.theme}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                          {mcq.skillArea}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileQuestion className="size-3 text-slate-400" />
                          {mcq.questionCount} Questions
                        </span>
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                          <ShieldCheck className="size-3" />
                          0 Flags
                        </span>
                      </div>

                      {/* AI Evaluation Agent Summary Box */}
                      {mcq.agentAnalysis && (
                        <div className="mt-3.5 space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                            <span className="flex items-center gap-1 text-emerald-700">
                              <Sparkles className="size-3" />
                              AI Agent Synthesis for Manager
                            </span>
                            <span>Score: {mcq.scorePct}%</span>
                          </div>

                          <p className="text-[11px] text-slate-600 leading-relaxed italic">
                            "{mcq.agentAnalysis.managerReviewNote}"
                          </p>

                          {/* Topic Mastery ladder */}
                          <div className="pt-2 border-t border-slate-200/80 space-y-1">
                            {mcq.agentAnalysis.topicMastery.slice(0, 2).map((tm, i) => (
                              <div key={i} className="flex items-center justify-between text-[10px]">
                                <span className="text-slate-600 truncate max-w-[170px]">{tm.topic}</span>
                                <span
                                  className={`rounded px-1.5 py-0.2 font-bold ${
                                    tm.status === "Strong"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {tm.scorePct}% ({tm.status})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      {isSubmitted ? (
                        <button
                          type="button"
                          onClick={() => handleOpenReviewMcq(mcq)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-2 text-xs font-bold text-white hover:bg-amber-700 shadow-xs cursor-pointer"
                        >
                          <Sparkles className="size-3.5" />
                          <span>Review AI Analysis & Publish Scorecard</span>
                        </button>
                      ) : isPublished ? (
                        <button
                          type="button"
                          onClick={() => handleOpenReviewMcq(mcq)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                        >
                          <Award className="size-3.5" />
                          <span>Inspect Scorecard & Feedback</span>
                        </button>
                      ) : (
                        <div className="text-center text-[11px] text-slate-400 py-1">
                          Awaiting mentee assessment completion
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 3: Curated Learning Topics Tab */}
      {activeTab === "learning" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {learningTopics.map((topic) => (
              <div
                key={topic.id}
                className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-2xs"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                    {topic.track}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      topic.status === "Mastered"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {topic.status}
                  </span>
                </div>

                <h3 className="mt-2 text-sm font-bold text-slate-900">{topic.title}</h3>
                <p className="mt-1 text-xs text-slate-600">{topic.description}</p>

                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Curated Resources
                  </span>
                  {topic.resources.map((res, i) => (
                    <a
                      key={i}
                      href={res.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 hover:text-emerald-700"
                    >
                      <span className="truncate">{res.title}</span>
                      <ExternalLink className="size-3 text-slate-400 shrink-0" />
                    </a>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Target Date: {topic.targetDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Month {selectedTask.monthNumber}, Week {selectedTask.weekNumber ? (selectedTask.weekNumber <= 4 ? selectedTask.weekNumber : selectedTask.weekNumber <= 8 ? selectedTask.weekNumber - 4 : selectedTask.weekNumber - 8) : 1} · {selectedTask.skillArea}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {selectedTask.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-700">Description:</span>
                <p className="mt-1 text-slate-600 leading-relaxed">{selectedTask.description}</p>
              </div>

              {selectedTask.submissionUrl && (
                <div>
                  <span className="font-semibold text-slate-700">Submitted Deliverable:</span>
                  <a
                    href={selectedTask.submissionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 flex items-center gap-1.5 text-emerald-700 hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>{selectedTask.submissionUrl}</span>
                  </a>
                </div>
              )}

              {selectedTask.submissionNotes && (
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <span className="font-semibold text-slate-700">Mentee Notes:</span>
                  <p className="mt-0.5 text-slate-600 italic">"{selectedTask.submissionNotes}"</p>
                </div>
              )}

              {selectedTask.managerFeedback && (
                <div className="rounded-lg bg-emerald-50/70 p-2.5 border border-emerald-100">
                  <span className="font-semibold text-emerald-900">Manager Feedback:</span>
                  <p className="mt-0.5 text-emerald-800">{selectedTask.managerFeedback}</p>
                </div>
              )}

              {/* Status Move Buttons */}
              <div className="pt-3 border-t border-slate-100">
                <span className="font-semibold text-slate-700 block mb-2">Move Status:</span>
                <div className="flex flex-wrap gap-2">
                  {KANBAN_COLUMNS.map((col) => (
                    <button
                      key={col.status}
                      type="button"
                      disabled={selectedTask.status === col.status}
                      onClick={() => handleStatusChange(selectedTask, col.status)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                        selectedTask.status === col.status
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Task Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Assign New Sprint Task</h3>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign To Mentee
                </label>
                <select
                  value={newMenteeId}
                  onChange={(e) => setNewMenteeId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs font-medium text-slate-900"
                >
                  {myMentees.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.track})
                    </option>
                  ))}
                </select>
              </div>

              {/* Curriculum Sprint Week Selector from 12-Week Roadmap */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Curriculum Sprint (12-Week Roadmap)
                  </label>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                    Month {newMonth}, Week {selectedWeek <= 4 ? selectedWeek : selectedWeek <= 8 ? selectedWeek - 4 : selectedWeek - 8} (Week {selectedWeek})
                  </span>
                </div>
                <select
                  value={selectedWeek}
                  onChange={(e) => handleWeekSelect(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs font-semibold text-slate-900 bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {FULL_STACK_12_WEEK_PLAN.map((plan) => (
                    <option key={plan.week} value={plan.week}>
                      Month {plan.month}, Week {plan.weekInMonth} (Week {plan.week}): {plan.theme}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Selecting a sprint dynamically pre-fills the Task Title, Skill Area, and Acceptance Criteria.
                </p>
                <div className="mt-2 rounded-lg bg-emerald-50/70 border border-emerald-100 p-2.5 flex items-center justify-between text-[11px] text-emerald-900">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <FileQuestion className="size-3.5 text-emerald-600 shrink-0" />
                    <span>Paired Weekly MCQ:</span>
                    <span className="font-normal truncate max-w-[240px]">Week {selectedWeek} Knowledge Check ({newSkillArea})</span>
                  </div>
                  <span className="font-bold text-emerald-800 shrink-0">Calm AI Proctoring</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Build JWT Authentication with Refresh Token rotation"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detailed Acceptance Criteria
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Include endpoints, DB collections, security headers, and unit tests required."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Skill Area
                  </label>
                  <input
                    type="text"
                    required
                    value={newSkillArea}
                    onChange={(e) => setNewSkillArea(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs font-medium text-slate-900"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sprint Cadence
                  </label>
                  <div className="flex h-[38px] items-center rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-800 border border-slate-200">
                    Month {newMonth}, Week {selectedWeek <= 4 ? selectedWeek : selectedWeek <= 8 ? selectedWeek - 4 : selectedWeek - 8} (W{selectedWeek})
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                >
                  Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Weekly MCQ AI Evaluation & Manager Review Modal */}
      {reviewingMcq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      AI Evaluation Review · {reviewingMcq.title}
                    </span>
                    <span className="rounded bg-emerald-50 px-2 py-0.2 text-[10px] font-bold text-emerald-800">
                      {reviewingMcq.menteeName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Analyzed by AI Assessment Evaluation Agent · Requires Manager Sign-off
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewingMcq(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* Score & Telemetry Header */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-[10px] font-medium text-slate-500 uppercase">Assessment Score</span>
                  <p className="mt-1 text-2xl font-extrabold text-emerald-700">{reviewingMcq.scorePct}%</p>
                  <span className="text-[10px] text-slate-400">
                    {reviewingMcq.pointsObtained} of {reviewingMcq.totalPoints} points
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-[10px] font-medium text-slate-500 uppercase">Proctoring Telemetry</span>
                  <p className="mt-1 text-2xl font-extrabold text-emerald-700">100%</p>
                  <span className="text-[10px] text-slate-400">0 Flags (Clean Face & Tab)</span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-[10px] font-medium text-slate-500 uppercase">Submission Status</span>
                  <p className="mt-1 text-sm font-bold text-slate-900 capitalize">
                    {reviewingMcq.status === "published" ? "Published" : "Pending Sign-off"}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {reviewingMcq.submittedAt ? `Submitted ${reviewingMcq.submittedAt}` : "Pending"}
                  </span>
                </div>
              </div>

              {/* AI Agent Executive Summary */}
              {reviewingMcq.agentAnalysis && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="size-4 text-emerald-600" />
                      AI Evaluation Agent Synthesis for Manager
                    </span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800 font-bold">
                      Accuracy: {reviewingMcq.agentAnalysis.accuracyPct}%
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    {reviewingMcq.agentAnalysis.summary}
                  </p>

                  <div className="mt-2.5 rounded-lg bg-white p-3 border border-emerald-100">
                    <span className="font-bold text-emerald-950 block mb-1">
                      Targeted Mentoring Recommendation:
                    </span>
                    <p className="text-slate-600 italic">
                      "{reviewingMcq.agentAnalysis.managerReviewNote}"
                    </p>
                  </div>
                </div>
              )}

              {/* Topic Mastery Ladder */}
              {reviewingMcq.agentAnalysis?.topicMastery && (
                <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
                  <span className="font-bold text-slate-900 block">
                    Curriculum Topic Competency Breakdown:
                  </span>
                  <div className="space-y-1.5">
                    {reviewingMcq.agentAnalysis.topicMastery.map((tm, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-slate-700">{tm.topic}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            tm.status === "Strong"
                              ? "bg-emerald-100 text-emerald-800"
                              : tm.status === "Developing"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {tm.scorePct}% ({tm.status})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manager Feedback Textarea */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-800">
                  Manager Feedback & Coaching Advice (Included in Mentee Scorecard & Email Notification):
                </label>
                <textarea
                  rows={3}
                  value={managerReviewFeedback}
                  onChange={(e) => setManagerReviewFeedback(e.target.value)}
                  placeholder="Add your personalized mentoring notes and praise..."
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setReviewingMcq(null)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {reviewingMcq.status !== "published" ? (
                  <button
                    type="button"
                    onClick={handleApproveAndPublishMcq}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs cursor-pointer"
                  >
                    <Send className="size-3.5" />
                    <span>Approve & Publish Scorecard (Triggers Email Agent)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      handleApproveAndPublishMcq();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <span>Update Feedback</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

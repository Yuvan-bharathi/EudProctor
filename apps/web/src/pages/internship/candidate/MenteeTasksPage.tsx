import {
  CheckCircle2,
  FileQuestion,
  ListTodo,
  Play,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { useAuth } from "@/features/auth/store";
import {
  getInternshipMenteeForUser,
  getPersistedTasks,
  saveTaskToStorage,
} from "@/lib/mockData";
import type { InternshipTask, TaskStatus } from "@/lib/types";

const STAGES: { status: TaskStatus; label: string; color: string }[] = [
  { status: "Assigned", label: "To Do", color: "bg-slate-100 text-slate-700" },
  { status: "In Progress", label: "In Progress", color: "bg-blue-100 text-blue-700" },
  { status: "Review", label: "Under Manager Review", color: "bg-amber-100 text-amber-800" },
  { status: "Rework", label: "Needs Rework", color: "bg-rose-100 text-rose-800" },
  { status: "Done", label: "Approved & Completed", color: "bg-emerald-100 text-emerald-800" },
];

export function MenteeTasksPage() {
  usePageTitle("My Tasks & Sprints");
  const { user } = useAuth();
  const mentee = getInternshipMenteeForUser(user);
  const menteeId = mentee.id;
  const [tasks, setTasks] = useState<InternshipTask[]>(() => getPersistedTasks());
  const [selectedTask, setSelectedTask] = useState<InternshipTask | null>(null);
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleTaskUpdate = () => setTasks(getPersistedTasks());
    window.addEventListener("eduproctor_tasks_updated", handleTaskUpdate);
    return () => {
      window.removeEventListener("eduproctor_tasks_updated", handleTaskUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const myTasks = tasks.filter((t) => t.menteeId === menteeId);

  const handleOpenSubmitModal = (task: InternshipTask) => {
    setSelectedTask(task);
    setSubmissionUrl(task.submissionUrl || "https://github.com/organization/intern-mern-repo/pull/14");
    setSubmissionNotes(task.submissionNotes || "");
  };

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    const updated: InternshipTask = {
      ...selectedTask,
      submissionUrl,
      submissionNotes,
      status: "Review",
    };

    saveTaskToStorage(updated);
    setSelectedTask(null);
    showToast(`Submitted "${selectedTask.title}" to Priya Sharma for review!`);
  };

  const handleStartTask = (task: InternshipTask) => {
    const updated: InternshipTask = { ...task, status: "In Progress" };
    saveTaskToStorage(updated);
    showToast(`Task "${task.title}" is now In Progress.`);
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
            <ListTodo className="size-3.5" />
            <span>Sprint Tasks & Deliverables</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1 sm:text-2xl">
            My Tasks & Sprints
          </h1>
          <p className="text-xs text-slate-500">
            Deliver production-grade code, submit GitHub PR links, and receive manager code-review feedback.
          </p>
        </div>
      </div>

      {/* Paired Weekly MCQ Knowledge Check Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
            <FileQuestion className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Sprint Knowledge Check (Weekly MCQ)</span>
              <span className="rounded bg-emerald-100 px-2 py-0.2 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                Month 1, Week 2
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Complete the proctored multiple-choice assessment for this week's React Core & Hooks curriculum to validate your understanding.
            </p>
          </div>
        </div>
        <Link
          to="/candidate/internship/mcq"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-2xs"
        >
          <Play className="size-3.5" />
          <span>Take Weekly MCQ Assessment →</span>
        </Link>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {STAGES.map((col) => {
          const colTasks = myTasks.filter((t) => t.status === col.status);
          return (
            <div
              key={col.status}
              className="flex flex-col rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 shadow-2xs"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                <span className="font-semibold text-xs text-slate-800">{col.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${col.color}`}>
                  {colTasks.length}
                </span>
              </div>

              <div className="space-y-2.5 min-h-[460px]">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition-all hover:border-emerald-400 hover:shadow-xs"
                  >
                    <div className="flex items-center justify-between text-[10px] font-semibold gap-1">
                      <div className="flex items-center gap-1">
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800 font-bold">
                          M{task.monthNumber} · W{task.weekNumber ?? (task.monthNumber === 1 ? 1 : task.monthNumber === 2 ? 5 : 9)}
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

                    <h4 className="mt-2 text-xs font-semibold text-slate-900">
                      {task.title}
                    </h4>
                    <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                      {task.description}
                    </p>

                    {task.managerFeedback && (
                      <div className="mt-2 rounded-lg bg-emerald-50/70 p-2 text-[10px] text-emerald-800 border border-emerald-100">
                        <strong>Manager:</strong> {task.managerFeedback}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                      <span>Due: {task.dueDate}</span>

                      {task.status === "Assigned" && (
                        <button
                          type="button"
                          onClick={() => handleStartTask(task)}
                          className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 cursor-pointer"
                        >
                          Start Task
                        </button>
                      )}

                      {(task.status === "In Progress" || task.status === "Rework") && (
                        <button
                          type="button"
                          onClick={() => handleOpenSubmitModal(task)}
                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                        >
                          Submit Work
                        </button>
                      )}

                      {task.status === "Review" && (
                        <span className="text-amber-700 font-medium">In Review</span>
                      )}

                      {task.status === "Done" && (
                        <span className="text-emerald-700 font-bold">✔ Completed</span>
                      )}
                    </div>
                  </div>
                ))}

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

      {/* Submit Deliverable Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Submit Deliverable: {selectedTask.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Target: {selectedTask.skillArea} · Due: {selectedTask.dueDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitTask} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deliverable URL (GitHub Pull Request / Demo Link)
                </label>
                <input
                  type="url"
                  required
                  value={submissionUrl}
                  onChange={(e) => setSubmissionUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Implementation Summary & Notes for Manager
                </label>
                <textarea
                  rows={4}
                  required
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="Describe your architectural design, tests written, and edge cases handled..."
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                >
                  Submit for Manager Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart2,
  CheckCircle2,
  Loader2,
  Calendar,
  Clock,
  Eye,
  HelpCircle,
  MoreVertical,
  Plus,
  Send,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { AssessmentStatusBadge } from "@/components/AssessmentStatusBadge";
import { ErrorState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CoursePicker } from "@/features/mentor/CoursePicker";
import { api, errorMessage } from "@/lib/api";
import type { Exam } from "@/lib/types";

function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type FilterTab = "all" | "draft" | "scheduled" | "live" | "completed";

export function ExamsPage() {
  usePageTitle("Assessment Management");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const isLocationAdmin = location.pathname.startsWith("/admin");
  const baseExamPath = isLocationAdmin ? "/admin/exams" : "/mentor/exams";

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
    };
    window.addEventListener("eduproctor_assessments_updated", handleUpdate);
    return () => {
      window.removeEventListener("eduproctor_assessments_updated", handleUpdate);
    };
  }, [qc]);

  // Form states for creating new assessment
  const now = new Date();
  const [courseId, setCourseId] = useState("Full Stack Development");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(60);
  const [start, setStart] = useState(localInput(now));
  const [end, setEnd] = useState(localInput(new Date(now.getTime() + 7 * 864e5)));
  const [threshold, setThreshold] = useState(3);
  const [shuffle, setShuffle] = useState(true);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const examsQuery = useQuery({
    queryKey: ["exams"],
    queryFn: () => api<Exam[]>("/exams"),
    retry: 1,
  });

  const coursesQuery = useQuery({
    queryKey: ["courses"],
    queryFn: () => api<{ id: string; name: string; code: string }[]>("/courses"),
  });

  const create = useMutation({
    mutationFn: async () => {
      const matched = coursesQuery.data?.find(
        (c) => c.id === courseId || c.name.toLowerCase() === courseId.toLowerCase()
      ) ?? coursesQuery.data?.[0];
      const targetCourseId = matched?.id || courseId;

      return api<Exam>("/exams", {
        body: {
          course_id: targetCourseId,
          title,
          duration_min: duration,
          window_start: new Date(start).toISOString(),
          window_end: new Date(end).toISOString(),
          shuffle,
          flag_threshold_s: threshold,
        },
      });
    },
    onSuccess: (exam) => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      showToast("Assessment created successfully!");
      setModalOpen(false);
      navigate(`${baseExamPath}/${exam.id}`);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  // Pure TiDB Cloud backend assessments - zero mockData / localStorage leakage
  const assessments = (examsQuery.data ?? []).map((e) => {
    const rawCardStatus = (e as unknown as { card_status?: FilterTab }).card_status;
    const mappedStatus: FilterTab =
      rawCardStatus ??
      (e.status === "closed" ? "completed" : e.status === "scheduled" ? "scheduled" : "draft");

    const courseName = (e as unknown as { course_name?: string }).course_name || "Full Stack Development";
    const createdBy = (e as unknown as { created_by?: string }).created_by || "Mentor";
    const rawCreated = (e as unknown as { created_at?: string }).created_at;
    const createdDate = rawCreated
      ? new Date(rawCreated).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      : "Active";

    return {
      id: e.id,
      title: e.title,
      course: courseName,
      status: mappedStatus,
      questions: (e as unknown as { question_count?: number }).question_count ?? 0,
      duration_min: e.duration_min ?? 60,
      started: (e as unknown as { sessions_count?: number }).sessions_count ?? 0,
      submitted: (e as unknown as { completed_count?: number }).completed_count ?? 0,
      total: (e as unknown as { candidates_count?: number }).candidates_count ?? 0,
      createdBy,
      createdDate,
      targetRole: courseName,
    };
  });

  const filteredAssessments = assessments.filter((a) => {
    if (activeTab === "all") return true;
    return a.status === activeTab;
  });

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="flex items-center justify-between rounded-xl border border-success-200 bg-success-50/90 px-4 py-3 text-xs font-semibold text-success-800 shadow-2xs backdrop-blur-2xs transition-all animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-success-600" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="rounded-lg p-1 text-success-700 hover:bg-success-100 cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Top Header: Title & "+ Create assessment" button */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text">Assessments</h2>
          <p className="text-xs text-muted">
            {isLocationAdmin
              ? "Review and audit all scheduled, live, and completed interview assessments."
              : "Create, schedule and manage assessments with status."}
          </p>
        </div>

        {!isLocationAdmin && (
          <Button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-primary-600 font-medium text-white shadow-xs hover:bg-primary-700"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Create assessment</span>
          </Button>
        )}
      </div>

      {/* Filter Tabs matching Design Board: All (3), Draft (1), Scheduled (1), Live (1), Completed (0) */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { key: "all", label: "All", count: assessments.length },
          { key: "draft", label: "Draft", count: assessments.filter((a) => a.status === "draft").length },
          { key: "scheduled", label: "Scheduled", count: assessments.filter((a) => a.status === "scheduled").length },
          { key: "live", label: "Live", count: assessments.filter((a) => a.status === "live").length },
          { key: "completed", label: "Completed", count: assessments.filter((a) => a.status === "completed").length },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as FilterTab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary-50 text-primary-700 shadow-2xs font-bold"
                : "text-muted hover:bg-surface-muted hover:text-text"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Cards List Layout matching Screen 2 */}
      <div className="space-y-3">
        {examsQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface p-12 text-center text-xs text-muted gap-3 shadow-xs">
            <Loader2 className="size-6 animate-spin text-primary-600" />
            <span className="font-medium">Loading assessments...</span>
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted">
            No assessments found in this status.
          </div>
        ) : (
          filteredAssessments.map((item) => {
            const isMenuOpen = menuOpenId === item.id;
            const progress =
              item.status === "live"
                ? Math.round(((item.started ?? 0) / item.total) * 100)
                : item.submitted
                  ? Math.round((item.submitted / item.total) * 100)
                  : 0;

            return (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between gap-4 rounded-2xl border border-border/80 bg-gradient-to-r from-surface via-surface to-surface-muted/30 p-5 shadow-xs transition-all hover:border-primary-300 hover:shadow-md sm:flex-row sm:items-center"
              >
                {/* Left info */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      to={`${baseExamPath}/${item.id}`}
                      className="text-base font-bold text-text transition-colors hover:text-primary-600"
                    >
                      {item.title}
                    </Link>

                    <AssessmentStatusBadge status={item.status} />

                    {item.targetRole && (
                      <span className="rounded-md bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-800 border border-primary-200/60">
                        Target: {item.targetRole}
                      </span>
                    )}
                  </div>

                  {/* Metadata Row: Course, Created By, Created Date, Questions, Duration */}
                  <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 text-xs text-muted">
                    <span className="font-semibold text-text">{item.course}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-text/80">
                      <UserCheck className="size-3.5 text-primary-600" />
                      <span>Created by: <strong>{item.createdBy || "Priya Sharma"}</strong></span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3.5 text-muted" />
                      <span>{item.createdDate || "12 Jan 2026"}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <HelpCircle className="size-3.5 text-muted" />
                      {item.questions} questions
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5 text-muted" />
                      {item.duration_min} min
                    </span>
                  </div>
                </div>

                {/* Right Progress & Actions */}
                <div className="flex items-center gap-4 shrink-0">
                  {/* Progress info */}
                  <div className="flex w-36 flex-col text-right">
                    <span className="text-xs font-semibold text-text">
                      {item.status === "live"
                        ? `${item.started ?? 0}/${item.total} screening`
                        : `${item.submitted ?? item.total}/${item.total} completed`}
                    </span>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-muted border border-border/40">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.status === "live"
                            ? "bg-gradient-to-r from-primary-500 to-primary-600"
                            : "bg-gradient-to-r from-emerald-500 to-teal-500"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {item.status === "draft" ? (
                    <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5 font-bold shadow-xs cursor-pointer">
                      <Link to={`${baseExamPath}/${item.id}?publish=true`}>
                        <Send className="size-3" />
                        <span>Publish</span>
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="secondary" className="text-xs h-8">
                      <Link to={`${baseExamPath}/${item.id}`}>
                        Manage
                      </Link>
                    </Button>
                  )}

                  {/* Kebab action dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpenId(isMenuOpen ? null : item.id)}
                      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-text cursor-pointer"
                      aria-label="Actions"
                    >
                      <MoreVertical className="size-4.5" />
                    </button>

                    {isMenuOpen && (
                      <div
                        className="absolute right-0 top-8 z-30 w-48 rounded-xl border border-border bg-surface py-1 shadow-lg"
                        role="menu"
                      >
                        {item.status === "draft" && (
                          <Link
                            to={`${baseExamPath}/${item.id}?publish=true`}
                            onClick={() => setMenuOpenId(null)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            <Send className="size-3.5 text-emerald-600" />
                            <span>Publish & Schedule</span>
                          </Link>
                        )}
                        <Link
                          to={`${baseExamPath}/${item.id}`}
                          onClick={() => setMenuOpenId(null)}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-muted"
                        >
                          <Users className="size-3.5 text-primary-600" />
                          <span>Candidates & Proctoring</span>
                        </Link>
                        <Link
                          to={`${baseExamPath}/${item.id}/results`}
                          onClick={() => setMenuOpenId(null)}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-muted"
                        >
                          <BarChart2 className="size-3.5 text-info-700" />
                          <span>Results & Analysis</span>
                        </Link>
                        <Link
                          to={`${baseExamPath}/${item.id}`}
                          onClick={() => setMenuOpenId(null)}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-surface-muted"
                        >
                          <Eye className="size-3.5 text-muted" />
                          <span>Assessment Details</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* "+ Create Assessment" Modal Dialog */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-semibold text-text">Create New Assessment</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded p-1 text-muted hover:bg-surface-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <CoursePicker value={courseId} onChange={setCourseId} />

              <div>
                <Label htmlFor="modal-title">Assessment Title</Label>
                <Input
                  id="modal-title"
                  placeholder="e.g. Unit test 3 - Applied Concepts"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="modal-duration">Duration (minutes)</Label>
                  <Input
                    id="modal-duration"
                    type="number"
                    min={1}
                    value={duration}
                    onChange={(e) => setDuration(+e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="modal-threshold">Red-flag limit (seconds, 3-5s)</Label>
                  <Input
                    id="modal-threshold"
                    type="number"
                    min={3}
                    max={5}
                    step={0.5}
                    value={threshold}
                    onChange={(e) => setThreshold(+e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="modal-start">Window Opens</Label>
                  <Input id="modal-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="modal-end">Window Closes</Label>
                  <Input id="modal-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 text-xs text-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={shuffle}
                  onChange={(e) => setShuffle(e.target.checked)}
                  className="size-4 rounded accent-primary-600"
                />
                <span>Shuffle questions and options for candidate integrity</span>
              </label>

              {create.isError && <ErrorState message={errorMessage(create.error)} />}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!title.trim() || create.isPending}
                  className="bg-primary-600 hover:bg-primary-700 text-white gap-1.5 font-semibold cursor-pointer disabled:opacity-60"
                >
                  {create.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Creating Assessment...</span>
                    </>
                  ) : (
                    <span>Create assessment</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


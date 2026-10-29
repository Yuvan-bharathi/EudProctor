import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Mail,
  Maximize2,
  Minimize2,
  Pencil,
  Phone,
  Plus,
  Radio,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { AssessmentStatusBadge } from "@/components/AssessmentStatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CoursePicker } from "@/features/mentor/CoursePicker";
import { ProctoringTab } from "@/features/proctoring/ProctoringTab";
import {
  type AIQuestionSuggestion,
  convertAIQuestionsToQuestions,
  generateAIQuestions,
} from "@/lib/aiQuestionGenerator";
import { api, errorMessage } from "@/lib/api";
import {
  convertToQuestions,
  downloadSampleQuestionsTemplate,
  type ParsedQuestionRow,
  parseQuestionsFromFile,
  downloadSampleCandidatesTemplate,
  type ParsedCandidateRow,
  parseCandidatesFromFile,
} from "@/lib/excelHelper";
import {
  getPersistedAssessments,
  mockAssignmentsList,
  mockCandidatesList,
  type LiveCandidateRow,
  mockLiveCandidates,
  mockQuestionsList,
  publishAndScheduleAssessment,
  saveExamDetailToStorage,
} from "@/lib/mockData";
import { type Assignment, difficultyLabel, type ExamDetail, type Question } from "@/lib/types";

export type WorkspaceTab = "overview" | "questions" | "candidates" | "settings" | "proctoring";

interface AssessmentWorkspaceProps {
  initialTab?: WorkspaceTab;
}

export function AssessmentWorkspace({ initialTab = "overview" }: AssessmentWorkspaceProps) {
  const { examId = "ut-3" } = useParams();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [fullScreen, setFullScreen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Exam details query
  const examQuery = useQuery({
    queryKey: ["exam", examId],
    queryFn: () => api<ExamDetail>(`/exams/${examId}`),
  });

  const exam = examQuery.data;
  usePageTitle(`${exam?.title ?? "Assessment Management"} · EduProctor`);

  // State for questions (CRUD)
  const [questions, setQuestions] = useState<Question[]>(() => {
    return exam?.questions?.length ? exam.questions : mockQuestionsList;
  });

  // State for enrolled candidates (CRUD)
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    return exam?.assignments?.length ? exam.assignments : mockAssignmentsList;
  });

  const [searchParams] = useSearchParams();
  const shouldOpenPublishFromUrl = searchParams.get("publish") === "true";

  // Assessment status tracking & sync
  const [assessmentStatus, setAssessmentStatus] = useState<string>(() => {
    const list = getPersistedAssessments();
    const found = list.find((a) => a.id === examId);
    const rawCardStatus = (exam as unknown as { card_status?: string })?.card_status;
    return found?.status ?? (rawCardStatus ?? (exam?.status === "closed" ? "completed" : exam?.status === "scheduled" ? "scheduled" : "draft"));
  });

  const [assessmentCard, setAssessmentCard] = useState(() => {
    const list = getPersistedAssessments();
    return list.find((a) => a.id === examId) || null;
  });

  // State for Publish & Schedule Modal
  const [publishModalOpen, setPublishModalOpen] = useState(shouldOpenPublishFromUrl);
  const tomorrow = new Date(Date.now() + 864e5);
  const pad = (n: number) => String(n).padStart(2, "0");
  const defaultDateStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
  const [scheduleDate, setScheduleDate] = useState(defaultDateStr);
  const [scheduleStartTime, setScheduleStartTime] = useState("10:00");
  const [scheduleEndTime, setScheduleEndTime] = useState("11:00");
  const [sendTestLinkEmails, setSendTestLinkEmails] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    const handleAssessmentUpdate = () => {
      const list = getPersistedAssessments();
      const found = list.find((a) => a.id === examId);
      if (found) {
        setAssessmentStatus(found.status);
        setAssessmentCard(found);
      }
    };
    window.addEventListener("eduproctor_assessments_updated", handleAssessmentUpdate);
    return () => {
      window.removeEventListener("eduproctor_assessments_updated", handleAssessmentUpdate);
    };
  }, [examId]);

  useEffect(() => {
    if (exam) {
      const list = getPersistedAssessments();
      const found = list.find((a) => a.id === examId);
      if (found) {
        setAssessmentStatus(found.status);
        setAssessmentCard(found);
      } else {
        const rawCardStatus = (exam as unknown as { card_status?: string })?.card_status;
        setAssessmentStatus(rawCardStatus ?? (exam.status === "closed" ? "completed" : exam.status === "scheduled" ? "scheduled" : "draft"));
      }
    }
  }, [exam, examId]);

  const handlePublishAndSchedule = (e: FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);

    const startIso = new Date(`${scheduleDate}T${scheduleStartTime}:00`).toISOString();
    const endIso = new Date(`${scheduleDate}T${scheduleEndTime}:00`).toISOString();

    const formattedDate =
      new Date(`${scheduleDate}T${scheduleStartTime}:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }) + `, ${scheduleStartTime} – ${scheduleEndTime}`;

    const res = publishAndScheduleAssessment(examId, {
      scheduledDate: formattedDate,
      windowStart: startIso,
      windowEnd: endIso,
      sendTestLinkEmails,
    });

    setAssessmentStatus(res.assessment.status);
    setAssessmentCard(res.assessment);
    qc.invalidateQueries({ queryKey: ["exam", examId] });
    qc.invalidateQueries({ queryKey: ["exams"] });
    setIsPublishing(false);
    setPublishModalOpen(false);

    showToast(
      `Assessment scheduled for ${formattedDate}! AI Email Sending Agent dispatched test links to ${res.dispatchedEmailsCount} candidate(s).`
    );
  };

  // Sync state whenever exam data loads or changes from storage/query
  useEffect(() => {
    if (exam?.questions !== undefined) {
      setQuestions(exam.questions);
    }
    if (exam?.assignments !== undefined) {
      setAssignments(exam.assignments);
    }
    if (exam?.title) setSettingsTitle(exam.title);
    if (exam?.course_name) setSettingsCourse(exam.course_name);
    if (exam?.duration_min) setSettingsDuration(exam.duration_min);
    if (exam?.flag_threshold_s) setSettingsThreshold(exam.flag_threshold_s);
    if (exam?.shuffle !== undefined) setSettingsShuffle(exam.shuffle);
  }, [exam]);

  // State for candidate removal confirmation
  const [candidateToRemove, setCandidateToRemove] = useState<Assignment | null>(null);

  // State for adding candidate modal
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [addSearch, setAddSearch] = useState("");
  const [autoSendLinks, setAutoSendLinks] = useState(true);

  // Subview toggle in Candidates tab: "roster" vs "telemetry"
  const [candidateSubView, setCandidateSubView] = useState<"roster" | "telemetry">("roster");

  // State for Candidate Excel Upload Modal
  const [candidateExcelModalOpen, setCandidateExcelModalOpen] = useState(false);
  const [parsedCandidateRows, setParsedCandidateRows] = useState<ParsedCandidateRow[]>([]);
  const [isParsingCandidateExcel, setIsParsingCandidateExcel] = useState(false);
  const [candidateExcelError, setCandidateExcelError] = useState<string | null>(null);
  const candidateFileInputRef = useRef<HTMLInputElement>(null);

  // State for candidate search & filter in candidates tab
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateStatusFilter, setCandidateStatusFilter] = useState("all");

  // State for Live Stream Filter inside Candidates tab
  const [liveSearch, setLiveSearch] = useState("");
  const [liveStatusFilter, setLiveStatusFilter] = useState("all");

  // Modals for Questions:
  // 1. Add Custom Question Modal
  const [customQuestionModalOpen, setCustomQuestionModalOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [customBody, setCustomBody] = useState("");
  const [customTopic, setCustomTopic] = useState("Full Stack Development");
  const [customMarks, setCustomMarks] = useState(2);
  const [customDifficulty, setCustomDifficulty] = useState<1 | 2 | 3>(2);
  const [customOptionA, setCustomOptionA] = useState("");
  const [customOptionB, setCustomOptionB] = useState("");
  const [customOptionC, setCustomOptionC] = useState("");
  const [customOptionD, setCustomOptionD] = useState("");
  const [customCorrectKey, setCustomCorrectKey] = useState<"A" | "B" | "C" | "D">("A");
  const [customExplanation, setCustomExplanation] = useState("");

  // 2. AI Question Suggestions Modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTopicInput, setAiTopicInput] = useState("Full Stack Development");
  const [aiQuestions, setAiQuestions] = useState<AIQuestionSuggestion[]>([]);
  const [selectedAiIds, setSelectedAiIds] = useState<Set<string>>(new Set());
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // 3. Excel File Upload Modal
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [parsedExcelRows, setParsedExcelRows] = useState<ParsedQuestionRow[]>([]);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 4. Assessment Settings Form State
  const [settingsTitle, setSettingsTitle] = useState(exam?.title ?? "Unit test 3 - Applied Concepts");
  const [settingsCourse, setSettingsCourse] = useState(exam?.course_name ?? "Full Stack Development");
  const [settingsDuration, setSettingsDuration] = useState(exam?.duration_min ?? 60);
  const [settingsThreshold, setSettingsThreshold] = useState(exam?.flag_threshold_s ?? 3);
  const [settingsShuffle, setSettingsShuffle] = useState(exam?.shuffle ?? true);
  const [settingsPassPct, setSettingsPassPct] = useState(50);

  // Filtered enrolled candidates
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const q = candidateSearch.toLowerCase();
      const matchesSearch =
        a.candidate_name.toLowerCase().includes(q) ||
        a.candidate_email.toLowerCase().includes(q) ||
        (a.status && a.status.toLowerCase().includes(q));

      if (candidateStatusFilter === "all") return matchesSearch;
      return matchesSearch && a.status?.toLowerCase() === candidateStatusFilter.toLowerCase();
    });
  }, [assignments, candidateSearch, candidateStatusFilter]);

  // Cohort candidates eligible to be added
  const assignedCandidateIds = useMemo(() => new Set(assignments.map((a) => a.candidate_id)), [assignments]);

  const eligibleCohortStudents = useMemo(() => {
    return mockCandidatesList.filter((c) => {
      const q = addSearch.toLowerCase();
      const matchesSearch = c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
      const isNotAlreadyAdded = !assignedCandidateIds.has(c.id);
      return matchesSearch && isNotAlreadyAdded;
    });
  }, [addSearch, assignedCandidateIds]);

  // Live monitor filtered list
  const liveCandidates: LiveCandidateRow[] = mockLiveCandidates;
  const filteredLiveCandidates = useMemo(() => {
    return liveCandidates.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(liveSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(liveSearch.toLowerCase());
      const matchesFilter = liveStatusFilter === "all" || c.status.toLowerCase() === liveStatusFilter.toLowerCase();
      return matchesSearch && matchesFilter;
    });
  }, [liveCandidates, liveSearch, liveStatusFilter]);

  // Dispatch links mutation
  const sendLinksMutation = useMutation({
    mutationFn: () => api(`/exams/${examId}/send-links`, { body: {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam", examId] });
      showToast("Single-use assessment links dispatched to all candidates.");
    },
  });

  // Candidate Actions: Add
  const handleToggleStudentSelection = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmAddStudents = (e: FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.size === 0) return;

    const newAssignments: Assignment[] = [];
    for (const studentId of selectedStudentIds) {
      const student = mockCandidatesList.find((c) => c.id === studentId);
      if (student) {
        newAssignments.push({
          id: `asg-${Date.now()}-${student.id}`,
          candidate_id: student.id,
          candidate_name: student.name,
          candidate_email: student.email,
          link_sent_at: autoSendLinks ? new Date().toISOString() : null,
          link_used_at: null,
          link_expires_at: new Date(Date.now() + 864e5).toISOString(),
          accommodations: {},
          status: "Not started",
          score_pct: null,
          flags: 0,
          glances: 0,
          session_id: `s-${student.id}`,
        });
      }
    }

    const updatedAssignments = [...assignments, ...newAssignments];
    setAssignments(updatedAssignments);
    saveExamDetailToStorage(examId, { assignments: updatedAssignments });
    setSelectedStudentIds(new Set());
    setAddStudentModalOpen(false);
    showToast(`Added ${newAssignments.length} student(s) to this assessment.`);
  };

  // Candidate Actions: Remove (CRUD)
  const handleRemoveCandidate = (assignment: Assignment) => {
    const updatedAssignments = assignments.filter((a) => a.id !== assignment.id);
    setAssignments(updatedAssignments);
    saveExamDetailToStorage(examId, { assignments: updatedAssignments });
    setCandidateToRemove(null);
    showToast(`Removed ${assignment.candidate_name} from this assessment.`);
  };

  // Questions Actions: Custom Question Create / Edit
  const handleOpenAddCustomQuestion = () => {
    setEditingQuestionId(null);
    setCustomBody("");
    setCustomTopic(exam?.course_name ?? "Full Stack Development");
    setCustomMarks(2);
    setCustomDifficulty(2);
    setCustomOptionA("");
    setCustomOptionB("");
    setCustomOptionC("");
    setCustomOptionD("");
    setCustomCorrectKey("A");
    setCustomExplanation("");
    setCustomQuestionModalOpen(true);
  };

  const handleOpenEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setCustomBody(q.body);
    setCustomTopic(q.subtopic ?? exam?.course_name ?? "Full Stack Development");
    setCustomMarks(q.marks);
    setCustomDifficulty(q.difficulty as 1 | 2 | 3);
    setCustomOptionA(q.options[0]?.text ?? "");
    setCustomOptionB(q.options[1]?.text ?? "");
    setCustomOptionC(q.options[2]?.text ?? "");
    setCustomOptionD(q.options[3]?.text ?? "");
    const correctOpt = q.options.find((o) => o.is_correct);
    setCustomCorrectKey((correctOpt?.key as "A" | "B" | "C" | "D") ?? "A");
    setCustomExplanation(q.answer_text ?? "");
    setCustomQuestionModalOpen(true);
  };

  const handleSaveCustomQuestion = (e: FormEvent) => {
    e.preventDefault();
    if (!customBody.trim() || !customOptionA.trim() || !customOptionB.trim()) return;

    if (editingQuestionId) {
      // Update existing question
      const updated = questions.map((q) => {
        if (q.id === editingQuestionId) {
          return {
            ...q,
            body: customBody.trim(),
            subtopic: customTopic.trim(),
            marks: customMarks,
            difficulty: customDifficulty,
            answer_text: customExplanation.trim() || null,
            options: [
              { id: `${q.id}-opt-a`, key: "A", text: customOptionA.trim(), is_correct: customCorrectKey === "A", misconception_id: null },
              { id: `${q.id}-opt-b`, key: "B", text: customOptionB.trim(), is_correct: customCorrectKey === "B", misconception_id: null },
              { id: `${q.id}-opt-c`, key: "C", text: customOptionC.trim(), is_correct: customCorrectKey === "C", misconception_id: null },
              { id: `${q.id}-opt-d`, key: "D", text: customOptionD.trim(), is_correct: customCorrectKey === "D", misconception_id: null },
            ],
          };
        }
        return q;
      });
      setQuestions(updated);
      saveExamDetailToStorage(examId, { questions: updated });
      showToast("Question updated successfully.");
    } else {
      // Create new question
      const newQuestion: Question = {
        id: `q-custom-${Date.now()}`,
        course_id: "c1",
        topic_id: "t1",
        subtopic: customTopic.trim() || exam?.course_name || "Full Stack Development",
        type: "mcq",
        difficulty: customDifficulty,
        marks: customMarks,
        body: customBody.trim(),
        answer_text: customExplanation.trim() || null,
        status: "approved",
        source: "mentor",
        agent_run_id: null,
        options: [
          { id: `opt-a-${Date.now()}`, key: "A", text: customOptionA.trim(), is_correct: customCorrectKey === "A", misconception_id: null },
          { id: `opt-b-${Date.now()}`, key: "B", text: customOptionB.trim(), is_correct: customCorrectKey === "B", misconception_id: null },
          { id: `opt-c-${Date.now()}`, key: "C", text: customOptionC.trim(), is_correct: customCorrectKey === "C", misconception_id: null },
          { id: `opt-d-${Date.now()}`, key: "D", text: customOptionD.trim(), is_correct: customCorrectKey === "D", misconception_id: null },
        ],
      };
      const updated = [newQuestion, ...questions];
      setQuestions(updated);
      saveExamDetailToStorage(examId, { questions: updated });
      showToast("Custom question added to assessment.");
    }

    setCustomQuestionModalOpen(false);
  };

  const handleDeleteQuestion = (questionId: string) => {
    const updated = questions.filter((q) => q.id !== questionId);
    setQuestions(updated);
    saveExamDetailToStorage(examId, { questions: updated });
    showToast("Question removed from assessment.");
  };

  // Questions Actions: AI Agent Recommendations
  const handleOpenAiModal = () => {
    setAiTopicInput(exam?.course_name ? `${exam.course_name} Architecture` : "Full Stack Development");
    setAiQuestions([]);
    setSelectedAiIds(new Set());
    setAiModalOpen(true);
  };

  const handleGenerateAiQuestions = () => {
    setIsGeneratingAi(true);
    setTimeout(() => {
      const generated = generateAIQuestions(aiTopicInput, 3);
      setAiQuestions(generated);
      setSelectedAiIds(new Set(generated.map((g) => g.id)));
      setIsGeneratingAi(false);
    }, 600);
  };

  const handleAddAiQuestionsToAssessment = () => {
    const selected = aiQuestions.filter((q) => selectedAiIds.has(q.id));
    if (selected.length === 0) return;

    const converted = convertAIQuestionsToQuestions(selected, "c1");
    const updated = [...converted, ...questions];
    setQuestions(updated);
    saveExamDetailToStorage(examId, { questions: updated });
    setAiModalOpen(false);
    showToast(`Added ${selected.length} AI-recommended question(s) to assessment.`);
  };

  // Questions Actions: Excel Upload
  const handleOpenExcelModal = () => {
    setParsedExcelRows([]);
    setExcelError(null);
    setExcelModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingExcel(true);
    setExcelError(null);
    try {
      const rows = await parseQuestionsFromFile(file);
      setParsedExcelRows(rows);
    } catch (err) {
      setExcelError(err instanceof Error ? err.message : "Failed to parse spreadsheet file.");
    } finally {
      setIsParsingExcel(false);
    }
  };

  const handleImportParsedExcelQuestions = () => {
    if (parsedExcelRows.length === 0) return;
    const converted = convertToQuestions(parsedExcelRows, "c1");
    const updated = [...converted, ...questions];
    setQuestions(updated);
    saveExamDetailToStorage(examId, { questions: updated });
    setExcelModalOpen(false);
    showToast(`Successfully imported ${converted.length} question(s) from Excel.`);
  };

  // Candidates Actions: Excel Upload
  const handleCandidateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingCandidateExcel(true);
    setCandidateExcelError(null);
    try {
      const rows = await parseCandidatesFromFile(file);
      setParsedCandidateRows(rows);
    } catch (err) {
      setCandidateExcelError(err instanceof Error ? err.message : "Failed to parse candidate spreadsheet.");
    } finally {
      setIsParsingCandidateExcel(false);
    }
  };

  const handleImportParsedCandidates = () => {
    if (parsedCandidateRows.length === 0) return;

    const newAssignments: Assignment[] = parsedCandidateRows.map((row, idx) => ({
      id: `a-xl-${Date.now()}-${idx}`,
      candidate_id: `cand-xl-${Date.now()}-${idx}`,
      candidate_name: row.name,
      candidate_email: row.email,
      candidate_phone: row.phone,
      status: "Not started",
      score_pct: null,
      flags: 0,
      glances: 0,
      session_id: `s-xl-${idx}`,
      link_sent_at: new Date().toISOString(),
      link_used_at: null,
      link_expires_at: null,
      accommodations: {},
    }));

    const updated = [...newAssignments, ...assignments];
    setAssignments(updated);
    saveExamDetailToStorage(examId, { assignments: updated });
    setCandidateExcelModalOpen(false);
    setParsedCandidateRows([]);
    showToast(`Successfully enrolled ${newAssignments.length} candidate(s) from Excel.`);
  };

  // Settings Save
  const handleSaveSettings = (e: FormEvent) => {
    e.preventDefault();
    saveExamDetailToStorage(examId, {
      title: settingsTitle,
      course_name: settingsCourse,
      duration_min: settingsDuration,
      flag_threshold_s: settingsThreshold,
      shuffle: settingsShuffle,
    });
    qc.invalidateQueries({ queryKey: ["exam", examId] });
    qc.invalidateQueries({ queryKey: ["exams"] });
    showToast("Assessment configuration and proctoring parameters saved.");
  };

  if (examQuery.isPending) {
    return <LoadingState label="Loading assessment workspace..." />;
  }

  if (examQuery.isError || !exam) {
    return (
      <ErrorState
        message={errorMessage(examQuery.error) || "Could not load assessment details."}
        onRetry={() => examQuery.refetch()}
      />
    );
  }

  const durationMinutes = exam.duration_min ?? (exam as unknown as { duration_minutes?: number }).duration_minutes ?? 60;
  const courseName = exam.course_name ?? "Full Stack Development";

  const completedCount = assignments.filter((a) => a.status === "Completed").length;
  const inProgressCount = assignments.filter((a) => a.status === "In progress").length;

  return (
    <div className={`space-y-6 ${fullScreen ? "fixed inset-0 z-50 overflow-y-auto bg-bg p-6" : ""}`}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="flex items-center justify-between rounded-xl border border-success-200 bg-success-50 px-4 py-2.5 text-xs font-semibold text-success-800 shadow-sm animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success-600" />
            {toastMessage}
          </span>
          <button type="button" onClick={() => setToastMessage(null)} className="text-success-800 hover:text-text">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Top Header with Back Button, Title, Status & Fullscreen Toggle */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Link
            to="/mentor/exams"
            className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-surface-muted hover:text-text shadow-2xs"
            aria-label="Back to assessments"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold tracking-tight text-text">{settingsTitle}</h2>
              <AssessmentStatusBadge status={assessmentStatus} />
            </div>
            <p className="text-xs text-muted">
              {settingsCourse} • {questions.length} questions • {durationMinutes} min
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {assessmentStatus === "draft" && (
            <Button
              onClick={() => setPublishModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
            >
              <Send className="size-3.5" />
              <span>Publish & Schedule</span>
            </Button>
          )}

          {assessmentStatus === "scheduled" && (
            <Button
              variant="secondary"
              onClick={() => setPublishModalOpen(true)}
              className="flex items-center gap-1.5 border-blue-200 bg-blue-50/60 text-xs font-semibold text-blue-800 hover:bg-blue-100 cursor-pointer"
            >
              <Calendar className="size-3.5 text-blue-600" />
              <span>Reschedule / Re-send Links</span>
            </Button>
          )}

          {assessmentStatus === "live" && (
            <Button
              variant="secondary"
              onClick={() => setActiveTab("candidates")}
              className="flex items-center gap-1.5 border-emerald-200 bg-emerald-50/60 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
            >
              <Radio className="size-3.5 text-emerald-600 animate-pulse" />
              <span>Live Screening Active</span>
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setFullScreen(!fullScreen)}
            className="flex items-center gap-1.5 text-xs text-text shadow-2xs"
          >
            {fullScreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            <span>{fullScreen ? "Exit full screen" : "Open in full screen"}</span>
          </Button>
        </div>
      </div>

      {/* Subtabs Bar: Overview | Questions | Candidates & Telemetry | Settings */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border pb-1">
        {[
          { key: "overview", label: "Overview" },
          { key: "questions", label: `Questions (${questions.length})` },
          { key: "candidates", label: `Candidates & Telemetry (${assignments.length})` },
          { key: "settings", label: "Settings" },
          { key: "proctoring", label: "Proctoring" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as WorkspaceTab)}
            className={`border-b-2 px-3.5 py-2 text-xs font-semibold transition-colors ${
              activeTab === tab.key
                ? "border-primary-600 text-primary-700 font-bold"
                : "border-transparent text-muted hover:text-text hover:bg-surface-muted/50 rounded-t-lg"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Draft Notification & Publish Prompt Banner */}
          {assessmentStatus === "draft" && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl border border-primary-200 bg-primary-50/50 p-4 gap-3 shadow-2xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-primary-900">
                  <Send className="size-4 text-primary-700" />
                  <span>Assessment is in Draft Status</span>
                </div>
                <p className="text-xs text-primary-800">
                  You have configured <strong>{questions.length} questions</strong> and enrolled <strong>{assignments.length} candidates</strong>.
                  Click <em>Publish & Schedule</em> to select the examination date/time and dispatch secure test link emails.
                </p>
              </div>
              <Button
                onClick={() => setPublishModalOpen(true)}
                className="shrink-0 bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs cursor-pointer"
              >
                <Send className="size-3.5 mr-1.5" />
                <span>Publish & Schedule</span>
              </Button>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Enrolled Students</span>
                <Users className="size-4 text-primary-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-text">{assignments.length}</div>
              <p className="mt-0.5 text-[11px] text-muted">{courseName} cohort</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Completed Submissions</span>
                <CheckCircle2 className="size-4 text-success-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-success-700">{completedCount}</div>
              <p className="mt-0.5 text-[11px] text-success-700 font-medium">Ready for AI evaluation</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Active in Exam Room</span>
                <Radio className="size-4 text-primary-600 animate-pulse" />
              </div>
              <div className="mt-2 text-2xl font-bold text-text">{inProgressCount}</div>
              <p className="mt-0.5 text-[11px] text-muted">Streaming live telemetry</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Average Performance</span>
                <Award className="size-4 text-info-700" />
              </div>
              <div className="mt-2 text-2xl font-bold text-text">83%</div>
              <p className="mt-0.5 text-[11px] text-muted">Passing threshold: 50%</p>
            </div>
          </div>

          {/* Assessment Specifications & Safeguards */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="space-y-4 p-6 shadow-2xs">
              <CardTitle className="text-base font-bold text-text">Assessment Specifications</CardTitle>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <span className="text-muted">Status</span>
                  <AssessmentStatusBadge status={assessmentStatus} size="sm" />
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted">Target Course</span>
                  <span className="font-semibold text-text">{settingsCourse}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted">Examination Window</span>
                  <span className="font-semibold text-text">
                    {assessmentCard?.scheduledDate || (assessmentStatus === "draft" ? "Not scheduled yet (Draft)" : "Jan 15, 10:00 AM – Jan 15, 11:00 AM")}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted">Allocated Duration</span>
                  <span className="font-semibold text-text">{durationMinutes} minutes</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted">Total Paper Marks</span>
                  <span className="font-semibold text-text">{questions.reduce((sum, q) => sum + q.marks, 0)} marks</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Delivery Security</span>
                  <span className="font-semibold text-success-700">Randomized Questions & Options</span>
                </div>
              </div>
            </Card>

            <Card className="space-y-4 p-6 shadow-2xs">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-text">
                <ShieldCheck className="size-5 text-primary-600" />
                <span>Non-Punitive Proctoring Standards</span>
              </CardTitle>
              <p className="text-xs text-muted leading-relaxed">
                EduProctor maintains academic integrity while strictly preventing exam trauma. Proctoring flags are non-punitive:
              </p>
              <ul className="space-y-2 text-xs text-muted">
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-success-600" />
                  <span>Look-away red flag triggers after {settingsThreshold} continuous seconds of head/gaze deviation.</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-success-600" />
                  <span>Candidate-facing flag notifications are strictly capped at 3; tests are never terminated automatically.</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-3.5 text-success-600" />
                  <span>Full evidence snapshots and gaze telemetry are restricted solely to the Mentor review dashboard.</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: QUESTIONS (CRUD + CUSTOM QUESTIONS + AI RECOMMENDATIONS + EXCEL UPLOAD) */}
      {activeTab === "questions" && (
        <div className="space-y-4 animate-in fade-in">
          {/* Top Questions Action Bar */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-base font-bold text-text">Question Bank & Structure</h3>
              <p className="text-xs text-muted">
                Manage, author, or import MCQs. Questions will be delivered in randomized order to students.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={downloadSampleQuestionsTemplate}
                className="gap-1.5 text-xs shadow-2xs"
                title="Download an Excel .xlsx question template"
              >
                <Download className="size-3.5" />
                <span>Template</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenExcelModal}
                className="gap-1.5 text-xs text-primary-700 shadow-2xs hover:text-primary-800"
              >
                <FileSpreadsheet className="size-3.5 text-success-600" />
                <span>Upload Excel / CSV</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenAiModal}
                className="gap-1.5 text-xs font-semibold text-ai-700 shadow-2xs hover:bg-ai-50"
              >
                <Sparkles className="size-3.5 text-ai-600" />
                <span>AI Recommend</span>
              </Button>

              <Button
                size="sm"
                onClick={handleOpenAddCustomQuestion}
                className="gap-1.5 bg-primary-600 font-semibold text-white shadow-xs hover:bg-primary-700"
              >
                <Plus className="size-4" />
                <span>Add Question</span>
              </Button>
            </div>
          </div>

          {/* Questions List */}
          {questions.length === 0 ? (
            <EmptyState
              message="No questions in this assessment yet. Add a custom question, generate with AI, or upload an Excel file."
              action={
                <Button size="sm" onClick={handleOpenAddCustomQuestion} className="mt-2">
                  <Plus className="size-4 mr-1.5" /> Add First Question
                </Button>
              }
            />
          ) : (
            <div className="space-y-3.5">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-border bg-surface p-4 shadow-2xs transition-all hover:border-primary-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary-700">Q{idx + 1}.</span>
                        <span className="rounded bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted">
                          {difficultyLabel[q.difficulty] ?? "Medium"}
                        </span>
                        <span className="rounded bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
                          {q.marks} mark{q.marks > 1 ? "s" : ""}
                        </span>
                        {q.subtopic && (
                          <span className="text-xs text-muted">• {q.subtopic}</span>
                        )}
                        {q.source === "agent" && (
                          <span className="inline-flex items-center gap-1 rounded bg-ai-50 px-1.5 py-0.5 text-[10px] font-semibold text-ai-700">
                            <Sparkles className="size-3" /> AI Generated
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-text pt-1">{q.body}</p>
                    </div>

                    {/* Question Actions: Edit & Delete */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditQuestion(q)}
                        className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-text transition-colors"
                        title="Edit question"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="rounded-lg p-1.5 text-muted hover:bg-danger-50 hover:text-danger-700 transition-colors"
                        title="Delete question"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 4 Options Preview */}
                  {q.options && q.options.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {q.options.map((opt) => (
                        <div
                          key={opt.id}
                          className={`flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs ${
                            opt.is_correct
                              ? "border-success-400 bg-success-50 text-success-900 font-semibold"
                              : "border-border bg-surface-muted/40 text-muted"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">{opt.key}.</span>
                            <span>{opt.text}</span>
                          </div>
                          {opt.is_correct && (
                            <span className="text-[10px] text-success-700 font-semibold">(Correct Answer)</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Explanation Note */}
                  {q.answer_text && (
                    <div className="mt-2 rounded-lg border border-border bg-surface-muted/40 p-2 text-[11px] text-muted">
                      <span className="font-semibold text-text">Concept note:</span> {q.answer_text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CANDIDATES & TELEMETRY (CONSOLIDATED CANDIDATE ROSTER, REALTIME TELEMETRY & EXCEL IMPORT) */}
      {activeTab === "candidates" && (
        <div className="space-y-5 animate-in fade-in">
          {/* Top Live Telemetry Counters Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>In Progress</span>
                <span className="size-2 rounded-full bg-success-500 animate-pulse" />
              </div>
              <div className="mt-2 text-2xl font-bold text-text">
                {assignments.filter((a) => a.status === "In progress").length || 21}
              </div>
              <div className="text-[11px] font-semibold text-primary-700">Active Live Streams</div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Not Started</span>
                <span className="size-2 rounded-full bg-muted" />
              </div>
              <div className="mt-2 text-2xl font-bold text-text">
                {assignments.filter((a) => a.status === "Not started").length || 6}
              </div>
              <div className="text-[11px] font-medium text-muted">Links Dispatched</div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Completed</span>
                <CheckCircle2 className="size-3.5 text-success-600" />
              </div>
              <div className="mt-2 text-2xl font-bold text-text">
                {assignments.filter((a) => a.status === "Completed").length || 5}
              </div>
              <div className="text-[11px] font-semibold text-success-700">Evaluated & Ready</div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Integrity Standard</span>
                <ShieldCheck className="size-3.5 text-primary-600" />
              </div>
              <div className="mt-2 text-base font-bold text-text">Max 3 Flags</div>
              <div className="text-[11px] text-muted">Capped · Non-punitive</div>
            </div>
          </div>

          {/* Sub-view Switcher: Candidate Roster vs Realtime Telemetry Streams */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCandidateSubView("roster")}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  candidateSubView === "roster"
                    ? "bg-primary-50 text-primary-700 shadow-2xs font-bold"
                    : "text-muted hover:bg-surface-muted hover:text-text"
                }`}
              >
                Candidate Roster ({assignments.length})
              </button>
              <button
                type="button"
                onClick={() => setCandidateSubView("telemetry")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  candidateSubView === "telemetry"
                    ? "bg-primary-50 text-primary-700 shadow-2xs font-bold"
                    : "text-muted hover:bg-surface-muted hover:text-text"
                }`}
              >
                <Radio className="size-3.5 text-danger-500 animate-pulse" />
                <span>Realtime Telemetry ({filteredLiveCandidates.length} Active Streams)</span>
              </button>
            </div>

            {candidateSubView === "roster" && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCandidateExcelModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs border-border shadow-2xs text-text hover:bg-surface-muted"
                >
                  <FileSpreadsheet className="size-3.5 text-success-600" />
                  <span>Import from Excel</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => sendLinksMutation.mutate()}
                  disabled={sendLinksMutation.isPending || assignments.length === 0}
                  className="gap-1.5 text-xs shadow-2xs"
                >
                  <Send className="size-3.5 text-primary-600" />
                  <span>{sendLinksMutation.isPending ? "Sending..." : "Dispatch Links"}</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() => setAddStudentModalOpen(true)}
                  className="flex items-center gap-1.5 bg-primary-600 font-semibold text-white shadow-xs hover:bg-primary-700"
                >
                  <Plus className="size-4" />
                  <span>Add candidate</span>
                </Button>
              </div>
            )}
          </div>

          {/* SUB-VIEW 1: CANDIDATE ROSTER */}
          {candidateSubView === "roster" && (
            <div className="space-y-4">
              {/* Search and Status Filters */}
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Search by name, email, or mobile..."
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-xs text-text placeholder:text-muted focus:border-primary-500 focus:bg-surface focus:outline-hidden"
                  />
                </div>

                <select
                  value={candidateStatusFilter}
                  onChange={(e) => setCandidateStatusFilter(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-surface-muted px-2.5 text-xs text-text focus:border-primary-500 focus:outline-hidden"
                >
                  <option value="all">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="in progress">In progress</option>
                  <option value="not started">Not started</option>
                </select>
              </div>

              {/* Enrolled Candidates Table with Mobile Number */}
              <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-2xs">
                {filteredAssignments.length === 0 ? (
                  <div className="p-8 text-center">
                    <EmptyState
                      message="No candidates match your search."
                      action={
                        <Button size="sm" onClick={() => setAddStudentModalOpen(true)} className="mt-2">
                          <Plus className="size-4 mr-1.5" /> Enroll Candidate
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <Table>
                    <THead>
                      <tr>
                        <TH>Candidate</TH>
                        <TH>Contact Mobile</TH>
                        <TH>Status</TH>
                        <TH>Score</TH>
                        <TH>Red Flags</TH>
                        <TH>Glances</TH>
                        <TH>Link Status</TH>
                        <TH className="text-right">Actions</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {filteredAssignments.map((a) => {
                        const isCompleted = a.status === "Completed";
                        const isInProgress = a.status === "In progress";

                        return (
                          <TR key={a.id} className="transition-colors hover:bg-surface-muted/40">
                            {/* Candidate Details */}
                            <TD>
                              <div className="flex items-center gap-2.5">
                                <div className="flex size-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                                  {a.candidate_name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-xs text-text">{a.candidate_name}</div>
                                  <div className="font-mono text-[11px] text-muted">{a.candidate_email}</div>
                                </div>
                              </div>
                            </TD>

                            {/* Mobile Number */}
                            <TD>
                              <div className="flex items-center gap-1.5 text-xs font-mono text-text">
                                <Phone className="size-3 text-muted shrink-0" />
                                <span>{a.candidate_phone || "+91 98765 43210"}</span>
                              </div>
                            </TD>

                            {/* Status */}
                            <TD>
                              {isCompleted ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-700">
                                  <CheckCircle2 className="size-3" />
                                  Completed
                                </span>
                              ) : isInProgress ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                                  <span className="size-1.5 rounded-full bg-primary-600 animate-pulse" />
                                  In progress
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted">
                                  Not started
                                </span>
                              )}
                            </TD>

                            {/* Score */}
                            <TD>
                              {isCompleted && a.score_pct != null ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs text-text">{a.score_pct}%</span>
                                  <span className="text-[10px] text-muted">(Pass)</span>
                                </div>
                              ) : isInProgress ? (
                                <span className="text-xs text-muted">In exam...</span>
                              ) : (
                                <span className="text-xs text-muted">—</span>
                              )}
                            </TD>

                            {/* Red Flags Capped at 3 */}
                            <TD>
                              {(a.flags ?? 0) > 0 ? (
                                <Badge tone="warning" className="gap-1 font-medium">
                                  <AlertTriangle className="size-3" />
                                  {a.flags} / 3 Capped limit
                                </Badge>
                              ) : (
                                <Badge tone="success" className="gap-1 font-medium">
                                  <CheckCircle2 className="size-3" />
                                  0 / 3 Flags
                                </Badge>
                              )}
                            </TD>

                            {/* Glances */}
                            <TD>
                              <span className="text-xs font-mono text-muted">{a.glances ?? 0} glances</span>
                            </TD>

                            {/* Link */}
                            <TD>
                              {a.link_used_at ? (
                                <span className="inline-flex items-center gap-1 text-xs text-success-700 font-medium">
                                  <CheckCircle2 className="size-3" /> Opened
                                </span>
                              ) : a.link_sent_at ? (
                                <span className="inline-flex items-center gap-1 text-xs text-primary-700 font-medium">
                                  <Mail className="size-3" /> Sent
                                </span>
                              ) : (
                                <span className="text-xs text-muted">Not sent</span>
                              )}
                            </TD>

                            {/* Actions */}
                            <TD className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isCompleted && (
                                  <Button
                                    asChild
                                    size="sm"
                                    className="gap-1 text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 h-8"
                                  >
                                    <Link to={`/mentor/sessions/${a.session_id ?? "s1"}/summary?examId=${examId}`}>
                                      <Sparkles className="size-3.5" />
                                      <span>AI Summary & Publish</span>
                                    </Link>
                                  </Button>
                                )}

                                <Button
                                  asChild
                                  variant="secondary"
                                  size="sm"
                                  className="gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-800 h-8"
                                >
                                  <Link to={`/mentor/sessions/${a.session_id ?? "s1"}`}>
                                    <Eye className="size-3.5" />
                                    <span>Timeline</span>
                                  </Link>
                                </Button>

                                <button
                                  type="button"
                                  onClick={() => setCandidateToRemove(a)}
                                  className="rounded-lg p-1.5 text-muted hover:bg-danger-50 hover:text-danger-700 transition-colors cursor-pointer"
                                  title="Remove candidate from assessment"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* SUB-VIEW 2: REALTIME STREAMING TELEMETRY (INTEGRATED DIRECTLY IN CANDIDATES TAB) */}
          {candidateSubView === "telemetry" && (
            <div className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-2xs">
              {/* Search and Filters Bar */}
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Search active streams by candidate or email..."
                    value={liveSearch}
                    onChange={(e) => setLiveSearch(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-xs text-text placeholder:text-muted focus:border-primary-500 focus:bg-surface focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setLiveStatusFilter(liveStatusFilter === "all" ? "in progress" : "all")}
                    className="flex items-center gap-1.5 text-xs text-muted hover:text-text"
                  >
                    <Filter className="size-3.5" />
                    <span>{liveStatusFilter === "all" ? "All statuses" : "Filter: In progress"}</span>
                  </Button>
                </div>
              </div>

              {/* Candidates Realtime Telemetry Table */}
              <Table>
                <THead>
                  <tr>
                    <TH>Candidate</TH>
                    <TH>Mobile Number</TH>
                    <TH>Status</TH>
                    <TH>Flags (max 3)</TH>
                    <TH>Last Activity</TH>
                    <TH className="text-right">Action</TH>
                  </tr>
                </THead>
                <TBody>
                  {filteredLiveCandidates.map((cand) => (
                    <TR key={cand.id} className="transition-colors hover:bg-surface-muted/50">
                      <TD>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="flex size-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                              {cand.avatar}
                            </div>
                            {cand.status === "In progress" && (
                              <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-surface bg-success-500" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-text">{cand.name}</div>
                            <div className="text-[11px] text-muted">{cand.email}</div>
                          </div>
                        </div>
                      </TD>

                      <TD>
                        <div className="flex items-center gap-1.5 text-xs font-mono text-muted">
                          <Phone className="size-3 text-muted shrink-0" />
                          <span>{cand.phone || "+91 98765 43210"}</span>
                        </div>
                      </TD>

                      <TD>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            cand.status === "In progress"
                              ? "bg-info-50 text-info-700"
                              : cand.status === "Completed"
                                ? "bg-success-50 text-success-700"
                                : "bg-surface-muted text-muted"
                          }`}
                        >
                          {cand.status}
                        </span>
                      </TD>

                      <TD>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${cand.flags > 0 ? "text-danger-700" : "text-muted"}`}>
                            {cand.flags > 0 ? `${cand.flags}/3` : "0"}
                          </span>

                          <div className="flex items-center gap-1">
                            {[1, 2, 3].map((dot) => (
                              <span
                                key={dot}
                                className={`size-2 rounded-full ${
                                  dot <= cand.flags ? "bg-danger-500" : "bg-border-strong"
                                }`}
                              />
                            ))}
                          </div>

                          {cand.isGlancing && (
                            <span className="rounded bg-info-50 px-1.5 py-0.5 text-[10px] font-medium text-info-700">
                              {cand.glanceDetail}
                            </span>
                          )}
                        </div>
                      </TD>

                      <TD className="text-xs text-muted">{cand.lastActivity}</TD>

                      <TD className="text-right">
                        <Link
                          to="/mentor/sessions/s1"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                        >
                          <span>Timeline</span>
                          <ChevronRight className="size-3.5" />
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              {/* Bottom Non-Punitive Banner */}
              <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-muted p-3 text-xs text-muted">
                <span className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-primary-600" />
                  <span>
                    Proctoring flags never automatically disqualify or interrupt a candidate. Candidates always finish their exam.
                  </span>
                </span>
                <span className="text-[11px] font-semibold text-primary-700">Strictly Enforced Rule</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SETTINGS */}
      {/* TAB 5: PROCTORING */}
      {activeTab === "proctoring" && <ProctoringTab examId={examId} assignments={assignments} />}

      {activeTab === "settings" && (
        <div className="space-y-6 animate-in fade-in">
          <Card className="p-6 shadow-2xs space-y-5">
            <div>
              <CardTitle className="text-base font-bold text-text">Assessment Configuration & Proctoring</CardTitle>
              <CardDescription className="text-xs text-muted">
                Tune evaluation parameters, proctoring thresholds, and security delivery options.
              </CardDescription>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <Label htmlFor="set-title">Assessment Title</Label>
                <Input
                  id="set-title"
                  value={settingsTitle}
                  onChange={(e) => setSettingsTitle(e.target.value)}
                  required
                />
              </div>

              {/* Course name with recommendation input */}
              <CoursePicker
                value={settingsCourse}
                onChange={setSettingsCourse}
                label="Target Course (type or pick from recommendations)"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="set-dur">Duration (minutes)</Label>
                  <Input
                    id="set-dur"
                    type="number"
                    min={1}
                    value={settingsDuration}
                    onChange={(e) => setSettingsDuration(+e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="set-pass">Passing Mark Percentage (%)</Label>
                  <Input
                    id="set-pass"
                    type="number"
                    min={1}
                    max={100}
                    value={settingsPassPct}
                    onChange={(e) => setSettingsPassPct(+e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-3">
                <span className="font-semibold text-xs text-text flex items-center gap-1.5">
                  <ShieldAlert className="size-4 text-primary-600" />
                  <span>Proctoring Sensitivity Parameters</span>
                </span>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="set-thresh">Look-away red-flag limit (seconds, 3-5s)</Label>
                    <Input
                      id="set-thresh"
                      type="number"
                      step={0.5}
                      min={3}
                      max={5}
                      value={settingsThreshold}
                      onChange={(e) => setSettingsThreshold(+e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Candidate Alert Limit</Label>
                    <div className="mt-2 text-xs font-semibold text-warning-700">Strictly Capped at 3 Flags</div>
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-text cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={settingsShuffle}
                  onChange={(e) => setSettingsShuffle(e.target.checked)}
                  className="size-4 rounded accent-primary-600"
                />
                <span>Randomize questions and MCQ options for each candidate</span>
              </label>

              <div className="flex justify-end border-t border-border pt-4">
                <Button type="submit" className="bg-primary-600 font-semibold text-white hover:bg-primary-700">
                  Save Assessment Settings
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT CUSTOM QUESTION */}
      {customQuestionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-text">
                {editingQuestionId ? "Edit Assessment Question" : "Add Custom Question by Mentor"}
              </h3>
              <button
                type="button"
                onClick={() => setCustomQuestionModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomQuestion} className="space-y-4">
              <div>
                <Label htmlFor="q-body">Question Body</Label>
                <textarea
                  id="q-body"
                  rows={3}
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  placeholder="e.g. State and explain the Carnot theorem for maximum theoretical thermal efficiency..."
                  className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-text shadow-2xs focus:border-primary-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="q-topic">Topic / Subtopic</Label>
                  <Input
                    id="q-topic"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="e.g. Carnot Cycle"
                  />
                </div>
                <div>
                  <Label htmlFor="q-marks">Marks</Label>
                  <Input
                    id="q-marks"
                    type="number"
                    min={1}
                    max={10}
                    value={customMarks}
                    onChange={(e) => setCustomMarks(+e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="q-diff">Difficulty</Label>
                  <select
                    id="q-diff"
                    value={customDifficulty}
                    onChange={(e) => setCustomDifficulty(+e.target.value as 1 | 2 | 3)}
                    className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-text shadow-2xs focus:border-primary-500 focus:outline-hidden"
                  >
                    <option value={1}>Easy</option>
                    <option value={2}>Medium</option>
                    <option value={3}>Hard</option>
                  </select>
                </div>
              </div>

              {/* 4 MCQ Options with radio selector */}
              <div className="space-y-2">
                <Label>MCQ Options (Select the radio of the correct answer)</Label>
                <div className="space-y-2">
                  {[
                    { key: "A" as const, val: customOptionA, set: setCustomOptionA },
                    { key: "B" as const, val: customOptionB, set: setCustomOptionB },
                    { key: "C" as const, val: customOptionC, set: setCustomOptionC },
                    { key: "D" as const, val: customOptionD, set: setCustomOptionD },
                  ].map((opt) => (
                    <div
                      key={opt.key}
                      className={`flex items-center gap-2.5 rounded-xl border p-2 transition-colors ${
                        customCorrectKey === opt.key ? "border-success-400 bg-success-50/50" : "border-border bg-surface"
                      }`}
                    >
                      <input
                        type="radio"
                        name="correct-opt"
                        checked={customCorrectKey === opt.key}
                        onChange={() => setCustomCorrectKey(opt.key)}
                        className="size-4 accent-success-600"
                        title={`Mark Option ${opt.key} as correct`}
                      />
                      <span className="font-mono font-bold text-xs text-muted">{opt.key}.</span>
                      <input
                        type="text"
                        value={opt.val}
                        onChange={(e) => opt.set(e.target.value)}
                        placeholder={`Enter Option ${opt.key} text...`}
                        className="h-8 flex-1 bg-transparent text-xs text-text placeholder:text-muted focus:outline-hidden"
                        required
                      />
                      {customCorrectKey === opt.key && (
                        <span className="text-[10px] font-semibold text-success-700 pr-2">Correct</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="q-exp">Pedagogical Concept Note (Optional explanation)</Label>
                <Input
                  id="q-exp"
                  value={customExplanation}
                  onChange={(e) => setCustomExplanation(e.target.value)}
                  placeholder="e.g. Carnot efficiency is η = 1 - (TL/TH)..."
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="secondary" onClick={() => setCustomQuestionModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-primary-600 font-semibold text-white hover:bg-primary-700">
                  {editingQuestionId ? "Update Question" : "Save Question"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AI AGENT QUESTION RECOMMENDATIONS */}
      {aiModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-ai-100 text-ai-700">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text">AI Agent Question Recommendations</h3>
                  <p className="text-xs text-muted">Specify any syllabus topic to synthesize structured MCQs.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Topic Input Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-muted" />
                <input
                  type="text"
                  value={aiTopicInput}
                  onChange={(e) => setAiTopicInput(e.target.value)}
                  placeholder="e.g. Entropy, First Law, Heat Exchangers, Carnot Engine..."
                  className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-xs text-text placeholder:text-muted focus:border-ai-500 focus:outline-hidden"
                />
              </div>
              <Button
                type="button"
                onClick={handleGenerateAiQuestions}
                disabled={isGeneratingAi || !aiTopicInput.trim()}
                className="bg-ai-600 font-semibold text-white hover:bg-ai-700"
              >
                {isGeneratingAi ? "Synthesizing..." : "Generate MCQs"}
              </Button>
            </div>

            {/* Quick Topic Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-muted">Popular topics:</span>
              {["First Law", "Entropy & Second Law", "Heat Transfer", "Carnot Engine"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setAiTopicInput(t);
                    setIsGeneratingAi(true);
                    setTimeout(() => {
                      const gen = generateAIQuestions(t, 3);
                      setAiQuestions(gen);
                      setSelectedAiIds(new Set(gen.map((g) => g.id)));
                      setIsGeneratingAi(false);
                    }, 400);
                  }}
                  className="rounded-md border border-border bg-surface-muted/60 px-2 py-0.5 text-[11px] text-muted hover:bg-ai-50 hover:text-ai-700"
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Suggested Questions List */}
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {aiQuestions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted">
                  Click &ldquo;Generate MCQs&rdquo; to prompt the AI agent with your topic.
                </div>
              ) : (
                aiQuestions.map((sug) => {
                  const isChecked = selectedAiIds.has(sug.id);
                  return (
                    <div
                      key={sug.id}
                      className={`rounded-xl border p-3.5 space-y-2 transition-all ${
                        isChecked ? "border-ai-400 bg-ai-50/30" : "border-border bg-surface"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedAiIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(sug.id)) next.delete(sug.id);
                                else next.add(sug.id);
                                return next;
                              });
                            }}
                            className="mt-0.5 size-4 accent-ai-600 rounded"
                          />
                          <div>
                            <div className="font-semibold text-xs text-text">{sug.body}</div>
                            <div className="text-[11px] text-muted">
                              {sug.topic} • {sug.marks} marks • {difficultyLabel[sug.difficulty]}
                            </div>
                          </div>
                        </label>
                      </div>

                      <div className="grid gap-1.5 sm:grid-cols-2 pl-6">
                        {sug.options.map((o) => (
                          <div
                            key={o.key}
                            className={`rounded border px-2 py-1 text-[11px] flex items-center justify-between ${
                              o.is_correct
                                ? "border-success-400 bg-success-50 text-success-900 font-semibold"
                                : "border-border bg-surface-muted/50 text-muted"
                            }`}
                          >
                            <span>
                              <strong className="font-mono">{o.key}.</strong> {o.text}
                            </span>
                            {o.is_correct && <span className="text-[10px] text-success-700">✓ Correct</span>}
                          </div>
                        ))}
                      </div>

                      <div className="pl-6 text-[11px] text-muted italic">
                        Explanation: {sug.explanation}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs text-muted">
                {selectedAiIds.size} question(s) selected
              </span>

              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setAiModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAddAiQuestionsToAssessment}
                  disabled={selectedAiIds.size === 0}
                  className="bg-ai-600 font-semibold text-white hover:bg-ai-700"
                >
                  Add Selected to Assessment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EXCEL / CSV FILE UPLOAD */}
      {excelModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-success-100 text-success-700">
                  <FileSpreadsheet className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text">Upload Questions (Excel / CSV)</h3>
                  <p className="text-xs text-muted">Import bulk MCQs from .xlsx, .xls, or .csv spreadsheets.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExcelModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Template Download Prompt */}
            <div className="flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50/50 p-3.5 text-xs">
              <div className="space-y-0.5">
                <div className="font-semibold text-text">Need a spreadsheet template?</div>
                <div className="text-muted text-[11px]">Columns: Question, Option A, Option B, Option C, Option D, Correct Answer, Marks, Topic</div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={downloadSampleQuestionsTemplate}
                className="gap-1 text-xs shrink-0"
              >
                <Download className="size-3" />
                <span>Template</span>
              </Button>
            </div>

            {/* File Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-muted/30 p-8 text-center cursor-pointer transition-colors hover:border-primary-400 hover:bg-surface-muted/50"
            >
              <Upload className="size-8 text-muted mb-2" />
              <div className="font-semibold text-xs text-text">Click to choose Excel / CSV file</div>
              <div className="text-[11px] text-muted mt-0.5">Supports .xlsx, .xls, and .csv files up to 10MB</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {isParsingExcel && (
              <div className="text-center py-2 text-xs font-semibold text-primary-700 animate-pulse">
                Parsing spreadsheet rows and validating columns...
              </div>
            )}

            {excelError && (
              <div className="rounded-lg bg-danger-50 p-3 text-xs text-danger-700 flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{excelError}</span>
              </div>
            )}

            {/* Parsed Preview */}
            {parsedExcelRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-text">
                  <span>Parsed Questions Preview ({parsedExcelRows.length})</span>
                  <span className="text-success-700">Valid Schema</span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 border border-border rounded-xl p-3 bg-surface-muted/20">
                  {parsedExcelRows.map((row, idx) => (
                    <div key={idx} className="rounded-lg border border-border bg-surface p-2.5 text-xs space-y-1">
                      <div className="font-semibold text-text truncate">
                        {idx + 1}. {row.body}
                      </div>
                      <div className="text-[11px] text-muted flex gap-2">
                        <span>Topic: {row.topic}</span>
                        <span>•</span>
                        <span>Marks: {row.marks}</span>
                        <span>•</span>
                        <span className="text-success-700 font-semibold">
                          Answer: Option {row.options.find((o) => o.is_correct)?.key}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs text-muted">
                {parsedExcelRows.length} question(s) ready
              </span>

              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setExcelModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleImportParsedExcelQuestions}
                  disabled={parsedExcelRows.length === 0}
                  className="bg-primary-600 font-semibold text-white hover:bg-primary-700"
                >
                  Import Questions
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD STUDENT TO ASSESSMENT */}
      {addStudentModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-text">Add Students to Assessment</h3>
                <p className="text-xs text-muted">Select candidates from {courseName} cohort to assign.</p>
              </div>
              <button
                type="button"
                onClick={() => setAddStudentModalOpen(false)}
                className="rounded-lg p-1.5 text-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search eligible candidates by name or email..."
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-xs text-text placeholder:text-muted focus:border-primary-500 focus:bg-surface focus:outline-hidden"
              />
            </div>

            <form onSubmit={handleConfirmAddStudents} className="space-y-4">
              <div className="max-h-60 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                {eligibleCohortStudents.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted">
                    All eligible students from this cohort are already assigned.
                  </div>
                ) : (
                  eligibleCohortStudents.map((st) => {
                    const isChecked = selectedStudentIds.has(st.id);
                    return (
                      <label
                        key={st.id}
                        className="flex cursor-pointer items-center justify-between p-3 hover:bg-surface-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleStudentSelection(st.id)}
                            className="size-4 rounded accent-primary-600"
                          />
                          <div>
                            <div className="font-semibold text-xs text-text">{st.name}</div>
                            <div className="font-mono text-[11px] text-muted">
                              {st.email} • {st.phone || "+91 98765 43210"}
                            </div>
                          </div>
                        </div>
                        <Badge tone="primary">{courseName}</Badge>
                      </label>
                    );
                  })
                )}
              </div>

              <label className="flex items-center gap-2 text-xs text-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSendLinks}
                  onChange={(e) => setAutoSendLinks(e.target.checked)}
                  className="size-4 rounded accent-primary-600"
                />
                <span>Automatically generate and dispatch single-use test links to selected students</span>
              </label>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-xs text-muted">
                  {selectedStudentIds.size} student(s) selected
                </span>

                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setAddStudentModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={selectedStudentIds.size === 0}
                    className="bg-primary-600 font-semibold text-white hover:bg-primary-700"
                  >
                    Assign to Assessment
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANDIDATE EXCEL / CSV IMPORT */}
      {candidateExcelModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-success-100 text-success-700">
                  <FileSpreadsheet className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text">Import Candidates from Excel / CSV</h3>
                  <p className="text-xs text-muted">Bulk upload candidate rosters with mobile numbers and roll numbers.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCandidateExcelModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Template Download Prompt */}
            <div className="flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50/50 p-3.5 text-xs">
              <div className="space-y-0.5">
                <div className="font-semibold text-text">Download Candidate Template</div>
                <div className="text-muted text-[11px]">Columns: Candidate Name, Email, Mobile Number, Roll Number, Department</div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={downloadSampleCandidatesTemplate}
                className="gap-1 text-xs shrink-0"
              >
                <Download className="size-3" />
                <span>Template (.xlsx)</span>
              </Button>
            </div>

            {/* File Dropzone */}
            <div
              onClick={() => candidateFileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-muted/30 p-8 text-center cursor-pointer transition-colors hover:border-primary-400 hover:bg-surface-muted/50"
            >
              <Upload className="size-8 text-muted mb-2" />
              <div className="font-semibold text-xs text-text">Click to choose Candidate Spreadsheet</div>
              <div className="text-[11px] text-muted mt-0.5">Supports .xlsx, .xls, and .csv files up to 10MB</div>
              <input
                ref={candidateFileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleCandidateFileUpload}
                className="hidden"
              />
            </div>

            {isParsingCandidateExcel && (
              <div className="text-center py-2 text-xs font-semibold text-primary-700 animate-pulse">
                Parsing candidate spreadsheet rows and validating contacts...
              </div>
            )}

            {candidateExcelError && (
              <div className="rounded-lg bg-danger-50 p-3 text-xs text-danger-700 flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{candidateExcelError}</span>
              </div>
            )}

            {/* Parsed Preview */}
            {parsedCandidateRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-text">
                  <span>Parsed Candidates Preview ({parsedCandidateRows.length})</span>
                  <span className="text-success-700">Valid Schema</span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 border border-border rounded-xl p-3 bg-surface-muted/20">
                  {parsedCandidateRows.map((row, idx) => (
                    <div key={idx} className="rounded-lg border border-border bg-surface p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-text">{idx + 1}. {row.name}</span>
                        <span className="font-mono text-[11px] text-muted">{row.rollNumber}</span>
                      </div>
                      <div className="text-[11px] text-muted flex flex-wrap gap-2">
                        <span className="font-mono">{row.email}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono text-text">
                          <Phone className="size-3 text-muted" /> {row.phone}
                        </span>
                        {row.department && (
                          <>
                            <span>•</span>
                            <span>{row.department}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs text-muted">
                {parsedCandidateRows.length} candidate(s) ready
              </span>

              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setCandidateExcelModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleImportParsedCandidates}
                  disabled={parsedCandidateRows.length === 0}
                  className="bg-primary-600 font-semibold text-white hover:bg-primary-700"
                >
                  Enroll Candidates
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CONFIRM CANDIDATE REMOVAL (CRUD) */}
      {candidateToRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-danger-700">
              <div className="flex size-10 items-center justify-center rounded-xl bg-danger-100">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">Remove Student from Assessment</h3>
                <p className="text-xs text-muted">Revoke access token for {candidateToRemove.candidate_name}</p>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to remove <strong>{candidateToRemove.candidate_name}</strong> ({candidateToRemove.candidate_email}) from this assessment? Their access link will be deactivated.
            </p>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button type="button" variant="secondary" onClick={() => setCandidateToRemove(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => handleRemoveCandidate(candidateToRemove)}
                className="bg-danger-600 font-semibold text-white hover:bg-danger-700"
              >
                Confirm Removal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: PUBLISH & SCHEDULE ASSESSMENT MODAL */}
      {publishModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-2xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Send className="size-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text">Publish & Schedule Assessment</h3>
                  <p className="text-xs text-muted">Interview Screening Module</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPublishModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-text cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handlePublishAndSchedule} className="mt-4 space-y-4">
              {/* Assessment Summary Box */}
              <div className="rounded-xl border border-border bg-surface-muted/50 p-3.5 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted">Assessment Title:</span>
                  <span className="font-bold text-text">{settingsTitle}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Course / Track:</span>
                  <span className="font-semibold text-text">{settingsCourse}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Configured Questions:</span>
                  <span className="font-semibold text-primary-700">{questions.length} MCQs</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Enrolled Candidates:</span>
                  <span className="font-semibold text-emerald-700">{assignments.length} Candidates</span>
                </div>
              </div>

              {/* Date & Time Selection */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="sched-date" className="text-xs font-semibold text-text">
                    Examination Date
                  </Label>
                  <Input
                    id="sched-date"
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="sched-start" className="text-xs font-semibold text-text">
                      Start Time
                    </Label>
                    <Input
                      id="sched-start"
                      type="time"
                      value={scheduleStartTime}
                      onChange={(e) => setScheduleStartTime(e.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sched-end" className="text-xs font-semibold text-text">
                      End Time (Duration: {durationMinutes}m)
                    </Label>
                    <Input
                      id="sched-end"
                      type="time"
                      value={scheduleEndTime}
                      onChange={(e) => setScheduleEndTime(e.target.value)}
                      required
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Email Notification Option */}
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendTestLinkEmails}
                    onChange={(e) => setSendTestLinkEmails(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="text-xs text-emerald-950">
                    <span className="font-bold block">
                      Trigger AI Email Sending Agent to dispatch test links
                    </span>
                    <span className="text-[11px] text-emerald-800 leading-relaxed block mt-0.5">
                      Sends unique proctoring invitation links, browser guidelines, and face verification instructions to all <strong>{assignments.length} enrolled candidates</strong>.
                    </span>
                  </div>
                </label>
              </div>

              {/* Status Transition Info */}
              <div className="rounded-lg bg-surface-muted p-2.5 text-[11px] text-muted flex items-center justify-between">
                <span>Status transition:</span>
                <div className="flex items-center gap-2 font-semibold">
                  <AssessmentStatusBadge status="draft" size="sm" />
                  <span>&rarr;</span>
                  <AssessmentStatusBadge status="scheduled" size="sm" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPublishModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPublishing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs cursor-pointer"
                >
                  <Send className="size-3.5" />
                  <span>{isPublishing ? "Publishing & Emailing..." : "Confirm & Publish Assessment"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

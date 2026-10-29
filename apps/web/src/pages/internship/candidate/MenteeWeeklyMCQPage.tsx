import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  FileQuestion,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePageTitle } from "@/app/layouts";
import { useAuth } from "@/features/auth/store";
import { getWeeklyMCQQuestions } from "@/lib/candidateExamQuestions";
import {
  getInternshipMenteeForUser,
  getPersistedWeeklyMCQs,
  submitMenteeWeeklyMCQ,
} from "@/lib/mockData";
import type { Question, WeeklyMCQAssessment } from "@/lib/types";

export function MenteeWeeklyMCQPage() {
  usePageTitle("Weekly MCQs & Knowledge Checks");
  const { user } = useAuth();
  const mentee = getInternshipMenteeForUser(user);

  const [mcqs, setMcqs] = useState<WeeklyMCQAssessment[]>(() => getPersistedWeeklyMCQs());
  const [selectedMonth, setSelectedMonth] = useState<"all" | 1 | 2 | 3>("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active taking exam modal state
  const [activeTakingMcq, setActiveTakingMcq] = useState<WeeklyMCQAssessment | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [examSecondsLeft, setExamSecondsLeft] = useState(1200); // 20 mins default
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccessMcq, setSubmissionSuccessMcq] = useState<WeeklyMCQAssessment | null>(null);

  // Scorecard modal state
  const [inspectedMcq, setInspectedMcq] = useState<WeeklyMCQAssessment | null>(null);

  // Sync persistence across tabs
  useEffect(() => {
    const handleUpdate = () => setMcqs(getPersistedWeeklyMCQs());
    window.addEventListener("eduproctor_weekly_mcqs_updated", handleUpdate);
    return () => window.removeEventListener("eduproctor_weekly_mcqs_updated", handleUpdate);
  }, []);

  // Filtered MCQs
  const filteredMcqs = useMemo(() => {
    return mcqs.filter((m) => {
      if (selectedMonth !== "all" && m.monthNumber !== selectedMonth) return false;
      return true;
    });
  }, [mcqs, selectedMonth]);

  // Derived metrics
  const completedCount = mcqs.filter((m) => m.status === "published" || m.status === "submitted").length;
  const publishedList = mcqs.filter((m) => m.status === "published" && m.scorePct !== undefined);
  const avgScore =
    publishedList.length > 0
      ? Math.round(publishedList.reduce((acc, curr) => acc + (curr.scorePct || 0), 0) / publishedList.length)
      : 93;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Exam timer countdown
  useEffect(() => {
    if (!activeTakingMcq) return;
    const interval = setInterval(() => {
      setExamSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTakingMcq]);

  const questions: Question[] = useMemo(() => {
    if (!activeTakingMcq) return [];
    return getWeeklyMCQQuestions(activeTakingMcq.weekNumber);
  }, [activeTakingMcq]);

  const currentQ = questions[currentQIndex] || questions[0];

  const handleStartExam = (mcq: WeeklyMCQAssessment) => {
    setActiveTakingMcq(mcq);
    setCurrentQIndex(0);
    setAnswers({});
    setExamSecondsLeft(mcq.durationMinutes * 60);
  };

  const handleSelectOption = (key: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQIndex + 1]: key,
    }));
  };

  const handleFinishExam = () => {
    if (!activeTakingMcq) return;
    setIsSubmitting(true);
    const answeredCount = Object.keys(answers).length;
    const totalQ = questions.length || activeTakingMcq.questionCount;

    setTimeout(() => {
      const updated = submitMenteeWeeklyMCQ(
        activeTakingMcq.id,
        answeredCount,
        totalQ,
        mentee.name,
      );
      setIsSubmitting(false);
      setActiveTakingMcq(null);
      setSubmissionSuccessMcq(updated);
      showToast(`Submitted! AI Evaluation Agent drafted report for Manager ${activeTakingMcq.managerName}.`);
    }, 1000);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-teal-50/40 to-slate-50 p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              <Rocket className="size-3 text-emerald-600" />
              <span>Full Stack 12-Week Roadmap · Continuous Knowledge Evaluation</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Weekly Knowledge Checks & MCQs
            </h1>
            <p className="max-w-2xl text-xs text-slate-600 sm:text-sm">
              Proctored weekly assessments testing your command of sprint topics. Submissions are analyzed by the{" "}
              <strong className="text-emerald-700">AI Assessment Evaluation Agent</strong> and signed off by your Manager.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3.5 py-2 shadow-2xs">
              <ShieldCheck className="size-5 text-emerald-600" />
              <div className="text-left text-xs">
                <span className="block font-bold text-slate-900">Calm AI Proctoring</span>
                <span className="text-[10px] text-slate-500">Look-away & tab check (Max 3 flags)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-emerald-100 bg-white/90 p-3 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Weekly Checks Done</span>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {completedCount} <span className="text-xs font-normal text-slate-400">/ 12 Weeks</span>
            </p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-white/90 p-3 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Average MCQ Score</span>
            <p className="mt-1 text-xl font-bold text-emerald-700">{avgScore}%</p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-white/90 p-3 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Active Sprint Topic</span>
            <p className="mt-1 text-sm font-bold text-slate-900 truncate">React Core & Hooks</p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-white/90 p-3 shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Assigned Manager</span>
            <p className="mt-1 text-sm font-bold text-slate-900 truncate">Priya Sharma</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSelectedMonth("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              selectedMonth === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All 12 Weeks
          </button>
          <button
            type="button"
            onClick={() => setSelectedMonth(1)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              selectedMonth === 1 ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Month 1 (Foundations)
          </button>
          <button
            type="button"
            onClick={() => setSelectedMonth(2)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              selectedMonth === 2 ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Month 2 (Applied Skills)
          </button>
          <button
            type="button"
            onClick={() => setSelectedMonth(3)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              selectedMonth === 3 ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Month 3 (Capstone & BI)
          </button>
        </div>

        <span className="text-xs text-slate-500">
          Showing <strong>{filteredMcqs.length}</strong> weekly assessments
        </span>
      </div>

      {/* MCQs Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredMcqs.map((mcq) => {
          const isPublished = mcq.status === "published";
          const isSubmitted = mcq.status === "submitted";
          const isAvailable = mcq.status === "available";

          return (
            <div
              key={mcq.id}
              className={`flex flex-col justify-between rounded-xl border bg-white p-5 shadow-2xs transition-all ${
                isPublished
                  ? "border-emerald-200/90 hover:border-emerald-400"
                  : isSubmitted
                    ? "border-amber-200/90 hover:border-amber-400 bg-amber-50/10"
                    : "border-slate-200/90 hover:border-slate-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800">
                    Month {mcq.monthNumber} · Week {mcq.weekInMonth} (W{mcq.weekNumber})
                  </span>

                  {isPublished && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      <CheckCircle2 className="size-3" />
                      Score: {mcq.scorePct}%
                    </span>
                  )}

                  {isSubmitted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      <Clock className="size-3" />
                      Awaiting Manager Sign-off
                    </span>
                  )}

                  {isAvailable && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      <Sparkles className="size-3" />
                      Ready to Start
                    </span>
                  )}
                </div>

                <h3 className="mt-2.5 text-sm font-bold text-slate-900 leading-snug">{mcq.title}</h3>
                <p className="mt-1 text-xs text-slate-500 font-medium">{mcq.theme}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                    {mcq.skillArea}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileQuestion className="size-3 text-slate-400" />
                    {mcq.questionCount} Questions
                  </span>
                  <span className="flex items-center gap-1">
                    <Timer className="size-3 text-slate-400" />
                    {mcq.durationMinutes} Mins
                  </span>
                </div>

                {/* Agent Analysis Snippet if available */}
                {mcq.agentAnalysis && (
                  <div className="mt-3.5 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span className="flex items-center gap-1 text-emerald-700">
                        <Sparkles className="size-3" />
                        AI Agent Evaluation
                      </span>
                      <span>Accuracy: {mcq.agentAnalysis.accuracyPct}%</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">
                      {mcq.agentAnalysis.summary}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 border-t border-slate-100 pt-3">
                {isPublished && (
                  <button
                    type="button"
                    onClick={() => setInspectedMcq(mcq)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                  >
                    <Award className="size-3.5" />
                    <span>View Published Scorecard</span>
                  </button>
                )}

                {isSubmitted && (
                  <button
                    type="button"
                    onClick={() => setInspectedMcq(mcq)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/60 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer"
                  >
                    <Eye className="size-3.5" />
                    <span>View AI Evaluation Preview ({mcq.scorePct}%)</span>
                  </button>
                )}

                {isAvailable && (
                  <button
                    type="button"
                    onClick={() => handleStartExam(mcq)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-2xs cursor-pointer"
                  >
                    <Play className="size-3.5" />
                    <span>Start Weekly MCQ Assessment</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Exam Modal */}
      {activeTakingMcq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-3.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Month {activeTakingMcq.monthNumber} · Week {activeTakingMcq.weekNumber} Assessment
                </span>
                <h3 className="text-sm font-bold text-slate-900">{activeTakingMcq.title}</h3>
              </div>

              <div className="flex items-center gap-3">
                {/* Timer */}
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono font-bold text-slate-700">
                  <Timer className="size-3.5 text-emerald-600" />
                  <span>{formatTimer(examSecondsLeft)}</span>
                </div>

                {/* Proctoring Pill */}
                <div className="hidden sm:flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800">
                  <ShieldCheck className="size-3" />
                  <span>0 Flags (Clean)</span>
                </div>
              </div>
            </div>

            {/* Question Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">
                  Question {currentQIndex + 1} of {questions.length}
                </span>
                <span>Topic: {currentQ?.subtopic || activeTakingMcq.skillArea}</span>
              </div>

              <h4 className="text-sm font-semibold text-slate-900 leading-relaxed">
                {currentQ?.body || "What is the primary architectural advantage of using this framework standard?"}
              </h4>

              {/* Options */}
              <div className="space-y-2.5 pt-2">
                {currentQ?.options?.map((opt) => {
                  const isSelected = answers[currentQIndex + 1] === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleSelectOption(opt.key)}
                      className={`w-full text-left rounded-xl border p-3 text-xs transition-all flex items-start gap-3 cursor-pointer ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/60 font-semibold text-emerald-900 shadow-2xs"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          isSelected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className="flex-1">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Question Navigation Bubbles */}
              <div className="pt-4 border-t border-slate-100">
                <span className="text-[11px] font-medium text-slate-400 block mb-2">Question Navigation:</span>
                <div className="flex flex-wrap gap-1.5">
                  {questions.map((_, idx) => {
                    const isAnswered = !!answers[idx + 1];
                    const isCurrent = idx === currentQIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentQIndex(idx)}
                        className={`size-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? "border-2 border-emerald-600 bg-emerald-50 text-emerald-800"
                            : isAnswered
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentQIndex === 0}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Previous Question
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTakingMcq(null)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Exit Draft
                </button>

                {currentQIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                  >
                    Next Question →
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleFinishExam}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    {isSubmitting ? "Evaluating with AI..." : "Submit Weekly MCQ"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submission Success Dialog */}
      {submissionSuccessMcq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="size-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Weekly MCQ Submitted Successfully!
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Your answers for <strong>{submissionSuccessMcq.title}</strong> were recorded.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-xs text-emerald-900 text-left space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span>Provisional Score:</span>
                <span className="text-sm font-extrabold text-emerald-700">
                  {submissionSuccessMcq.scorePct}%
                </span>
              </div>
              <p className="text-[11px] text-emerald-800">
                The <strong>AI Assessment Evaluation Agent</strong> has synthesized your topic mastery and drafted the review report for your manager <strong>{submissionSuccessMcq.managerName}</strong>.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setInspectedMcq(submissionSuccessMcq);
                  setSubmissionSuccessMcq(null);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
              >
                Inspect AI Evaluation Preview
              </button>
              <button
                type="button"
                onClick={() => setSubmissionSuccessMcq(null)}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Scorecard & AI Review Modal */}
      {inspectedMcq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Month {inspectedMcq.monthNumber} · Week {inspectedMcq.weekNumber} Scorecard
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{inspectedMcq.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedMcq(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Score & Telemetry Header */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-medium text-slate-500 uppercase">Score</span>
                <p className="mt-1 text-2xl font-extrabold text-emerald-700">{inspectedMcq.scorePct}%</p>
                <span className="text-[10px] text-slate-400">
                  {inspectedMcq.pointsObtained} of {inspectedMcq.totalPoints} points
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-medium text-slate-500 uppercase">Integrity</span>
                <p className="mt-1 text-2xl font-extrabold text-emerald-700">100%</p>
                <span className="text-[10px] text-slate-400">0 Flags (Clean)</span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-medium text-slate-500 uppercase">Status</span>
                <p className="mt-1 text-sm font-bold text-slate-900 capitalize">
                  {inspectedMcq.status === "published" ? "Published" : "Under Review"}
                </p>
                <span className="text-[10px] text-slate-400">
                  {inspectedMcq.publishedAt ? `Published ${inspectedMcq.publishedAt}` : "Pending Manager"}
                </span>
              </div>
            </div>

            {/* AI Agent Topic Mastery Breakdown */}
            {inspectedMcq.agentAnalysis && (
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-emerald-600" />
                    AI Topic Mastery Breakdown
                  </span>
                  <span className="text-[11px] text-slate-500">Curated from weekly responses</span>
                </div>

                <div className="space-y-2">
                  {inspectedMcq.agentAnalysis.topicMastery.map((tm, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
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

            {/* Manager Feedback */}
            {inspectedMcq.managerNotes && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3.5 text-xs">
                <span className="font-bold text-emerald-900 block mb-1">
                  Manager Review & Feedback:
                </span>
                <p className="text-emerald-800 leading-relaxed">{inspectedMcq.managerNotes}</p>
              </div>
            )}

            {/* AI Recommended Learning Notes */}
            {inspectedMcq.agentAnalysis?.recommendedNotes && (
              <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="size-3.5 text-slate-500" />
                  Recommended Closed-Loop Practice Notes:
                </span>
                {inspectedMcq.agentAnalysis.recommendedNotes.map((note, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5 border border-slate-100"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{note.title}</span>
                      <span className="block text-[11px] text-slate-500">{note.desc}</span>
                    </div>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {note.count} Practice Qs
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInspectedMcq(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Close Scorecard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { Button } from "@/components/ui/button";
import { getExamQuestions } from "@/lib/candidateExamQuestions";
import { getPersistedAssessments, saveCandidateSubmission } from "@/lib/mockData";

export function CandidateExamPage() {
  usePageTitle("Assessment in Progress");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const examId = searchParams.get("examId") || "ut-3";

  // Load exam metadata and questions
  const assessments = getPersistedAssessments();
  const exam = assessments.find((a) => a.id === examId) ?? assessments[0];
  const questions = useMemo(() => getExamQuestions(examId), [examId]);
  const totalQuestions = questions.length;

  // Active question state: strictly starts at Question 1
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState<number>(1);

  // Candidate answers store: NO option is chosen by default for any question
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // Questions bookmarked for review
  const [bookmarkedSet, setBookmarkedSet] = useState<Set<number>>(new Set());

  // Submit confirmation modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Calm proctoring flag counter capped at 3 per design rules
  const flagCount = 1;
  const [showBanner, setShowBanner] = useState(true);

  // Timer countdown: 60 minutes or exam duration
  const initialSeconds = (exam?.duration_min || 60) * 60;
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (secs: number) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, "0");
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // Current question data
  const currentIndex = Math.max(0, Math.min(currentQuestionNumber - 1, totalQuestions - 1));
  const currentQuestionData = questions[currentIndex] || questions[0];
  const isBookmarked = bookmarkedSet.has(currentQuestionNumber);
  const currentSelectedOption = answers[currentQuestionNumber] ?? null;

  // Option selection handler
  const handleSelectOption = (key: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestionNumber]: key,
    }));
  };

  // Bookmark toggle handler
  const handleToggleBookmark = () => {
    setBookmarkedSet((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestionNumber)) {
        next.delete(currentQuestionNumber);
      } else {
        next.add(currentQuestionNumber);
      }
      return next;
    });
  };

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Top Bar matching Screen 8 & Image 2:
          Title, Question X of 40, Timer, Flag counter (Flags 1 of 3) */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-3.5 shadow-2xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-text">
              {exam?.course || "Full Stack Development"} · {exam?.title || "Unit test 3"}
            </span>
          </div>
          <div className="text-xs text-muted">
            Question {currentQuestionNumber} of {totalQuestions} • {Math.floor(secondsRemaining / 60)} min left
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Live Timer Countdown */}
          <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-text">
            <Clock className="size-4 text-primary-600" />
            <span>{formatTimer(secondsRemaining)}</span>
          </div>

          {/* Flag Counter matching Image 2:
              Three small dots + text "Flags 1 of 3" (first dot red, other two grey) */}
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              flagCount > 0 ? "bg-danger-50 text-danger-700 border border-danger-500/20" : "bg-surface-muted text-muted"
            }`}
          >
            <div className="flex items-center gap-1">
              <span className={`size-2 rounded-full ${flagCount >= 1 ? "bg-danger-500" : "bg-border-strong"}`} />
              <span className={`size-2 rounded-full ${flagCount >= 2 ? "bg-danger-500" : "bg-border-strong"}`} />
              <span className={`size-2 rounded-full ${flagCount >= 3 ? "bg-danger-500" : "bg-border-strong"}`} />
            </div>
            <span>Flags {flagCount} of 3</span>
          </div>
        </div>
      </div>

      {/* Calm Flag Notice Banner matching Image 1 & Image 2:
          "Flag 1 of 3 - please keep your eyes on the screen." */}
      {showBanner && flagCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-xl border border-danger-500/30 bg-danger-50 px-4 py-3 text-xs text-danger-700 shadow-2xs animate-in fade-in"
        >
          <div className="flex items-center gap-2.5">
            <Eye className="size-4 shrink-0 text-danger-500" />
            <span className="font-medium">
              Flag {flagCount} of 3 — please keep your eyes on the screen.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowBanner(false)}
            className="rounded p-0.5 text-danger-700/70 hover:text-danger-700"
            aria-label="Dismiss banner"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* 2-Column Assessment Layout:
          Left: Question Card & Options
          Right: Question Navigation Palette (resolves the user's vertical line gap) */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main Question Card matching Screen 8 */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-2xs space-y-6">
          {/* Question Header & Bookmark */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-700">
                Question {currentQuestionNumber}
              </span>
              {currentQuestionData.subtopic && (
                <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted">
                  {currentQuestionData.subtopic}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleToggleBookmark}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                isBookmarked
                  ? "bg-warning-50 text-warning-800 border border-warning-200"
                  : "text-muted hover:bg-surface-muted hover:text-text border border-transparent"
              }`}
            >
              <Bookmark className={`size-3.5 ${isBookmarked ? "fill-warning-500 text-warning-500" : ""}`} />
              <span>{isBookmarked ? "Marked for review" : "Mark for review"}</span>
            </button>
          </div>

          {/* Question Stem */}
          <div className="text-base font-semibold leading-relaxed text-text">
            {currentQuestionData.body}
          </div>

          {/* Radio Options A, B, C, D:
              Defaults to NOT chosen (empty state), highlights on user selection */}
          <div className="space-y-3">
            {currentQuestionData.options.map((opt) => {
              const isSelected = currentSelectedOption === opt.key;
              return (
                <label
                  key={opt.key}
                  onClick={() => handleSelectOption(opt.key)}
                  className={`flex items-center gap-3.5 rounded-xl border p-4 text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary-600 bg-primary-50/60 text-text shadow-2xs"
                      : "border-border bg-surface text-text hover:border-border-strong hover:bg-surface-muted/40"
                  }`}
                >
                  <div
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                      isSelected
                        ? "bg-primary-600 text-white"
                        : "border border-border bg-surface text-muted"
                    }`}
                  >
                    {opt.key}
                  </div>
                  <span className="leading-relaxed">{opt.text}</span>
                </label>
              );
            })}
          </div>

          {/* Bottom Navigation: Previous / Next / Finish */}
          <div className="flex items-center justify-between border-t border-border pt-5">
            <Button
              variant="secondary"
              onClick={() => setCurrentQuestionNumber((prev) => Math.max(1, prev - 1))}
              disabled={currentQuestionNumber <= 1}
              className="flex items-center gap-1.5 text-xs"
            >
              <ArrowLeft className="size-3.5" />
              <span>Previous</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowSubmitModal(true)}
                className="text-xs text-muted hover:text-text"
              >
                Finish assessment
              </Button>

              <Button
                onClick={() => {
                  if (currentQuestionNumber < totalQuestions) {
                    setCurrentQuestionNumber((prev) => prev + 1);
                  } else {
                    setShowSubmitModal(true);
                  }
                }}
                className="flex items-center gap-1.5 bg-primary-600 text-white hover:bg-primary-700 text-xs"
              >
                <span>{currentQuestionNumber === totalQuestions ? "Review & Finish" : "Next"}</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Question Palette & Overview (filling the vertical red line gap) */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-text">Question Palette</span>
              <span className="text-[11px] font-medium text-muted">
                {answeredCount}/{totalQuestions} Answered
              </span>
            </div>

            {/* Status Legend Pills */}
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div className="rounded-lg bg-primary-50 p-1.5 border border-primary-200">
                <span className="block font-bold text-primary-700">{answeredCount}</span>
                <span className="text-primary-800">Answered</span>
              </div>
              <div className="rounded-lg bg-surface-muted p-1.5 border border-border">
                <span className="block font-bold text-text">{unansweredCount}</span>
                <span className="text-muted">Unanswered</span>
              </div>
              <div className="rounded-lg bg-warning-50 p-1.5 border border-warning-200">
                <span className="block font-bold text-warning-800">{bookmarkedSet.size}</span>
                <span className="text-warning-800">Review</span>
              </div>
            </div>

            {/* 1-40 Question Chips Grid */}
            <div className="grid grid-cols-5 gap-1.5 max-h-[360px] overflow-y-auto pr-1">
              {questions.map((_, idx) => {
                const qNum = idx + 1;
                const isCurrent = currentQuestionNumber === qNum;
                const isAns = answers[qNum] !== undefined;
                const isBook = bookmarkedSet.has(qNum);

                return (
                  <button
                    key={qNum}
                    type="button"
                    onClick={() => setCurrentQuestionNumber(qNum)}
                    className={`relative flex h-8 w-full items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                      isCurrent
                        ? "ring-2 ring-primary-600 bg-primary-100 text-primary-900 font-bold shadow-2xs"
                        : isAns
                          ? "bg-primary-600 text-white hover:bg-primary-700"
                          : isBook
                            ? "border-2 border-warning-500 bg-warning-50 text-warning-900"
                            : "border border-border bg-surface text-muted hover:border-border-strong hover:bg-surface-muted hover:text-text"
                    }`}
                  >
                    <span>{qNum}</span>
                    {isBook && (
                      <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-warning-500 ring-1 ring-surface" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Submit Action in Palette */}
            <div className="border-t border-border pt-3">
              <Button
                onClick={() => setShowSubmitModal(true)}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white text-xs h-9"
              >
                Submit Assessment
              </Button>
            </div>
          </div>

          {/* Calm Proctoring Notice Box */}
          <div className="rounded-xl border border-border bg-surface-muted/50 p-3.5 text-[11px] text-muted space-y-1">
            <span className="font-semibold text-text flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-success-600" />
              Non-punitive integrity active
            </span>
            <p>
              Your answers are securely auto-saved. Proctoring flags never disqualify or pause your session.
            </p>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95">
            {!isSubmitted ? (
              <>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h4 className="text-base font-semibold text-text">Submit Assessment</h4>
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(false)}
                    className="rounded p-1 text-muted hover:text-text"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <p className="text-xs text-text leading-relaxed">
                  Are you sure you want to submit? You have answered{" "}
                  <strong>
                    {answeredCount} of {totalQuestions}
                  </strong>{" "}
                  questions.
                </p>

                {unansweredCount > 0 && (
                  <div className="rounded-lg bg-warning-50 border border-warning-200 p-3 text-xs text-warning-800">
                    You still have <strong>{unansweredCount} unanswered</strong> question(s). You can return to answer them
                    or submit now.
                  </div>
                )}

                <div className="rounded-lg bg-surface-muted p-3 text-xs text-muted">
                  Once submitted, your answers will be securely saved and scored. Your mentor will review the AI evaluation
                  summary and publish your personalized recommendations and practice set.
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={() => setShowSubmitModal(false)}>
                    Return to questions
                  </Button>
                  <Button
                    onClick={() => {
                      saveCandidateSubmission(examId, answers, totalQuestions);
                      setIsSubmitted(true);
                    }}
                    className="bg-primary-600 text-white hover:bg-primary-700"
                  >
                    Confirm & submit
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4 py-2 text-center animate-in fade-in zoom-in-95">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-50 text-success-600 ring-8 ring-success-50/50">
                  <CheckCircle2 className="size-8" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-text">Assessment Completed & Submitted!</h4>
                  <p className="text-xs text-muted">
                    {exam?.title ?? "Assessment"} · {exam?.course ?? "Course"}
                  </p>
                </div>

                <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-4 text-left space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary-900">
                    <Sparkles className="size-4 text-primary-600" />
                    <span>Results will be shared in your "My Results" page</span>
                  </div>
                  <p className="text-xs text-primary-800 leading-relaxed">
                    Your answers were securely logged. Priya Sharma is reviewing your AI performance breakdown and
                    curated closed-loop practice recommendations.
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-[11px] font-medium text-primary-700">
                    <Mail className="size-3.5" />
                    <span>An automated email report with your scorecard will be sent upon publication.</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
                  <Button
                    onClick={() => navigate(`/candidate/results?examId=${examId}`)}
                    className="w-full sm:w-auto bg-primary-600 text-white hover:bg-primary-700"
                  >
                    Go to My Results
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate("/candidate")}
                    className="w-full sm:w-auto"
                  >
                    Return to Dashboard
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


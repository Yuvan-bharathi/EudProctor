import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Clock,
  Eye,
  HelpCircle,
  Mail,
  Sparkles,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { Button } from "@/components/ui/button";
import { AnswerSync } from "@/features/assessment/answerSync";
import { makeClock } from "@/features/assessment/clock";
import type { CandidateSession } from "@/features/assessment/types";
import { useProctoring } from "@/features/proctoring/ProctoringLayer";
import { api, errorMessage } from "@/lib/api";
import { getExamQuestions } from "@/lib/candidateExamQuestions";
import { getPersistedAssessments, saveCandidateSubmission } from "@/lib/mockData";
import type { Question } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DONE = new Set(["submitted", "scored", "analysed"]);

export function CandidateExamPage() {
  usePageTitle("Assessment in Progress");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const examId = searchParams.get("examId") || "ut-3";

  // Backend assessments get a real session: server questions, autosave, deadline and proctoring.
  // Local demo assessments (ut-*) keep the browser-only flow.
  const sessionQuery = useQuery({
    queryKey: ["exam-session", examId],
    queryFn: () => api<CandidateSession>("/sessions/start", { body: { exam_id: examId } }),
    enabled: UUID_RE.test(examId),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const remote = sessionQuery.data ?? null;
  const session = remote?.status === "in_progress" ? remote : null;
  const { count: flagCount, max: maxFlags, notice, noticeReason, videoRef } = useProctoring(session);
  const sync = useMemo(
    () =>
      session
        ? new AnswerSync(session.id, (batch) =>
            api<{ acks: { question_id: string; client_seq: number; accepted: boolean }[] }>(
              `/sessions/${session.id}/answers`,
              { method: "PUT", body: { answers: batch } },
            ),
          )
        : null,
    [session],
  );

  // Load exam metadata and questions
  const assessments = getPersistedAssessments();
  const localExam = assessments.find((a) => a.id === examId) ?? assessments[0];
  const exam = remote ? { ...localExam, title: remote.exam_title, duration_min: remote.duration_min } : localExam;
  const questions = useMemo<Question[]>(
    () =>
      session
        ? session.questions.map((q) => ({
            id: q.id,
            course_id: "",
            topic_id: "",
            subtopic: "",
            type: q.type,
            difficulty: 1,
            marks: q.marks,
            body: q.body,
            options: q.options.map((o) => ({ ...o, id: o.key, is_correct: false, misconception_id: null })),
            answer_text: "",
            status: "approved",
            source: "mentor",
            agent_run_id: null,
          }) as Question)
        : getExamQuestions(examId),
    [session, examId],
  );
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Calm proctoring notice: only for a new red flag (long look-away or leaving the tab), capped at max flags.
  // Flags come from the server via useProctoring; nothing is shown until one is actually raised.
  const [dismissedNotice, setDismissedNotice] = useState<number | null>(null);
  const showBanner = notice !== null && notice !== dismissedNotice;

  // Timer countdown: the server deadline for a backend session, otherwise the exam duration
  const initialSeconds = (exam?.duration_min || 60) * 60;
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);

  useEffect(() => {
    const clock = session ? makeClock(session.server_now, session.deadline_at) : null;
    if (clock) setSecondsRemaining(Math.ceil((clock.remainingMs() ?? 0) / 1000));
    const timer = setInterval(() => {
      if (clock) setSecondsRemaining(Math.ceil((clock.remainingMs() ?? 0) / 1000));
      else setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [session]);

  // Autosave: restore saved answers (server + offline buffer), then flush every few seconds
  useEffect(() => {
    if (!session || !sync) return;
    const numberOf = new Map(session.questions.map((q) => [q.id, q.number]));
    const toAnswers = (entries: [string, Record<string, unknown>][]) =>
      Object.fromEntries(
        entries
          .filter(([qid, v]) => numberOf.has(qid) && typeof v.option_key === "string")
          .map(([qid, v]) => [numberOf.get(qid)!, v.option_key as string]),
      );
    setAnswers(toAnswers(Object.entries(session.answers).map(([k, v]) => [k, v.value])));
    const seqs = Object.fromEntries(Object.entries(session.answers).map(([k, v]) => [k, v.client_seq]));
    void sync.init(seqs).then((local) => {
      if (local.size) setAnswers((a) => ({ ...a, ...toAnswers([...local.entries()]) }));
      void sync.flush();
    });
    sync.start();
    return () => sync.stop();
    // session.answers is only the initial snapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync]);

  // The server deadline auto-submits; reflect it here once time is up
  useEffect(() => {
    if (session && secondsRemaining <= 0 && !isSubmitted) {
      void sync?.flush();
      setIsSubmitted(true);
      setShowSubmitModal(true);
    }
  }, [session, secondsRemaining, isSubmitted, sync]);

  async function handleConfirmSubmit() {
    if (session && sync) {
      setIsSubmitting(true);
      setSubmitError(null);
      await sync.flush();
      try {
        await api(`/sessions/${session.id}/submit`, { method: "POST" });
      } catch (err) {
        setSubmitError(`${errorMessage(err)} Your answers are kept – please try again.`);
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }
    saveCandidateSubmission(examId, answers, totalQuestions);
    setIsSubmitted(true);
  }

  // Prevent browser back navigation and accidental tab closure during the active assessment
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSubmitted) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isSubmitted]);

  const formatTimer = (secs: number) => {
    const h = String(Math.floor(secs / 3600)).padStart(2, "0");
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // Current question data
  const currentIndex = Math.max(0, Math.min(currentQuestionNumber - 1, totalQuestions - 1));
  const currentQuestionData: Question = questions[currentIndex] || questions[0] || ({
    id: "empty",
    course_id: "c1",
    topic_id: "t1",
    subtopic: "",
    type: "mcq",
    difficulty: 1,
    marks: 1,
    body: "No question available",
    options: [],
    answer_text: "",
    status: "approved",
    source: "mentor",
    agent_run_id: null,
  } as Question);
  const isBookmarked = bookmarkedSet.has(currentQuestionNumber);
  const currentSelectedOption = answers[currentQuestionNumber] ?? null;

  // Option selection handler
  const handleSelectOption = (key: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestionNumber]: key,
    }));
    if (sync && currentQuestionData.id !== "empty") void sync.record(currentQuestionData.id, { option_key: key });
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

  if (sessionQuery.isFetching && !remote) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted shadow-2xs">
        Preparing your assessment…
      </div>
    );
  }

  if (sessionQuery.isError || (remote && remote.status !== "in_progress")) {
    const done = remote && DONE.has(remote.status);
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-xl border border-border bg-surface p-8 text-center shadow-2xs">
        <h3 className="text-base font-bold text-text">
          {done ? "Assessment already submitted" : "This assessment cannot be started"}
        </h3>
        <p className="text-xs text-muted leading-relaxed">
          {done
            ? "Your answers are saved. Your mentor will publish your results and recommendations."
            : sessionQuery.isError
              ? errorMessage(sessionQuery.error)
              : "The assessment window has closed. Please contact your mentor if you think this is a mistake."}
        </p>
        <Button onClick={() => navigate("/candidate/assessments")} className="bg-primary-600 text-white hover:bg-primary-700 text-xs">
          Return to Assessments
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Camera frames are analysed in the browser only; video is never uploaded */}
      <video ref={videoRef} className="hidden" muted playsInline aria-hidden="true" />

      {/* Top Bar matching Screen 8 & Image 2 */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-3.5 shadow-2xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-text">
              {exam?.course || "Full Stack Development"} · {exam?.title || "Assessment"}
            </span>
          </div>
          <div className="text-xs text-muted">
            {totalQuestions > 0 ? (
              <>Question {currentQuestionNumber} of {totalQuestions} • {Math.floor(secondsRemaining / 60)} min left</>
            ) : (
              <>0 Questions configured</>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Live Timer Countdown */}
          <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-text">
            <Clock className="size-4 text-primary-600" />
            <span>{formatTimer(secondsRemaining)}</span>
          </div>

          {/* Flag Counter */}
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              flagCount > 0 ? "bg-danger-50 text-danger-700 border border-danger-500/20" : "bg-surface-muted text-muted"
            }`}
          >
            <div className="flex items-center gap-1">
              {Array.from({ length: maxFlags }, (_, i) => (
                <span key={i} className={`size-2 rounded-full ${flagCount > i ? "bg-danger-500" : "bg-border-strong"}`} />
              ))}
            </div>
            <span>Flags {flagCount} of {maxFlags}</span>
          </div>
        </div>
      </div>

      {/* Zero Questions State Notice */}
      {totalQuestions === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center space-y-4 shadow-2xs my-6">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <HelpCircle className="size-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-text">No Questions Configured</h3>
            <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
              This assessment does not have any questions assigned yet. Please contact your mentor or administrator.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => navigate("/candidate/assessments")}
              className="bg-primary-600 text-white hover:bg-primary-700 text-xs"
            >
              Return to Assessments
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Calm Flag Notice Banner */}
          {showBanner && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-between rounded-xl border border-danger-500/30 bg-danger-50 px-4 py-3 text-xs text-danger-700 shadow-2xs animate-in fade-in"
            >
              <div className="flex items-center gap-2.5">
                <Eye className="size-4 shrink-0 text-danger-500" />
                <span className="font-medium">
                  Flag {notice} of {maxFlags} —{" "}
                  {noticeReason === "tab" ? "please stay on the assessment tab." : "please keep your eyes on the screen."}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDismissedNotice(notice)}
                className="rounded p-0.5 text-danger-700/70 hover:text-danger-700 cursor-pointer"
                aria-label="Dismiss banner"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {/* 2-Column Assessment Layout */}
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
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
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

              {/* Radio Options A, B, C, D */}
              <div className="space-y-3">
                {currentQuestionData.options?.map((opt, idx) => {
                  // options may be shuffled per candidate: letters follow the display order,
                  // while the saved answer stays the option's own key (used for scoring)
                  const isSelected = currentSelectedOption === opt.key;
                  const displayLetter = String.fromCharCode(65 + idx);
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
                        {displayLetter}
                      </div>
                      <span className="leading-relaxed">{opt.text}</span>
                    </label>
                  );
                })}
              </div>

              {/* Bottom Navigation */}
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

            {/* Right Sidebar: Question Palette & Overview */}
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

                {/* Question Chips Grid */}
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
                        className={`relative flex h-8 w-full items-center justify-center rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
        </>
      )}

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
                    className="rounded p-1 text-muted hover:text-text cursor-pointer"
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

                {submitError && (
                  <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 p-3 text-xs text-danger-700">
                    {submitError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={() => setShowSubmitModal(false)}>
                    Return to questions
                  </Button>
                  <Button
                    onClick={() => void handleConfirmSubmit()}
                    disabled={isSubmitting}
                    className="bg-primary-600 text-white hover:bg-primary-700"
                  >
                    {isSubmitting ? "Submitting…" : "Confirm & submit"}
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
                    onClick={() => navigate("/candidate/assessments")}
                    className="w-full sm:w-auto"
                  >
                    Return to Assessments
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

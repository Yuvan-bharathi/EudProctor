import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Mail,
  Play,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { Button } from "@/components/ui/button";
import {
  type CandidateAssessmentResult,
  getPersistedResults,
  publishCandidateResult,
} from "@/lib/mockData";

export function CandidateResultsViewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlExamId = searchParams.get("examId");

  const [resultsList, setResultsList] = useState<CandidateAssessmentResult[]>(getPersistedResults);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(urlExamId);
  const [filterTab, setFilterTab] = useState<"all" | "published" | "pending">("all");
  const [justPublishedToast, setJustPublishedToast] = useState<string | null>(null);

  // Selected result for drilldown
  const activeResult = selectedExamId
    ? resultsList.find((r) => r.examId === selectedExamId) ||
      resultsList.find((r) => r.id === selectedExamId)
    : null;

  usePageTitle(activeResult ? `${activeResult.examTitle} · Results` : "My Assessment Results");

  // Sync with localStorage updates across tabs/windows
  useEffect(() => {
    const handleUpdate = () => {
      setResultsList(getPersistedResults());
    };
    window.addEventListener("eduproctor_results_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("eduproctor_results_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Update selected assessment when URL search param changes
  useEffect(() => {
    if (urlExamId) {
      setSelectedExamId(urlExamId);
    }
  }, [urlExamId]);

  // Filtered list for list view
  const filteredList = resultsList.filter((r) => {
    if (filterTab === "published") return r.status === "published";
    if (filterTab === "pending") return r.status === "pending_review";
    return true;
  });

  const publishedCount = resultsList.filter((r) => r.status === "published").length;
  const pendingCount = resultsList.filter((r) => r.status === "pending_review").length;

  const handleSelectExam = (examId: string) => {
    setSelectedExamId(examId);
    setSearchParams({ examId });
  };

  const handleBackToList = () => {
    setSelectedExamId(null);
    setSearchParams({});
  };

  // Shortcut for demo/testing mentor publish directly
  const handleQuickPublish = (examId: string) => {
    const res = publishCandidateResult(examId);
    setResultsList(getPersistedResults());
    setJustPublishedToast(`Published! AI Email Sending Agent dispatched performance report to ${res.result.candidateEmail}`);
    setTimeout(() => setJustPublishedToast(null), 5000);
  };

  return (
    <div className="w-full space-y-6">
      {justPublishedToast && (
        <div className="flex items-center justify-between rounded-xl border border-success-200 bg-success-50 p-4 text-xs font-medium text-success-800 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success-600" />
            <span>{justPublishedToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setJustPublishedToast(null)}
            className="text-success-700 hover:text-success-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* VIEW 1: DRILLDOWN VIEW (Matching reference image media_1793257640003_eb93a907.png) */}
      {activeResult ? (
        <div className="space-y-6 animate-in fade-in">
          {/* Top Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBackToList}
                className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-surface-muted hover:text-text cursor-pointer"
                aria-label="Back to all assessments"
                title="Back to all results"
              >
                <ArrowLeft className="size-4" />
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight text-text">
                    {activeResult.examTitle} · Results
                  </h2>
                  {activeResult.status === "published" ? (
                    <span className="flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700">
                      <CheckCircle2 className="size-3" />
                      Published by Manager
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-semibold text-warning-800">
                      <Clock className="size-3" />
                      Under Manager Review
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {activeResult.courseName} •{" "}
                  {activeResult.status === "published"
                    ? `Approved by ${activeResult.mentorName?.replace(/Dr\.\s*/g, "")}`
                    : `Awaiting publication by ${activeResult.mentorName?.replace(/Dr\.\s*/g, "")}`}
                </p>
              </div>
            </div>

            {/* Quick action pill if under review */}
            {activeResult.status === "pending_review" && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleQuickPublish(activeResult.examId)}
                  className="gap-1.5 text-xs font-medium text-primary-700 border-primary-200 bg-primary-50/50 hover:bg-primary-100/70"
                >
                  <Sparkles className="size-3.5 text-primary-600" />
                  <span>Simulate Manager Publish & Email</span>
                </Button>
              </div>
            )}
          </div>

          {/* Under Review Notice Banner */}
          {activeResult.status === "pending_review" && (
            <div className="rounded-xl border border-warning-200 bg-warning-50/60 p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-warning-900">
                <Clock className="size-4 text-warning-700" />
                <span>Assessment Submitted & Recorded (Submitted on {activeResult.submittedAt})</span>
              </div>
              <p className="text-xs text-warning-800 leading-relaxed">
                The <strong>Assessment Evaluation Agent</strong> has drafted your topic mastery analysis and performance scorecard.{" "}
                <strong>{activeResult.mentorName?.replace(/Dr\.\s*/g, "")}</strong> is currently reviewing the evaluation summary and approving targeted practice questions.
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-surface/80 p-3 text-xs text-text border border-warning-200">
                <Mail className="size-4 text-primary-600 shrink-0" />
                <span>
                  <strong>Dual Action Notification:</strong> As soon as your manager clicks <em>"Publish Result"</em>, your full scorecard and practice plan will unlock below, and an automated email report with your closed-loop practice set will be sent to <strong>{activeResult.candidateEmail}</strong>.
                </span>
              </div>
            </div>
          )}

          {/* Score Overview Stat Cards (Shown for both, with provisional indication if pending) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs text-center sm:text-left">
              <span className="text-xs font-medium text-muted">Overall Score</span>
              <div className="mt-2 text-3xl font-extrabold text-success-700">
                {activeResult.overallScorePct}%
              </div>
              <span className="text-[11px] text-muted">
                {activeResult.pointsObtained} of {activeResult.totalPoints} points
                {activeResult.status === "pending_review" ? " · Provisional" : ""}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs text-center sm:text-left">
              <span className="text-xs font-medium text-muted">Class Percentile</span>
              <div className="mt-2 text-3xl font-extrabold text-text">
                {activeResult.classPercentile}th
              </div>
              <span className="text-[11px] text-muted">
                Above class average ({activeResult.classAveragePct}%)
              </span>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs text-center sm:text-left">
              <span className="text-xs font-medium text-muted">Topic Progress</span>
              <div className="mt-2 text-3xl font-extrabold text-primary-700">
                +{activeResult.topicProgressPct}%
              </div>
              <span className="text-[11px] text-muted">Gain since baseline test</span>
            </div>
          </div>

          {/* Topic Mastery Distribution */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">Your Topic Mastery</h3>
              <span className="text-xs text-muted">Based on your answers in this assessment</span>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {activeResult.topicMastery.map((item) => {
                const isStrong = item.level === "Strong";
                const isDev = item.level === "Developing";
                return (
                  <span
                    key={item.topic}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      isStrong
                        ? "bg-success-50 text-success-700"
                        : isDev
                          ? "bg-warning-50 text-warning-800"
                          : "bg-danger-50 text-danger-700"
                    }`}
                  >
                    <span
                      className={`size-2 rounded-full ${
                        isStrong
                          ? "bg-success-500"
                          : isDev
                            ? "bg-warning-500"
                            : "bg-danger-500"
                      }`}
                    />
                    {item.topic} · {item.scorePct}% ({item.level})
                  </span>
                );
              })}
            </div>
          </div>

          {/* Manager-Approved Recommendations & Practice Plan */}
          <div className="rounded-xl border border-border bg-surface p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-text">Recommended Learning Topics & Practice</h3>
                <p className="text-xs text-muted">
                  {activeResult.status === "published"
                    ? `${activeResult.mentorName?.replace(/Dr\.\s*/g, "")} approved these study notes and targeted questions for you.`
                    : `AI drafted recommendations pending approval by ${activeResult.mentorName?.replace(/Dr\.\s*/g, "")}.`}
                </p>
              </div>
              <span className="self-start sm:self-auto rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
                Closed Loop Practice
              </span>
            </div>

            {/* Target Area Cards */}
            {activeResult.recommendations.map((rec) => (
              <div
                key={rec.targetArea}
                className="rounded-xl border border-primary-100 bg-primary-50/40 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text">Target Area: {rec.targetArea}</span>
                  <span className="rounded bg-danger-50 px-2 py-0.5 text-[11px] font-semibold text-danger-700">
                    Score: {rec.scorePct}%
                  </span>
                </div>

                <p className="text-xs text-text leading-relaxed">
                  <strong>Recommendation:</strong> {rec.recommendation}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-4 text-primary-600 shrink-0" />
                    <div>
                      <span className="font-semibold text-text">Approved Note: {rec.approvedNoteTitle}</span>
                      <span className="block text-[11px] text-muted">{rec.approvedNoteDescription}</span>
                    </div>
                  </div>

                  <Button asChild size="sm" className="bg-primary-600 text-white hover:bg-primary-700">
                    <Link to={`/candidate/practice?topic=${encodeURIComponent(rec.practiceTopicSlug)}&examId=${activeResult.examId}`}>
                      <Play className="size-3.5" />
                      <span>Start Practice ({rec.practiceCount} Qs)</span>
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Email Agent Delivery Status Box */}
          {activeResult.emailSent && (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs flex items-center justify-between text-xs text-muted">
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-primary-600" />
                <span>
                  <strong>Email Report Delivered:</strong> An official scorecard copy was dispatched to{" "}
                  <span className="font-mono text-text">{activeResult.candidateEmail}</span>.
                </span>
              </div>
              <span className="text-[11px] text-muted font-mono">{activeResult.emailSentAt || "Delivered"}</span>
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: LIST OF ALL ASSESSMENTS TAKEN BY CANDIDATE */
        <div className="space-y-6 animate-in fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-text">My Results & Learning History</h2>
              <p className="text-xs text-muted">
                Review your scores, class percentiles, and manager-approved closed-loop practice sets.
              </p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-border pb-1">
            {[
              { key: "all", label: `All Assessments (${resultsList.length})` },
              { key: "published", label: `Published (${publishedCount})` },
              { key: "pending", label: `Under Review (${pendingCount})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterTab(tab.key as "all" | "published" | "pending")}
                className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  filterTab === tab.key
                    ? "border-primary-600 font-semibold text-primary-700"
                    : "border-transparent text-muted hover:text-text"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Assessments Grid */}
          {filteredList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
              <p className="text-sm font-medium text-text">No assessment results found in this view.</p>
              <p className="text-xs text-muted mt-1">Complete an assessment to view your results here.</p>
              <Button asChild className="mt-4" size="sm">
                <Link to="/candidate/assessments">Go to My Assessments</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredList.map((result) => {
                const isPublished = result.status === "published";
                return (
                  <div
                    key={result.id}
                    onClick={() => handleSelectExam(result.examId)}
                    className="group relative cursor-pointer rounded-xl border border-border bg-surface p-5 shadow-2xs transition-all hover:border-primary-400 hover:shadow-md space-y-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                          {result.courseName}
                        </span>
                        <h3 className="mt-1 text-sm font-bold text-text group-hover:text-primary-700 transition-colors">
                          {result.examTitle}
                        </h3>
                      </div>

                      {isPublished ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700 shrink-0">
                          <CheckCircle2 className="size-3" />
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-semibold text-warning-800 shrink-0">
                          <Clock className="size-3" />
                          Under Review
                        </span>
                      )}
                    </div>

                    {/* Score / Percentile row */}
                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface-muted/60 p-3 text-center">
                      <div>
                        <span className="text-[10px] text-muted block">Score</span>
                        <span className="text-base font-extrabold text-success-700">
                          {result.overallScorePct}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted block">Percentile</span>
                        <span className="text-base font-extrabold text-text">
                          {result.classPercentile}th
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted block">Progress</span>
                        <span className="text-base font-extrabold text-primary-700">
                          +{result.topicProgressPct}%
                        </span>
                      </div>
                    </div>

                    {/* Target Area highlight */}
                    {result.recommendations[0] && (
                      <div className="text-xs text-muted line-clamp-1">
                        <strong className="text-text">Focus Area:</strong>{" "}
                        {result.recommendations[0].targetArea}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                      <span className="text-muted flex items-center gap-1">
                        <Calendar className="size-3" />
                        {result.submittedAt}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-primary-700 group-hover:translate-x-0.5 transition-transform">
                        <span>View Detailed Analysis</span>
                        <ArrowRight className="size-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
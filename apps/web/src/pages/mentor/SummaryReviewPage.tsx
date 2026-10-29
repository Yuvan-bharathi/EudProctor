import {
  ArrowLeft,
  BookOpen,
  Bot,
  CheckCircle2,
  Eye,
  Mail,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import {
  type CandidateAssessmentResult,
  type EmailReportPreview,
  getCandidateResultByExamId,
  getPersistedResults,
  publishCandidateResult,
} from "@/lib/mockData";

export function SummaryReviewPage() {
  usePageTitle("AI Evaluation Summary Review");

  const [searchParams] = useSearchParams();
  const examId = searchParams.get("examId") || "ut-2";

  // Load result from storage or fallback
  const [result, setResult] = useState<CandidateAssessmentResult>(() => {
    const found = getCandidateResultByExamId(examId);
    return found || getPersistedResults()[0];
  });

  // State for Review and Approval flow
  const [status, setStatus] = useState<"draft" | "approved" | "published">(() => {
    return result?.status === "published" ? "published" : "draft";
  });
  const [requestChangesModal, setRequestChangesModal] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [selectedNote, setSelectedNote] = useState(
    result?.recommendations[0]?.approvedNoteTitle || "Energy balance basics"
  );
  const [publishSuccess, setPublishSuccess] = useState(false);

  // AI Email Agent Execution State
  const [isAgentExecuting, setIsAgentExecuting] = useState(false);
  const [agentStep, setAgentStep] = useState(1);
  const [emailPreview, setEmailPreview] = useState<EmailReportPreview | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      const found = getCandidateResultByExamId(examId);
      if (found) {
        setResult(found);
        if (found.status === "published") {
          setStatus("published");
        }
      }
    };
    window.addEventListener("eduproctor_results_updated", handleUpdate);
    return () => window.removeEventListener("eduproctor_results_updated", handleUpdate);
  }, [examId]);

  // Dual Action: Publish Result AND Trigger Email Dispatch Agent
  const handlePublishResult = () => {
    setIsAgentExecuting(true);
    setAgentStep(1);

    setTimeout(() => {
      setAgentStep(2);
    }, 600);

    setTimeout(() => {
      setAgentStep(3);
      // Execute the dual action in storage & agent pipeline
      const { result: updated, emailPreview: preview } = publishCandidateResult(result.examId || "ut-2");
      setResult(updated);
      setEmailPreview(preview);
      setStatus("published");
      setPublishSuccess(true);
      setIsAgentExecuting(false);
    }, 1400);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Link
            to={`/mentor/exams/${result.examId || "ut-2"}/results`}
            className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-surface-muted hover:text-text"
            aria-label="Back to results"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-text">Assessment Evaluation Summary</h2>
              {status === "draft" && (
                <span className="flex items-center gap-1 rounded-full bg-ai-50 px-2.5 py-0.5 text-xs font-semibold text-ai-700">
                  <Sparkles className="size-3" />
                  AI Draft · Needs Review
                </span>
              )}
              {status === "approved" && (
                <span className="flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700">
                  <CheckCircle2 className="size-3" />
                  Approved by Mentor
                </span>
              )}
              {status === "published" && (
                <span className="flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                  <Send className="size-3" />
                  Published to Candidate & Dispatched via Email
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              Candidate: <strong>{result.candidateName}</strong> ({result.candidateEmail}) · {result.examTitle} ({result.courseName})
            </p>
          </div>
        </div>

        {/* Action button header */}
        <div className="flex items-center gap-2">
          {status === "draft" && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setRequestChangesModal(true)}>
                Request changes
              </Button>
              <Button
                size="sm"
                className="bg-primary-600 text-white hover:bg-primary-700"
                onClick={() => setStatus("approved")}
              >
                <CheckCircle2 className="size-4" />
                <span>Approve</span>
              </Button>
            </>
          )}

          {status === "approved" && (
            <Button
              size="sm"
              disabled={isAgentExecuting}
              className="bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
              onClick={handlePublishResult}
            >
              {isAgentExecuting ? (
                <>
                  <Bot className="size-4 animate-spin" />
                  <span>Agent Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  <span>Publish Result & Send Email</span>
                </>
              )}
            </Button>
          )}

          {status === "published" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowEmailModal(true)}
              className="gap-1.5 text-xs text-primary-700 border-primary-200 bg-primary-50/50 hover:bg-primary-100"
            >
              <Mail className="size-3.5 text-primary-600" />
              <span>Preview Dispatched Email</span>
            </Button>
          )}
        </div>
      </div>

      {/* Agent Execution In-Progress Modal */}
      {isAgentExecuting && (
        <div className="rounded-xl border border-primary-300 bg-primary-50/90 p-5 shadow-sm animate-in fade-in space-y-3">
          <div className="flex items-center gap-2.5">
            <Bot className="size-5 text-primary-600 animate-pulse" />
            <h4 className="text-sm font-bold text-primary-950">
              AI Email & Practice Dispatch Agent Executing...
            </h4>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-primary-900">
              <CheckCircle2 className="size-4 text-success-600" />
              <span>Phase 1: Reading topic mastery breakdown & approved study notes...</span>
            </div>
            <div className={`flex items-center gap-2 ${agentStep >= 2 ? "text-primary-900" : "text-muted"}`}>
              {agentStep >= 2 ? (
                <CheckCircle2 className="size-4 text-success-600" />
              ) : (
                <span className="size-4 rounded-full border border-muted" />
              )}
              <span>Phase 2: Generating personalized email template with closed-loop practice link...</span>
            </div>
            <div className={`flex items-center gap-2 ${agentStep >= 3 ? "text-primary-900" : "text-muted"}`}>
              {agentStep >= 3 ? (
                <CheckCircle2 className="size-4 text-success-600" />
              ) : (
                <span className="size-4 rounded-full border border-muted" />
              )}
              <span>Phase 3: Dispatching email to {result.candidateEmail} via Agent API...</span>
            </div>
          </div>
        </div>
      )}

      {publishSuccess && (
        <div className="flex items-center justify-between rounded-xl border border-success-500/30 bg-success-50 p-4 text-xs text-success-700 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success-600 shrink-0" />
            <span>
              <strong>Dual Action Executed Successfully!</strong> Results are now published on{" "}
              <strong>{result.candidateName}</strong>'s portal ("My Results"), and an automated email report with the 8-question practice link was dispatched to <strong>{result.candidateEmail}</strong>.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowEmailModal(true)}
              className="text-xs h-7 text-success-800 border-success-300 hover:bg-success-100"
            >
              <Eye className="size-3 mr-1" />
              Preview Email
            </Button>
            <button
              type="button"
              onClick={() => setPublishSuccess(false)}
              className="text-success-700 hover:opacity-75"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Two Column Layout matching Product Requirements & Design Boards */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.3fr]">
        {/* Left Column: Deterministic Computed Results */}
        <div className="space-y-5">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-text">Computed Assessment Performance</CardTitle>
              <Badge tone="primary">Score: {result.overallScorePct}%</Badge>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-surface-muted p-3 text-center">
                <div className="text-xs text-muted">Correct</div>
                <div className="text-lg font-bold text-success-700">
                  {result.pointsObtained} / {result.totalPoints}
                </div>
              </div>
              <div className="rounded-lg bg-surface-muted p-3 text-center">
                <div className="text-xs text-muted">Percentile</div>
                <div className="text-lg font-bold text-text">{result.classPercentile}th</div>
              </div>
              <div className="rounded-lg bg-surface-muted p-3 text-center">
                <div className="text-xs text-muted">Duration</div>
                <div className="text-lg font-bold text-text">42 min</div>
              </div>
            </div>

            {/* Topic Breakdown */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">Topic Mastery Breakdown</h4>
              <div className="space-y-2">
                {result.topicMastery.map((tm) => (
                  <div key={tm.topic}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-text">{tm.topic}</span>
                      <span
                        className={`font-semibold ${
                          tm.level === "Strong"
                            ? "text-success-700"
                            : tm.level === "Developing"
                              ? "text-warning-800"
                              : "text-danger-700"
                        }`}
                      >
                        {tm.scorePct}% ({tm.level})
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-surface-muted">
                      <div
                        className={`h-full rounded-full ${
                          tm.level === "Strong"
                            ? "bg-success-500"
                            : tm.level === "Developing"
                              ? "bg-warning-500"
                              : "bg-danger-500"
                        }`}
                        style={{ width: `${tm.scorePct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mentor-only Proctoring Snapshot (Strictly confidential) */}
            <div className="rounded-lg border border-border bg-surface-muted/60 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-text">
                <ShieldAlert className="size-3.5 text-muted" />
                <span>Mentor Proctoring Record (Confidential)</span>
              </div>
              <p className="text-muted">
                1 look-away red flag (3.4 s, right) · 4 head glances · 0 collusion risk detected. All answers submitted
                within time limit. Non-punitive calm proctoring compliant.
              </p>
            </div>
          </Card>
        </div>

        {/* Right Column: Lavender AI Draft Card matching Image 2 */}
        <div className="space-y-4">
          <div className="rounded-xl border border-ai-500/20 bg-ai-50 p-6 shadow-sm space-y-5">
            {/* Top AI Badge */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 rounded-full bg-ai-100 px-3 py-1 text-xs font-semibold text-ai-700">
                <Sparkles className="size-3.5 text-ai-500" />
                ✦ AI draft
              </span>
              <span className="text-[11px] text-ai-700/80">Anthropic Claude Evaluation Agent</span>
            </div>

            {/* Topic Pills Row */}
            <div className="flex flex-wrap items-center gap-2">
              {result.topicMastery.map((tm) => (
                <span key={tm.topic} className="inline-flex items-center gap-1 text-xs">
                  <strong className="text-text">{tm.level}:</strong>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      tm.level === "Strong"
                        ? "bg-success-50 text-success-700"
                        : tm.level === "Developing"
                          ? "bg-warning-50 text-warning-800"
                          : "bg-danger-50 text-danger-700"
                    }`}
                  >
                    {tm.topic} · {tm.scorePct}%
                  </span>
                </span>
              ))}
            </div>

            {/* Recommended Learning Content */}
            <div className="rounded-lg border border-ai-100 bg-surface p-4 text-xs space-y-2">
              <div className="font-semibold text-text">Recommended Learning Topics</div>
              <p className="text-text leading-relaxed">
                <strong>1. {result.recommendations[0]?.targetArea || "Core Topics"}</strong> —{" "}
                {result.recommendations[0]?.recommendation ||
                  "Review energy balance basics and complete the 8 practice questions."}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-muted">Approved note assigned:</span>
                <span className="rounded bg-primary-50 px-2 py-0.5 font-medium text-primary-700">
                  “{selectedNote}”
                </span>
                <span className="text-muted">•</span>
                <span className="font-medium text-text">8 practice questions</span>
              </div>
            </div>

            {/* Approved Notes Library Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted">Approved Notes Library Link:</label>
              <select
                value={selectedNote}
                onChange={(e) => setSelectedNote(e.target.value)}
                disabled={status === "published"}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text shadow-2xs focus:border-primary-500 focus:outline-hidden"
              >
                <option value="Energy balance basics">Energy balance basics (Approved · Core)</option>
                <option value="First law sign conventions">First law sign conventions (Approved · Core)</option>
                <option value="PostgreSQL Indexing & Optimization">PostgreSQL Indexing & Optimization (Approved · Advanced)</option>
                <option value="React Server Components & SSR">React Server Components & SSR (Approved · Core)</option>
              </select>
              <p className="text-[10px] text-muted">
                *The AI agent can only recommend notes from the mentor-approved library.
              </p>
            </div>

            {/* Mentor Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {status === "draft" ? (
                <>
                  <Button variant="secondary" onClick={() => setRequestChangesModal(true)}>
                    Request changes
                  </Button>
                  <Button
                    className="bg-primary-600 text-white hover:bg-primary-700"
                    onClick={() => setStatus("approved")}
                  >
                    Approve
                  </Button>
                </>
              ) : status === "approved" ? (
                <Button
                  className="bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
                  disabled={isAgentExecuting}
                  onClick={handlePublishResult}
                >
                  <Send className="size-4" />
                  <span>Publish Result & Send Email</span>
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary-700">
                    <CheckCircle2 className="size-4 text-success-600" />
                    <span>Published to {result.candidateName}'s candidate dashboard & Email sent</span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowEmailModal(true)}
                    className="text-xs text-primary-700"
                  >
                    <Mail className="size-3.5 mr-1 text-primary-600" />
                    View Sent Email
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dispatched Email Preview Modal */}
      {showEmailModal && (() => {
        const activePreview = emailPreview || {
          from: "EduProctor Intelligence Agent <agent@eduproctor.ai>",
          to: `${result.candidateName} <${result.candidateEmail}>`,
          subject: `Your Assessment Results & Recommended Practice: ${result.examTitle}`,
          sentAt: "Just now",
          candidateName: result.candidateName,
          candidateEmail: result.candidateEmail,
          mentorName: result.mentorName,
          examTitle: result.examTitle,
          courseName: result.courseName,
          overallScorePct: result.overallScorePct,
          pointsObtained: result.pointsObtained,
          totalPoints: result.totalPoints,
          classPercentile: result.classPercentile,
          topicMastery: result.topicMastery,
          targetArea: result.recommendations[0]?.targetArea || "Core Topics",
          recommendation:
            result.recommendations[0]?.recommendation ||
            "Study the approved note below and complete the targeted practice questions.",
          approvedNoteTitle: selectedNote,
          practiceLink: `/candidate/practice?topic=${encodeURIComponent(
            result.recommendations[0]?.practiceTopicSlug || "fundamentals"
          )}&examId=${result.examId}`,
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-text/50 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-2xl space-y-4 rounded-xl border border-border bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                    <Mail className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text">Dispatched Candidate Email Report</h4>
                    <p className="text-[11px] text-muted">Sent via EduProctor AI Email Dispatch Agent</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="rounded p-1 text-muted hover:text-text cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Email Metadata */}
              <div className="rounded-lg bg-surface-muted/60 p-3 text-xs space-y-1 font-mono">
                <div>
                  <span className="text-muted">From:</span>{" "}
                  <span className="text-text font-semibold">{activePreview.from}</span>
                </div>
                <div>
                  <span className="text-muted">To:</span>{" "}
                  <span className="text-text">{activePreview.to}</span>
                </div>
                <div>
                  <span className="text-muted">Subject:</span>{" "}
                  <span className="text-primary-700 font-semibold">{activePreview.subject}</span>
                </div>
              </div>

              {/* Email Body Preview */}
              <div className="rounded-xl border border-border bg-surface p-5 space-y-4 text-xs text-text shadow-inner">
                <div className="border-b border-border pb-3">
                  <h3 className="text-base font-bold text-text">Dear {activePreview.candidateName},</h3>
                  <p className="text-muted mt-1 leading-relaxed">
                    Your mentor, <strong>{activePreview.mentorName}</strong>, has reviewed and published your evaluation scorecard for{" "}
                    <strong>{activePreview.examTitle}</strong> ({activePreview.courseName}).
                  </p>
                </div>

                {/* Score Highlight Box */}
                <div className="grid grid-cols-3 gap-3 rounded-xl bg-primary-50/70 p-4 border border-primary-200 text-center">
                  <div>
                    <span className="text-[10px] text-muted block">Overall Score</span>
                    <span className="text-xl font-extrabold text-success-700">{activePreview.overallScorePct}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block">Class Percentile</span>
                    <span className="text-xl font-extrabold text-text">{activePreview.classPercentile}th</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted block">Topic Progress</span>
                    <span className="text-xl font-extrabold text-primary-700">+{result.topicProgressPct}%</span>
                  </div>
                </div>

                {/* Topic Mastery Summary */}
                <div className="space-y-1.5">
                  <span className="font-bold text-text block">Topic Mastery Breakdown:</span>
                  <div className="flex flex-wrap gap-2">
                    {activePreview.topicMastery.map((tm) => (
                      <span
                        key={tm.topic}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          tm.level === "Strong"
                            ? "bg-success-100 text-success-800"
                            : tm.level === "Developing"
                              ? "bg-warning-100 text-warning-900"
                              : "bg-danger-100 text-danger-800"
                        }`}
                      >
                        {tm.topic}: {tm.scorePct}% ({tm.level})
                      </span>
                    ))}
                  </div>
                </div>

                {/* Recommendation & Practice CTA */}
                <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4 space-y-2.5">
                  <div className="font-bold text-primary-950">
                    Targeted Learning Area: {activePreview.targetArea}
                  </div>
                  <p className="text-primary-900 leading-relaxed">
                    {activePreview.recommendation}
                  </p>
                  <div className="flex items-center gap-2 pt-1 font-semibold text-text">
                    <BookOpen className="size-4 text-primary-600" />
                    <span>Approved Note: {activePreview.approvedNoteTitle}</span>
                  </div>
                  <div className="pt-2">
                    <Button asChild size="sm" className="bg-primary-600 text-white hover:bg-primary-700">
                      <Link
                        to={activePreview.practiceLink}
                        onClick={() => setShowEmailModal(false)}
                      >
                        Start Practice (8 Questions) →
                      </Link>
                    </Button>
                  </div>
                </div>

                <p className="text-[11px] text-muted pt-2 border-t border-border">
                  Best regards,<br />
                  <strong>EduProctor Intelligence & Academic Team</strong>
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button onClick={() => setShowEmailModal(false)}>Close Preview</Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Request Changes Modal */}
      {requestChangesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h4 className="text-sm font-semibold text-text">Request Changes from AI Agent</h4>
              <button
                type="button"
                onClick={() => setRequestChangesModal(false)}
                className="rounded p-1 text-muted hover:text-text cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Feedback or adjustment prompt:</label>
              <Textarea
                rows={3}
                placeholder="e.g. Please include 2 additional practice questions on isobaric work calculations."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setRequestChangesModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setRequestChangesModal(false);
                  setFeedback("");
                }}
              >
                Send feedback
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
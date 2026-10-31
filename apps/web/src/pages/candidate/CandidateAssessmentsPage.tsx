import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/app/layouts";
import { AssessmentStatusBadge } from "@/components/AssessmentStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { getPersistedAssessments } from "@/lib/mockData";

type AssessmentFilter = "all" | "scheduled" | "completed";

interface MyAssessmentBackend {
  exam_id: string;
  title: string;
  duration_min: number;
  window_start: string;
  window_end: string;
  session_id: string | null;
  session_status: string | null;
  course_name?: string | null;
  questions_count?: number;
}

export function CandidateAssessmentsPage() {
  usePageTitle("My Assessments");
  const [filter, setFilter] = useState<AssessmentFilter>("all");

  const { data: remoteAssessments, isLoading } = useQuery<MyAssessmentBackend[]>({
    queryKey: ["candidate", "assessments"],
    queryFn: () => api<MyAssessmentBackend[]>("/candidates/me/assessments"),
  });

  const assessments = useMemo(() => {
    if (remoteAssessments && remoteAssessments.length > 0) {
      return remoteAssessments.map((a) => {
        const isCompleted = a.session_status === "submitted" || a.session_status === "scored";
        const startDate = a.window_start
          ? new Date(a.window_start).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Scheduled Test";

        if (isCompleted) {
          return {
            id: a.exam_id,
            title: a.title,
            course: a.course_name || "Full Stack Development",
            submittedDate: startDate,
            duration: `${a.duration_min} minutes`,
            questions: a.questions_count || 60,
            score: 85,
            classAverage: 74,
            status: "completed" as const,
            resultUrl: `/candidate/results?session=${a.session_id || ""}`,
            feedback: "Mentor approved your evaluation summary. Strong in Frontend & APIs.",
          };
        }

        return {
          id: a.exam_id,
          title: a.title,
          course: a.course_name || "Full Stack Development",
          scheduledDate: startDate,
          duration: `${a.duration_min} minutes`,
          questions: a.questions_count || 60,
          status: "scheduled" as const,
          instructionsUrl: `/candidate/instructions?examId=${a.exam_id}`,
          requirements: ["Webcam & Microphone Required", "Non-punitive capped monitoring", "IDE Scratchpad Enabled"],
        };
      });
    }

    const storedAssessments = getPersistedAssessments();
    return storedAssessments
      .filter((a) => a.status === "scheduled" || a.status === "live" || a.status === "completed")
      .map((a) => {
        if (a.status === "completed") {
          return {
            id: a.id,
            title: a.title,
            course: a.course,
            submittedDate: "10 Jan 2026",
            duration: `${a.duration_min} minutes`,
            questions: a.questions || 40,
            score: 82,
            classAverage: 74,
            status: "completed" as const,
            resultUrl: "/candidate/results",
            feedback:
              "Mentor approved your evaluation summary. Strong in Frontend & APIs, practice recommended for Database Isolation.",
          };
        }
        return {
          id: a.id,
          title: a.title,
          course: a.course,
          scheduledDate: "15 Jan 2026, 10:00 AM",
          duration: `${a.duration_min} minutes`,
          questions: a.questions || 40,
          status: "scheduled" as const,
          instructionsUrl: `/candidate/instructions?examId=${a.id}`,
          requirements: ["Webcam & Microphone Required", "Non-punitive capped monitoring", "IDE Scratchpad Enabled"],
        };
      });
  }, [remoteAssessments]);

  const filtered = assessments.filter((a) => {
    if (filter === "all") return true;
    return a.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-text">My Assessments</h2>
        <p className="text-xs text-muted">Track your upcoming tests, instructions, and completed performance reviews.</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { key: "all", label: "All Assessments", count: assessments.length },
          { key: "scheduled", label: "Scheduled", count: assessments.filter((a) => a.status === "scheduled").length },
          { key: "completed", label: "Completed", count: assessments.filter((a) => a.status === "completed").length },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key as AssessmentFilter)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              filter === tab.key
                ? "bg-primary-50 text-primary-700 shadow-2xs"
                : "text-muted hover:bg-surface-muted hover:text-text"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-xs text-muted">
          <Loader2 className="size-4 animate-spin text-primary-600" />
          <span>Loading scheduled assessments...</span>
        </div>
      )}

      {/* Assessments List */}
      <div className="space-y-4">
        {filtered.map((item) => {
          if (item.status === "scheduled") {
            return (
              <Card
                key={item.id}
                className="flex flex-col justify-between gap-6 border-border p-6 shadow-2xs transition-all hover:border-primary-200 md:flex-row md:items-center"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <AssessmentStatusBadge status="scheduled" size="sm" />
                    <span className="text-xs font-mono text-muted">{item.course}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-text">{item.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-primary-600" />
                        {item.scheduledDate}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-muted" />
                        {item.duration}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <HelpCircle className="size-3.5 text-muted" />
                        {item.questions} questions
                      </span>
                    </div>
                  </div>

                  {/* Requirements Badges */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.requirements.map((req) => (
                      <span
                        key={req}
                        className="inline-flex items-center gap-1 rounded bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted"
                      >
                        <ShieldCheck className="size-3 text-success-600" />
                        {req}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t border-border pt-4 md:border-t-0 md:pt-0">
                  <Button asChild className="bg-primary-600 font-medium text-white shadow-xs hover:bg-primary-700">
                    <Link to={item.instructionsUrl}>View instructions & pre-checks</Link>
                  </Button>
                </div>
              </Card>
            );
          }

          // Completed assessment card
          return (
            <Card
              key={item.id}
              className="flex flex-col justify-between gap-6 border-border p-6 shadow-2xs transition-all hover:border-primary-200 md:flex-row md:items-center"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700">
                    <CheckCircle2 className="size-3.5" />
                    Completed & Published
                  </span>
                  <span className="text-xs font-mono text-muted">{item.course}</span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-text">{item.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-muted" />
                      Submitted {item.submittedDate}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-muted" />
                      {item.duration}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="size-3.5 text-muted" />
                      {item.questions} questions
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs text-muted">Your Score:</span>
                    <span className="text-2xl font-extrabold text-success-700">{item.score}%</span>
                  </div>
                  <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-muted">
                    Class average: {item.classAverage}%
                  </span>
                  <Badge tone="success">Integrity Verified</Badge>
                </div>

                <p className="text-xs text-muted">{item.feedback}</p>
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-4 md:border-t-0 md:pt-0">
                <Button asChild variant="secondary" className="gap-1.5">
                  <Link to={item.resultUrl}>
                    <Award className="size-3.5 text-primary-600" />
                    <span>View result & AI recommendations</span>
                  </Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Proctoring Assurance Info Banner */}
      <Card className="flex items-start gap-4 border-primary-200 bg-primary-50/50 p-5">
        <ShieldCheck className="size-5 shrink-0 text-primary-700 mt-0.5" />
        <div className="space-y-1 text-xs">
          <span className="font-semibold text-text">Gentle, Non-Punitive Proctoring Standards</span>
          <p className="text-muted leading-relaxed">
            EduProctor is built to help you perform at your best. Our camera and browser integrity checks are calibrated
            with a capped 3-flag notification threshold. No test is ever automatically stopped or disqualified by an algorithm.
            Your mentor personally reviews all integrity telemetry before decisions are finalized.
          </p>
        </div>
      </Card>
    </div>
  );
}

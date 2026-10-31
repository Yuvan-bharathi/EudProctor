import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/app/layouts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/store";
import { api } from "@/lib/api";
import { mockCandidateDashboard } from "@/lib/mockData";

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

export function CandidateHomePage() {
  usePageTitle("Candidate Dashboard");
  const { user } = useAuth();
  const data = mockCandidateDashboard;

  const { data: remoteAssessments, isLoading } = useQuery<MyAssessmentBackend[]>({
    queryKey: ["candidate", "assessments"],
    queryFn: () => api<MyAssessmentBackend[]>("/candidates/me/assessments"),
  });

  const nextAss = remoteAssessments?.find(
    (a) => a.session_status !== "submitted" && a.session_status !== "scored"
  ) ?? remoteAssessments?.[0];

  const nextTitle = nextAss?.title ?? data.nextAssessment.title;
  const nextCourse = nextAss?.course_name ?? data.nextAssessment.course;
  const nextDuration = nextAss ? `${nextAss.duration_min} minutes` : data.nextAssessment.duration;
  const nextQuestions = nextAss ? `${nextAss.questions_count || 60} questions` : `${data.nextAssessment.questions} questions`;
  const nextScheduled = nextAss?.window_start
    ? new Date(nextAss.window_start).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : data.nextAssessment.scheduled;
  const nextInstructionsUrl = nextAss ? `/candidate/instructions?examId=${nextAss.exam_id}` : "/candidate/instructions";
  const upcomingCount = remoteAssessments && remoteAssessments.length > 0 ? remoteAssessments.length : data.upcomingAssessments;

  return (
    <div className="space-y-6">
      {/* Top Welcome Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-text">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
        </h2>
        <p className="text-xs text-muted">Continue your learning journey.</p>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Upcoming assessments */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Upcoming assessments</span>
            <ClipboardList className="size-4 text-primary-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text">{upcomingCount}</span>
            <span className="text-[11px] text-primary-700">Scheduled</span>
          </div>
        </div>

        {/* Recent result */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Recent result</span>
            <Award className="size-4 text-success-700" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-success-700">{data.recentResults}</span>
            <span className="text-[11px] text-muted">Published</span>
          </div>
        </div>

        {/* Practice topics */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Practice topics</span>
            <BookOpen className="size-4 text-info-700" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text">{data.practiceTopics}</span>
            <span className="text-[11px] text-muted">Recommended</span>
          </div>
        </div>

        {/* Completed practice sets */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Completed practice sets</span>
            <CheckCircle2 className="size-4 text-primary-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text">{data.completedPracticeSets}</span>
            <span className="text-[11px] text-muted">Mastery tracked</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Your next assessment */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-6 shadow-2xs">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted gap-2">
              <Loader2 className="size-5 animate-spin text-primary-600" />
              <span>Checking your scheduled assessments...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">Your next assessment</span>
                <span className="rounded-full bg-info-50 px-2.5 py-0.5 text-xs font-medium text-info-700">
                  Scheduled
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-text">{nextTitle}</h3>
                <p className="text-xs text-muted">{nextCourse}</p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-3.5" />
                  {nextScheduled}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {nextDuration}
                </span>
                <span className="flex items-center gap-1.5">
                  <HelpCircle className="size-3.5" />
                  {nextQuestions}
                </span>
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-border pt-4">
            <Button asChild className="w-full bg-primary-600 text-white hover:bg-primary-700">
              <Link to={nextInstructionsUrl}>View instructions & pre-checks</Link>
            </Button>
          </div>
        </div>

        {/* Card 2: Recent result */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-6 shadow-2xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Recent result</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-700">
                <CheckCircle2 className="size-3" />
                Published
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-text">{data.recentResult.title}</h3>
              <p className="text-xs text-muted">{data.recentResult.course}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-success-700">{data.recentResult.score}%</div>
              <div className="text-xs text-muted">Class average: {data.recentResult.classAverage}%</div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted">
              <CheckCircle2 className="size-3.5 text-success-600" />
              <span>{data.recentResult.integrityBadge}</span>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <Button asChild variant="secondary" className="w-full">
              <Link to="/candidate/results">View breakdown</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Recommended Practice Section */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-text">Recommended practice sets</h3>
            <p className="text-xs text-muted">AI-targeted practice based on recent topic performance.</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1 text-primary-600">
            <Link to="/candidate/practice">
              <span>View all topics</span>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {data.practiceTopicsList.map((topic) => (
            <Link
              key={topic.id}
              to={`/candidate/practice/${topic.id}`}
              className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:border-primary-300 hover:bg-surface-muted"
            >
              <div>
                <div className="text-xs font-semibold text-text">{topic.name}</div>
                <div className="text-[11px] text-muted">{topic.questions} questions available</div>
              </div>
              <ChevronRight className="size-4 text-muted" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

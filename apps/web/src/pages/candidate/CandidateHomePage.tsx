import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  HelpCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/store";
import { mockCandidateDashboard } from "@/lib/mockData";

export function CandidateHomePage() {
  usePageTitle("Candidate Dashboard");
  const { user } = useAuth();
  const data = mockCandidateDashboard;

  return (
    <div className="space-y-6">
      {/* Top Welcome Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-text">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
        </h2>
        <p className="text-xs text-muted">Continue your learning journey.</p>
      </div>

      {/* 4 Stat Cards matching Screen 5:
          2 Upcoming assessments, 1 Recent result, 5 Practice topics, 3 Completed practice sets */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Upcoming assessments */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Upcoming assessments</span>
            <ClipboardList className="size-4 text-primary-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text">{data.upcomingAssessments}</span>
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

      {/* Main Grid: Your next assessment & Recent result matching Screen 5 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Your next assessment */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-6 shadow-2xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Your next assessment</span>
              <span className="rounded-full bg-info-50 px-2.5 py-0.5 text-xs font-medium text-info-700">
                Scheduled
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-text">{data.nextAssessment.title}</h3>
              <p className="text-xs text-muted">{data.nextAssessment.course}</p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                {data.nextAssessment.scheduled}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {data.nextAssessment.duration}
              </span>
              <span className="flex items-center gap-1.5">
                <HelpCircle className="size-3.5" />
                {data.nextAssessment.questions} questions
              </span>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <Button asChild className="w-full bg-primary-600 text-white hover:bg-primary-700">
              <Link to="/candidate/instructions">View instructions</Link>
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
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-muted">Score:</span>
                <span className="text-3xl font-extrabold text-success-700">{data.recentResult.score}%</span>
              </div>
              <span className="rounded-md bg-surface-muted px-2 py-1 text-xs text-muted">
                Class average: 71%
              </span>
            </div>

            <p className="text-xs text-muted">
              Mentor approved your evaluation summary. Targeted practice questions and learning notes are ready.
            </p>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <Button asChild variant="secondary" className="w-full">
              <Link to="/candidate/results">View result & recommendations</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Recommended Practice Section */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text">Recommended Learning Topics</h3>
            <p className="text-xs text-muted">Curated by mentor-approved AI evaluation to reinforce key concepts</p>
          </div>
          <Link
            to="/candidate/practice"
            className="flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
          >
            <span>All Practice Topics</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface-muted/50 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-text">Backend & Databases</span>
              <span className="rounded bg-danger-50 px-1.5 py-0.5 text-[10px] font-semibold text-danger-700">Weak</span>
            </div>
            <p className="text-xs text-muted">Review ACID transaction isolation and connection pooling.</p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-primary-700">Note: PostgreSQL Indexing & Optimization</span>
              <Button asChild size="sm" variant="secondary" className="h-7 text-xs">
                <Link to="/candidate/practice/backend">Practice</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-muted/50 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-text">AI Engineering & LLMs</span>
              <span className="rounded bg-warning-50 px-1.5 py-0.5 text-[10px] font-semibold text-warning-800">Developing</span>
            </div>
            <p className="text-xs text-muted">RAG chunking, vector embeddings, and prompt chaining.</p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-primary-700">Note: RAG Architecture & Vector Embeddings</span>
              <Button asChild size="sm" variant="secondary" className="h-7 text-xs">
                <Link to="/candidate/practice/ai-engineer">Practice</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-muted/50 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-text">Frontend Engineering</span>
              <span className="rounded bg-success-50 px-1.5 py-0.5 text-[10px] font-semibold text-success-700">Strong</span>
            </div>
            <p className="text-xs text-muted">React Hooks, TypeScript generics, and Web Vitals.</p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-primary-700">Note: Modern CSS Grid & Flexbox</span>
              <Button asChild size="sm" variant="secondary" className="h-7 text-xs">
                <Link to="/candidate/practice/frontend">Challenge</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

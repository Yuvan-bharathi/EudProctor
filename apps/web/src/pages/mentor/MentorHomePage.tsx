import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { RecentPerformanceMultiBarChart } from "@/components/charts";
import { Card, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/store";
import { mockMentorDashboard } from "@/lib/mockData";

export function MentorHomePage() {
  usePageTitle("Mentor Dashboard");
  const { user } = useAuth();

  const stats = mockMentorDashboard;

  return (
    <div className="space-y-6">
      {/* Top Welcome Bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-text">
            Good morning, {user?.name ? user.name.split(" ")[0] : "Mentor"}!
          </h2>
          <p className="text-xs text-muted">Here's what's happening with your interview assessments.</p>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Active assessments */}
        <div className="rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Active assessments</span>
            <div className="flex size-7 items-center justify-center rounded-md bg-primary-50 text-primary-600">
              <ClipboardList className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text">{stats.activeAssessments}</span>
            <span className="text-[11px] font-medium text-primary-700">Live now</span>
          </div>
        </div>

        {/* Candidates */}
        <div className="rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Candidates</span>
            <div className="flex size-7 items-center justify-center rounded-md bg-info-50 text-info-700">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text">{stats.candidates}</span>
            <span className="text-[11px] text-muted">Enrolled cohort</span>
          </div>
        </div>

        {/* Submissions */}
        <div className="rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Submissions</span>
            <div className="flex size-7 items-center justify-center rounded-md bg-success-50 text-success-700">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text">{stats.submissions}</span>
            <span className="text-[11px] text-muted">65% submitted</span>
          </div>
        </div>

        {/* Pending reviews */}
        <div className="rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Pending reviews</span>
            <div className="flex size-7 items-center justify-center rounded-md bg-ai-50 text-ai-700">
              <Sparkles className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ai-700">{stats.pendingReviews}</span>
            <span className="text-[11px] font-medium text-warning-800">Requires sign-off</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Performance & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Left: Recent Performance Multi-Bar Chart */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-text">Recent performance</CardTitle>
              <p className="text-xs text-muted">Class mastery distribution across core syllabus topics</p>
            </div>
            <Link
              to="/mentor/results"
              className="flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
            >
              <span>Full Analytics</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
          <RecentPerformanceMultiBarChart data={stats.performanceData} />
        </Card>

        {/* Right: Recent Activity */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-text">Recent activity</CardTitle>
            <span className="text-[11px] text-muted">Live updates</span>
          </div>

          <div className="space-y-4">
            {stats.recentActivity.map((act) => (
              <div key={act.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface-muted/40 p-3 transition-colors hover:bg-surface-muted">
                <div
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${
                    act.type === "ai_review"
                      ? "bg-ai-50 text-ai-700"
                      : act.type === "submission"
                        ? "bg-success-50 text-success-700"
                        : act.type === "link_sent"
                          ? "bg-primary-50 text-primary-700"
                          : "bg-info-50 text-info-700"
                  }`}
                >
                  {act.type === "ai_review" ? (
                    <Sparkles className="size-3.5" />
                  ) : act.type === "submission" ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : act.type === "link_sent" ? (
                    <Send className="size-3.5" />
                  ) : (
                    <FileCheck2 className="size-3.5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-xs font-semibold text-text">{act.title}</p>
                    <span className="shrink-0 text-[10px] text-muted">{act.time}</span>
                  </div>
                  <p className="truncate text-xs text-muted">{act.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-border pt-3">
            <Link
              to="/mentor/exams"
              className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline"
            >
              <span>Manage all assessments</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Quick Access Assessment Highlights */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Currently Active · Unit test 3 - Applied Concepts</h3>
          <Link
            to="/mentor/exams/ut-3/live"
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700"
          >
            <span>Open Live Monitor</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-muted p-3">
            <div className="text-[11px] text-muted">Assigned Candidates</div>
            <div className="text-lg font-bold text-text">45 candidates</div>
          </div>
          <div className="rounded-lg bg-surface-muted p-3">
            <div className="text-[11px] text-muted">Test In Progress</div>
            <div className="text-lg font-bold text-primary-700">28 started (62%)</div>
          </div>
          <div className="rounded-lg bg-surface-muted p-3">
            <div className="text-[11px] text-muted">Proctoring Flags Raised</div>
            <div className="text-lg font-bold text-danger-700">1 flagged · max 3</div>
          </div>
        </div>
      </div>
    </div>
  );
}

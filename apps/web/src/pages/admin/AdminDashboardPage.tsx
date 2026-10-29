import {
  Activity,
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Flag,
  GraduationCap,
  Server,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { AssessmentStatusBadge } from "@/components/AssessmentStatusBadge";
import {
  AssessmentActivityLineChart,
  AssessmentOutcomesDonut,
  UserDistributionDonut,
} from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  type FlaggedSessionRecent,
  type SystemHealthService,
  mockAgentUsage,
  mockAssessmentActivity,
  mockAssessmentOutcomes,
  mockFlaggedSessionsRecent,
  mockPendingActions,
  mockPlatformActivity,
  mockSystemHealth,
  mockTopCourses,
  mockUserDistribution,
  getPersistedAssessments,
} from "@/lib/mockData";

export function AdminDashboardPage() {
  usePageTitle("Platform Overview · Admin Dashboard");

  const [dateRange, setDateRange] = useState("1 Jan 2024 - 31 Jan 2024");
  const [activityTimeframe, setActivityTimeframe] = useState("Last 30 days");

  // Drill-down modal states
  const [assessmentsList] = useState(getPersistedAssessments());
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [selectedFlagSession, setSelectedFlagSession] = useState<FlaggedSessionRecent | null>(null);

  return (
    <div className="space-y-6">
      {/* Top Header with Date Range Filter */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-text">Platform Overview</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
              <span className="size-1.5 rounded-full bg-success-500 animate-pulse" />
              Live System
            </span>
          </div>
          <p className="text-xs text-muted">Assessment integrity, learning outcomes, and candidate screening at a glance.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text shadow-2xs">
            <Calendar className="size-3.5 text-muted" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent text-xs text-text focus:outline-hidden"
            >
              <option value="1 Jan 2024 - 31 Jan 2024">1 Jan 2024 – 31 Jan 2024</option>
              <option value="1 Dec 2023 - 31 Dec 2023">1 Dec 2023 – 31 Dec 2023</option>
              <option value="Last 90 days">Last 90 days</option>
              <option value="Academic Year 2024-25">Academic Year 2024–25</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5 Top Summary Metric Cards matching Reference Images 1, 2, 3, 4 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Total Candidates */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Total Candidates</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-info-50 text-info-700">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-text">1,248</div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-success-700">
              <TrendingUp className="size-3" />
              <span>+12% vs last month</span>
            </div>
          </div>
        </div>

        {/* Total Mentors */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Total Mentors</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
              <GraduationCap className="size-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-text">86</div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-success-700">
              <TrendingUp className="size-3" />
              <span>+8% vs last month</span>
            </div>
          </div>
        </div>

        {/* Total Assessments */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Total Assessments</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-ai-50 text-ai-700">
              <FileText className="size-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-text">312</div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-success-700">
              <TrendingUp className="size-3" />
              <span>+18% vs last month</span>
            </div>
          </div>
        </div>

        {/* Completed Assessments */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Completed Assessments</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-success-50 text-success-700">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-text">6,920</div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-success-700">
              <TrendingUp className="size-3" />
              <span>+14% vs last month</span>
            </div>
          </div>
        </div>

        {/* Flagged Sessions */}
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Flagged Sessions</span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-danger-50 text-danger-700">
              <Flag className="size-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-danger-700">214</div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-success-700">
              <TrendingDown className="size-3 text-success-700" />
              <span>-3% vs last month</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Assessment Activity (spline chart), Outcomes (donut), Platform Health */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr_1fr] min-w-0">
        {/* Assessment Activity Multi-Line Chart */}
        <Card className="p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-text">Assessment Activity</CardTitle>
              <p className="text-[11px] text-muted">Scheduled, completed, and flagged session trends</p>
            </div>
            <select
              value={activityTimeframe}
              onChange={(e) => setActivityTimeframe(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-muted focus:outline-hidden"
            >
              <option value="Last 7 days">Last 7 days</option>
              <option value="Last 30 days">Last 30 days</option>
              <option value="Last 90 days">Last 90 days</option>
            </select>
          </div>

          <AssessmentActivityLineChart data={mockAssessmentActivity} />
        </Card>

        {/* Assessment Outcomes Donut Chart */}
        <Card className="p-5 space-y-3 min-w-0">
          <div>
            <CardTitle className="text-sm font-semibold text-text">Assessment Outcomes</CardTitle>
            <p className="text-[11px] text-muted">Mastery classification across {mockAssessmentOutcomes.total.toLocaleString()} submissions</p>
          </div>

          <div className="pt-2">
            <AssessmentOutcomesDonut
              total={mockAssessmentOutcomes.total}
              strong={mockAssessmentOutcomes.strong.pct}
              developing={mockAssessmentOutcomes.developing.pct}
              weak={mockAssessmentOutcomes.weak.pct}
            />
          </div>
        </Card>

        {/* Platform Health / System Status Widget */}
        <Card className="p-5 space-y-3 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-text">Platform Health</CardTitle>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="size-2 rounded-full bg-success-500 animate-pulse" />
                  <span className="text-[11px] font-medium text-success-700">All systems operational</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHealthModalOpen(true)}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary-700 hover:underline"
              >
                <span>View Details</span>
                <ChevronRight className="size-3" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {mockSystemHealth.slice(0, 5).map((srv) => (
                <div
                  key={srv.id}
                  onClick={() => setHealthModalOpen(true)}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-border/50 bg-bg/50 px-2.5 py-1.5 text-xs transition-colors hover:bg-surface-muted"
                >
                  <div className="flex items-center gap-2">
                    <Server className="size-3.5 text-muted" />
                    <span className="font-medium text-text">{srv.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted">{srv.latency}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success-700">
                      <span className="size-1.5 rounded-full bg-success-500" />
                      {srv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted">
            <span>Uptime: 99.98% (30d)</span>
            <span className="text-primary-700 font-medium">Auto-scaling Active</span>
          </div>
        </Card>
      </div>

      {/* Row 3: User Distribution (donut), Top Courses by Assessments, Pending Actions */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr_1.1fr] min-w-0">
        {/* User Distribution Donut */}
        <Card className="p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-text">Users by Role</CardTitle>
              <p className="text-[11px] text-muted">Active accounts across institutional cohorts</p>
            </div>
            <Link to="/admin/users" className="text-[11px] font-semibold text-primary-700 hover:underline">
              View all →
            </Link>
          </div>

          <div className="pt-2">
            <UserDistributionDonut
              total={mockUserDistribution.total}
              candidates={mockUserDistribution.candidates.pct}
              mentors={mockUserDistribution.mentors.pct}
              admins={mockUserDistribution.admins.pct}
              inactive={mockUserDistribution.inactive.pct}
            />
          </div>
        </Card>

        {/* Top Courses by Assessments */}
        <Card className="p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-text">Assessments by Technology Track</CardTitle>
              <p className="text-[11px] text-muted">Volume, enrollment, and candidate completion rates</p>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            {mockTopCourses.map((c) => (
              <div key={c.course} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-text">{c.course}</span>
                  <div className="flex items-center gap-3 text-[11px] text-muted">
                    <span>{c.assessments} tests</span>
                    <span>{c.candidates} learners</span>
                    <span className="font-semibold text-text">{c.completionRate}%</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                  <div
                    className="h-full rounded-full bg-primary-600 transition-all"
                    style={{ width: `${c.completionRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Pending Actions List */}
        <Card className="p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-text">Pending Actions</CardTitle>
              <p className="text-[11px] text-muted">Items requiring mentor or administrator intervention</p>
            </div>
            <span className="rounded-full bg-danger-50 px-2 py-0.5 text-[10px] font-bold text-danger-700">
              {mockPendingActions.reduce((acc, p) => acc + p.count, 0)} total
            </span>
          </div>

          <div className="space-y-2 pt-1">
            {mockPendingActions.map((act) => (
              <Link
                key={act.id}
                to={act.path}
                className="group flex items-center justify-between rounded-lg border border-border bg-bg/40 p-2.5 text-xs transition-colors hover:border-primary-500/50 hover:bg-surface"
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      act.severity === "danger"
                        ? "bg-danger-50 text-danger-700"
                        : act.severity === "warning"
                          ? "bg-warning-50 text-warning-700"
                          : "bg-info-50 text-info-700"
                    }`}
                  >
                    {act.count}
                  </div>
                  <div>
                    <div className="font-semibold text-text group-hover:text-primary-700 transition-colors">
                      {act.title}
                    </div>
                    <div className="text-[10px] text-muted">{act.desc}</div>
                  </div>
                </div>
                <ChevronRight className="size-3.5 text-muted group-hover:text-text transition-colors" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Row 4: Recent Assessments, Flagged Sessions Table & AI Agent Usage */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1.3fr_1fr] min-w-0">
        {/* Recent Assessments Table */}
        <Card className="p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-text">Recent Assessments</CardTitle>
              <p className="text-[11px] text-muted">Recently scheduled and completed evaluations</p>
            </div>
            <Link to="/admin/exams" className="text-[11px] font-semibold text-primary-700 hover:underline">
              View all →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-muted/50 text-[10px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-2 px-2.5">Title</th>
                  <th className="py-2 px-2.5">Course</th>
                  <th className="py-2 px-2.5">Status</th>
                  <th className="py-2 px-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {assessmentsList.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-muted/30 transition-colors">
                    <td className="py-2.5 px-2.5 font-medium text-text">{a.title}</td>
                    <td className="py-2.5 px-2.5 text-muted">{a.course}</td>
                    <td className="py-2.5 px-2.5">
                      <AssessmentStatusBadge status={a.status} size="sm" />
                    </td>
                    <td className="py-2.5 px-2.5 text-right">
                      <Link
                        to={`/admin/exams/${a.id}`}
                        className="rounded px-2 py-1 text-[11px] font-medium text-primary-700 hover:bg-primary-50 transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Flagged Sessions (Recent) with Drill-down Inspection */}
        <Card className="p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-text">Flagged Sessions (Recent)</CardTitle>
              <p className="text-[11px] text-muted">Look-aways and tab switches under mentor verification</p>
            </div>
            <Link to="/admin/exams/ut-3" className="text-[11px] font-semibold text-primary-700 hover:underline">
              View all →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-muted/50 text-[10px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-2 px-2.5">Candidate</th>
                  <th className="py-2 px-2.5">Assessment</th>
                  <th className="py-2 px-2.5 text-center">Flags</th>
                  <th className="py-2 px-2.5">Status</th>
                  <th className="py-2 px-2.5 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {mockFlaggedSessionsRecent.map((fs) => (
                  <tr key={fs.id} className="hover:bg-surface-muted/30 transition-colors">
                    <td className="py-2.5 px-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700">
                          {fs.avatar}
                        </div>
                        <div className="truncate max-w-[100px]">
                          <div className="font-medium text-text truncate">{fs.candidateName}</div>
                          <div className="text-[10px] text-muted truncate">{fs.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-muted">{fs.assessment}</td>
                    <td className="py-2.5 px-2.5 text-center">
                      <span className="inline-flex items-center rounded-full bg-danger-50 px-2 py-0.5 text-[10px] font-bold text-danger-700">
                        {fs.flags} / 3
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          fs.status === "Under Review"
                            ? "bg-warning-50 text-warning-700"
                            : "bg-success-50 text-success-700"
                        }`}
                      >
                        {fs.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedFlagSession(fs)}
                        className="rounded px-2 py-1 text-[11px] font-semibold text-primary-700 hover:bg-primary-50 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* AI Agent Usage (Last 30 Days) */}
        <Card className="p-5 space-y-4 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-text">Agent Usage (30d)</CardTitle>
                <p className="text-[11px] text-muted">Evaluation & suggestion runs</p>
              </div>
              <Link to="/admin/agent" className="text-[11px] font-semibold text-primary-700 hover:underline">
                Trace log →
              </Link>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text">{mockAgentUsage.totalRuns}</span>
              <span className="text-xs font-semibold text-success-700">{mockAgentUsage.change}</span>
            </div>

            <div className="mt-4 space-y-2.5">
              {mockAgentUsage.tools.map((t) => (
                <div key={t.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">{t.name}</span>
                    <span className="font-semibold text-text">{t.count} runs</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                    <div
                      className="h-full rounded-full bg-ai-500 transition-all"
                      style={{ width: `${t.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <Bot className="size-3.5 text-ai-700" />
              Human-in-the-loop: 100%
            </span>
            <span className="text-success-700 font-medium">0 Hallucinations</span>
          </div>
        </Card>
      </div>

      {/* Row 5: Recent Platform Activity Stream */}
      <Card className="p-5 space-y-3 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-text">Recent Platform Activity</CardTitle>
            <p className="text-[11px] text-muted">Audit trail of assessments, user provisioning, and evaluation summaries</p>
          </div>
          <Link to="/admin/audit" className="text-[11px] font-semibold text-primary-700 hover:underline">
            View full audit logs →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-muted/50 text-[10px] uppercase tracking-wider text-muted">
              <tr>
                <th className="py-2 px-3">Time</th>
                <th className="py-2 px-3">Event Type</th>
                <th className="py-2 px-3">Details</th>
                <th className="py-2 px-3">User / Actor</th>
                <th className="py-2 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {mockPlatformActivity.map((pa) => (
                <tr key={pa.id} className="hover:bg-surface-muted/30 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-muted text-[11px]">{pa.time}</td>
                  <td className="py-2.5 px-3 font-semibold text-text">{pa.type}</td>
                  <td className="py-2.5 px-3 text-muted">{pa.details}</td>
                  <td className="py-2.5 px-3 text-text font-medium">{pa.user}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        pa.status === "Success"
                          ? "bg-success-50 text-success-700"
                          : "bg-danger-50 text-danger-700"
                      }`}
                    >
                      {pa.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* =========================================================================
          DRILL-DOWN MODAL 1: SYSTEM HEALTH DIAGNOSTICS
          ========================================================================= */}
      {healthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-5 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-success-50 text-success-700">
                  <Activity className="size-4.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text">System Health & Infrastructure Diagnostics</h3>
                  <p className="text-xs text-muted">Real-time status of services, queues, and database latency</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHealthModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-text transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3">
              {mockSystemHealth.map((srv: SystemHealthService) => (
                <div
                  key={srv.id}
                  className="rounded-xl border border-border bg-bg/50 p-3.5 space-y-1.5 transition-colors hover:border-primary-500/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-success-500" />
                      <span className="font-semibold text-text text-sm">{srv.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted">Latency: {srv.latency}</span>
                      <span className="rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-bold text-success-700">
                        Uptime {srv.uptime}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted">{srv.description}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/80 bg-surface-muted/40 p-3 text-xs text-muted flex items-center justify-between">
              <span>Next automated heartbeat check in 14s</span>
              <span className="font-semibold text-primary-700">All 6 microservices nominal</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setHealthModalOpen(false)}>
                Close Diagnostics
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DRILL-DOWN MODAL 2: FLAGGED SESSION INSPECTOR
          ========================================================================= */}
      {selectedFlagSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-5 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-danger-50 text-danger-700">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text">Flagged Session Drill-Down</h3>
                  <p className="text-xs text-muted">
                    Candidate: {selectedFlagSession.candidateName} ({selectedFlagSession.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFlagSession(null)}
                className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-text transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Quick Context Card */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-border bg-bg/50 p-3">
                <div className="text-muted">Assessment</div>
                <div className="font-semibold text-text">{selectedFlagSession.assessment}</div>
                <div className="text-[11px] text-muted">{selectedFlagSession.course}</div>
              </div>
              <div className="rounded-lg border border-border bg-bg/50 p-3">
                <div className="text-muted">Proctoring Flag Total</div>
                <div className="font-bold text-danger-700 text-base">
                  {selectedFlagSession.flags} of 3 (Capped)
                </div>
                <div className="text-[11px] text-muted">Last look-away at {selectedFlagSession.lastFlag}</div>
              </div>
            </div>

            {/* Guardrail Reminder Alert */}
            <div className="rounded-xl border border-primary-500/20 bg-primary-50/50 p-3 text-xs text-primary-800 leading-relaxed">
              <strong>Core Proctoring Guarantee:</strong> Candidate was never paused, interrupted, or disqualified.
              The candidate-facing banner capped at {selectedFlagSession.flags}/3. Official review and oral verification decisions are reserved for the Mentor.
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Link
                to="/admin/sessions/s1"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline"
                onClick={() => setSelectedFlagSession(null)}
              >
                <span>Open Full Integrity Timeline</span>
                <ExternalLink className="size-3.5" />
              </Link>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSelectedFlagSession(null)}>
                  Close
                </Button>
                <Button
                  size="sm"
                  className="bg-primary-600 hover:bg-primary-700 text-surface"
                  onClick={() => {
                    alert(`Flagged session for ${selectedFlagSession.candidateName} marked as Reviewed.`);
                    setSelectedFlagSession(null);
                  }}
                >
                  Mark Reviewed
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

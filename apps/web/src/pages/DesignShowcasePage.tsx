import {
  ArrowRight,
  GraduationCap,
  Shield,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { Button } from "@/components/ui/button";
import { authStore, type Role } from "@/features/auth/store";

export function DesignShowcasePage() {
  usePageTitle("UI Design Showcase · Soft Mist Light Theme");
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"boards" | "tokens" | "rules">("boards");
  const [zoomedScreen, setZoomedScreen] = useState<number | null>(null);

  const switchRole = (r: Role, path: string) => {
    const mockUsers: Record<Role, { id: string; email: string; name: string }> = {
      mentor: { id: "u-mentor", email: "mentor1@example.com", name: "Priya Sharma" },
      candidate: { id: "u-candidate", email: "candidate01@example.com", name: "Arjun Mehta" },
      admin: { id: "u-admin", email: "admin@example.com", name: "System Admin" },
    };
    const targetUser = mockUsers[r];
    authStore.set({
      access_token: `mock-${r}-token`,
      refresh_token: `mock-${r}-refresh`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: r,
        is_active: true,
      },
    });
    navigate(path);
  };

  const tokens = [
    { name: "bg", token: "var(--bg)", role: "Page background", cls: "bg-bg" },
    { name: "surface", token: "var(--surface)", role: "Cards & containers", cls: "bg-surface" },
    { name: "surface-muted", token: "var(--surface-muted)", role: "Headers & inputs", cls: "bg-surface-muted" },
    { name: "border", token: "var(--border)", role: "Dividers & lines", cls: "bg-border" },
    { name: "text", token: "var(--text)", role: "Primary body text", cls: "bg-text" },
    { name: "text-muted", token: "var(--text-muted)", role: "Secondary labels", cls: "bg-muted" },
    { name: "primary-50", token: "var(--primary-50)", role: "Sage teal tint", cls: "bg-primary-50" },
    { name: "primary-600", token: "var(--primary-600)", role: "Primary brand actions", cls: "bg-primary-600" },
    { name: "ai-50", token: "var(--ai-50)", role: "AI lavender tint", cls: "bg-ai-50" },
    { name: "ai-500", token: "var(--ai-500)", role: "AI accent lavender", cls: "bg-ai-500" },
    { name: "success-50", token: "var(--success-50)", role: "Strong mastery tint", cls: "bg-success-50" },
    { name: "warning-50", token: "var(--warning-50)", role: "Developing tint", cls: "bg-warning-50" },
    { name: "danger-50", token: "var(--danger-50)", role: "Flag / weak tint", cls: "bg-danger-50" },
    { name: "danger-500", token: "var(--danger-500)", role: "Red flag indicator", cls: "bg-danger-500" },
    { name: "info-50", token: "var(--info-50)", role: "Glance info tint", cls: "bg-info-50" },
    { name: "info-500", token: "var(--info-500)", role: "Informational accent", cls: "bg-info-500" },
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Hero Banner */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-2xs sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                Design Translation Complete
              </span>
              <span className="text-xs text-muted">WCAG AA Compliant (≥ 4.5:1)</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-text sm:text-3xl">
              EduProctor Intelligence — Soft Mist UI Boards
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm text-muted leading-relaxed">
              Implemented all 12 page designs covering the Mentor, Candidate, and Admin experiences with clean
              reusable React components, calm proctoring guardrails, and interactive drill-downs.
            </p>
          </div>

          {/* Quick Role Tester Pills */}
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-muted/50 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              1-Click Role Switcher
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => switchRole("mentor", "/mentor")}
                className="bg-primary-600 text-white hover:bg-primary-700 text-xs"
              >
                <GraduationCap className="size-3.5" />
                <span>Mentor Portal</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => switchRole("candidate", "/candidate")}
                className="text-xs"
              >
                <User className="size-3.5" />
                <span>Candidate Portal</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => switchRole("admin", "/admin")}
                className="text-xs"
              >
                <Shield className="size-3.5" />
                <span>Admin Portal</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-6 flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("boards")}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === "boards"
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            12 UI Page Designs Board
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tokens")}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === "tokens"
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            Soft Mist Light Theme Palette & Tokens
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === "rules"
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            Guarantees & Non-Negotiable Rules Preserved
          </button>
        </div>
      </div>

      {/* VIEW 1: 12 UI PAGE DESIGNS BOARD */}
      {activeTab === "boards" && (
        <div className="space-y-10">
          {/* ================= SECTION 1: MENTOR PORTAL ================= */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-ai-50 text-ai-700 font-bold text-xs">
                M
              </div>
              <div>
                <h2 className="text-base font-bold text-text">Mentor Portal</h2>
                <p className="text-xs text-muted">
                  Create assessments, monitor live sessions, review results, and approve AI evaluation summaries.
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Screen 1: Mentor Dashboard */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:border-primary-300 hover:shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary-700">1. Mentor Dashboard</span>
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">Overview</span>
                  </div>

                  {/* Thumbnail Mockup Preview */}
                  <div className="rounded-lg border border-border bg-surface-muted/60 p-2.5 space-y-2 text-[10px]">
                    <div className="flex items-center justify-between font-semibold text-text">
                      <span>Thermodynamics 101</span>
                      <span className="text-primary-700">3 Active</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[9px] text-muted">
                      <div className="rounded bg-surface p-1">128 Candidates</div>
                      <div className="rounded bg-surface p-1">84 Submissions</div>
                    </div>
                    <div className="h-10 rounded bg-surface p-1 flex items-end gap-1">
                      <span className="w-1/4 h-6 bg-primary-500 rounded-xs" />
                      <span className="w-1/4 h-8 bg-info-500 rounded-xs" />
                      <span className="w-1/4 h-4 bg-ai-500 rounded-xs" />
                      <span className="w-1/4 h-7 bg-primary-500 rounded-xs" />
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-tight">
                    Overview of active assessments, cohort size, multi-bar topic performance, and recent activity.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => switchRole("mentor", "/mentor")}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <span>Open Live Screen</span>
                    <ArrowRight className="size-3" />
                  </button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setZoomedScreen(1)}>
                    Inspect
                  </Button>
                </div>
              </div>

              {/* Screen 2: Assessment Management */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:border-primary-300 hover:shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary-700">2. Assessment Management</span>
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">Exams</span>
                  </div>

                  {/* Thumbnail Mockup Preview */}
                  <div className="rounded-lg border border-border bg-surface-muted/60 p-2.5 space-y-1.5 text-[10px]">
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="font-semibold text-text">Assessments</span>
                      <span className="rounded bg-primary-600 px-1 py-0.5 text-white">+ Create</span>
                    </div>
                    <div className="rounded bg-surface p-1.5 space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span>Unit test 3 - Applied</span>
                        <span className="text-success-700 text-[8px]">Live</span>
                      </div>
                      <div className="text-[8px] text-muted">40 Qs · 28/45 started</div>
                    </div>
                    <div className="rounded bg-surface p-1.5 space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span>Unit test 2 - Foundations</span>
                        <span className="text-muted text-[8px]">Done</span>
                      </div>
                      <div className="text-[8px] text-muted">50 Qs · 45/45 submitted</div>
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-tight">
                    Create, schedule, and filter assessments (All, Draft, Scheduled, Live, Completed).
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => switchRole("mentor", "/mentor/exams")}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <span>Open Live Screen</span>
                    <ArrowRight className="size-3" />
                  </button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setZoomedScreen(2)}>
                    Inspect
                  </Button>
                </div>
              </div>

              {/* Screen 3: Live Monitor */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:border-primary-300 hover:shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary-700">3. Live Monitor</span>
                    <span className="rounded bg-success-50 text-success-700 px-1.5 py-0.5 text-[10px] font-semibold">
                      Real-time
                    </span>
                  </div>

                  {/* Thumbnail Mockup Preview */}
                  <div className="rounded-lg border border-border bg-surface-muted/60 p-2.5 space-y-1.5 text-[10px]">
                    <div className="grid grid-cols-3 gap-1 text-center font-bold text-[9px]">
                      <div className="rounded bg-surface p-1 text-primary-700">28 In Prog</div>
                      <div className="rounded bg-surface p-1 text-muted">12 Not St</div>
                      <div className="rounded bg-surface p-1 text-success-700">5 Done</div>
                    </div>
                    <div className="rounded bg-surface p-1 flex justify-between items-center text-[8px]">
                      <span>Arjun Mehta (c1)</span>
                      <span className="text-danger-700 font-bold">1/3 Flags</span>
                    </div>
                    <div className="rounded bg-surface p-1 flex justify-between items-center text-[8px]">
                      <span>Kavya Nair (c2)</span>
                      <span className="text-muted">0/3 Flags</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-tight">
                    Real-time view of candidate exam status with flag count (max 3), search, and live glance alerts.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => switchRole("mentor", "/mentor/exams/ut-3/live")}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <span>Open Live Screen</span>
                    <ArrowRight className="size-3" />
                  </button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setZoomedScreen(3)}>
                    Inspect
                  </Button>
                </div>
              </div>

              {/* Screen 4: Candidate Proctoring Details */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:border-primary-300 hover:shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary-700">4. Proctoring Timeline</span>
                    <span className="rounded bg-danger-50 text-danger-700 px-1.5 py-0.5 text-[10px]">Mentor Only</span>
                  </div>

                  {/* Thumbnail Mockup Preview */}
                  <div className="rounded-lg border border-border bg-surface-muted/60 p-2.5 space-y-1.5 text-[10px]">
                    <div className="grid grid-cols-2 gap-1 text-[8px]">
                      <div className="rounded bg-danger-50 text-danger-700 p-1 font-bold">Red Flags: 1/3</div>
                      <div className="rounded bg-surface p-1 text-muted">Glances: 4 head / 6 eye</div>
                    </div>
                    <div className="rounded bg-surface p-1 flex items-center gap-1 text-[8px]">
                      <span className="font-mono text-muted">10:14:03</span>
                      <span className="text-danger-700 font-semibold truncate">Look-away 3.4s [Flag 1]</span>
                    </div>
                    <div className="rounded bg-surface p-1 flex items-center justify-between text-[8px]">
                      <span className="text-muted">Evidence Snapshot:</span>
                      <span className="text-primary-700 font-semibold">View JPEG</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-tight">
                    Restricted telemetry: Red flags 1/3, glances, tab switches, and encrypted webcam evidence snapshots.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => switchRole("mentor", "/mentor/sessions/s1")}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <span>Open Live Screen</span>
                    <ArrowRight className="size-3" />
                  </button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setZoomedScreen(4)}>
                    Inspect
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ================= SECTION 2: CANDIDATE PORTAL ================= */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary-50 text-primary-700 font-bold text-xs">
                C
              </div>
              <div>
                <h2 className="text-base font-bold text-text">Candidate Portal</h2>
                <p className="text-xs text-muted">
                  Take assessments, follow calm instructions, complete identity check, and receive approved learning
                  recommendations.
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Screen 5: Candidate Dashboard */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:border-primary-300 hover:shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary-700">5. Candidate Dashboard</span>
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">Home</span>
                  </div>

                  {/* Thumbnail Mockup Preview */}
                  <div className="rounded-lg border border-border bg-surface-muted/60 p-2.5 space-y-1.5 text-[10px]">
                    <div className="font-semibold text-text">Welcome back!</div>
                    <div className="grid grid-cols-2 gap-1 text-[8px] text-muted">
                      <div className="rounded bg-surface p-1">2 Upcoming</div>
                      <div className="rounded bg-surface p-1">1 Result (78%)</div>
                    </div>
                    <div className="rounded bg-surface p-1 text-[8px] space-y-0.5">
                      <span className="font-semibold block">Next: Unit test 3</span>
                      <span className="text-muted">60 min · 40 Qs</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-tight">
                    Upcoming assessments, approved exam results, practice topics, and completed practice sets.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => switchRole("candidate", "/candidate")}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <span>Open Live Screen</span>
                    <ArrowRight className="size-3" />
                  </button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setZoomedScreen(5)}>
                    Inspect
                  </Button>
                </div>
              </div>

              {/* Screen 6: Assessment Instructions */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:border-primary-300 hover:shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary-700">6. Assessment Instructions</span>
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">Pre-Start</span>
                  </div>

                  {/* Thumbnail Mockup Preview */}
                  <div className="rounded-lg border border-border bg-surface-muted/60 p-2.5 space-y-1.5 text-[10px]">
                    <div className="font-semibold text-text">Unit test 3 Instructions</div>
                    <div className="space-y-1 text-[8px] text-muted">
                      <div className="rounded bg-surface p-1">1. Quiet, well-lit place</div>
                      <div className="rounded bg-surface p-1">2. Keep face clearly visible</div>
                      <div className="rounded bg-surface p-1 text-primary-700 font-semibold">
                        4. Complete test even if flagged
                      </div>
                    </div>
                    <div className="text-[8px] text-text font-medium">[✓] Consent agreed</div>
                  </div>

                  <p className="text-xs text-muted leading-tight">
                    Clear guidelines before starting: 5-step stepper, integrity rules, and explicit candidate consent.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => switchRole("candidate", "/candidate/instructions")}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <span>Open Live Screen</span>
                    <ArrowRight className="size-3" />
                  </button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setZoomedScreen(6)}>
                    Inspect
                  </Button>
                </div>
              </div>

              {/* Screen 7: Camera Setup */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:border-primary-300 hover:shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary-700">7. Camera Setup</span>
                    <span className="rounded bg-primary-50 text-primary-700 px-1.5 py-0.5 text-[10px]">Head Alignment</span>
                  </div>

                  {/* Thumbnail Mockup Preview */}
                  <div className="rounded-lg border border-border bg-surface-muted/60 p-2.5 space-y-1 text-[10px]">
                    <div className="h-10 rounded bg-slate-800 flex items-center justify-center text-white text-[8px]">
                      [Camera Face Oval]
                    </div>
                    <div className="space-y-0.5 text-[8px] text-success-700 font-medium">
                      <div>✓ Webcam connected</div>
                      <div>✓ Face detected in oval</div>
                      <div>✓ Head alignment (level & centered)</div>
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-tight">
                    Webcam positioning, face framing, and strict 3D head alignment check.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => switchRole("candidate", "/candidate/camera-setup")}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <span>Open Live Screen</span>
                    <ArrowRight className="size-3" />
                  </button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setZoomedScreen(7)}>
                    Inspect
                  </Button>
                </div>
              </div>

              {/* Screen 8: Assessment Taking (Candidate) */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:border-primary-300 hover:shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary-700">8. Assessment Taking</span>
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">Exam Room</span>
                  </div>

                  {/* Thumbnail Mockup Preview */}
                  <div className="rounded-lg border border-border bg-surface-muted/60 p-2.5 space-y-1.5 text-[10px]">
                    <div className="flex justify-between items-center text-[8px]">
                      <span className="font-mono">00:42:15</span>
                      <span className="rounded bg-danger-50 text-danger-700 px-1 font-bold">Flags 1 of 3</span>
                    </div>
                    <div className="rounded bg-danger-50 text-danger-700 p-1 text-[7.5px]">
                      Flag 1 of 3 — please keep eyes on screen.
                    </div>
                    <div className="rounded bg-surface p-1 text-[8px] font-medium">
                      Which best describes enthalpy?
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-tight">
                    Clean, calm test-taking interface with capped flag counter (max 3), countdown timer, and MCQ choices.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => switchRole("candidate", "/candidate/exam")}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <span>Open Live Screen</span>
                    <ArrowRight className="size-3" />
                  </button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setZoomedScreen(8)}>
                    Inspect
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ================= SECTION 3: ADMIN PORTAL ================= */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-success-50 text-success-700 font-bold text-xs">
                A
              </div>
              <div>
                <h2 className="text-base font-bold text-text">Admin Portal</h2>
                <p className="text-xs text-muted">
                  Platform overview, user and role management, approved notes library, AI agent runs, and audit logs.
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Screen 9: Admin Dashboard */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:border-primary-300 hover:shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary-700">9. Admin Dashboard</span>
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">Overview</span>
                  </div>

                  {/* Thumbnail Mockup Preview */}
                  <div className="rounded-lg border border-border bg-surface-muted/60 p-2.5 space-y-1.5 text-[10px]">
                    <div className="grid grid-cols-2 gap-1 text-[8px]">
                      <div className="rounded bg-surface p-1">12 Courses</div>
                      <div className="rounded bg-surface p-1">48 Mentors</div>
                      <div className="rounded bg-surface p-1">1,240 Candidates</div>
                      <div className="rounded bg-surface p-1">36 Assessments</div>
                    </div>
                    <div className="rounded bg-surface p-1 text-[8px] flex justify-between">
                      <span>Completion: 82%</span>
                      <span className="text-primary-700 font-semibold">+18% MoM</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-tight">
                    Platform overview, system health metrics, assessment volume over time, and completion rates.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => switchRole("admin", "/admin")}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <span>Open Live Screen</span>
                    <ArrowRight className="size-3" />
                  </button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setZoomedScreen(9)}>
                    Inspect
                  </Button>
                </div>
              </div>

              {/* Screen 10: User Management */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:border-primary-300 hover:shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary-700">10. User Management</span>
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">Users</span>
                  </div>

                  {/* Thumbnail Mockup Preview */}
                  <div className="rounded-lg border border-border bg-surface-muted/60 p-2.5 space-y-1 text-[10px]">
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="text-muted">All (1,288)</span>
                      <span className="text-primary-700 font-semibold">+ Add User</span>
                    </div>
                    <div className="space-y-1 text-[8px]">
                      <div className="rounded bg-surface p-1 flex justify-between">
                        <span>Priya Sharma</span>
                        <span className="text-ai-700">Mentor</span>
                      </div>
                      <div className="rounded bg-surface p-1 flex justify-between">
                        <span>Arjun Mehta</span>
                        <span className="text-muted">Candidate</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-tight">
                    Manage mentors, candidates, and admins with role-based permissions and active/inactive status.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => switchRole("admin", "/admin/users")}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <span>Open Live Screen</span>
                    <ArrowRight className="size-3" />
                  </button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setZoomedScreen(10)}>
                    Inspect
                  </Button>
                </div>
              </div>

              {/* Screen 11: Notes Library */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:border-primary-300 hover:shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary-700">11. Notes Library</span>
                    <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">Curriculum</span>
                  </div>

                  {/* Thumbnail Mockup Preview */}
                  <div className="rounded-lg border border-border bg-surface-muted/60 p-2.5 space-y-1 text-[10px]">
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="font-semibold text-text">Approved Library</span>
                      <span className="text-primary-700 font-semibold">+ Add Note</span>
                    </div>
                    <div className="space-y-1 text-[8px]">
                      <div className="rounded bg-surface p-1 flex justify-between">
                        <span>First law thermodynamics</span>
                        <span className="text-success-700 font-bold">Approved</span>
                      </div>
                      <div className="rounded bg-surface p-1 flex justify-between">
                        <span>Carnot cycle</span>
                        <span className="text-warning-800">Pending</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-tight">
                    Approved learning notes library. The Claude AI agent is strictly restricted to recommending only notes
                    from this library.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => switchRole("admin", "/admin/notes")}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <span>Open Live Screen</span>
                    <ArrowRight className="size-3" />
                  </button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setZoomedScreen(11)}>
                    Inspect
                  </Button>
                </div>
              </div>

              {/* Screen 12: Agent Runs (Admin) */}
              <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4.5 shadow-2xs transition-all hover:border-primary-300 hover:shadow-xs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary-700">12. Agent Runs</span>
                    <span className="rounded bg-ai-50 text-ai-700 px-1.5 py-0.5 text-[10px]">AI Observability</span>
                  </div>

                  {/* Thumbnail Mockup Preview */}
                  <div className="rounded-lg border border-border bg-surface-muted/60 p-2.5 space-y-1 text-[10px]">
                    <div className="flex justify-between items-center text-[9px] font-semibold text-text">
                      <span>Claude Tool Runs</span>
                      <span className="text-ai-700">$0.0096 / run</span>
                    </div>
                    <div className="space-y-1 text-[8px]">
                      <div className="rounded bg-surface p-1 flex justify-between">
                        <span>Unit test 2 evaluation</span>
                        <span className="text-success-700">Completed</span>
                      </div>
                      <div className="rounded bg-surface p-1 flex justify-between">
                        <span>Unit test 3 evaluation</span>
                        <span className="text-info-700">Running</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted leading-tight">
                    Full AI agent observability: token consumption, execution latency, cost ($USD), tool-call traces,
                    and mentor review decisions.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => switchRole("admin", "/admin/agent")}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                  >
                    <span>Open Live Screen</span>
                    <ArrowRight className="size-3" />
                  </button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setZoomedScreen(12)}>
                    Inspect
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SOFT MIST LIGHT THEME PALETTE & KEY COMPONENTS (Matching Image 2) */}
      {activeTab === "tokens" && (
        <div className="space-y-8 rounded-xl border border-border bg-surface p-6 shadow-2xs">
          <div>
            <h3 className="text-lg font-bold text-text">EduProctor · Soft Mist light theme</h3>
            <p className="text-xs text-muted">
              Preview of colour tokens and key components. All text pairs meet WCAG AA (≥ 4.5:1).
            </p>
          </div>

          {/* Color Tokens Swatches */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Color Palette Tokens</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {tokens.map((tok) => (
                <div key={tok.name} className="overflow-hidden rounded-xl border border-border bg-surface shadow-2xs">
                  <div
                    className="h-14 w-full border-b border-border/40"
                    style={{ backgroundColor: tok.token }}
                  />
                  <div className="p-2.5 text-xs">
                    <div className="font-bold text-text">{tok.name}</div>
                    <div className="font-mono text-[10px] text-muted">{tok.token}</div>
                    <div className="mt-1 text-[10px] text-muted leading-tight">{tok.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Component Breakdowns from Image 2 */}
          <div className="space-y-6 pt-4 border-t border-border">
            {/* Component 1: Candidate assessment page top bar */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">
                Candidate assessment page
              </span>
              <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <span className="text-sm font-bold text-text">Thermodynamics · Unit test 2</span>
                    <span className="ml-3 text-xs text-muted">Question 7 of 20 · 24:18 left</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1 text-xs text-danger-700">
                    <div className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-danger-500" />
                      <span className="size-2 rounded-full bg-border-strong" />
                      <span className="size-2 rounded-full bg-border-strong" />
                    </div>
                    <span className="font-semibold">Flags 1 of 3</span>
                  </div>
                </div>
                <div className="rounded-xl border border-danger-500/30 bg-danger-50 px-4 py-2.5 text-xs font-medium text-danger-700">
                  Flag 1 of 3 — please keep your eyes on the screen.
                </div>
              </div>
            </div>

            {/* Component 2: Mentor · candidate details */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">
                Mentor · candidate details
              </span>
              <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <span className="text-xs text-muted">Red flags</span>
                    <div className="text-xl font-bold text-danger-700">2 / 3</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <span className="text-xs text-muted">Head glances</span>
                    <div className="text-xl font-bold text-text">6</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <span className="text-xs text-muted">Eye glances</span>
                    <div className="text-xl font-bold text-text">9</div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <span className="text-xs text-muted">Other alerts</span>
                    <div className="text-xl font-bold text-text">0</div>
                  </div>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-muted text-muted text-[11px] uppercase">
                      <tr>
                        <th className="p-2.5 text-left">TIME</th>
                        <th className="p-2.5 text-left">EVENT</th>
                        <th className="p-2.5 text-left">DIRECTION</th>
                        <th className="p-2.5 text-left">DURATION</th>
                        <th className="p-2.5 text-left">CANDIDATE NOTIFIED</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="p-2.5 font-mono text-muted">00:04:12</td>
                        <td className="p-2.5">
                          <span className="rounded-full bg-info-50 text-info-700 px-2 py-0.5 font-medium">
                            Glance · eyes
                          </span>
                        </td>
                        <td className="p-2.5 text-muted">Left</td>
                        <td className="p-2.5 text-muted">1.4 s</td>
                        <td className="p-2.5 text-muted">No</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-mono text-muted">00:09:37</td>
                        <td className="p-2.5">
                          <span className="rounded-full bg-danger-50 text-danger-700 px-2 py-0.5 font-medium">
                            Red flag 1 of 3 · head
                          </span>
                        </td>
                        <td className="p-2.5 text-muted">Right</td>
                        <td className="p-2.5 text-muted">3.8 s</td>
                        <td className="p-2.5 text-muted">Yes</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-mono text-muted">00:21:44</td>
                        <td className="p-2.5">
                          <span className="rounded-full bg-danger-50 text-danger-700 px-2 py-0.5 font-medium">
                            Red flag 2 of 3 · eyes
                          </span>
                        </td>
                        <td className="p-2.5 text-muted">Down</td>
                        <td className="p-2.5 text-muted">4.6 s</td>
                        <td className="p-2.5 text-muted">Yes</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Component 3: Assessment Evaluation Summary (mentor review) */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">
                Assessment Evaluation Summary (mentor review)
              </span>
              <div className="rounded-xl border border-ai-500/20 bg-ai-50 p-5 space-y-4">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-ai-100 text-ai-700 px-2.5 py-0.5 text-xs font-semibold">
                    ✦ AI draft
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span>
                    <strong>Strong:</strong>{" "}
                    <span className="rounded bg-success-50 text-success-700 px-2 py-0.5 font-medium">
                      Heat transfer · 88%
                    </span>
                  </span>
                  <span>
                    <strong>Developing:</strong>{" "}
                    <span className="rounded bg-warning-50 text-warning-800 px-2 py-0.5 font-medium">
                      Entropy · 70%
                    </span>
                  </span>
                  <span>
                    <strong>Weak:</strong>{" "}
                    <span className="rounded bg-danger-50 text-danger-700 px-2 py-0.5 font-medium">
                      First law · 45%
                    </span>
                  </span>
                </div>

                <div className="text-xs text-text leading-relaxed">
                  <strong>Recommended:</strong> 1. First law — mixes up heat and work sign convention · Notes: “Energy
                  balance basics” · 8 practice questions
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" variant="secondary">
                    Request changes
                  </Button>
                  <Button size="sm" className="bg-primary-600 text-white hover:bg-primary-700">
                    Approve
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: NON-NEGOTIABLE GUARANTEES */}
      {activeTab === "rules" && (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-2xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary-600" />
            <h3 className="text-base font-bold text-text">Guarantees & Non-Negotiable Rules Enforced in UI</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-2">
              <span className="text-xs font-bold text-text">1. No Automatic Disqualification</span>
              <p className="text-xs text-muted leading-relaxed">
                Proctoring flags never automatically pause, block, disqualify, or auto-submit a candidate. Candidates
                always finish their exam. Auto-submit occurs strictly at the server deadline.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-2">
              <span className="text-xs font-bold text-text">2. Red Flag Counter Capped at 3</span>
              <p className="text-xs text-muted leading-relaxed">
                The candidate-facing notice is strictly capped at 3 red flags (look-aways of 3s+). Any additional
                look-aways are quietly logged server-side as post-limit for mentor review.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-2">
              <span className="text-xs font-bold text-text">3. Strict Mentor-Only Telemetry Scoping</span>
              <p className="text-xs text-muted leading-relaxed">
                Glance logs (1-2s look-aways), evidence snapshots, integrity notes, and flag history are restricted to
                the Mentor portal. Candidates never see flags, glance logs, or snapshots in their results.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-2">
              <span className="text-xs font-bold text-text">4. Mandatory Human Mentor Approval</span>
              <p className="text-xs text-muted leading-relaxed">
                AI-drafted evaluation summaries require explicit mentor approval before publication. The candidate
                dashboard displays only approved learning recommendations and approved notes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Modal for inspecting individual boards */}
      {zoomedScreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl space-y-4 rounded-xl border border-border bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h4 className="text-base font-bold text-text">
                Screen {zoomedScreen} Board Architecture & Telemetry
              </h4>
              <button
                type="button"
                onClick={() => setZoomedScreen(null)}
                className="rounded p-1 text-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-text">
              <p>
                This board is implemented as a connected React component within the EduProctor frontend architecture,
                styled using the exact Soft Mist tokens, Inter typography, and WCAG AA contrast standards.
              </p>
              <div className="rounded-lg bg-surface-muted p-3">
                <strong>Component Path:</strong>{" "}
                <code className="text-primary-700">
                  {zoomedScreen <= 4
                    ? "apps/web/src/pages/mentor/"
                    : zoomedScreen <= 8
                      ? "apps/web/src/pages/candidate/"
                      : "apps/web/src/pages/admin/"}
                </code>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="secondary" onClick={() => setZoomedScreen(null)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setZoomedScreen(null);
                  if (zoomedScreen === 1) switchRole("mentor", "/mentor");
                  else if (zoomedScreen === 2) switchRole("mentor", "/mentor/exams");
                  else if (zoomedScreen === 3) switchRole("mentor", "/mentor/exams/ut-3/live");
                  else if (zoomedScreen === 4) switchRole("mentor", "/mentor/sessions/s1");
                  else if (zoomedScreen === 5) switchRole("candidate", "/candidate");
                  else if (zoomedScreen === 6) switchRole("candidate", "/candidate/instructions");
                  else if (zoomedScreen === 7) switchRole("candidate", "/candidate/camera-setup");
                  else if (zoomedScreen === 8) switchRole("candidate", "/candidate/exam");
                  else if (zoomedScreen === 9) switchRole("admin", "/admin");
                  else if (zoomedScreen === 10) switchRole("admin", "/admin/users");
                  else if (zoomedScreen === 11) switchRole("admin", "/admin/notes");
                  else if (zoomedScreen === 12) switchRole("admin", "/admin/agent");
                }}
                className="bg-primary-600 text-white hover:bg-primary-700"
              >
                Launch Screen Live
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


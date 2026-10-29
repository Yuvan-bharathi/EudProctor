import {
  BookOpen,
  Camera,
  CheckCircle2,
  Lock,
  Mail,
  Mic,
  Monitor,
  Phone,
  ShieldCheck,
  User,
  Wifi,
} from "lucide-react";
import { usePageTitle } from "@/app/layouts";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/store";

export function CandidateProfilePage() {
  usePageTitle("My Profile & Biometric Status");
  const { user } = useAuth();

  const candidate = {
    name: user?.name ?? "Arjun Mehta",
    email: user?.email ?? "candidate01@example.com",
    phone: "+91 98765 43210",
    rollNumber: "EP-2026-CS-042",
    department: "Computer Science & Engineering",
    program: "B.Tech Software Engineering (Semester 6)",
    institution: "Global Institute of Technology",
    joinedDate: "August 2023",
    verifiedDate: "10 Jan 2026",
  };

  const courses = [
    { code: "FSD-301", name: "Full Stack Development", credits: 4, attendance: "96%" },
    { code: "FED-201", name: "Frontend", credits: 4, attendance: "94%" },
    { code: "BED-202", name: "Backend", credits: 4, attendance: "91%" },
    { code: "DAT-101", name: "Data Analyst", credits: 3, attendance: "95%" },
    { code: "AIE-401", name: "AI Engineer", credits: 4, attendance: "92%" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-text">Candidate Profile</h2>
        <p className="text-xs text-muted">Manage your student credentials, verification baseline, and device readiness.</p>
      </div>

      {/* Main Profile Identity Card */}
      <Card className="flex flex-col gap-6 border-border p-6 shadow-2xs sm:flex-row sm:items-center">
        <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-primary-100 text-2xl font-bold text-primary-700 shadow-inner">
          AM
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-bold text-text">{candidate.name}</h3>
            <Badge tone="success" className="gap-1 font-semibold">
              <CheckCircle2 className="size-3" />
              Biometrically Verified
            </Badge>
            <span className="rounded bg-surface-muted px-2 py-0.5 font-mono text-xs text-muted">
              {candidate.rollNumber}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <Mail className="size-3.5" />
              {candidate.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" />
              {candidate.phone}
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-3.5" />
              {candidate.program}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-muted/40 p-4 text-right">
          <div className="text-[11px] text-muted">Academic Standing</div>
          <div className="text-xl font-bold text-success-700">82% GPA</div>
          <div className="text-[10px] text-muted">2 Assessments Taken</div>
        </div>
      </Card>

      {/* 2-Column Details Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Identity & Biometric Verification */}
        <Card className="space-y-4 p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-text">
              <ShieldCheck className="size-4 text-primary-600" />
              <span>Identity & Biometric Baseline</span>
            </CardTitle>
            <Badge tone="primary">Active Baseline</Badge>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-2.5">
                <Camera className="size-4 text-primary-600" />
                <div>
                  <div className="font-semibold text-text">Face Registration Baseline</div>
                  <div className="text-[11px] text-muted">Verified against institutional ID on {candidate.verifiedDate}</div>
                </div>
              </div>
              <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-[11px] font-semibold text-success-700">
                Matched 98.4%
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-2.5">
                <User className="size-4 text-primary-600" />
                <div>
                  <div className="font-semibold text-text">Liveness Calibration Profile</div>
                  <div className="text-[11px] text-muted">3D head rotation and neutral gaze calibrated</div>
                </div>
              </div>
              <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-[11px] font-semibold text-success-700">
                Calibrated
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-2.5">
                <Lock className="size-4 text-primary-600" />
                <div>
                  <div className="font-semibold text-text">DPDP Act Consent & Telemetry Retention</div>
                  <div className="text-[11px] text-muted">Stored encrypted for 90 days strictly for evaluation review</div>
                </div>
              </div>
              <span className="text-[11px] font-medium text-muted">Signed & Active</span>
            </div>
          </div>
        </Card>

        {/* Card 2: Device & Environmental Readiness */}
        <Card className="space-y-4 p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-text">
              <Monitor className="size-4 text-primary-600" />
              <span>Exam Environment & Hardware Pre-check</span>
            </CardTitle>
            <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-[11px] font-semibold text-success-700">
              All Systems Ready
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-2.5">
                <Camera className="size-4 text-muted" />
                <div>
                  <div className="font-semibold text-text">Camera Feed</div>
                  <div className="text-[11px] text-muted">1080p Web Camera · Optimal lighting detected</div>
                </div>
              </div>
              <CheckCircle2 className="size-4 text-success-600" />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-2.5">
                <Mic className="size-4 text-muted" />
                <div>
                  <div className="font-semibold text-text">Microphone Stream</div>
                  <div className="text-[11px] text-muted">Dual-channel input · Ambient level below 35 dB</div>
                </div>
              </div>
              <CheckCircle2 className="size-4 text-success-600" />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-2.5">
                <Wifi className="size-4 text-muted" />
                <div>
                  <div className="font-semibold text-text">Network Connection</div>
                  <div className="text-[11px] text-muted">WebRTC direct signaling · Latency 28ms</div>
                </div>
              </div>
              <CheckCircle2 className="size-4 text-success-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Enrolled Courses Section */}
      <Card className="space-y-4 p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <CardTitle className="text-sm font-bold text-text">Enrolled Courses & Assessment Cohorts</CardTitle>
            <CardDescription className="text-xs text-muted">
              Courses for which you are eligible to receive proctored evaluations.
            </CardDescription>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {courses.map((c) => (
            <div
              key={c.code}
              className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-2 transition-colors hover:border-primary-200"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-primary-700">{c.code}</span>
                <span className="text-[11px] font-semibold text-success-700">{c.attendance} Attended</span>
              </div>
              <div className="font-semibold text-sm text-text">{c.name}</div>
              <div className="text-[11px] text-muted">{c.credits} Credits · Spring Term 2026</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

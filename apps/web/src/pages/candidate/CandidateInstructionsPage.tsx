import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { usePageTitle } from "@/app/layouts";
import { Button } from "@/components/ui/button";
import { getPersistedAssessments } from "@/lib/mockData";

export function CandidateInstructionsPage() {
  usePageTitle("Assessment Instructions");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const examId = searchParams.get("examId") || "ut-3";

  const assessments = getPersistedAssessments();
  const exam = assessments.find((a) => a.id === examId) ?? assessments[0];

  const [agreed, setAgreed] = useState(false);

  const steps = [
    { num: 1, label: "Instructions", active: true, done: false },
    { num: 2, label: "System check", active: false, done: false },
    { num: 3, label: "Identity verification", active: false, done: false },
    { num: 4, label: "Camera setup", active: false, done: false },
    { num: 5, label: "Start assessment", active: false, done: false },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Header with Back Link */}
      <div className="flex items-center gap-3">
        <Link
          to="/candidate"
          className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-surface-muted hover:text-text"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-text">Assessment Instructions</h2>
          <p className="text-xs text-muted">Clear guidelines before starting your verified assessment.</p>
        </div>
      </div>

      {/* Stepper & Content Grid matching Screen 6 */}
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        {/* Left Stepper Sidebar */}
        <div className="space-y-1 rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Steps</div>
          {steps.map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                s.active
                  ? "bg-primary-50 text-primary-700"
                  : s.done
                    ? "text-success-700"
                    : "text-muted"
              }`}
            >
              <div
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  s.active
                    ? "bg-primary-600 text-white"
                    : s.done
                      ? "bg-success-50 text-success-700"
                      : "bg-surface-muted text-muted"
                }`}
              >
                {s.done ? <CheckCircle2 className="size-3.5" /> : s.num}
              </div>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Right Main Instructions Content */}
        <div className="space-y-6 rounded-xl border border-border bg-surface p-6 shadow-2xs">
          {/* Assessment Title & Metadata */}
          <div className="border-b border-border pb-4">
            <h3 className="text-lg font-bold text-text">{exam?.title || "Unit test 3 - Applied Concepts"}</h3>
            <p className="text-xs text-muted">{exam?.course || "Full Stack Development"}</p>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5 font-medium text-text">
                <HelpCircle className="size-3.5 text-primary-600" />
                {exam?.questions || 40} questions
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-medium text-text">
                <Clock className="size-3.5 text-primary-600" />
                {exam?.duration_min || 60} minutes
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                Multiple choice
              </span>
            </div>
          </div>

          {/* Important Instructions matching Screen 6 */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Important instructions</h4>

            <ol className="list-decimal space-y-3 pl-4 text-xs leading-relaxed text-text">
              <li>
                <strong>Ensure you are in a quiet, well-lit place:</strong> Avoid harsh backlighting so the camera
                can verify your face without glares or shadows.
              </li>
              <li>
                <strong>Keep your face clearly visible throughout the assessment:</strong> Your webcam will gently verify
                your presence. Video never leaves your computer.
              </li>
              <li>
                <strong>Do not use external devices, notes or other applications:</strong> Full screen and focus
                integrity are recorded. Copying text is restricted.
              </li>
              <li className="text-primary-700">
                <strong>You can complete the assessment even if a flag is raised:</strong> Proctoring flags never
                automatically pause, disqualify, or submit your exam.
              </li>
            </ol>
          </div>

          {/* Privacy Note */}
          <div className="flex items-start gap-3 rounded-lg bg-surface-muted p-3 text-xs text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary-600" />
            <p>
              Under the India DPDP Act 2023, continuous raw video is never transmitted or stored on servers. Only
              lightweight encrypted telemetry and small evidence snapshots are saved for mentor review.
            </p>
          </div>

          {/* Consent Checkbox */}
          <div className="border-t border-border pt-4">
            <label className="flex items-center gap-2.5 text-xs font-medium text-text cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="size-4 rounded accent-primary-600"
              />
              <span>I have read and understand the instructions</span>
            </label>
          </div>

          {/* Footer Action */}
          <div className="flex justify-end pt-2">
            <Button
              disabled={!agreed}
              onClick={() => navigate(`/candidate/identity?examId=${examId}`)}
              className="bg-primary-600 text-white hover:bg-primary-700"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import {
  CheckCircle2,
  Clock,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePageTitle } from "@/app/layouts";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getPersistedAssessments } from "@/lib/mockData";

export function CandidateInstructionsPage() {
  usePageTitle("Assessment Instructions");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const examId = searchParams.get("examId") || "ut-3";

  const { data: remoteAssessments } = useQuery<{
    exam_id: string;
    title: string;
    duration_min: number;
    window_start: string;
    window_end: string;
  }[]>({
    queryKey: ["candidate", "assessments"],
    queryFn: () => api("/candidates/me/assessments"),
  });

  const assessments = getPersistedAssessments();
  const exam = assessments.find((a) => a.id === examId) ?? assessments[0];

  const remoteExam = remoteAssessments?.find((a) => a.exam_id === examId);
  const now = Date.now();
  let isExpired = false;

  if (remoteExam) {
    if (remoteExam.window_end) {
      const end = new Date(remoteExam.window_end).getTime();
      if (!isNaN(end) && end < now) isExpired = true;
    } else if (remoteExam.window_start) {
      const start = new Date(remoteExam.window_start).getTime();
      if (!isNaN(start) && start + (remoteExam.duration_min || 60) * 60000 < now) isExpired = true;
    }
  } else if (exam) {
    const dateStr = exam.scheduled_end || exam.scheduled_start || exam.scheduledDate || exam.createdDate;
    if (dateStr) {
      const parsed = new Date(dateStr).getTime();
      if (!isNaN(parsed) && parsed < now && exam.status !== "completed") {
        isExpired = true;
      }
    }
  }

  const [agreed, setAgreed] = useState(false);

  // Prevent browser back navigation while entering the assessment
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (isExpired) {
    return (
      <div className="mx-auto max-w-xl space-y-6 pt-12 text-center">
        <div className="rounded-2xl border border-rose-200 bg-surface p-8 shadow-xs space-y-4">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <Clock className="size-7" />
          </div>
          <h2 className="text-xl font-bold text-text">Assessment Expired</h2>
          <p className="text-xs text-muted leading-relaxed">
            The examination window for <strong>{remoteExam?.title || exam?.title || "this assessment"}</strong> has passed.
            Candidates cannot enter or attempt expired assessments. Please contact your mentor if you need an extended schedule.
          </p>
          <div className="pt-2">
            <Button
              onClick={() => navigate("/candidate/assessments")}
              className="bg-primary-600 text-white hover:bg-primary-700 font-medium"
            >
              Return to My Assessments
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    { num: 1, label: "Instructions", active: true, done: false },
    { num: 2, label: "System check", active: false, done: false },
    { num: 3, label: "Camera setup", active: false, done: false },
    { num: 4, label: "Start assessment", active: false, done: false },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Header without Back Link */}
      <div className="flex items-center gap-3">
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
            <h3 className="text-lg font-bold text-text">{remoteExam?.title || exam?.title || "Unit test 3 - Applied Concepts"}</h3>
            <p className="text-xs text-muted">{exam?.course || "Full Stack Development"}</p>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5 font-medium text-text">
                <HelpCircle className="size-3.5 text-primary-600" />
                {exam?.questions ?? 0} questions
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-medium text-text">
                <Clock className="size-3.5 text-primary-600" />
                {remoteExam?.duration_min || exam?.duration_min || 60} minutes
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-medium text-success-700">
                <ShieldCheck className="size-3.5" />
                Non-punitive capped monitoring
              </span>
            </div>
          </div>

          {/* Calming Proctoring Disclosure Banner */}
          <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="size-5 shrink-0 text-primary-700 mt-0.5" />
              <div className="space-y-1 text-xs">
                <h4 className="font-semibold text-text">Calibrated Academic Integrity Support</h4>
                <p className="text-muted leading-relaxed">
                  EduProctor is designed to give you peace of mind. Our camera and environment checks assist you
                  in staying focused. You receive up to 3 gentle notifications if head pose shifts away from screen.
                  <strong> No algorithmic termination takes place.</strong> All integrity reports are personally evaluated
                  by your course mentor.
                </p>
              </div>
            </div>
          </div>

          {/* Test Taking Guidelines */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Test Protocol</h4>
            <ul className="space-y-2 text-xs text-text">
              <li className="flex items-start gap-2">
                <div className="mt-1 size-1.5 shrink-0 rounded-full bg-primary-600" />
                <span>Sit in a reasonably lit, quiet space with your webcam facing you.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 size-1.5 shrink-0 rounded-full bg-primary-600" />
                <span>Keep your browser window active. Switching tabs triggers an advisory notification.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 size-1.5 shrink-0 rounded-full bg-primary-600" />
                <span>You can utilize the built-in scratchpad and calculator on questions where permitted.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-1 size-1.5 shrink-0 rounded-full bg-primary-600" />
                <span>Answers save continuously on every selection. You will not lose progress on network reconnects.</span>
              </li>
            </ul>
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
              onClick={() => navigate(`/candidate/camera-setup?examId=${examId}`)}
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

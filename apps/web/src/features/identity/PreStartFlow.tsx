import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Clock, ShieldCheck } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { ErrorState, LoadingState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CandidateSession } from "@/features/assessment/types";
import { cropFace } from "@/features/vision/camera";
import { eyeAspectRatio, noseOffset, type Point } from "@/features/vision/geometry";
import { type Challenge, challengeText, LivenessDetector } from "@/features/vision/liveness";
import { type FaceFrame, useFaceCamera } from "@/features/vision/useFaceCamera";
import { api, errorMessage } from "@/lib/api";
import { CalibrationStep } from "./CalibrationStep";

interface IdentityStatus {
  consent_version: string;
  consented: boolean;
  enrolled: boolean;
  consent_text: string;
}

function Frame({ title, step, children }: { title: string; step: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-8">
      <Card className="w-full max-w-xl space-y-4 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{step}</p>
        <h1 className="text-xl font-semibold">{title}</h1>
        {children}
      </Card>
    </main>
  );
}

function VideoBox({ video, faces, ready }: { video: RefObject<HTMLVideoElement>; faces: number; ready: boolean }) {
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-border bg-surface-muted">
        {/* mirrored for the candidate's comfort; processing uses the unmirrored frames */}
        <video ref={video} className="aspect-[4/3] w-full -scale-x-100 object-cover" muted playsInline aria-label="Your camera preview" />
      </div>
      <p className="text-xs text-muted" role="status">
        {!ready ? "Starting camera…" : faces === 1 ? "Face detected." : faces === 0 ? "No face detected – move into view." : "More than one face detected."}
      </p>
    </div>
  );
}

function ConsentStep({ status, onDone }: { status: IdentityStatus; onDone: () => void }) {
  const [agree, setAgree] = useState(false);
  const m = useMutation({
    mutationFn: () => api("/identity/consent", { body: { consent_version: status.consent_version } }),
    onSuccess: onDone,
  });
  return (
    <Frame title="Before you begin" step="Step 1 · Consent">
      <div className="flex gap-3 rounded-xl bg-primary-50 p-4 text-sm text-text">
        <ShieldCheck className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
        <p>{status.consent_text}</p>
      </div>
      <label className="flex items-start gap-2 text-sm text-text">
        <input type="checkbox" className="mt-0.5 size-4 accent-primary-600" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        I have read this notice and agree to identity verification for this assessment.
      </label>
      {m.isError && <ErrorState message={errorMessage(m.error)} />}
      <Button disabled={!agree || m.isPending} onClick={() => m.mutate()}>
        Continue
      </Button>
    </Frame>
  );
}

function EnrolStep({ onDone }: { onDone: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const cam = useFaceCamera(video);
  const [shots, setShots] = useState<string[]>([]);
  const enrol = useMutation({ mutationFn: (images: string[]) => api("/identity/enrol", { body: { images } }), onSuccess: onDone });

  function capture() {
    const lm = cam.latest.current?.result.faceLandmarks[0] as Point[] | undefined;
    if (!video.current || !lm) return;
    const next = [...shots, cropFace(video.current, lm)];
    setShots(next);
    if (next.length === 3) enrol.mutate(next);
  }

  return (
    <Frame title="Enrol your face" step="Step 2 · Enrolment">
      <p className="text-sm text-text">
        Take 3 photos with your face centred and well lit. Turn your head very slightly between photos. Only an encrypted face
        template is kept, not the photos.
      </p>
      {cam.error ? <ErrorState message={cam.error} /> : <VideoBox video={video} faces={cam.faces} ready={cam.ready} />}
      {enrol.isError && <ErrorState message={errorMessage(enrol.error)} />}
      <Button onClick={capture} disabled={!cam.ready || cam.faces !== 1 || enrol.isPending || shots.length >= 3}>
        <Camera aria-hidden="true" /> {enrol.isPending ? "Saving…" : `Take photo ${Math.min(shots.length + 1, 3)} of 3`}
      </Button>
    </Frame>
  );
}

type VerifyResult = { result: "pass" | "retry" | "review"; status: string; attempts_left: number };

function LivenessStep({ session, onChange }: { session: CandidateSession; onChange: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [challenge, setChallenge] = useState<{ check_id: string; challenge: Challenge; window_s: number; attempt: number; max_attempts: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const detector = useRef<LivenessDetector | null>(null);
  const frames = useRef<string[]>([]);
  const lastCrop = useRef(0);
  const finishing = useRef(false);

  const onFrame = (f: FaceFrame) => {
    const d = detector.current;
    const el = video.current;
    if (!d || !el || finishing.current) return;
    const lm = f.result.faceLandmarks;
    const one = lm.length === 1 ? (lm[0] as Point[]) : null;
    d.push({ t: f.t, faces: lm.length, ear: one ? eyeAspectRatio(one) : 0, noseOffset: one ? noseOffset(one) : 0 });
    if (one && f.t - lastCrop.current > 600) {
      lastCrop.current = f.t;
      frames.current = [...frames.current, cropFace(el, one, 160, 0.75)].slice(-3);
    }
    if (d.done) void finish(true);
  };
  const cam = useFaceCamera(video, onFrame);

  async function begin() {
    setMessage(null);
    setBusy(true);
    try {
      const c = await api<typeof challenge & object>(`/sessions/${session.id}/identity/challenge`, { method: "POST" });
      frames.current = [];
      finishing.current = false;
      detector.current = new LivenessDetector(c.challenge);
      setChallenge(c);
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function finish(passed: boolean) {
    if (finishing.current || !challenge) return;
    finishing.current = true;
    const d = detector.current;
    detector.current = null;
    setBusy(true);
    try {
      const lm = cam.latest.current?.result.faceLandmarks[0] as Point[] | undefined;
      await api(`/sessions/${session.id}/liveness`, {
        body: { check_id: challenge.check_id, passed, detail: d?.detail() ?? "", frames: frames.current.length >= 2 ? frames.current : [...frames.current, ...frames.current] },
      });
      if (!video.current || !lm) throw new Error("No face visible");
      const res = await api<VerifyResult>(`/sessions/${session.id}/verify`, {
        body: { kind: "start", check_id: challenge.check_id, image: cropFace(video.current, lm) },
      });
      setChallenge(null);
      if (res.result === "retry") setMessage(`We could not confirm it was you. Please try again in good light (${res.attempts_left} attempt left).`);
      onChange();
    } catch (err) {
      setChallenge(null);
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!challenge) return;
    const t = setTimeout(() => void finish(false), challenge.window_s * 1000);
    return () => clearTimeout(t);
    // finish is stable for a given challenge
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge]);

  return (
    <Frame title="Verify it's you" step="Step 3 · Identity check">
      {cam.error ? <ErrorState message={cam.error} /> : <VideoBox video={video} faces={cam.faces} ready={cam.ready} />}
      {challenge ? (
        <p className="rounded-xl bg-primary-50 px-4 py-3 text-sm font-medium text-primary-700" role="status">
          {challengeText[challenge.challenge]}
        </p>
      ) : (
        <p className="text-sm text-text">When you are ready, start the check and follow the short instruction on screen.</p>
      )}
      {message && <ErrorState message={message} />}
      {!challenge && (
        <Button onClick={begin} disabled={!cam.ready || cam.faces !== 1 || busy}>
          {busy ? "Checking…" : "Start check"}
        </Button>
      )}
    </Frame>
  );
}

function ReviewWait({ onChange }: { onChange: () => void }) {
  useEffect(() => {
    const t = setInterval(onChange, 5000);
    return () => clearInterval(t);
  }, [onChange]);
  return (
    <Frame title="Waiting for your mentor" step="Identity review">
      <div className="flex gap-3 text-sm text-text">
        <Clock className="size-5 shrink-0 text-muted" aria-hidden="true" />
        <p>
          We couldn't confirm your identity automatically, so your mentor will review it. This page updates by itself – please keep
          it open.
        </p>
      </div>
      <LoadingState rows={1} label="Waiting for mentor decision" />
    </Frame>
  );
}

export function PreStartFlow({ session, onChange }: { session: CandidateSession; onChange: () => void }) {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["identity-status"], queryFn: () => api<IdentityStatus>("/identity/status") });
  const refreshStatus = () => qc.invalidateQueries({ queryKey: ["identity-status"] });

  if (session.status === "identity_review") return <ReviewWait onChange={onChange} />;
  if (session.status === "calibrating") return <CalibrationStep session={session} onChange={onChange} />;
  if (status.isPending) return <Frame title={session.exam_title} step="Preparing"><LoadingState /></Frame>;
  if (status.isError) return <Frame title={session.exam_title} step="Preparing"><ErrorState onRetry={() => status.refetch()} /></Frame>;
  if (!status.data.consented) return <ConsentStep status={status.data} onDone={refreshStatus} />;
  if (!status.data.enrolled) return <EnrolStep onDone={refreshStatus} />;
  return <LivenessStep session={session} onChange={onChange} />;
}

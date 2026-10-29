import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ErrorState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CandidateSession } from "@/features/assessment/types";
import {
  buildCalibration,
  CALIBRATION_TARGETS,
  type FrameSignals,
  saveCalibration,
  type Target,
} from "@/features/proctoring/signals";
import { gazeRatios, headAngles, type Point } from "@/features/vision/geometry";
import { type FaceFrame, useFaceCamera } from "@/features/vision/useFaceCamera";
import { api, errorMessage } from "@/lib/api";
import { E2E, E2E_CALIBRATION } from "@/lib/e2e";
import { cn } from "@/lib/utils";

const PER_TARGET_MS = 2500;
const SETTLE_MS = 600; // ignore samples while the eyes move to the new target

const position: Record<Target, string> = {
  centre: "left-1/2 top-1/2",
  top_left: "left-[6%] top-[8%]",
  top_right: "left-[94%] top-[8%]",
  bottom_left: "left-[6%] top-[92%]",
  bottom_right: "left-[94%] top-[92%]",
};

function toSignals(f: FaceFrame): FrameSignals {
  const lm = f.result.faceLandmarks[0] as Point[] | undefined;
  const m = f.result.facialTransformationMatrixes?.[0]?.data;
  const a = m ? headAngles(m) : { yaw: 0, pitch: 0 };
  const g = lm ? gazeRatios(lm) : { h: 0.5, v: 0.5 };
  return { t: f.t, faces: f.result.faceLandmarks.length, yaw: a.yaw, pitch: a.pitch, gazeH: g.h, gazeV: g.v, box: null };
}

/** 10-20 s gaze/head-pose calibration, then the clock starts. Calibration problems never block the start. */
export function CalibrationStep({ session, onChange }: { session: CandidateSession; onChange: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [running, setRunning] = useState(false);
  const [targetIndex, setTargetIndex] = useState(-1);
  const [failed, setFailed] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (E2E) {
      saveCalibration(session.id, E2E_CALIBRATION);
      setDone(true);
    }
  }, [session.id]);
  const samples = useRef<Record<Target, FrameSignals[]>>({ centre: [], top_left: [], top_right: [], bottom_left: [], bottom_right: [] });
  const targetStart = useRef(0);
  const target = targetIndex >= 0 ? CALIBRATION_TARGETS[targetIndex] : null;

  const cam = useFaceCamera(video, (f) => {
    if (!running || !target || performance.now() - targetStart.current < SETTLE_MS) return;
    samples.current[target].push(toSignals(f));
  });

  useEffect(() => {
    if (!running) return;
    if (targetIndex >= CALIBRATION_TARGETS.length) {
      setRunning(false);
      const cal = buildCalibration(samples.current);
      if (cal) {
        saveCalibration(session.id, cal);
        setDone(true);
      } else setFailed((n) => n + 1);
      return;
    }
    targetStart.current = performance.now();
    const t = setTimeout(() => setTargetIndex((i) => i + 1), PER_TARGET_MS);
    return () => clearTimeout(t);
  }, [running, targetIndex, session.id]);

  function begin() {
    samples.current = { centre: [], top_left: [], top_right: [], bottom_left: [], bottom_right: [] };
    setTargetIndex(0);
    setRunning(true);
  }

  const start = useMutation({
    mutationFn: async () => {
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {
        /* full screen is optional */
      }
      return api(`/sessions/${session.id}/start`, { method: "POST" });
    },
    onSuccess: onChange,
  });

  // one persistent <video>: the camera stream stays attached while the view switches
  const preview = (
    <video
      ref={video}
      className={running ? "hidden" : "fixed bottom-4 right-4 z-10 aspect-[4/3] w-40 -scale-x-100 rounded-xl border border-border object-cover"}
      muted
      playsInline
      aria-label="Your camera preview"
    />
  );

  if (running && target) {
    return (
      <main className="fixed inset-0 bg-bg" aria-live="polite">
        {preview}
        <p className="absolute inset-x-0 top-1/3 text-center text-sm text-muted">Look at the dot until it moves.</p>
        <p className="sr-only" aria-live="polite">
          Point {targetIndex + 1} of {CALIBRATION_TARGETS.length}
        </p>
        <span
          className={cn(
            "absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-600 ring-8 ring-primary-100 transition-all duration-200 ease-out",
            position[target],
          )}
          aria-label={`Calibration point ${targetIndex + 1} of ${CALIBRATION_TARGETS.length}`}
          role="img"
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      {preview}
      <Card className="w-full max-w-lg space-y-4 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Step 4 · Calibration</p>
        <h1 className="text-xl font-semibold">{done ? "All set" : "Quick calibration"}</h1>
        {cam.error && <ErrorState message={cam.error} />}
        {!done && (
          <p className="text-sm text-text">
            Sit as you will during the assessment. A dot will appear in the centre and the four corners for about 12 seconds –
            follow it with your eyes.
          </p>
        )}
        {failed > 0 && !done && <ErrorState message="We could not see your face clearly. Check the light and try again." />}
        {done ? (
          <p className="text-sm text-text">
            {session.exam_title} · {session.duration_min} minutes. The timer starts when you press Start. If you look away for a
            while you will see a short, neutral reminder – your assessment is never stopped.
          </p>
        ) : null}
        {start.isError && <ErrorState message={errorMessage(start.error)} />}
        <div className="flex flex-wrap gap-2">
          {!done && (
            <Button onClick={begin} variant={failed >= 2 ? "secondary" : "primary"} disabled={!cam.ready || cam.faces !== 1}>
              {failed ? "Try calibration again" : "Start calibration"}
            </Button>
          )}
          {(done || failed >= 2) && (
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              Start assessment
            </Button>
          )}
        </div>
      </Card>
    </main>
  );
}

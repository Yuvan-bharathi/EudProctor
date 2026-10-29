import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { FlagCounter } from "@/components/FlagCounter";
import { FlagNotice } from "@/components/FlagNotice";
import type { CandidateSession } from "@/features/assessment/types";
import { cropBox, snapshotFrame, startCamera, stopCamera } from "@/features/vision/camera";
import { api } from "@/lib/api";
import { E2E } from "@/lib/e2e";
import { reconcileCount } from "./classify";
import type { ClientEvent, FlagStatus, ProctoringConfig } from "./config";
import { watchIntegrity } from "./integrity";
import { ProctorMonitor } from "./monitor";
import { type FrameSignals, loadCalibration } from "./signals";
import { EventUploader } from "./uploader";
import { startVision, type VisionSource } from "./visionSource";

/**
 * Candidate-side proctoring. Shows only the small flag counter and the neutral notice. Video stays in the
 * browser; only events (and a small snapshot for a red flag) are uploaded. Nothing here pauses or submits.
 */
export function ProctoringLayer({ session }: { session: CandidateSession }) {
  const cfg = useQuery({
    queryKey: ["proctoring-config", session.id],
    queryFn: () => api<ProctoringConfig>(`/sessions/${session.id}/proctoring-config`),
    staleTime: Infinity,
  });
  const max = cfg.data?.max_flags ?? session.max_flags;
  const [count, setCount] = useState(Math.min(session.flag_count, max));
  const [notice, setNotice] = useState<number | null>(null);
  const noticed = useRef(session.flag_count);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const config = cfg.data;
    const el = video.current;
    if (!config || !el) return;
    let stream: MediaStream | null = null;
    let vision: VisionSource | null = null;
    let stopIntegrity: (() => void) | null = null;
    let identityTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSignals: FrameSignals | null = null;
    let cancelled = false;
    let current = Math.min(session.flag_count, config.max_flags);
    const examStart = session.started_at ? new Date(session.started_at).getTime() : Date.now();

    const showNotice = (n: number) => {
      if (n > noticed.current && n <= config.max_flags) {
        noticed.current = n;
        setNotice(n);
      }
    };
    const onStatus = (fs: FlagStatus) => {
      current = reconcileCount(current, fs);
      setCount(current);
      monitor.syncFlagCount(current);
      showNotice(current); // server truth: covers a notice the browser missed
    };
    const uploader = new EventUploader(
      session.id,
      (events) => api<FlagStatus>(`/sessions/${session.id}/events`, { body: { events } }),
      onStatus,
    );
    const emit = (ev: ClientEvent) => void uploader.enqueue(ev);
    const monitor = new ProctorMonitor(config, loadCalibration(session.id), examStart, {
      emit,
      notice: (n) => {
        setCount(Math.min(n, config.max_flags));
        showNotice(n);
      },
      snapshot: () => (video.current ? snapshotFrame(video.current) : null),
      flagCount: () => current,
    });
    const cameraLost = () =>
      emit({
        client_event_id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        type: "CAMERA_UNAVAILABLE",
        started_at: new Date().toISOString(),
        duration_ms: 0,
        exam_clock_ms: Date.now() - examStart,
      });

    async function identityCheck() {
      try {
        if (lastSignals?.faces === 1 && lastSignals.box && video.current) {
          await api(`/sessions/${session.id}/verify`, { body: { kind: "random", image: cropBox(video.current, lastSignals.box) } });
        }
        const next = await api<CandidateSession>(`/sessions/${session.id}`);
        scheduleIdentity(next.next_identity_check_in_s ?? null);
      } catch {
        /* a missed random check is not an error for the candidate */
      }
    }
    function scheduleIdentity(seconds: number | null) {
      if (seconds === null || cancelled) return;
      identityTimer = setTimeout(() => void identityCheck(), Math.max(1, seconds) * 1000);
    }

    uploader.start();
    stopIntegrity = watchIntegrity(config, examStart, emit);
    (async () => {
      try {
        if (!E2E) {
          stream = await startCamera(el);
          stream.getVideoTracks()[0]?.addEventListener("ended", cameraLost);
        }
        vision = await startVision(el, (s) => {
          lastSignals = s;
          monitor.onSignals(s);
        });
        if (cancelled) vision.stop();
        scheduleIdentity(session.next_identity_check_in_s ?? null);
      } catch {
        cameraLost(); // the assessment continues; the mentor decides
      }
    })();

    return () => {
      cancelled = true;
      vision?.stop();
      stopCamera(stream);
      stopIntegrity?.();
      if (identityTimer) clearTimeout(identityTimer);
      void uploader.flush().finally(() => uploader.stop());
    };
    // run once per session/config
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.data, session.id]);

  return (
    <>
      <video ref={video} className="hidden" muted playsInline aria-hidden="true" />
      <FlagCounter count={count} max={max} />
      <FlagNotice flagNo={notice} max={max} />
    </>
  );
}

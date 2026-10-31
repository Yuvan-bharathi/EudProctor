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

/** Why the latest red flag was raised: a long look-away or leaving the assessment tab. */
export type FlagReason = "look" | "tab";
const TAB_NOTICE_WINDOW_MS = 10_000;

/**
 * Candidate-side proctoring engine: camera + face landmarks, look-away / face / tab-switch detection and the event
 * uploader. Returns only the candidate's own flag counter and the latest new flag number for the neutral notice.
 * Video stays in the browser; only events (and a small snapshot for a red flag) are uploaded. Nothing here pauses
 * or submits. Pass `null` (no backend session) to keep it idle. Render a hidden <video> with the returned ref.
 */
export function useProctoring(session: CandidateSession | null) {
  const sessionId = session?.id ?? null;
  const cfg = useQuery({
    queryKey: ["proctoring-config", sessionId],
    queryFn: () => api<ProctoringConfig>(`/sessions/${sessionId}/proctoring-config`),
    staleTime: Infinity,
    enabled: sessionId !== null,
  });
  const max = cfg.data?.max_flags ?? session?.max_flags ?? 3;
  const [count, setCount] = useState(Math.min(session?.flag_count ?? 0, max));
  const [notice, setNotice] = useState<number | null>(null);
  const [noticeReason, setNoticeReason] = useState<FlagReason>("look");
  const noticed = useRef(session?.flag_count ?? 0);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const config = cfg.data;
    const el = video.current;
    if (!session || !config || !el) return;
    const s = session; // non-null inside the closures below
    let stream: MediaStream | null = null;
    let vision: VisionSource | null = null;
    let stopIntegrity: (() => void) | null = null;
    let identityTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSignals: FrameSignals | null = null;
    let cancelled = false;
    let current = Math.min(s.flag_count, config.max_flags);
    setCount(current); // the session may arrive after the first render (e.g. resuming with earlier flags)
    noticed.current = Math.max(noticed.current, s.flag_count);
    const examStart = s.started_at ? new Date(s.started_at).getTime() : Date.now();

    let lastTabSwitchAt = 0;
    const showNotice = (n: number, reason: FlagReason) => {
      if (n > noticed.current && n <= config.max_flags) {
        noticed.current = n;
        setNotice(n);
        setNoticeReason(reason);
      }
    };
    const onStatus = (fs: FlagStatus) => {
      current = reconcileCount(current, fs);
      setCount(current);
      monitor.syncFlagCount(current);
      // server truth: covers a notice the browser missed; a flag right after a tab switch came from it
      showNotice(current, Date.now() - lastTabSwitchAt < TAB_NOTICE_WINDOW_MS ? "tab" : "look");
    };
    const uploader = new EventUploader(
      s.id,
      (events) => api<FlagStatus>(`/sessions/${s.id}/events`, { body: { events } }),
      onStatus,
    );
    const emit = (ev: ClientEvent) => {
      if (ev.type === "TAB_SWITCH") {
        lastTabSwitchAt = Date.now();
        void uploader.enqueue(ev).then(() => uploader.flush()); // the server raises the flag: tell them promptly
        return;
      }
      void uploader.enqueue(ev);
    };
    const monitor = new ProctorMonitor(config, loadCalibration(s.id), examStart, {
      emit,
      notice: (n) => {
        setCount(Math.min(n, config.max_flags));
        showNotice(n, "look");
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
          await api(`/sessions/${s.id}/verify`, { body: { kind: "random", image: cropBox(video.current, lastSignals.box) } });
        }
        const next = await api<CandidateSession>(`/sessions/${s.id}`);
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
        scheduleIdentity(s.next_identity_check_in_s ?? null);
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
  }, [cfg.data, sessionId]);

  return { count, max, notice, noticeReason, videoRef: video };
}

/** Shows only the small flag counter and the neutral notice. */
export function ProctoringLayer({ session }: { session: CandidateSession }) {
  const { count, max, notice, noticeReason, videoRef: video } = useProctoring(session);
  return (
    <>
      <video ref={video} className="hidden" muted playsInline aria-hidden="true" />
      <FlagCounter count={count} max={max} />
      <FlagNotice flagNo={notice} max={max} reason={noticeReason} />
    </>
  );
}

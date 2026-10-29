import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { type RefObject, useEffect, useRef, useState } from "react";
import { E2E } from "@/lib/e2e";
import { CameraError, getLandmarker, startCamera, stopCamera } from "./camera";

export interface FaceFrame {
  t: number;
  result: FaceLandmarkerResult;
}

/** Starts the camera and runs the landmarker at ~10 fps on the main thread (pre-start steps only). */
export function useFaceCamera(video: RefObject<HTMLVideoElement>, onFrame?: (f: FaceFrame) => void) {
  const [state, setState] = useState<{ ready: boolean; error: string | null; faces: number }>({
    ready: false,
    error: null,
    faces: 0,
  });
  const latest = useRef<FaceFrame | null>(null);
  const frameCb = useRef(onFrame);
  frameCb.current = onFrame;

  useEffect(() => {
    if (E2E) {
      setState({ ready: true, error: null, faces: 1 });
      return;
    }
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    (async () => {
      try {
        const el = video.current;
        if (!el) return;
        stream = await startCamera(el);
        const lm = await getLandmarker();
        if (cancelled) return;
        setState((s) => ({ ...s, ready: true }));
        timer = setInterval(() => {
          if (el.readyState < 2) return;
          const t = performance.now();
          const result = lm.detectForVideo(el, t);
          latest.current = { t, result };
          setState((s) => (s.faces === result.faceLandmarks.length ? s : { ...s, faces: result.faceLandmarks.length }));
          frameCb.current?.(latest.current);
        }, 100);
      } catch (err) {
        setState({ ready: false, faces: 0, error: err instanceof CameraError ? err.message : "Face detection could not start." });
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stopCamera(stream);
    };
  }, [video]);

  return { ...state, latest };
}

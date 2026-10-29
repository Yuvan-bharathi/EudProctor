import { FACE_MODEL_URL, getLandmarker, WASM_BASE } from "../vision/camera";
import { faceBox, gazeRatios, headAngles, type Point } from "../vision/geometry";
import { E2E, e2eSignals } from "@/lib/e2e";
import type { FrameSignals } from "./signals";

const FPS_INTERVAL = 100; // ~10 fps

export interface VisionSource {
  stop(): void;
}

/** Preferred: landmarker in a Web Worker. Falls back to the main thread if the worker cannot start. */
export async function startVision(video: HTMLVideoElement, onSignals: (s: FrameSignals) => void): Promise<VisionSource> {
  if (E2E) {
    const timer = setInterval(() => onSignals(e2eSignals()), FPS_INTERVAL);
    return { stop: () => clearInterval(timer) };
  }
  try {
    return await startWorker(video, onSignals);
  } catch {
    return startMainThread(video, onSignals);
  }
}

function startWorker(video: HTMLVideoElement, onSignals: (s: FrameSignals) => void): Promise<VisionSource> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./vision.worker.ts", import.meta.url), { type: "module" });
    let timer: ReturnType<typeof setInterval> | null = null;
    let pending = false;
    const fail = setTimeout(() => {
      worker.terminate();
      reject(new Error("worker timeout"));
    }, 20_000);
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "ready") {
        clearTimeout(fail);
        timer = setInterval(async () => {
          if (pending || video.readyState < 2) return; // skip frames, don't queue
          pending = true;
          try {
            const bitmap = await createImageBitmap(video);
            worker.postMessage({ type: "frame", bitmap, t: performance.now() }, [bitmap]);
          } finally {
            pending = false;
          }
        }, FPS_INTERVAL);
        resolve({
          stop() {
            if (timer) clearInterval(timer);
            worker.terminate();
          },
        });
      } else if (m.type === "signals") {
        onSignals(m.signals as FrameSignals);
      } else if (m.type === "error") {
        clearTimeout(fail);
        worker.terminate();
        reject(new Error(m.message));
      }
    };
    worker.onerror = () => {
      clearTimeout(fail);
      worker.terminate();
      reject(new Error("worker failed"));
    };
    worker.postMessage({ type: "init", wasmBase: new URL(WASM_BASE, location.origin).href, modelUrl: FACE_MODEL_URL });
  });
}

async function startMainThread(video: HTMLVideoElement, onSignals: (s: FrameSignals) => void): Promise<VisionSource> {
  const lm = await getLandmarker();
  const timer = setInterval(() => {
    if (video.readyState < 2) return;
    const r = lm.detectForVideo(video, performance.now());
    const pts = r.faceLandmarks[0] as Point[] | undefined;
    const m = r.facialTransformationMatrixes?.[0]?.data;
    const angles = m ? headAngles(m) : { yaw: 0, pitch: 0 };
    const gaze = pts ? gazeRatios(pts) : { h: 0.5, v: 0.5 };
    onSignals({
      t: Date.now(),
      faces: r.faceLandmarks.length,
      yaw: angles.yaw,
      pitch: angles.pitch,
      gazeH: gaze.h,
      gazeV: gaze.v,
      box: pts ? faceBox(pts) : null,
    });
  }, FPS_INTERVAL);
  return { stop: () => clearInterval(timer) };
}

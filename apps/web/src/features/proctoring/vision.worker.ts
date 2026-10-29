/// <reference lib="webworker" />
/**
 * MediaPipe Face Landmarker in a Web Worker. Receives ImageBitmap frames (~10 fps, never queued) and returns
 * numeric signals only. Frames never leave the device.
 */
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { faceBox, gazeRatios, headAngles, type Point } from "../vision/geometry";
import type { FrameSignals } from "./signals";

declare const self: DedicatedWorkerGlobalScope & { importScripts?: (...urls: string[]) => void };

// tasks-vision loads its WASM glue with importScripts, which throws in module workers. Workers allow synchronous
// XHR, so replace it: load the script text and evaluate it in global scope.
self.importScripts = (...urls: string[]) => {
  for (const url of urls) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.send();
    (0, eval)(xhr.responseText);
  }
};

let landmarker: FaceLandmarker | null = null;
let busy = false;

type InMsg = { type: "init"; wasmBase: string; modelUrl: string } | { type: "frame"; bitmap: ImageBitmap; t: number };

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const msg = e.data;
  if (msg.type === "init") {
    try {
      const files = await FilesetResolver.forVisionTasks(msg.wasmBase);
      landmarker = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: msg.modelUrl, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 2,
        outputFacialTransformationMatrixes: true,
      });
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "error", message: String(err) });
    }
    return;
  }
  if (msg.type === "frame") {
    if (!landmarker || busy) {
      msg.bitmap.close(); // skip frames instead of queueing
      return;
    }
    busy = true;
    try {
      const r = landmarker.detectForVideo(msg.bitmap, msg.t);
      const lm = r.faceLandmarks[0] as Point[] | undefined;
      const m = r.facialTransformationMatrixes?.[0]?.data;
      const angles = m ? headAngles(m) : { yaw: 0, pitch: 0 };
      const gaze = lm ? gazeRatios(lm) : { h: 0.5, v: 0.5 };
      const out: FrameSignals = {
        t: Date.now(),
        faces: r.faceLandmarks.length,
        yaw: angles.yaw,
        pitch: angles.pitch,
        gazeH: gaze.h,
        gazeV: gaze.v,
        box: lm ? faceBox(lm) : null,
      };
      self.postMessage({ type: "signals", signals: out });
    } finally {
      msg.bitmap.close();
      busy = false;
    }
  }
};

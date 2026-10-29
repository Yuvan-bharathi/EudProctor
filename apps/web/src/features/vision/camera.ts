import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { faceBox, type Point } from "./geometry";

export const FACE_MODEL_URL =
  import.meta.env.VITE_FACE_MODEL_URL ??
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
export const WASM_BASE = "/mediapipe/wasm";

export class CameraError extends Error {}

/** 640x480 camera stream. Frames are processed locally only. */
export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError("This browser cannot use the camera.");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    return stream;
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === "NotAllowedError") throw new CameraError("Camera permission was denied. Allow camera access and try again.");
    if (name === "NotFoundError") throw new CameraError("No camera was found.");
    throw new CameraError("The camera could not be started.");
  }
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

let landmarker: Promise<FaceLandmarker> | null = null;

/** Main-thread landmarker for the short pre-start steps (the assessment itself uses the Web Worker). */
export function getLandmarker(): Promise<FaceLandmarker> {
  landmarker ??= (async () => {
    const files = await FilesetResolver.forVisionTasks(WASM_BASE);
    return FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 2,
      outputFacialTransformationMatrixes: true,
    });
  })();
  return landmarker;
}

/** Crop the face region to a small JPEG (base64, no data: prefix). The only image data we upload. */
export function cropFace(video: HTMLVideoElement, landmarks: Point[], size = 224, quality = 0.85): string {
  return cropBox(video, faceBox(landmarks), size, quality);
}

export function cropBox(
  video: HTMLVideoElement,
  box: { x: number; y: number; w: number; h: number },
  size = 224,
  quality = 0.85,
): string {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CameraError("Canvas unavailable");
  ctx.drawImage(video, box.x * vw, box.y * vh, box.w * vw, box.h * vh, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", quality).split(",", 2)[1];
}

/** Evidence snapshot for red flags / high-severity alerts only: JPEG, at most 640 px wide, quality 0.7. */
export function snapshotFrame(video: HTMLVideoElement, maxWidth = 640, quality = 0.7): string | null {
  if (!video.videoWidth) return null;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality).split(",", 2)[1];
}

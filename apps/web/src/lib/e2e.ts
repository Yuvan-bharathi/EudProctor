/**
 * Playwright E2E hooks. Enabled only when the app is built/served with VITE_E2E=1 (never in production builds):
 * the camera and vision worker are replaced by a scripted signal source the test controls via window.__e2eVision.
 */
import type { FrameSignals } from "@/features/proctoring/signals";

export const E2E = import.meta.env.DEV && import.meta.env.VITE_E2E === "1";

type Scripted = Pick<FrameSignals, "faces" | "yaw" | "pitch" | "gazeH" | "gazeV">;

declare global {
  interface Window {
    __e2eVision?: Scripted;
  }
}

export function e2eSignals(): FrameSignals {
  const s = window.__e2eVision ?? { faces: 1, yaw: 0, pitch: 0, gazeH: 0.5, gazeV: 0.5 };
  return { t: Date.now(), ...s, box: null };
}

export const E2E_CALIBRATION = { yaw: 0, pitch: 0, gazeH: [0.4, 0.6] as [number, number], gazeV: [0.4, 0.6] as [number, number] };

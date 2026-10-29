import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_STORAGE } from "../playwright.config";

export const PASSWORD = "eduproctor-dev";
export const API = "http://127.0.0.1:8100/api/v1";

export async function token(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).access_token;
}

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** Latest emailed join link for a recipient, from the API's file outbox. */
export function latestJoinLink(email: string): string {
  const dir = path.join(E2E_STORAGE, "outbox");
  const files = readdirSync(dir)
    .map((f) => path.join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  for (const f of files) {
    const raw = readFileSync(f, "utf8");
    if (!raw.includes(email)) continue;
    const body = raw.replace(/=\r?\n/g, "").replace(/=3D/g, "="); // undo quoted-printable soft breaks
    const m = body.match(/\/join\/([A-Za-z0-9_-]{20,})/);
    if (m) return `/join/${m[1]}`;
  }
  throw new Error(`No join link emailed to ${email}`);
}

/**
 * Identity via the API with synthetic images drawn in the browser (no real faces). The dev identity engine
 * compares pixels; frames differ so the liveness check sees motion.
 */
export async function passIdentity(page: Page, sessionId: string) {
  const result = await page.evaluate(async (sid) => {
    const auth = JSON.parse(localStorage.getItem("eduproctor.auth") ?? "{}").access_token;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = async (url: string, body: unknown): Promise<any> => {
      const r = await fetch(`/api/v1${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
        body: JSON.stringify(body),
      });
      return r.status === 204 ? {} : r.json();
    };
    const img = (shift: number, noise: number) => {
      const c = document.createElement("canvas");
      c.width = 192;
      c.height = 192;
      const g = c.getContext("2d")!;
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const v = Math.floor(rnd() * 255);
          g.fillStyle = `rgb(${v},${v},${v})`;
          g.fillRect(((x * 24 + shift) % 192), y * 24, 24, 24);
        }
      g.fillStyle = `rgba(128,128,128,${noise})`;
      g.fillRect(0, 0, 4, 4);
      return c.toDataURL("image/jpeg", 0.9).split(",")[1];
    };
    await call("/identity/enrol", { images: [img(0, 0.1), img(0, 0.2), img(0, 0.3)] });
    const ch = await call(`/sessions/${sid}/identity/challenge`, {});
    await call(`/sessions/${sid}/liveness`, { check_id: ch.check_id, passed: true, detail: ch.challenge, frames: [img(0, 0), img(12, 0), img(24, 0)] });
    return call(`/sessions/${sid}/verify`, { kind: "start", check_id: ch.check_id, image: img(0, 0.15) });
  }, sessionId);
  expect(result.result).toBe("pass");
}

declare global {
  interface Window {
    __e2eVision?: { faces: number; yaw: number; pitch: number; gazeH: number; gazeV: number };
  }
}

export async function setGaze(page: Page, v: Partial<{ faces: number; yaw: number; pitch: number; gazeH: number; gazeV: number }>) {
  await page.evaluate((s) => {
    window.__e2eVision = { faces: 1, yaw: 0, pitch: 0, gazeH: 0.5, gazeV: 0.5, ...s };
  }, v);
}

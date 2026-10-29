import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

// A separate API (port 8100, fresh database "eduproctor_e2e", rule-based mock LLM, file outbox) and a Vite server
// built with VITE_E2E=1 (camera/vision replaced by a scripted signal source). Set UV="python -m uv" if the `uv`
// binary is not on PATH.
const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../api");
export const E2E_STORAGE = path.join(API_DIR, ".data", "e2e-storage");
const uv = process.env.UV ?? "uv";

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5174", trace: "retain-on-failure" },
  webServer: [
    {
      command: `${uv} run python -m app.devserver`,
      cwd: API_DIR,
      url: "http://127.0.0.1:8100/api/v1/health",
      timeout: 240_000,
      reuseExistingServer: false,
      env: {
        ENVIRONMENT: "dev",
        DEV_DB_NAME: "eduproctor_e2e",
        DEV_RESET: "1",
        DEV_DEMO: "0",
        API_PORT: "8100",
        RELOAD: "0",
        AGENT_LLM: "mock",
        MAIL_BACKEND: "file",
        STORAGE_DIR: E2E_STORAGE,
        WEB_BASE_URL: "http://localhost:5174",
        CORS_ORIGINS: '["http://localhost:5174"]',
        EVALUATION_JOBS: "background",
        REDIS_URL: "redis://127.0.0.1:1/0",
      },
    },
    {
      command: "pnpm exec vite --port 5174 --strictPort",
      url: "http://localhost:5174",
      timeout: 120_000,
      reuseExistingServer: false,
      env: { VITE_E2E: "1", VITE_API_TARGET: "http://127.0.0.1:8100" },
    },
  ],
});

import type { ProctoringConfig } from "./config";

/** Same rules as apps/api/app/proctoring/policy.py. The server re-classifies and is the authority. */
export type LookAwayClass = "ignore" | "glance" | "flag" | "post_limit";

export function classify(
  durationMs: number,
  flagCount: number,
  cfg: Pick<ProctoringConfig, "glance_min_s" | "flag_threshold_s" | "max_flags">,
): LookAwayClass {
  if (durationMs < cfg.glance_min_s * 1000) return "ignore";
  if (durationMs < cfg.flag_threshold_s * 1000) return "glance";
  if (flagCount < cfg.max_flags) return "flag";
  return "post_limit";
}

/** The candidate counter always shows the server value, capped at max (never more than max). */
export function reconcileCount(_optimistic: number, server: { flag_count: number; max_flags: number }): number {
  return Math.min(Math.max(server.flag_count, 0), server.max_flags);
}

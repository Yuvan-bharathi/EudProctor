import type { Dir, LookAwayEvent, ProctoringConfig, Source } from "./config";

/**
 * Look-away state machine (reference.md). A look-away only ends after the candidate has been back on screen for
 * return_to_screen_s; a shorter return is part of the same look-away. One continuous look-away = one event.
 */
export type LookState =
  | { phase: "on" }
  | { phase: "away"; since: number; source: Source; direction: Dir; returnAt?: number };

type Cfg = Pick<ProctoringConfig, "glance_min_s" | "return_to_screen_s">;

export function step(
  s: LookState,
  now: number,
  away: boolean,
  src: Source,
  dir: Dir,
  cfg: Cfg,
): [LookState, LookAwayEvent?] {
  if (s.phase === "on") {
    return away ? [{ phase: "away", since: now, source: src, direction: dir }] : [s];
  }
  if (away) {
    // still (or again) away: cancel any pending return; head wins over eyes as source
    const source: Source = s.source === "head" || src === "head" ? "head" : "eyes";
    return [{ ...s, source, returnAt: undefined }];
  }
  const returnAt = s.returnAt ?? now;
  if (now - returnAt < cfg.return_to_screen_s * 1000) return [{ ...s, returnAt }];
  const durationMs = returnAt - s.since; // time actually spent away
  if (durationMs < cfg.glance_min_s * 1000) return [{ phase: "on" }];
  return [{ phase: "on" }, { source: s.source, direction: s.direction, startedAt: s.since, durationMs }];
}

/** How long the current look-away has lasted so far (for the live notice), or 0 when on screen. */
export function ongoingMs(s: LookState, now: number): number {
  if (s.phase !== "away") return 0;
  return (s.returnAt ?? now) - s.since;
}

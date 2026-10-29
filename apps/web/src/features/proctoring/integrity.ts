import type { ClientEvent, ProctoringConfig } from "./config";

/** Browser integrity events: mentor-only alerts. Nothing here pauses or blocks the assessment. */
export function watchIntegrity(
  cfg: Pick<ProctoringConfig, "tab_switch_s">,
  examStartMs: number,
  emit: (ev: ClientEvent) => void,
): () => void {
  let hiddenSince: number | null = null;
  let wasFullscreen = Boolean(document.fullscreenElement);
  const id = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  const send = (type: ClientEvent["type"], start: number, duration = 0) =>
    emit({
      client_event_id: id(),
      type,
      started_at: new Date(start).toISOString(),
      duration_ms: duration,
      exam_clock_ms: Math.max(0, start - examStartMs),
    });

  const away = () => {
    hiddenSince ??= Date.now();
  };
  const back = () => {
    if (hiddenSince === null) return;
    const d = Date.now() - hiddenSince;
    if (d > cfg.tab_switch_s * 1000) send("TAB_SWITCH", hiddenSince, d);
    hiddenSince = null;
  };
  const onVisibility = () => (document.hidden ? away() : back());
  const onFullscreen = () => {
    const now = Boolean(document.fullscreenElement);
    if (wasFullscreen && !now) send("FULLSCREEN_EXIT", Date.now());
    wasFullscreen = now;
  };
  const onClipboard = (e: ClipboardEvent) => {
    e.preventDefault(); // blocked + logged
    send("COPY_PASTE_ATTEMPT", Date.now());
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("blur", away);
  window.addEventListener("focus", back);
  document.addEventListener("fullscreenchange", onFullscreen);
  document.addEventListener("copy", onClipboard);
  document.addEventListener("cut", onClipboard);
  document.addEventListener("paste", onClipboard);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("blur", away);
    window.removeEventListener("focus", back);
    document.removeEventListener("fullscreenchange", onFullscreen);
    document.removeEventListener("copy", onClipboard);
    document.removeEventListener("cut", onClipboard);
    document.removeEventListener("paste", onClipboard);
  };
}

/** Thresholds come from the server (GET /sessions/{id}/proctoring-config); never hard-code them. */
export interface ProctoringConfig {
  glance_min_s: number;
  flag_threshold_s: number;
  max_flags: number;
  yaw_limit_deg: number;
  pitch_limit_deg: number;
  face_absent_s: number;
  multi_face_s: number;
  tab_switch_s: number;
  return_to_screen_s: number;
  gaze_disabled: boolean;
}

export type Source = "head" | "eyes";
export type Dir = "left" | "right" | "up" | "down";

export interface LookAwayEvent {
  source: Source;
  direction: Dir;
  startedAt: number; // epoch ms
  durationMs: number;
}

export type ClientEventType =
  | "LOOK_AWAY"
  | "LOOK_AWAY_PROGRESS"
  | "FACE_ABSENT"
  | "MULTIPLE_FACES"
  | "TAB_SWITCH"
  | "FULLSCREEN_EXIT"
  | "COPY_PASTE_ATTEMPT"
  | "CAMERA_UNAVAILABLE";

export interface ClientEvent {
  client_event_id: string;
  type: ClientEventType;
  source?: Source;
  direction?: Dir;
  started_at: string;
  duration_ms: number;
  exam_clock_ms?: number;
  snapshot_b64?: string;
}

export interface FlagStatus {
  flag_count: number;
  max_flags: number;
}

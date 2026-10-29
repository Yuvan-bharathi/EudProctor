const LABELS: Record<string, string> = {
  LOOK_AWAY_FLAG: "Red flag",
  LOOK_AWAY_POST_LIMIT: "After limit",
  FACE_ABSENT: "Face not visible",
  MULTIPLE_FACES: "Multiple faces",
  TAB_SWITCH: "Left the tab",
  FULLSCREEN_EXIT: "Left full screen",
  COPY_PASTE_ATTEMPT: "Copy/paste blocked",
  CAMERA_UNAVAILABLE: "Camera unavailable",
  IDENTITY_MISMATCH: "Identity mismatch",
  LIVENESS_FAIL: "Liveness not passed",
};

export function eventLabel(type: string): string {
  return LABELS[type] ?? type.replace(/_/g, " ").toLowerCase();
}

import { MoveHorizontal, ScanEye } from "lucide-react";
import { cn, formatDuration } from "@/lib/utils";

export type LookSource = "head" | "eyes";

/** Mentor-only. Never render on candidate screens. */
export function GlanceChip({ source, durationMs }: { source: LookSource; durationMs?: number }) {
  const Icon = source === "eyes" ? ScanEye : MoveHorizontal;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-info-50 px-2 py-0.5 text-xs text-info-700">
      <Icon className="size-4" aria-hidden="true" />
      Glance · {source}
      {durationMs !== undefined && <span>· {formatDuration(durationMs)}</span>}
    </span>
  );
}

/** Mentor-only red flag chip. flagNo null = recorded after the limit. */
export function RedFlagChip({ flagNo, max, source }: { flagNo: number | null; max: number; source?: LookSource | "tab" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700">
      {flagNo === null ? "After limit" : `Red flag ${flagNo} of ${max}`}
      {source && <span className="font-normal">· {source === "tab" ? "left the tab" : source}</span>}
    </span>
  );
}

export type Severity = "high" | "medium" | "low";

const severityClass: Record<Severity, string> = {
  high: "bg-danger-50 text-danger-700",
  medium: "bg-warning-50 text-warning-800",
  low: "bg-info-50 text-info-700",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", severityClass[severity])}>
      {severity}
    </span>
  );
}

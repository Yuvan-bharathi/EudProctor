export type AssessmentStatus = "draft" | "scheduled" | "live" | "live_screening" | "completed" | "closed";

interface AssessmentStatusBadgeProps {
  status: AssessmentStatus | string;
  size?: "sm" | "md";
  className?: string;
}

export function AssessmentStatusBadge({
  status,
  size = "md",
  className = "",
}: AssessmentStatusBadgeProps) {
  const norm = (status || "").toLowerCase().trim();

  const isLive = norm === "live" || norm === "live_screening" || norm === "live session" || norm === "live screening";
  const isScheduled = norm === "scheduled";
  const isCompleted = norm === "completed" || norm === "closed";
  // Default is draft

  const sizeClass = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs";

  if (isLive) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 font-semibold text-emerald-700 border border-emerald-200 ${sizeClass} ${className}`}
      >
        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
        Live Screening
      </span>
    );
  }

  if (isScheduled) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-blue-50 font-semibold text-blue-700 border border-blue-200 ${sizeClass} ${className}`}
      >
        Scheduled
      </span>
    );
  }

  if (isCompleted) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-slate-100 font-semibold text-slate-700 border border-slate-200 ${sizeClass} ${className}`}
      >
        Completed
      </span>
    );
  }

  // Draft
  return (
    <span
      className={`inline-flex items-center rounded-full bg-surface-muted font-semibold text-muted border border-border ${sizeClass} ${className}`}
    >
      Draft
    </span>
  );
}

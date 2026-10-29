import { cn } from "@/lib/utils";

/** Candidate top-bar counter. Small, always visible, never blocks questions. */
export function FlagCounter({ count, max }: { count: number; max: number }) {
  const shown = Math.min(count, max);
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1 text-xs",
        shown > 0 ? "text-danger-700" : "text-muted",
      )}
      data-testid="flag-counter"
    >
      <span className="flex gap-1" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={cn("size-2 rounded-full", i < shown ? "bg-danger-500" : "border border-border-strong")}
          />
        ))}
      </span>
      <span>
        Flags {shown} of {max}
      </span>
    </div>
  );
}

import { CheckCircle2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Wraps anything written by an agent. Becomes a normal white card once a mentor approves it. */
export function AiDraftCard({
  children,
  approvedBy,
  title,
  className,
}: {
  children: ReactNode;
  approvedBy?: string | null;
  title?: string;
  className?: string;
}) {
  const approved = Boolean(approvedBy);
  return (
    <section
      className={cn("rounded-xl border p-5", approved ? "border-border bg-surface" : "border-ai-100 bg-ai-50", className)}
    >
      <div className="mb-3 flex items-center gap-2">
        {approved ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Approved by {approvedBy}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-ai-100 px-2 py-0.5 text-xs font-medium text-ai-700">
            <Sparkles className="size-4" aria-hidden="true" /> AI draft
          </span>
        )}
        {title && <h3 className="text-sm font-semibold text-text">{title}</h3>}
      </div>
      {children}
    </section>
  );
}

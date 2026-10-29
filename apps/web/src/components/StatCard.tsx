import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  tone = "default",
  delta,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "danger";
  delta?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold", tone === "danger" ? "text-danger-700" : "text-text")}>
        {value}
      </div>
      {delta && <div className="mt-1">{delta}</div>}
    </div>
  );
}

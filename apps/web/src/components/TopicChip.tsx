import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TopicClass = "strong" | "developing" | "weak" | "insufficient";

const topicClass: Record<TopicClass, string> = {
  strong: "bg-success-50 text-success-700",
  developing: "bg-warning-50 text-warning-800",
  weak: "bg-danger-50 text-danger-700",
  insufficient: "bg-surface-muted text-muted",
};

const topicIcon: Record<TopicClass, LucideIcon> = {
  strong: ArrowUp,
  developing: Minus,
  weak: ArrowDown,
  insufficient: Minus,
};

export const topicClassLabel: Record<TopicClass, string> = {
  strong: "Strong",
  developing: "Developing",
  weak: "Weak",
  insufficient: "Insufficient data",
};

/** Colour plus icon plus (screen-reader) label: status is never colour alone. */
export function TopicChip({ name, cls, scorePct }: { name: string; cls: TopicClass; scorePct: number | null }) {
  const Icon = topicIcon[cls];
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", topicClass[cls])}
      title={topicClassLabel[cls]}
    >
      <Icon className="size-4" aria-hidden="true" />
      {name}
      {scorePct !== null ? ` · ${Math.round(scorePct)}%` : " · insufficient data"}
      <span className="sr-only"> ({topicClassLabel[cls]})</span>
    </span>
  );
}

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium [&_svg]:size-4",
  {
    variants: {
      tone: {
        neutral: "bg-surface-muted text-muted",
        primary: "bg-primary-50 text-primary-700",
        ai: "bg-ai-100 text-ai-700",
        success: "bg-success-50 text-success-700",
        warning: "bg-warning-50 text-warning-800",
        danger: "bg-danger-50 text-danger-700",
        info: "bg-info-50 text-info-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

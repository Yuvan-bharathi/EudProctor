import { CheckCircle2, X } from "lucide-react";

interface FloatingToastProps {
  message: string | null;
  onClose: () => void;
}

export function FloatingToast({ message, onClose }: FloatingToastProps) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-5 right-5 z-50 flex items-center justify-between gap-3.5 rounded-xl border border-border/80 bg-surface/95 px-4 py-3 text-xs font-semibold text-text shadow-2xl backdrop-blur-md ring-1 ring-black/5 animate-in fade-in slide-in-from-top-3 max-w-md pointer-events-auto"
    >
      <div className="flex items-center gap-2.5">
        <CheckCircle2 className="size-4 text-success-600 shrink-0" />
        <span className="leading-snug">{message}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-text transition-colors cursor-pointer shrink-0"
        aria-label="Dismiss notification"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

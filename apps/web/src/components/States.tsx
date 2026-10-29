import { AlertCircle, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-6 py-10 text-center">
      <Inbox className="size-6 text-muted" aria-hidden="true" />
      <p className="text-sm text-muted">{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700"
    >
      <span className="flex items-center gap-2">
        <AlertCircle className="size-4" aria-hidden="true" />
        {message}
      </span>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** Renders loading / error / empty / content for a TanStack query result. */
export function QueryState<T>({
  query,
  isEmpty,
  emptyMessage,
  emptyAction,
  children,
}: {
  query: { isPending: boolean; isError: boolean; data: T | undefined; refetch: () => unknown };
  isEmpty?: (data: T) => boolean;
  emptyMessage: string;
  emptyAction?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <LoadingState />;
  if (query.isError || query.data === undefined)
    return <ErrorState message="Could not load this data." onRetry={() => query.refetch()} />;
  if (isEmpty?.(query.data)) return <EmptyState message={emptyMessage} action={emptyAction} />;
  return <>{children(query.data)}</>;
}

import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin text-ink-muted", className)} aria-hidden />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("bw-skeleton rounded", className)} />;
}

/** Inline loading block that keeps the surrounding layout in place. */
export function LoadingState({ label = "Loading…", height = 160, className }: { label?: string; height?: number; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center justify-center gap-2 text-[13px] text-ink-muted", className)} style={{ minHeight: height }}>
      <Spinner className="size-5" />
      <span>{label}</span>
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-2 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

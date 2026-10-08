import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export type BadgeTone = "neutral" | "accent" | "normal" | "review" | "anomaly";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-canvas text-ink-muted border-line",
  accent: "bg-accent-soft text-accent border-accent/25",
  normal: "bg-normal-soft text-normal border-normal-line",
  review: "bg-review-soft text-review border-review-line",
  anomaly: "bg-anomaly-soft text-anomaly border-anomaly-line",
};

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold leading-4", tones[tone], className)}>
      {children}
    </span>
  );
}

import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

interface Props {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "normal" | "review" | "anomaly";
}

const accent = { neutral: "bg-line-strong", normal: "bg-normal", review: "bg-review", anomaly: "bg-anomaly" };

export function MetricCard({ label, value, hint, icon, tone = "neutral" }: Props) {
  return (
    <div className="relative overflow-hidden rounded-md border border-line bg-surface px-4 py-3">
      <span className={cn("absolute inset-y-0 left-0 w-1", accent[tone])} aria-hidden />
      <div className="flex items-center justify-between gap-2 text-[12px] font-medium uppercase tracking-wide text-ink-muted">
        <span>{label}</span>
        {icon}
      </div>
      <div className="num mt-1 text-2xl font-semibold leading-tight text-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-ink-muted">{hint}</div> : null}
    </div>
  );
}

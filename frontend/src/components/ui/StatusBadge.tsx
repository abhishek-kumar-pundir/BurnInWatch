import type { ScreeningStatus } from "../../types/api";
import { statusMeta } from "../../utils/status";
import { cn } from "../../utils/cn";

/** Colour is never the only signal: every status carries an icon and a text label. */
export function StatusBadge({ status, size = "md", className }: { status: ScreeningStatus; size?: "sm" | "md" | "lg"; className?: string }) {
  const m = statusMeta(status);
  const sizes = { sm: "px-1.5 py-0.5 text-[11px] gap-1", md: "px-2 py-0.5 text-xs gap-1.5", lg: "px-3 py-1 text-sm gap-2" };
  const icon = { sm: "size-3", md: "size-3.5", lg: "size-4" };
  return (
    <span
      data-status={status}
      className={cn("inline-flex items-center rounded border font-semibold uppercase tracking-wide", m.soft, m.text, m.border, sizes[size], className)}
    >
      <m.Icon className={icon[size]} aria-hidden />
      {m.label}
    </span>
  );
}

import { cn } from "../utils/cn";

export function DotRow({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-[13px]">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn("size-2 rounded-full", ok === null ? "bg-line-strong" : ok ? "bg-normal" : "bg-anomaly")}
        />
        <span className="text-ink">{label}</span>
      </div>
      <span className="text-right text-ink-muted">{detail ?? (ok === null ? "Unknown" : ok ? "Yes" : "No")}</span>
    </div>
  );
}

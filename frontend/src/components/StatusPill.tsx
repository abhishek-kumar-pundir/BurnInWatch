import { CircleAlert, CircleCheck, Loader2, WifiOff } from "lucide-react";
import { useBackendStatus } from "../hooks/useBackendStatus";
import { cn } from "../utils/cn";

export function StatusPill() {
  const { state, health } = useBackendStatus();
  const cfg = {
    checking: { Icon: Loader2, text: "Checking backend…", cls: "border-line bg-canvas text-ink-muted", spin: true },
    online: { Icon: CircleCheck, text: "Backend connected", cls: "border-normal-line bg-normal-soft text-normal", spin: false },
    degraded: { Icon: CircleAlert, text: "Models unavailable", cls: "border-review-line bg-review-soft text-review", spin: false },
    offline: { Icon: WifiOff, text: "Backend offline", cls: "border-anomaly-line bg-anomaly-soft text-anomaly", spin: false },
  }[state];
  return (
    <span
      role="status"
      title={health ? `${health.app} v${health.version}` : undefined}
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", cfg.cls)}
    >
      <cfg.Icon className={cn("size-3.5", cfg.spin && "animate-spin")} aria-hidden />
      {cfg.text}
    </span>
  );
}

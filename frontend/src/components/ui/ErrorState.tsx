import { CircleAlert, RotateCw, WifiOff } from "lucide-react";
import { ApiError, describeError, normalizeError } from "../../api/errors";
import { Button } from "./Button";
import { cn } from "../../utils/cn";

interface Props {
  error: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
  className?: string;
}

/** Never shows raw payloads. A technical line is added only in development builds. */
export function ErrorState({ error, onRetry, retryLabel = "Try again", compact, className }: Props) {
  const apiError = error instanceof ApiError ? error : normalizeError(error);
  const d = describeError(apiError);
  const Icon = apiError.kind === "network" ? WifiOff : CircleAlert;
  return (
    <div
      role="alert"
      className={cn("rounded-md border border-anomaly-line bg-anomaly-soft/60 text-ink", compact ? "p-3" : "p-5", className)}
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-anomaly" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-anomaly">{d.title}</h3>
          <p className="mt-1 text-[13px] text-ink">{d.message}</p>
          {d.facts.length > 0 ? (
            <dl className="mt-2 space-y-1 rounded border border-anomaly-line/70 bg-surface/70 p-2 text-[12px]">
              {d.facts.map((f) => (
                <div key={f.label} className="flex gap-2">
                  <dt className="w-28 shrink-0 text-ink-muted">{f.label}</dt>
                  <dd className="num min-w-0 break-words text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {d.hint ? <p className="mt-2 text-[13px] text-ink-muted">{d.hint}</p> : null}
          {import.meta.env.DEV ? (
            <p className="num mt-2 break-words text-[11px] text-ink-faint" data-testid="technical-detail">
              dev: {d.technical}
            </p>
          ) : null}
          {onRetry ? (
            <Button className="mt-3" size="sm" icon={<RotateCw className="size-3.5" aria-hidden />} onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

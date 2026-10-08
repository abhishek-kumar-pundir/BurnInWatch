import { Link } from "react-router-dom";
import { FilePlus2 } from "lucide-react";
import { Badge, Button } from "../../components/ui";
import { MODEL_LABELS } from "../../constants";
import type { ScreeningResult } from "../../types/api";
import { cn } from "../../utils/cn";
import { formatDateTime } from "../../utils/format";
import { statusMeta } from "../../utils/status";

export function StatusPanel({ result }: { result: ScreeningResult }) {
  const m = statusMeta(result.summary.status);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">Screening result</div>
          <h1 className="text-xl font-semibold tracking-tight">{result.device_id}</h1>
          <div className="num mt-0.5 break-all text-[13px] text-ink-muted">{result.input.filename}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span>{formatDateTime(result.created_at)}</span>
            <Badge tone="accent">{MODEL_LABELS[result.model.name] ?? result.model.name}</Badge>
            <span className="num">
              {result.model.feature_count} features · window {result.model.window_size} · stride {result.model.stride}
            </span>
          </div>
        </div>
        <Link to="/screenings/new">
          <Button icon={<FilePlus2 className="size-4" aria-hidden />}>New screening</Button>
        </Link>
      </div>

      <section aria-label="Overall screening status" className={cn("flex gap-4 rounded-md border p-4 sm:p-5", m.soft, m.border)}>
        <m.Icon className={cn("mt-0.5 size-8 shrink-0", m.text)} aria-hidden />
        <div className="min-w-0">
          <div className={cn("text-xs font-semibold uppercase tracking-wider", m.text)}>Status: {m.label}</div>
          <h2 className={cn("text-xl font-semibold leading-tight", m.text)}>{m.headline}</h2>
          <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-ink">{m.explanation}</p>
          <p className="mt-2 max-w-3xl text-xs text-ink-muted">{result.disclaimer}</p>
        </div>
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Check, Circle, Loader2 } from "lucide-react";
import { Button, Card, CardBody } from "../../components/ui";
import { SERVER_STEPS } from "../../constants";
import { cn } from "../../utils/cn";

interface Props {
  stage: "uploading" | "server";
  uploadFraction: number;
  startedAt: number;
  onCancel: () => void;
}

type StepState = "done" | "active" | "pending";

function Step({ state, label, children }: { state: StepState; label: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 shrink-0">
        {state === "done" ? (
          <Check className="size-4 text-normal" aria-hidden />
        ) : state === "active" ? (
          <Loader2 className="size-4 animate-spin text-accent" aria-hidden />
        ) : (
          <Circle className="size-4 text-line-strong" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm", state === "pending" ? "text-ink-faint" : "font-medium text-ink")}>
          {label}
          <span className="sr-only"> — {state === "done" ? "complete" : state === "active" ? "in progress" : "waiting"}</span>
        </div>
        {children}
      </div>
    </li>
  );
}

/**
 * The backend runs the whole analysis inside ONE request, so only two things are observable
 * from the browser: upload progress and "server is working". Individual server steps are
 * listed as the work being done, not as ticking progress; real per-stage timings are shown on
 * the result page.
 */
export function ProcessingView({ stage, uploadFraction, startedAt, onCancel }: Props) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const pct = Math.round(uploadFraction * 100);
  return (
    <Card>
      <CardBody className="mx-auto max-w-xl py-8" aria-live="polite">
        <h2 className="text-lg font-semibold">Analyzing burn-in data</h2>
        <p className="mt-1 text-[13px] text-ink-muted">
          Elapsed <span className="num">{elapsed}s</span>. Larger datasets take longer; do not close this page.
        </p>
        <ol className="mt-5 space-y-4">
          <Step state="done" label="Dataset validated" />
          <Step state={stage === "uploading" ? "active" : "done"} label="Uploading dataset">
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Upload progress">
              <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
            </div>
            <div className="num mt-1 text-xs text-ink-muted">{pct}%</div>
          </Step>
          <Step state={stage === "server" ? "active" : "pending"} label="Analysis on the server">
            <ul className="mt-1.5 space-y-1 text-xs text-ink-muted">
              {SERVER_STEPS.map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="size-1 rounded-full bg-line-strong" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-faint">These steps run inside a single server request. Measured time per step is shown with the result.</p>
          </Step>
          <Step state="pending" label="Screening result" />
        </ol>
        <div className="mt-6 flex justify-end">
          <Button size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

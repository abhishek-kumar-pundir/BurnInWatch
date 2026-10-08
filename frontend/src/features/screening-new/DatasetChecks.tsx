import { Check, Minus, TriangleAlert, X } from "lucide-react";
import type { CheckStatus, DatasetValidation } from "../../types/api";
import { cn } from "../../utils/cn";
import { formatDuration, formatInt, formatTimestamp } from "../../utils/format";

const icon: Record<CheckStatus, { Icon: typeof Check; cls: string; sr: string }> = {
  pass: { Icon: Check, cls: "text-normal", sr: "Passed" },
  warn: { Icon: TriangleAlert, cls: "text-review", sr: "Warning" },
  fail: { Icon: X, cls: "text-anomaly", sr: "Failed" },
  skipped: { Icon: Minus, cls: "text-ink-faint", sr: "Not evaluated" },
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="num mt-0.5 text-[15px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

export function DatasetChecks({ validation }: { validation: DatasetValidation }) {
  const v = validation;
  const ok = v.valid;
  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] font-medium",
          ok ? "border-normal-line bg-normal-soft text-normal" : "border-anomaly-line bg-anomaly-soft text-anomaly",
        )}
      >
        {ok ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
        <span className="num">{v.filename}</span>
        <span className="font-semibold">— {ok ? "Dataset validated" : "Dataset cannot be analyzed yet"}</span>
      </div>

      {v.total_rows !== null ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Fact label="Records" value={formatInt(v.valid_rows ?? v.total_rows)} />
          <Fact label="Columns detected" value={formatInt(v.columns_found.length)} />
          <Fact label="Capture duration" value={formatDuration(v.duration, v.time_start)} />
          <Fact label="Analysis windows" value={v.expected_windows === null ? "—" : formatInt(v.expected_windows)} />
          {v.time_start !== null && v.time_end !== null ? (
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Time range (timeEpoch)</dt>
              <dd className="num mt-0.5 text-[13px] text-ink">
                {formatTimestamp(v.time_start)} → {formatTimestamp(v.time_end)}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div>
        <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Dataset checks</h3>
        <ul className="divide-y divide-line rounded-md border border-line">
          {v.checks.map((c) => {
            const { Icon, cls, sr } = icon[c.status];
            return (
              <li key={c.id} className="flex items-start gap-2.5 px-3 py-2 text-[13px]">
                <Icon className={cn("mt-0.5 size-4 shrink-0", cls)} aria-hidden />
                <span className="sr-only">{sr}:</span>
                <div className="min-w-0">
                  <div className={cn("font-medium", c.status === "skipped" && "text-ink-faint")}>{c.label}</div>
                  {c.detail ? <div className="text-xs text-ink-muted">{c.detail}</div> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {v.missing_columns.length > 0 ? <MissingColumns validation={v} /> : null}
    </div>
  );
}

function MissingColumns({ validation: v }: { validation: DatasetValidation }) {
  return (
    <div role="alert" className="space-y-3 rounded-md border border-anomaly-line bg-anomaly-soft/60 p-3 text-[13px]">
      <div>
        <h3 className="font-semibold text-anomaly">
          Missing required column{v.missing_columns.length > 1 ? "s" : ""}
        </h3>
        <ul className="mt-1 space-y-1">
          {v.missing_columns.map((m) => (
            <li key={m}>
              <span className="num font-medium">{m}</span> was not found
              {v.column_hints[m]?.length ? (
                <>
                  . Similar column in file: <span className="num">{v.column_hints[m]?.join(", ")}</span>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Expected</div>
          <ul className="num mt-1 space-y-0.5 text-[12px]">
            {v.required_columns.map((c) => (
              <li key={c} className={cn(v.missing_columns.includes(c) && "font-semibold text-anomaly")}>
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Found in file</div>
          <ul className="num mt-1 max-h-40 space-y-0.5 overflow-y-auto text-[12px]">
            {v.columns_found.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

import { Card, CardBody, CardHeader } from "../../components/ui";
import { CHART } from "../../constants/chart";
import type { Agreement } from "../../types/api";
import { formatInt, formatPercent } from "../../utils/format";

/** Graph 6 - IF only / AE only / Both / Neither, all from this run's window flags. */
export function ModelAgreement({ agreement: a }: { agreement: Agreement }) {
  const total = a.both + a.isolation_forest_only + a.autoencoder_only + a.neither;
  const parts = [
    { key: "both", label: "Both models", value: a.both, color: CHART.both, text: "text-anomaly" },
    { key: "if", label: "Isolation Forest only", value: a.isolation_forest_only, color: CHART.ifOnly, text: "text-accent" },
    { key: "ae", label: "Autoencoder only", value: a.autoencoder_only, color: CHART.aeOnly, text: "text-ink" },
    { key: "none", label: "Neither", value: a.neither, color: CHART.neither, text: "text-ink-muted" },
  ];
  return (
    <Card>
      <CardHeader title="Model agreement" description="How the two detectors overlap across this upload's windows." />
      <CardBody className="space-y-4">
        <div
          className="flex h-7 w-full overflow-hidden rounded border border-line"
          role="img"
          aria-label={`Of ${total} windows: ${parts.map((p) => `${p.value} ${p.label}`).join(", ")}.`}
        >
          {parts.map((p) =>
            p.value > 0 ? <div key={p.key} title={`${p.label}: ${p.value}`} style={{ width: `${(p.value / Math.max(total, 1)) * 100}%`, background: p.color }} /> : null,
          )}
        </div>
        <dl className="divide-y divide-line rounded-md border border-line text-[13px]">
          {parts.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <dt className="flex items-center gap-2">
                <i className="inline-block size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
                {p.label}
              </dt>
              <dd className={`num font-semibold ${p.text}`}>
                {formatInt(p.value)} <span className="font-normal text-ink-muted">({formatPercent(total ? p.value / total : 0, 1)})</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs leading-relaxed text-ink-muted">
          Windows flagged by both models are where two different approaches agree; agreement raises review priority but is not ground truth and
          does not by itself indicate physical component failure.
        </p>
      </CardBody>
    </Card>
  );
}

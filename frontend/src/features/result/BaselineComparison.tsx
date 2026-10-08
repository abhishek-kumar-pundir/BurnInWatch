import { useMemo } from "react";
import { Card, CardHeader, DataTable, EmptyState } from "../../components/ui";
import type { Column } from "../../components/ui";
import { SIGNALS } from "../../constants";
import { CHART } from "../../constants/chart";
import type { FeatureExplanation, SignalLevel, WindowDetail } from "../../types/api";
import { formatNumber, formatPct, formatSigned } from "../../utils/format";
import { featureLabel, signalLabel } from "../../utils/labels";

function PairBar({ baseline, current }: { baseline: number; current: number }) {
  const max = Math.max(Math.abs(baseline), Math.abs(current), 1e-12);
  return (
    <div className="w-40 space-y-0.5" aria-hidden>
      <div className="h-1.5 rounded-sm" style={{ width: `${(Math.abs(baseline) / max) * 100}%`, background: CHART.baseline, opacity: 0.55 }} />
      <div className="h-1.5 rounded-sm" style={{ width: `${(Math.abs(current) / max) * 100}%`, background: CHART.anomaly }} />
    </div>
  );
}

/** Graph 4 - selected window vs. baselines that actually exist (start-of-test medians and learned-normal medians). */
export function BaselineComparison({ detail, limit = 8 }: { detail: WindowDetail | undefined; limit?: number }) {
  const levels = useMemo(() => (detail ? detail.signal_levels.filter((l) => l.baseline_median !== null) : []), [detail]);
  const feats = useMemo(
    () => (detail ? [...detail.features].sort((a, b) => Math.abs(b.normalized_deviation) - Math.abs(a.normalized_deviation)).slice(0, limit) : []),
    [detail, limit],
  );
  if (!detail) {
    return (
      <Card>
        <CardHeader title="Baseline vs current behavior" />
        <EmptyState title="Select a window" description="Pick an anomaly episode or window to compare it with its baseline." />
      </Card>
    );
  }
  const unit = (s: string) => SIGNALS[s]?.unit ?? "";
  const sigCols: Column<SignalLevel>[] = [
    { key: "s", header: "Signal", render: (l) => signalLabel(l.signal) },
    { key: "b", header: "Baseline", align: "right", render: (l) => `${formatNumber(l.baseline_median, 4)} ${unit(l.signal)}` },
    { key: "c", header: "Current (window mean)", align: "right", render: (l) => `${formatNumber(l.window_mean, 4)} ${unit(l.signal)}` },
    { key: "d", header: "Deviation", align: "right", render: (l) => formatSigned(l.delta_from_baseline, 4) },
    { key: "p", header: "% deviation", align: "right", render: (l) => formatPct(l.pct_from_baseline) },
    { key: "v", header: "", render: (l) => <PairBar baseline={l.baseline_median ?? 0} current={l.window_mean} /> },
  ];
  const featCols: Column<FeatureExplanation>[] = [
    { key: "f", header: "Feature", render: (f) => featureLabel(f) },
    { key: "b", header: "Learned normal", align: "right", render: (f) => formatNumber(f.learned_normal_value, 4) },
    { key: "c", header: "Current", align: "right", render: (f) => formatNumber(f.current_value, 4) },
    { key: "d", header: "Deviation", align: "right", render: (f) => formatSigned(f.deviation, 4) },
    { key: "p", header: "% deviation", align: "right", render: (f) => formatPct(f.pct_deviation) },
    { key: "v", header: "", render: (f) => <PairBar baseline={f.learned_normal_value} current={f.current_value} /> },
  ];
  return (
    <Card>
      <CardHeader
        title="Baseline vs current behavior"
        description={`Window #${detail.window_index}. Light bar = baseline, red bar = current value.`}
      />
      <div className="space-y-5 p-4">
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Signals vs start-of-test baseline</h3>
          <DataTable caption="Signals versus baseline" columns={sigCols} rows={levels} rowKey={(l) => l.signal} empty={<p className="text-[13px] text-ink-muted">No signal baselines available.</p>} />
          <p className="mt-1.5 text-xs text-ink-muted">
            Baseline = median of the earliest reference rows of this upload, using the same rule as training (first max(20, 10 % of the first 20 % of rows)). Only the three baseline-relative signals have one; it assumes the upload starts in a reference-like state.
            % deviation is shown only where the baseline is non-zero.
          </p>
        </section>
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Features vs learned normal (largest deviations)</h3>
          <DataTable caption="Features versus learned normal" columns={featCols} rows={feats} rowKey={(f) => f.feature} />
          <p className="mt-1.5 text-xs text-ink-muted">
            Learned normal = per-feature median of the models' training windows, stored in the fitted scaler. % deviation is shown only when that median is not ≈ 0 (|median| ≥ 1e-6), because a percentage of ~0 is undefined.
          </p>
        </section>
      </div>
    </Card>
  );
}

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { Card, CardHeader, EmptyState } from "../../components/ui";
import { CHART } from "../../constants/chart";
import type { FeatureExplanation } from "../../types/api";
import { formatNumber, formatPct, formatSigned, formatZ } from "../../utils/format";
import { featureLabel } from "../../utils/labels";

type Metric = "ae_error_share" | "normalized_deviation" | "if_contribution";

const METRICS: { id: Metric; label: string; axis: string; help: string }[] = [
  { id: "ae_error_share", label: "Autoencoder error share", axis: "% of reconstruction error", help: "(actual − reconstructed)² per feature ÷ total; sums to 100 %." },
  { id: "normalized_deviation", label: "Deviation from learned normal", axis: "training-IQR units", help: "(value − training median) ÷ training IQR; sign shows direction." },
  { id: "if_contribution", label: "Isolation Forest contribution", axis: "IF score change", help: "IF score minus score with this feature set to its training median (reference substitution; not SHAP)." },
];

function valueOf(f: FeatureExplanation, m: Metric): number {
  if (m === "ae_error_share") return f.ae_error_share * 100;
  if (m === "normalized_deviation") return f.normalized_deviation;
  return f.if_contribution ?? 0;
}

interface Props {
  features: FeatureExplanation[];
  windowLabel: string;
  limit?: number;
}

/** Graph 5 - ranked horizontal bars of the most abnormal features of the selected window. */
export function FeatureContributionChart({ features, windowLabel, limit = 10 }: Props) {
  const [metric, setMetric] = useState<Metric>("ae_error_share");
  const hasIf = features.some((f) => f.if_contribution !== null);
  const rows = useMemo(() => {
    const sorted = [...features].sort((a, b) => Math.abs(valueOf(b, metric)) - Math.abs(valueOf(a, metric)));
    return sorted.slice(0, limit).map((f) => ({ f, name: featureLabel(f), v: valueOf(f, metric) }));
  }, [features, metric, limit]);
  const m = METRICS.find((x) => x.id === metric)!;

  return (
    <Card>
      <CardHeader
        title="Feature abnormality"
        description={`Top ${Math.min(limit, features.length)} features associated with the anomaly score of ${windowLabel}.`}
        actions={
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} aria-label="Ranking metric" className="rounded border border-line-strong bg-surface px-2 py-1 text-[13px]">
            {METRICS.filter((x) => x.id !== "if_contribution" || hasIf).map((x) => (
              <option key={x.id} value={x.id}>{x.label}</option>
            ))}
          </select>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={BarChart3} title="No feature data" description="Select a window to see which features deviated from learned normal behavior." />
      ) : (
        <div className="px-2 pt-3" style={{ height: 40 + rows.length * 34 }} role="img" aria-label={`Top features by ${m.label} for ${windowLabel}: ${rows.slice(0, 3).map((r) => r.name).join("; ")}.`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={CHART.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} tickFormatter={(v: number) => formatNumber(v, 2)} />
              <YAxis type="category" dataKey="name" width={230} tick={{ fontSize: 11, fill: CHART.signal }} tickLine={false} axisLine={false} interval={0} />
              <Tooltip
                isAnimationActive={false}
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                content={(props) => {
                  const r = props.payload?.[0]?.payload as { f: FeatureExplanation; name: string } | undefined;
                  if (!props.active || !r) return null;
                  const f = r.f;
                  return (
                    <div className="max-w-sm rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                      <div className="font-semibold">{r.name}</div>
                      <div className="mb-1 text-[11px] text-ink-faint">{f.feature}</div>
                      <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 num">
                        <span className="text-ink-muted">Current value</span><span className="text-right">{formatNumber(f.current_value, 4)}</span>
                        <span className="text-ink-muted">Learned normal</span><span className="text-right">{formatNumber(f.learned_normal_value, 4)}</span>
                        <span className="text-ink-muted">Reconstructed</span><span className="text-right">{f.reconstructed_value === null ? "—" : formatNumber(f.reconstructed_value, 4)}</span>
                        <span className="text-ink-muted">Deviation</span><span className="text-right">{formatSigned(f.deviation, 4)} ({formatPct(f.pct_deviation)})</span>
                        <span className="text-ink-muted">Normalized dev.</span><span className="text-right">{formatZ(f.normalized_deviation)}</span>
                        <span className="text-ink-muted">AE error share</span><span className="text-right">{(f.ae_error_share * 100).toFixed(1)}%</span>
                        <span className="text-ink-muted">IF contribution</span><span className="text-right">{f.if_contribution === null ? "—" : formatSigned(f.if_contribution, 4)}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="v" isAnimationActive={false} radius={[0, 2, 2, 0]}>
                {rows.map((r) => (
                  <Cell key={r.f.feature} fill={r.v >= 0 ? CHART.positive : CHART.negative} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="border-t border-line px-4 py-2 text-xs leading-relaxed text-ink-muted">
        <strong className="font-semibold text-ink">{m.label}</strong> ({m.axis}): {m.help}
        {metric !== "ae_error_share" ? " Red = above the learned-normal value / pushes the score up; blue = below / pulls it down." : ""} These features are associated with the anomaly score; they are not established causes of component failure.
      </div>
    </Card>
  );
}

import { useState } from "react";
import { getWindow } from "../../api/screenings";
import { Badge, DataTable, Drawer, ErrorState, LoadingState, StatusBadge } from "../../components/ui";
import type { Column } from "../../components/ui";
import { SIGNALS } from "../../constants";
import { CHART } from "../../constants/chart";
import { useAsync } from "../../hooks/useAsync";
import type { FeatureExplanation, NeighborWindow, WindowDetail } from "../../types/api";
import { formatElapsed, formatNumber, formatPct, formatScore, formatSigned, formatWallClock, formatZ } from "../../utils/format";
import { featureLabel, signalLabel } from "../../utils/labels";
import { DETECTION_LABEL } from "../../utils/status";

interface Props {
  screeningId: string;
  windowIndex: number | null;
  timeOrigin: number;
  onClose: () => void;
  onSelectWindow: (index: number) => void;
}

function ScoreBar({ label, score, threshold, flagged, color }: { label: string; score: number; threshold: number; flagged: boolean; color: string }) {
  const max = Math.max(score, threshold) * 1.15 || 1;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="num">
          <strong>{formatScore(score)}</strong> <span className="text-ink-muted">vs threshold {formatScore(threshold)}</span>{" "}
          <Badge tone={flagged ? "anomaly" : "normal"}>{flagged ? "above threshold" : "within threshold"}</Badge>
        </span>
      </div>
      <div className="relative mt-1.5 h-2.5 rounded bg-canvas" aria-hidden>
        <div className="absolute inset-y-0 left-0 rounded" style={{ width: pct(Math.max(score, 0)), background: color }} />
        <div className="absolute -inset-y-0.5 w-0.5 bg-ink" style={{ left: pct(threshold) }} title="Threshold" />
      </div>
    </div>
  );
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 100},${28 - ((v - lo) / span) * 26 - 1}`).join(" ");
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-28" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="border-b border-line px-5 py-4 last:border-0">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h3>
      {children}
      {note ? <p className="mt-2 text-xs leading-relaxed text-ink-muted">{note}</p> : null}
    </section>
  );
}

function Body({ d, timeOrigin, onSelectWindow }: { d: WindowDetail; timeOrigin: number; onSelectWindow: (i: number) => void }) {
  const [showAll, setShowAll] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const byAe = [...d.features].sort((a, b) => b.ae_error_share - a.ae_error_share);
  const top = byAe.slice(0, 8);

  const featCols: Column<FeatureExplanation>[] = [
    { key: "f", header: "Feature", render: (f) => <span title={f.feature}>{featureLabel(f)}</span> },
    { key: "c", header: "Current", align: "right", render: (f) => formatNumber(f.current_value, 4) },
    { key: "n", header: "Learned normal", align: "right", render: (f) => formatNumber(f.learned_normal_value, 4) },
    { key: "r", header: "Reconstructed", align: "right", render: (f) => (f.reconstructed_value === null ? "—" : formatNumber(f.reconstructed_value, 4)) },
    { key: "p", header: "% dev", align: "right", render: (f) => formatPct(f.pct_deviation) },
    { key: "z", header: "Norm. dev", align: "right", render: (f) => formatZ(f.normalized_deviation) },
    { key: "a", header: "AE share", align: "right", render: (f) => `${(f.ae_error_share * 100).toFixed(1)}%` },
    { key: "i", header: "IF contrib.", align: "right", render: (f) => (f.if_contribution === null ? "—" : formatSigned(f.if_contribution, 4)) },
  ];
  const nearCols: Column<NeighborWindow>[] = [
    { key: "w", header: "Window", render: (n) => `#${n.window_index}${n.is_selected ? " ◄" : ""}` },
    { key: "t", header: "Start", align: "right", render: (n) => formatElapsed(n.start_time - timeOrigin) },
    { key: "i", header: "IF", align: "right", render: (n) => formatScore(n.isolation_forest_score) },
    { key: "a", header: "AE", align: "right", render: (n) => formatScore(n.autoencoder_score) },
    { key: "s", header: "Status", render: (n) => <StatusBadge status={n.status} size="sm" /> },
  ];

  return (
    <>
      <Section title="Result">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={d.status} size="lg" />
          <span className="text-[13px] text-ink-muted">Detected by: {DETECTION_LABEL[d.detection]}</span>
          {d.episode_id !== null ? <Badge tone="anomaly">Episode E{d.episode_id}</Badge> : null}
        </div>
        <dl className="num mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
          <dt className="text-ink-muted">Window ID</dt><dd>#{d.window_index}</dd>
          <dt className="text-ink-muted">Records (rows)</dt><dd>{d.start_row} – {d.end_row} ({d.record_count})</dd>
          <dt className="text-ink-muted">Start</dt><dd>{formatElapsed(d.start_time - timeOrigin)} <span className="text-ink-faint">{formatWallClock(d.start_time) ?? ""}</span></dd>
          <dt className="text-ink-muted">End</dt><dd>{formatElapsed(d.end_time - timeOrigin)} <span className="text-ink-faint">{formatWallClock(d.end_time) ?? ""}</span></dd>
        </dl>
        <div className="mt-4 space-y-3">
          <ScoreBar label="Isolation Forest" score={d.isolation_forest_score} threshold={d.isolation_forest_threshold} flagged={d.isolation_forest_flag} color={CHART.ifColor} />
          <ScoreBar label="Autoencoder reconstruction error" score={d.autoencoder_score} threshold={d.autoencoder_threshold} flagged={d.autoencoder_flag} color={CHART.aeColor} />
        </div>
      </Section>

      <Section title="Why was this flagged?" note="Descriptive only: these features are associated with the anomaly score and deviated from learned normal behavior; they are not established causes of component failure.">
        <ul className="list-disc space-y-1 pl-5 text-[13px]">
          {d.why_flagged.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </Section>

      <Section title="Top abnormal features (by autoencoder error)">
        <DataTable caption="Top abnormal features" columns={featCols} rows={top} rowKey={(f) => f.feature} />
      </Section>

      <Section title="Explanation methods">
        <p className="text-xs leading-relaxed text-ink-muted"><strong className="text-ink">Autoencoder:</strong> {d.ae_attribution_method}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted"><strong className="text-ink">Isolation Forest:</strong> {d.if_attribution_method}</p>
      </Section>

      <Section title="Raw measurements (window summary)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
                <th className="py-1 pr-3">Signal</th><th className="px-2 text-right">Min</th><th className="px-2 text-right">Mean</th><th className="px-2 text-right">Max</th><th className="px-2 text-right">Baseline</th><th className="px-2 text-right">% dev</th><th className="pl-3">Trace</th>
              </tr>
            </thead>
            <tbody>
              {d.signal_levels.map((l) => (
                <tr key={l.signal} className="border-t border-line/70">
                  <td className="py-1 pr-3">{signalLabel(l.signal)} <span className="text-ink-faint">{SIGNALS[l.signal]?.unit}</span></td>
                  <td className="num px-2 text-right">{formatNumber(l.window_min, 4)}</td>
                  <td className="num px-2 text-right">{formatNumber(l.window_mean, 4)}</td>
                  <td className="num px-2 text-right">{formatNumber(l.window_max, 4)}</td>
                  <td className="num px-2 text-right">{l.baseline_median === null ? "—" : formatNumber(l.baseline_median, 4)}</td>
                  <td className="num px-2 text-right">{l.baseline_median === null ? "—" : formatPct(l.pct_from_baseline)}</td>
                  <td className="pl-3">{d.raw_measurements[l.signal] ? <Spark values={d.raw_measurements[l.signal]!} color={CHART.signal} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="mt-2 text-xs font-medium text-accent underline" onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? "Hide" : "Show"} all {d.record_count} raw records
        </button>
        {showRaw ? (
          <div className="mt-2 max-h-64 overflow-auto rounded border border-line">
            <table className="w-full min-w-max text-[12px]">
              <thead className="sticky top-0 bg-canvas text-[11px] uppercase text-ink-muted">
                <tr><th className="px-2 py-1 text-right">t</th>{Object.keys(d.raw_measurements).map((k) => <th key={k} className="px-2 py-1 text-right">{k}</th>)}</tr>
              </thead>
              <tbody>
                {d.raw_time.map((t, i) => (
                  <tr key={i} className="border-t border-line/60">
                    <td className="num px-2 text-right text-ink-muted">{formatElapsed(t - timeOrigin)}</td>
                    {Object.keys(d.raw_measurements).map((k) => <td key={k} className="num px-2 text-right">{formatNumber(d.raw_measurements[k]![i], 4)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Section>

      <Section title={`Engineered features (${d.features.length})`}>
        <button type="button" className="mb-2 text-xs font-medium text-accent underline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Hide" : "Show"} all model input features
        </button>
        {showAll ? <DataTable caption="All engineered features" columns={featCols} rows={byAe} rowKey={(f) => f.feature} /> : <p className="text-xs text-ink-muted">Exactly the features and order the models were trained on.</p>}
      </Section>

      <Section title="Nearby windows (temporal context)">
        <DataTable caption="Nearby windows" columns={nearCols} rows={d.nearby} rowKey={(n) => n.window_index} onRowClick={(n) => onSelectWindow(n.window_index)} isRowActive={(n) => n.is_selected} />
      </Section>
    </>
  );
}

/** Window inspector: everything is requested from the server for THIS run's window. */
export function WindowInspector({ screeningId, windowIndex, timeOrigin, onClose, onSelectWindow }: Props) {
  const win = useAsync(
    (s) => (windowIndex !== null ? getWindow(screeningId, windowIndex, s) : Promise.reject(new Error("no window"))),
    [screeningId, windowIndex],
  );
  return (
    <Drawer
      open={windowIndex !== null}
      onClose={onClose}
      wide
      label="Window inspector"
      title={`Window #${windowIndex ?? ""}`}
      subtitle="Live inference details for this analysis window"
    >
      {win.status === "loading" ? (
        <LoadingState label="Loading window…" height={240} />
      ) : win.status === "error" ? (
        <ErrorState error={win.error} onRetry={win.reload} compact />
      ) : (
        <Body d={win.data} timeOrigin={timeOrigin} onSelectWindow={onSelectWindow} />
      )}
    </Drawer>
  );
}

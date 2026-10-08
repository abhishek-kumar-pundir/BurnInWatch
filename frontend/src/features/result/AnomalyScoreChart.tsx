import { memo, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, EmptyState, StatusBadge } from "../../components/ui";
import { CHART } from "../../constants/chart";
import type { ScreeningResult, TimelinePoint } from "../../types/api";
import { formatElapsed, formatScore, formatWallClock } from "../../utils/format";
import { DETECTION_LABEL } from "../../utils/status";
import { medianStep, statusRuns, toChartPoints, windowCenter } from "../../utils/timeline";
import type { ChartPoint } from "../../utils/timeline";
import { LineChart as LineChartIcon } from "lucide-react";

interface Props {
  result: ScreeningResult;
  onSelectWindow: (index: number) => void;
}

function paddedDomain(values: number[], threshold: number, nonNegative = false): [number, number] {
  const lo = Math.min(threshold, ...values);
  const hi = Math.max(threshold, ...values);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.1;
  return [nonNegative ? Math.max(0, lo - pad) : lo - pad, hi + pad];
}

function TooltipBody({ p, thresholds, t0 }: { p: ChartPoint; thresholds: ScreeningResult["thresholds"]; t0: number }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="num font-semibold">Window {p.index}</div>
      <div className="num text-ink-muted">t = {formatElapsed(p.start - t0)} → {formatElapsed(p.end - t0)}</div>
      <div className="num mb-1.5 text-[11px] text-ink-faint">{formatWallClock(p.start) ?? `timeEpoch ${p.start}`}</div>
      <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        <span className="text-ink-muted">Isolation Forest</span>
        <span className="num text-right font-medium">{formatScore(p.ifScore)}</span>
        <span className="text-ink-faint">Threshold</span>
        <span className="num text-right text-ink-faint">{formatScore(thresholds.isolation_forest)}</span>
        <span className="text-ink-muted">Autoencoder</span>
        <span className="num text-right font-medium">{formatScore(p.aeScore)}</span>
        <span className="text-ink-faint">Threshold</span>
        <span className="num text-right text-ink-faint">{formatScore(thresholds.autoencoder)}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <StatusBadge status={p.status} size="sm" />
        <span className="text-ink-muted">Detected by: {DETECTION_LABEL[p.detection]}</span>
      </div>
      <div className="mt-1 text-[11px] text-ink-faint">Click to inspect this window</div>
    </div>
  );
}

function indexFrom(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function AnomalyScoreChartInner({ result, onSelectWindow }: Props) {
  const { timeline, thresholds, peak } = result;
  const [aeLog, setAeLog] = useState(false);
  const t0 = result.input.time_start;
  const points = useMemo(() => toChartPoints(timeline).map((p) => ({ ...p, x: p.x - t0 })), [timeline, t0]);
  const runs = useMemo(() => statusRuns(timeline), [timeline]);
  const half = useMemo(() => medianStep(timeline) / 2, [timeline]);
  const byWindow = useMemo(() => new Map<number, TimelinePoint>(timeline.map((p) => [p.window_index, p])), [timeline]);

  if (points.length === 0) {
    return (
      <ChartContainer title="Anomaly score timeline" summary="No data." height={160}>
        <EmptyState icon={LineChartIcon} title="Timeline unavailable" description="The screening result does not contain timeline data." />
      </ChartContainer>
    );
  }

  const ifDomain = paddedDomain(points.map((p) => p.ifScore), thresholds.isolation_forest);
  // Reconstruction error is a mean squared error, so it cannot be negative.
  const aeValues = points.map((p) => p.aeScore);
  const canLog = thresholds.autoencoder > 0 && aeValues.every((v) => v > 0);
  const useLog = aeLog && canLog;
  const aeDomain: [number, number] = useLog
    ? [Math.min(thresholds.autoencoder, ...aeValues) * 0.8, Math.max(thresholds.autoencoder, ...aeValues) * 1.25]
    : paddedDomain(aeValues, thresholds.autoencoder, true);
  const peakPoint = byWindow.get(peak.window_index);
  const peakX = peakPoint ? windowCenter(peakPoint) - t0 : null;
  const xDomain: [number, number] = [points[0]?.x ?? 0, points[points.length - 1]?.x ?? 1];

  const select = (d: { activeIndex?: unknown }) => {
    const i = indexFrom(d.activeIndex);
    const p = i === null ? undefined : points[i];
    if (p) onSelectWindow(p.index);
  };

  const shading = runs.map((r) => {
    const a = timeline[r.firstIndex];
    const b = timeline[r.lastIndex];
    if (!a || !b) return null;
    const color = r.status === "ANOMALY" ? CHART.anomaly : CHART.review;
    return (
      <ReferenceArea
        key={`${r.firstIndex}-${r.lastIndex}`}
        x1={windowCenter(a) - half - t0}
        x2={windowCenter(b) + half - t0}
        fill={color}
        fillOpacity={r.status === "ANOMALY" ? 0.16 : 0.12}
        stroke="none"
        ifOverflow="hidden"
      />
    );
  });

  const episodeAreas = result.episodes.map((e) => (
    <ReferenceArea key={`ep-${e.id}`} x1={e.start_time - t0} x2={e.end_time - t0} fill="none" stroke={CHART.anomaly} strokeOpacity={0.7} strokeWidth={1.5} ifOverflow="hidden" />
  ));
  const dotFor = (field: "ifScore" | "aeScore") => (props: { cx?: number; cy?: number; payload?: ChartPoint; index?: number }) => {
    const p = props.payload;
    const key = `d-${field}-${props.index ?? p?.index}`;
    if (!p || props.cx === undefined || props.cy === undefined || p.detection === "none") return <g key={key} />;
    const color = p.detection === "both" ? CHART.both : p.detection === "isolation_forest" ? CHART.ifOnly : CHART.aeOnly;
    return <circle key={key} cx={props.cx} cy={props.cy} r={p.detection === "both" ? 3.2 : 2.6} fill={color} stroke="#fff" strokeWidth={0.8} />;
  };

  const peakLine =
    peakX !== null ? (
      <ReferenceLine x={peakX} stroke={CHART.signal} strokeDasharray="2 3" strokeOpacity={0.55} label={{ value: `Peak #${peak.window_index}`, position: "insideTopRight", fontSize: 10, fill: CHART.signal }} />
    ) : null;

  const margin = { top: 14, right: 16, bottom: 0, left: 4 };
  const summary = `${timeline.length} analysis windows. Isolation Forest threshold ${formatScore(thresholds.isolation_forest)}, autoencoder threshold ${formatScore(thresholds.autoencoder)}. ${result.summary.review_windows} review windows and ${result.summary.anomalous_windows} anomaly windows; peak at window ${peak.window_index}.`;

  return (
    <ChartContainer
      title="Anomaly score timeline"
      description="Live Isolation Forest score and autoencoder reconstruction error per window, with their thresholds. Higher is more anomalous."
      summary={summary}
      height={420}
      actions={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
          <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4" style={{ background: CHART.ifColor }} />Isolation Forest</span>
          <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4" style={{ background: CHART.aeColor }} />Autoencoder</span>
          <span className="flex items-center gap-1"><i className="inline-block w-4 border-t border-dashed" style={{ borderColor: CHART.signal }} />Threshold</span>
          <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-full" style={{ background: CHART.ifOnly }} />IF only</span>
          <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-full" style={{ background: CHART.aeOnly }} />AE only</span>
          <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-full" style={{ background: CHART.both }} />Both</span>
          <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm border" style={{ borderColor: CHART.anomaly }} />Episode</span>
                    <button
            type="button"
            aria-pressed={useLog}
            disabled={!canLog}
            title={canLog ? "Use a logarithmic axis for autoencoder error (helps when errors span orders of magnitude)" : "Log scale needs strictly positive scores"}
            onClick={() => setAeLog((v) => !v)}
            className="rounded border border-line-strong px-1.5 py-0.5 font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:text-ink-faint aria-pressed:bg-nav aria-pressed:text-white"
          >
            AE log scale
          </button>
        </div>
      }
      footer="Click the chart to open the window under the cursor. X axis: elapsed time since the first sample of this upload (timeEpoch interpreted as seconds). Dashed lines are the detector thresholds read from the model artifacts."
    >
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1">
          <span className="pointer-events-none absolute left-16 top-0 z-10 text-[11px] font-medium" style={{ color: CHART.ifColor }}>Isolation Forest score</span>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} syncId="bw-timeline" margin={margin} onClick={select} style={{ cursor: "pointer" }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="x" type="number" domain={xDomain} hide />
              <YAxis domain={ifDomain} tickFormatter={formatScore} width={60} tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} />
              {shading}
              {episodeAreas}
              {peakLine}
              <ReferenceLine y={thresholds.isolation_forest} stroke={CHART.signal} strokeDasharray="4 3" strokeOpacity={0.7} />
              <Line type="linear" dataKey="ifScore" stroke={CHART.ifColor} strokeWidth={1.5} dot={dotFor("ifScore")} activeDot={{ r: 3.5 }} isAnimationActive={points.length < 600} />
              <Tooltip
                isAnimationActive={false}
                cursor={{ stroke: CHART.signal, strokeOpacity: 0.4 }}
                content={(props) => {
                  const p = props.payload?.[0]?.payload as ChartPoint | undefined;
                  return props.active && p ? <TooltipBody p={p} thresholds={thresholds} t0={t0} /> : null;
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="relative min-h-0 flex-1">
          <span className="pointer-events-none absolute left-16 top-0 z-10 text-[11px] font-medium" style={{ color: CHART.aeColor }}>Autoencoder reconstruction error</span>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} syncId="bw-timeline" margin={{ ...margin, top: 6, bottom: 4 }} onClick={select} style={{ cursor: "pointer" }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="x" type="number" domain={xDomain} tickFormatter={formatElapsed} tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} minTickGap={48} />
              <YAxis domain={aeDomain} scale={useLog ? "log" : "linear"} allowDataOverflow={useLog} tickFormatter={formatScore} width={60} tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} />
              {shading}
              {episodeAreas}
              {peakLine}
              <ReferenceLine y={thresholds.autoencoder} stroke={CHART.signal} strokeDasharray="4 3" strokeOpacity={0.7} />
              <Line type="linear" dataKey="aeScore" stroke={CHART.aeColor} strokeWidth={1.5} dot={dotFor("aeScore")} activeDot={{ r: 3.5 }} isAnimationActive={points.length < 600} />
              <Tooltip content={() => null} cursor={{ stroke: CHART.signal, strokeOpacity: 0.4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartContainer>
  );
}

export const AnomalyScoreChart = memo(AnomalyScoreChartInner);

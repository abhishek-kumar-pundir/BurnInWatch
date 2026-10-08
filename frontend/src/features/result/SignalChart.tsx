import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, RotateCcw, ZoomIn } from "lucide-react";
import { getSignalSeries } from "../../api/screenings";
import { Button, Card, CardHeader, ErrorState, LoadingState } from "../../components/ui";
import { SIGNALS } from "../../constants";
import { CHART } from "../../constants/chart";
import { useAsync } from "../../hooks/useAsync";
import type { ScreeningResult } from "../../types/api";
import { formatElapsed, formatInt, formatNumber, formatWallClock } from "../../utils/format";
import { signalLabel } from "../../utils/labels";

interface Props {
  result: ScreeningResult;
}

function indexFrom(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Graph 1 - raw signal timeline: one signal at a time (scales differ), drag to zoom, episodes highlighted. */
export function SignalChart({ result }: Props) {
  const signals = result.input.signals.length ? result.input.signals : Object.keys(SIGNALS);
  const [signal, setSignal] = useState(signals.includes("packageTemperature") ? "packageTemperature" : signals[0]!);
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  const t0 = result.input.time_start;
  const full = { start: result.input.time_start, end: result.input.time_end };

  const series = useAsync(
    (s) => getSignalSeries(result.screening_id, signal, s, 1500, range ?? undefined),
    [result.screening_id, signal, range?.start, range?.end],
  );
  const data = useMemo(
    () => (series.data ? series.data.time.map((t, i) => ({ x: t - t0, y: series.data!.value[i]! })) : []),
    [series.data, t0],
  );
  const unit = SIGNALS[signal]?.unit ?? "";
  const span = (range ?? full).end - (range ?? full).start;

  const pan = (dir: -1 | 1) => {
    const cur = range ?? full;
    const shift = (cur.end - cur.start) * 0.5 * dir;
    const start = Math.min(Math.max(cur.start + shift, full.start), full.end - (cur.end - cur.start));
    setRange({ start, end: start + (cur.end - cur.start) });
  };

  const onDown = (d: { activeIndex?: unknown }) => {
    const i = indexFrom(d.activeIndex);
    const p = i === null ? undefined : data[i];
    if (p) setDrag({ a: p.x, b: p.x });
  };
  const onMove = (d: { activeIndex?: unknown }) => {
    if (!drag) return;
    const i = indexFrom(d.activeIndex);
    const p = i === null ? undefined : data[i];
    if (p) setDrag({ ...drag, b: p.x });
  };
  const onUp = () => {
    if (drag && Math.abs(drag.b - drag.a) > span * 0.01) {
      const lo = Math.min(drag.a, drag.b) + t0;
      const hi = Math.max(drag.a, drag.b) + t0;
      setRange({ start: lo, end: hi });
    }
    setDrag(null);
  };

  const s = series.data;
  const ys = data.map((d) => d.y);
  const yMin = ys.length ? Math.min(...ys, s?.baseline?.value ?? Infinity) : 0;
  const yMax = ys.length ? Math.max(...ys, s?.baseline?.value ?? -Infinity) : 1;
  const pad = (yMax - yMin || Math.abs(yMax) || 1) * 0.08;

  return (
    <Card>
      <CardHeader
        title="Raw signal timeline"
        description="Measured values from this upload. Signals have different scales, so one is shown at a time."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              Signal
              <select
                value={signal}
                onChange={(e) => setSignal(e.target.value)}
                className="rounded border border-line-strong bg-surface px-2 py-1 text-[13px] text-ink"
                aria-label="Signal to display"
              >
                {signals.map((k) => (
                  <option key={k} value={k}>
                    {signalLabel(k)}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="secondary" size="sm" onClick={() => pan(-1)} aria-label="Pan left"><ChevronLeft className="size-4" /></Button>
            <Button variant="secondary" size="sm" onClick={() => pan(1)} aria-label="Pan right"><ChevronRight className="size-4" /></Button>
            <Button variant="secondary" size="sm" onClick={() => setRange(null)} disabled={!range}><RotateCcw className="size-3.5" />Reset zoom</Button>
          </div>
        }
      />
      <div className="h-72 px-2 pt-3" role="img" aria-label={`${signalLabel(signal)} measured over time with anomaly episodes highlighted.`}>
        {series.status === "loading" && !s ? (
          <LoadingState label="Loading signal…" height={260} />
        ) : series.status === "error" ? (
          <ErrorState error={series.error} onRetry={series.reload} compact />
        ) : s ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 4 }} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} style={{ cursor: "crosshair" }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="x" type="number" domain={[s.range_start - t0, s.range_end - t0]} tickFormatter={formatElapsed} tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} minTickGap={48} allowDataOverflow />
              <YAxis domain={[yMin - pad, yMax + pad]} tickFormatter={(v: number) => formatNumber(v, 3)} width={64} tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} />
              {s.baseline ? (
                <ReferenceArea x1={s.baseline.time_start - t0} x2={s.baseline.time_end - t0} fill={CHART.baseline} fillOpacity={0.08} stroke="none" ifOverflow="hidden" />
              ) : null}
              {s.episodes.map((e) => (
                <ReferenceArea key={e.id} x1={e.start_time - t0} x2={e.end_time - t0} fill={CHART.anomaly} fillOpacity={0.16} stroke={CHART.anomaly} strokeOpacity={0.5} ifOverflow="hidden" label={{ value: `E${e.id}`, position: "insideTop", fontSize: 10, fill: CHART.anomaly }} />
              ))}
              {s.baseline ? <ReferenceLine y={s.baseline.value} stroke={CHART.baseline} strokeDasharray="4 3" strokeOpacity={0.8} /> : null}
              {drag ? <ReferenceArea x1={drag.a} x2={drag.b} fill={CHART.signal} fillOpacity={0.1} stroke="none" /> : null}
              <Line type="linear" dataKey="y" stroke={CHART.signal} strokeWidth={1.25} dot={false} isAnimationActive={false} />
              <Tooltip
                isAnimationActive={false}
                cursor={{ stroke: CHART.signal, strokeOpacity: 0.4 }}
                content={(props) => {
                  const p = props.payload?.[0]?.payload as { x: number; y: number } | undefined;
                  if (!props.active || !p) return null;
                  return (
                    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg">
                      <div className="num font-semibold">{formatNumber(p.y, 4)} {unit}</div>
                      <div className="num text-ink-muted">t = {formatElapsed(p.x)}</div>
                      <div className="num text-[11px] text-ink-faint">{formatWallClock(p.x + t0) ?? `timeEpoch ${(p.x + t0).toFixed(1)}`}</div>
                    </div>
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs text-ink-muted">
        <span className="flex items-center gap-1"><ZoomIn className="size-3.5" aria-hidden />Drag across the chart to zoom; use the arrows to pan.</span>
        <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm" style={{ background: CHART.anomaly, opacity: 0.4 }} />Anomaly episode</span>
        {s?.baseline ? (
          <span className="flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm" style={{ background: CHART.baseline, opacity: 0.3 }} />Baseline region (median {formatNumber(s.baseline.value, 3)} {unit})</span>
        ) : (
          <span>No baseline is defined for this signal.</span>
        )}
        {s?.downsampled ? <span>Showing {formatInt(s.returned_points)} of {formatInt(s.total_points)} points (min/max preserved).</span> : null}
        <span>X axis: elapsed time; {unit ? `Y axis: ${unit}.` : "Y axis: value as uploaded."}</span>
      </div>
    </Card>
  );
}

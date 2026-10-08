import { Card, CardHeader } from "../../components/ui";
import type { ScreeningResult } from "../../types/api";
import { formatDuration, formatInt, formatMs, formatTimestamp } from "../../utils/format";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-[13px]">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="num text-right">{v}</dd>
    </div>
  );
}

export function InputPanel({ result }: { result: ScreeningResult }) {
  const i = result.input;
  const t = result.timings_ms;
  const stages: [string, number][] = [
    ["Parse and clean data", t.parse_clean_ms],
    ["Generate windows", t.windowing_ms],
    ["Extract features", t.features_ms],
    ["Run detectors", t.inference_ms],
    ["Build indicators and timeline", t.explanation_ms],
  ];
  return (
    <Card>
      <CardHeader title="Input and processing" description="Data quality and measured server-side processing time." />
      <div className="grid gap-x-8 gap-y-4 p-4 md:grid-cols-2">
        <dl className="divide-y divide-line">
          <Row k="Records received" v={formatInt(i.total_rows)} />
          <Row k="Records analyzed" v={formatInt(i.valid_rows)} />
          <Row k="Records dropped" v={formatInt(i.dropped_rows)} />
          <Row k="Time range" v={`${formatTimestamp(i.time_start)} → ${formatTimestamp(i.time_end)}`} />
          <Row k="Capture duration" v={formatDuration(i.time_end - i.time_start, i.time_start)} />
          <Row k="Baseline region" v={`earliest ${formatInt(i.baseline_rows)} records`} />
          <Row k="Windows scored" v={formatInt(i.windows)} />
          <Row k="Trailing records not scored" v={formatInt(i.unused_tail_rows)} />
        </dl>
        <div>
          <dl className="divide-y divide-line">
            {stages.map(([k, ms]) => (
              <Row key={k} k={k} v={formatMs(ms)} />
            ))}
            <Row k="Total" v={<strong>{formatMs(t.total_ms)}</strong>} />
          </dl>
          <p className="mt-2 text-xs text-ink-faint">The first screening after a backend start includes model loading time.</p>
        </div>
      </div>
      {i.warnings.length > 0 ? (
        <div className="border-t border-line px-4 py-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-review">Notes on the input</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-ink">
            {i.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

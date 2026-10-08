import { ShieldAlert } from "lucide-react";
import { Card, CardBody, CardHeader, MetricCard } from "../../components/ui";
import { MODEL_LABELS } from "../../constants";
import type { ScreeningResult } from "../../types/api";
import { formatDateTime, formatDuration, formatInt, formatMs, formatPercent, formatScore, formatTimestamp } from "../../utils/format";
import { StatusPanel } from "./StatusPanel";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-[13px]">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="num min-w-0 break-words text-right">{v}</dd>
    </div>
  );
}

/** Live Screening header: status, run metadata and the 14 live metric cards. Every value is from this run. */
export function ScreeningSummary({ result: r }: { result: ScreeningResult }) {
  const s = r.summary;
  const a = s.agreement;
  const i = r.input;
  return (
    <div className="space-y-4">
      <StatusPanel result={r} />

      {r.distribution_check.status === "suspect" ? (
        <div role="alert" className="flex gap-3 rounded-md border border-review-line bg-review-soft p-4 text-[13px] text-ink">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-review" aria-hidden />
          <div>
            <div className="font-semibold text-review">Input may be outside the training distribution</div>
            <p className="mt-0.5">{r.distribution_check.message}</p>
            <p className="num mt-1 text-xs text-ink-muted">
              median AE error = {formatScore(r.distribution_check.median_ae_to_threshold)}× threshold · AE flags {formatPercent(r.distribution_check.ae_flag_fraction, 1)} · IF flags {formatPercent(r.distribution_check.if_flag_fraction, 1)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" aria-label="Live screening metrics">
        <MetricCard label="Screening status" value={s.status} tone={s.status === "ANOMALY" ? "anomaly" : s.status === "REVIEW" ? "review" : "normal"} hint="Worst window status" />
        <MetricCard label="Total samples" value={formatInt(s.total_samples)} hint={`${formatInt(i.total_rows)} received`} />
        <MetricCard label="Total windows" value={formatInt(s.total_windows)} hint={`${r.model.window_size} records, stride ${r.model.stride}`} />
        <MetricCard label="Normal windows" value={formatInt(s.normal_windows)} tone="normal" hint="Neither model flags" />
        <MetricCard label="Review windows" value={formatInt(s.review_windows)} tone="review" hint="Exactly one model flags" />
        <MetricCard label="Anomaly windows" value={formatInt(s.anomalous_windows)} tone="anomaly" hint="Both models flag" />
        <MetricCard label="Anomaly rate" value={formatPercent(s.anomaly_fraction)} hint="Anomaly / total windows" />
        <MetricCard label="Anomaly episodes" value={formatInt(s.episodes)} tone={s.episodes ? "anomaly" : "neutral"} hint="Merged anomaly windows" />
        <MetricCard label="Max IF score" value={formatScore(s.max_if_score)} hint={`threshold ${formatScore(r.thresholds.isolation_forest)}`} />
        <MetricCard label="Max AE error" value={formatScore(s.max_ae_score)} hint={`${formatScore(s.max_ae_to_threshold)}× threshold ${formatScore(r.thresholds.autoencoder)}`} />
        <MetricCard label="IF detections" value={formatInt(a.isolation_forest_flagged)} hint="Windows above IF threshold" />
        <MetricCard label="AE detections" value={formatInt(a.autoencoder_flagged)} hint="Windows above AE threshold" />
        <MetricCard label="Both-model detections" value={formatInt(a.both)} tone="anomaly" hint="IF and AE agree" />
        <MetricCard label="Processing time" value={formatMs(r.timings_ms.total_ms)} hint="Server, this upload" />
      </div>

      <Card>
        <CardHeader title="Run details" description="Everything below describes this upload and the models applied to it." />
        <CardBody className="grid gap-x-8 md:grid-cols-2">
          <dl className="divide-y divide-line">
            <Row k="Device ID" v={r.device_id} />
            <Row k="File name" v={i.filename} />
            <Row k="Samples" v={formatInt(i.valid_rows)} />
            <Row k="Time range" v={`${formatTimestamp(i.time_start)} → ${formatTimestamp(i.time_end)}`} />
            <Row k="Duration" v={formatDuration(i.duration_s, i.time_start)} />
            <Row k="Median sampling interval" v={i.median_sampling_interval_s === null ? "—" : `${i.median_sampling_interval_s.toFixed(3)} s`} />
          </dl>
          <dl className="divide-y divide-line">
            <Row k="Model" v={`${MODEL_LABELS[r.model.name] ?? r.model.name} ${r.model.version}`} />
            <Row k="Feature set" v={`${r.model.feature_count} features (${r.model.name})`} />
            <Row k="Isolation Forest threshold" v={formatScore(r.thresholds.isolation_forest)} />
            <Row k="Autoencoder threshold" v={formatScore(r.thresholds.autoencoder)} />
            <Row k="Trained with scikit-learn" v={r.model.trained_sklearn_version ?? "—"} />
            <Row k="Processed" v={formatDateTime(r.created_at)} />
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

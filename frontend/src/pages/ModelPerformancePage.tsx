import { FlaskConical } from "lucide-react";
import { getOfflineEvaluation } from "../api/evaluation";
import { Badge, Card, CardBody, CardHeader, DataTable, ErrorState, LoadingState } from "../components/ui";
import type { Column } from "../components/ui";
import { MODEL_LABELS } from "../constants";
import { useAsync } from "../hooks/useAsync";
import type { OfflineDeviceRow, OfflineModelEvaluation } from "../types/api";
import { formatInt, formatPercent, formatScore } from "../utils/format";

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-[13px]">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="num text-right">{v}</dd>
    </div>
  );
}

/** Offline Model Evaluation - static research results, deliberately separate from Live Screening. */
export default function ModelPerformancePage() {
  const ev = useAsync((s) => getOfflineEvaluation(s), []);
  if (ev.status === "loading") return <LoadingState label="Loading offline evaluation…" height={240} />;
  if (ev.status === "error") return <ErrorState error={ev.error} onRetry={ev.reload} />;
  const e = ev.data;

  const modelCols: Column<OfflineModelEvaluation>[] = [
    { key: "m", header: "Model / feature set", render: (m) => `${MODEL_LABELS[m.model] ?? m.model} (${m.feature_count} features)` },
    { key: "ti", header: "IF threshold", align: "right", render: (m) => formatScore(m.threshold_if) },
    { key: "ta", header: "AE threshold", align: "right", render: (m) => formatScore(m.threshold_ae) },
    { key: "tr", header: "Train / val / eval windows", align: "right", render: (m) => `${formatInt(m.train_windows)} / ${formatInt(m.validation_windows)} / ${formatInt(m.evaluation_windows)}` },
    { key: "fi", header: "IF flagged (eval)", align: "right", render: (m) => formatPercent(m.if_flag_fraction, 1) },
    { key: "fa", header: "AE flagged (eval)", align: "right", render: (m) => formatPercent(m.ae_flag_fraction, 1) },
    { key: "b", header: "Both / IF-only / AE-only", align: "right", render: (m) => `${m.both_flagged} / ${m.if_only} / ${m.ae_only}` },
    { key: "c", header: "IF–AE score correlation", align: "right", render: (m) => m.score_correlation.toFixed(3) },
    { key: "l", header: "AE final train loss", align: "right", render: (m) => (m.ae_final_training_loss === null ? "—" : m.ae_final_training_loss.toFixed(4)) },
  ];
  const devCols: Column<OfflineDeviceRow>[] = [
    { key: "d", header: "Device", render: (r) => r.device_id },
    { key: "f", header: "File", render: (r) => `${r.file} (${r.role})` },
    { key: "n", header: "Eval windows", align: "right", render: (r) => formatInt(r.evaluation_windows) },
    { key: "i", header: "IF flagged", align: "right", render: (r) => formatPercent(r.if_flag_fraction, 1) },
    { key: "a", header: "AE flagged", align: "right", render: (r) => formatPercent(r.ae_flag_fraction, 1) },
    { key: "b", header: "Both", align: "right", render: (r) => formatInt(r.both_flagged) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral"><FlaskConical className="mr-1 inline size-3" aria-hidden />Offline Model Evaluation</Badge>
        <span className="text-xs text-ink-muted">Static results from the research notebooks. These are NOT the result of any upload; uploads are analysed on the Live Screening page.</span>
      </div>

      <Card>
        <CardHeader title="Offline Model Evaluation" description="Methodology and measured quantities available in the provided artifacts." />
        <CardBody className="grid gap-x-8 md:grid-cols-2">
          <dl className="divide-y divide-line">
            <KV k="Independent devices" v={e.dataset.independent_devices} />
            <KV k="Test files" v={e.dataset.files.length} />
            <KV k="Total windows (overlapping)" v={formatInt(e.dataset.total_windows)} />
          </dl>
          <div className="space-y-2 text-[13px] text-ink-muted">
            <p><strong className="text-ink">Validation methodology.</strong> {e.validation_methodology}</p>
            <p><strong className="text-ink">Thresholds.</strong> {e.threshold_method}</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Models" description="Evaluation-split behaviour of each model configuration." />
        <div className="p-4">
          <DataTable caption="Offline model evaluation" columns={modelCols} rows={e.models} rowKey={(m) => m.model} />
        </div>
      </Card>

      {e.models.map((m) => (
        <Card key={m.model}>
          <CardHeader title={`Device-level behaviour — ${MODEL_LABELS[m.model] ?? m.model}`} description="Share of evaluation windows each detector flagged, per test file. Not an accuracy measure (no labels)." />
          <div className="p-4"><DataTable caption={`Per-device results for ${m.model}`} columns={devCols} rows={m.per_device} rowKey={(r) => `${r.device_id}-${r.file}`} /></div>
        </Card>
      ))}

      <Card>
        <CardHeader title="Metrics not available" description="Listed instead of invented: these need ground-truth labels that the provided artifacts do not contain." />
        <CardBody>
          <dl className="divide-y divide-line">
            {Object.entries(e.unavailable_metrics).map(([k, why]) => (
              <div key={k} className="grid gap-1 py-1.5 text-[13px] md:grid-cols-[10rem_1fr]">
                <dt className="font-medium">{k}</dt>
                <dd className="text-ink-muted">{why}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Artifact consistency check" description="Notebook windows re-scored with the saved models through the backend's inference code." />
        <CardBody>
          <dl className="divide-y divide-line">
            {Object.entries(e.artifact_rescoring_check).map(([k, c]) => (
              <KV key={k} k={`${MODEL_LABELS[k] ?? k} (${formatInt(c.windows_rescored)} windows)`} v={`max |ΔIF| ${c.max_abs_if_score_diff.toExponential(1)} · max |ΔAE| ${c.max_abs_ae_score_diff.toExponential(1)}`} />
            ))}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Limitations" />
        <CardBody>
          <ul className="list-disc space-y-1.5 pl-5 text-[13px]">
            {e.limitations.map((l) => <li key={l}>{l}</li>)}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">Sources: {e.generated_from.join("; ")}</p>
        </CardBody>
      </Card>
    </div>
  );
}

import { RefreshCw } from "lucide-react";
import { API_BASE } from "../api/client";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorState, LoadingState, SectionHeader } from "../components/ui";
import { DETECTORS_LABEL, MODEL_LABELS } from "../constants";
import { useBackendStatus } from "../hooks/useBackendStatus";
import { formatDateTime, formatScore } from "../utils/format";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-[13px]">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="num text-right text-ink">{value}</dd>
    </div>
  );
}

export default function SystemPage() {
  const { state, health, models, error, lastChecked, refresh } = useBackendStatus();

  return (
    <div>
      <SectionHeader
        title="System"
        description="Backend connection and detection-model configuration, as reported by the analysis service."
        actions={
          <Button size="sm" icon={<RefreshCw className="size-3.5" aria-hidden />} onClick={refresh}>
            Re-check
          </Button>
        }
      />

      {state === "offline" && error ? (
        <ErrorState error={error} onRetry={refresh} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Backend" />
            <CardBody>
              {state === "checking" && !health ? (
                <LoadingState label="Contacting backend…" height={120} />
              ) : (
                <dl className="divide-y divide-line">
                  <Row label="Status" value={health?.status === "ok" ? "Connected" : "Connected (models unavailable)"} />
                  <Row label="Service" value={health?.app ?? "—"} />
                  <Row label="API version" value={health ? `v1 (service ${health.version})` : "—"} />
                  <Row label="API base URL" value={API_BASE} />
                  <Row label="Last checked" value={lastChecked ? formatDateTime(lastChecked.toISOString()) : "—"} />
                </dl>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Detection" description="Applies to every model configuration." />
            <CardBody>
              <dl className="divide-y divide-line">
                <Row label="Detectors" value={DETECTORS_LABEL} />
                <Row label="Window size" value={models?.models[0] ? `${models.models[0].window_size} samples` : "—"} />
                <Row label="Stride" value={models?.models[0] ? `${models.models[0].stride} samples` : "—"} />
                <Row label="Default model" value={models ? (MODEL_LABELS[models.default_model] ?? models.default_model) : "—"} />
                <Row label="Time axis" value="timeEpoch as stored in the CSV" />
              </dl>
            </CardBody>
          </Card>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader title="Model configurations" description="Thresholds are read from the trained artifacts and appear once a model has been loaded." />
              {!models ? (
                <EmptyState title="Model information unavailable" description="The model list could not be retrieved from the backend." />
              ) : (
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  {models.models.map((m) => (
                    <div key={m.name} className="rounded-md border border-line p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">{MODEL_LABELS[m.name] ?? m.name}</h3>
                        <div className="flex gap-1.5">
                          {m.is_default ? <Badge tone="accent">Default</Badge> : null}
                          <Badge tone={m.artifacts_available ? "normal" : "anomaly"}>{m.artifacts_available ? "Artifacts present" : "Artifacts missing"}</Badge>
                          <Badge>{m.loaded ? "Loaded" : "Not loaded yet"}</Badge>
                        </div>
                      </div>
                      <p className="mt-2 text-[13px] text-ink-muted">{m.description}</p>
                      <dl className="mt-2 divide-y divide-line">
                        <Row label="Version" value={m.version} />
                        <Row label="Engineered features" value={m.feature_count} />
                        <Row label="Isolation Forest threshold" value={m.thresholds ? formatScore(m.thresholds.isolation_forest) : "available after first use"} />
                        <Row label="Autoencoder threshold" value={m.thresholds ? formatScore(m.thresholds.autoencoder) : "available after first use"} />
                      </dl>
                      {m.missing_artifacts.length > 0 ? (
                        <p className="num mt-2 break-words text-xs text-anomaly">Missing: {m.missing_artifacts.join(", ")}</p>
                      ) : null}
                      <details className="mt-2 text-[13px]">
                        <summary className="cursor-pointer text-accent">Feature list ({m.feature_count})</summary>
                        <ul className="num mt-1 columns-1 gap-4 text-[12px] text-ink-muted sm:columns-2">
                          {m.features.map((f) => (
                            <li key={f} className="break-all">
                              {f}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

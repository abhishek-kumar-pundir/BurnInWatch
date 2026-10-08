import { useNavigate } from "react-router-dom";
import { FileUp } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, ErrorState, LoadingState, SectionHeader } from "../components/ui";
import { DEVICE_ID_HINT } from "../constants";
import { ConfigSummary } from "../features/screening-new/ConfigSummary";
import { DatasetChecks } from "../features/screening-new/DatasetChecks";
import { DatasetUpload } from "../features/screening-new/DatasetUpload";
import { ModelSelector } from "../features/screening-new/ModelSelector";
import { ProcessingView } from "../features/screening-new/ProcessingView";
import { isValidDeviceId, useNewScreening } from "../features/screening-new/useNewScreening";
import { useBackendStatus } from "../hooks/useBackendStatus";

function Step({ n, title, children, hint }: { n: number; title: string; children: React.ReactNode; hint?: string }) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span className="num flex size-5 items-center justify-center rounded-full bg-nav text-[11px] text-white">{n}</span>
            {title}
          </span>
        }
        description={hint}
      />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

export default function NewScreeningPage() {
  const navigate = useNavigate();
  const backend = useBackendStatus();
  const s = useNewScreening(backend.models?.default_model, (r) => navigate(`/screenings/${r.screening_id}`));
  const { phase } = s;

  const file = phase.name === "idle" ? null : phase.file;
  const validation =
    phase.name === "validated" || phase.name === "analyzing" || phase.name === "analysis_failed" ? phase.validation : null;
  const modelDesc = backend.models?.models.find((m) => m.name === s.model) ?? null;
  const deviceOk = isValidDeviceId(s.deviceId);
  const showDeviceError = s.deviceId.length > 0 && !deviceOk;

  let blocker: string | null = null;
  if (backend.state === "offline") blocker = "The backend is offline.";
  else if (!file) blocker = "Upload a dataset to begin.";
  else if (phase.name === "validating") blocker = "Validating dataset…";
  else if (!validation) blocker = "Fix the dataset problems above.";
  else if (!validation.valid) blocker = "This dataset did not pass validation.";
  else if (!deviceOk) blocker = "Enter a valid device ID.";
  else if (!modelDesc || !modelDesc.artifacts_available) blocker = "Select an available detection model.";
  const ready = blocker === null;

  if (phase.name === "analyzing") {
    return (
      <div>
        <SectionHeader title="New screening" eyebrow="Analysis in progress" />
        <ProcessingView stage={phase.stage} uploadFraction={phase.uploadFraction} startedAt={phase.startedAt} onCancel={s.cancel} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="New screening"
        description="Upload a burn-in dataset, review the validation, choose a detection model, then run the screening."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Step n={1} title="Burn-in dataset" hint="Upload chronological measurement data (CSV).">
            <DatasetUpload
              file={file}
              busy={phase.name === "validating"}
              onSelect={(f) => void s.selectFile(f)}
              onClear={s.clearFile}
            />
            <div className="mt-4">
              {phase.name === "idle" ? (
                <EmptyState icon={FileUp} title="No dataset selected" description="Upload a burn-in dataset to begin analysis." className="py-6" />
              ) : phase.name === "validating" ? (
                <LoadingState label="Validating dataset…" height={120} />
              ) : phase.name === "validation_failed" ? (
                <ErrorState error={phase.error} />
              ) : (
                <DatasetChecks validation={phase.validation} />
              )}
            </div>
          </Step>

          <Step n={2} title="Detection model" hint="Models are trained and fixed; no tuning is needed for screening.">
            <ModelSelector models={backend.models?.models ?? null} value={s.model} onChange={s.setModel} />
          </Step>

          <Step n={3} title="Device">
            <label htmlFor="device-id" className="block text-[13px] font-medium">
              Device ID
            </label>
            <input
              id="device-id"
              value={s.deviceId}
              onChange={(e) => s.setDeviceId(e.target.value)}
              placeholder="e.g. IGBT-001"
              autoComplete="off"
              maxLength={64}
              aria-invalid={showDeviceError}
              aria-describedby="device-id-hint"
              className="num mt-1 h-9 w-full max-w-sm rounded-md border border-line-strong bg-surface px-3 text-sm placeholder:text-ink-faint aria-[invalid=true]:border-anomaly"
            />
            <p id="device-id-hint" className={showDeviceError ? "mt-1 text-xs text-anomaly" : "mt-1 text-xs text-ink-muted"}>
              {DEVICE_ID_HINT}
            </p>
          </Step>

          {phase.name === "analysis_failed" ? (
            <ErrorState error={phase.error} onRetry={() => void s.start()} retryLabel="Retry screening" />
          ) : null}
        </div>

        <div className="xl:sticky xl:top-16 xl:self-start">
          <ConfigSummary
            deviceId={s.deviceId}
            filename={file?.name ?? null}
            validation={validation}
            model={s.model}
            featureCount={modelDesc?.feature_count ?? null}
            ready={ready}
            blocker={blocker}
            onStart={() => void s.start()}
          />
        </div>
      </div>
    </div>
  );
}

import { Play } from "lucide-react";
import { Button, Card, CardBody, CardHeader } from "../../components/ui";
import { DETECTORS_LABEL, MODEL_LABELS } from "../../constants";
import type { DatasetValidation } from "../../types/api";
import { formatInt } from "../../utils/format";

interface Props {
  deviceId: string;
  filename: string | null;
  validation: DatasetValidation | null;
  model: string;
  featureCount: number | null;
  ready: boolean;
  blocker: string | null;
  onStart: () => void;
}

function Item({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={missing ? "text-ink-faint" : "num text-right font-medium text-ink"}>{value}</dd>
    </div>
  );
}

export function ConfigSummary({ deviceId, filename, validation, model, featureCount, ready, blocker, onStart }: Props) {
  return (
    <Card>
      <CardHeader title="Screening configuration" />
      <CardBody>
        <dl className="divide-y divide-line">
          <Item label="Device" value={deviceId.trim() || "Not set"} missing={!deviceId.trim()} />
          <Item label="Dataset" value={filename ?? "No file"} missing={!filename} />
          <Item label="Records" value={validation?.valid_rows != null ? formatInt(validation.valid_rows) : "—"} missing={validation?.valid_rows == null} />
          <Item label="Window" value={validation ? `${validation.window_size} samples` : "100 samples"} />
          <Item label="Stride" value={validation ? `${validation.stride} samples` : "25 samples"} />
          <Item label="Model" value={model ? `${MODEL_LABELS[model] ?? model}${featureCount ? ` · ${featureCount} features` : ""}` : "Not selected"} missing={!model} />
          <Item label="Detection" value={DETECTORS_LABEL} />
        </dl>
        <Button variant="primary" size="lg" className="mt-4 w-full" disabled={!ready} onClick={onStart} icon={<Play className="size-4" aria-hidden />}>
          Start Screening
        </Button>
        {!ready && blocker ? <p className="mt-2 text-center text-xs text-ink-muted">{blocker}</p> : null}
      </CardBody>
    </Card>
  );
}

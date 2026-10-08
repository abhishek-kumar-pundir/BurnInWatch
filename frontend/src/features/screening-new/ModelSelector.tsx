import { Layers } from "lucide-react";
import { Badge, EmptyState } from "../../components/ui";
import { DETECTORS_LABEL, DETECTORS_SUMMARY, MODEL_LABELS } from "../../constants";
import type { ModelDescriptor } from "../../types/api";
import { cn } from "../../utils/cn";

interface Props {
  models: ModelDescriptor[] | null;
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ models, value, onChange, disabled }: Props) {
  if (!models) {
    return <EmptyState icon={Layers} title="Detection models unavailable" description="The model list could not be retrieved. Check the backend connection." className="py-6" />;
  }
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="sr-only">Detection model</legend>
      {models.map((m) => {
        const selected = m.name === value;
        const unavailable = !m.artifacts_available;
        return (
          <label
            key={m.name}
            className={cn(
              "flex cursor-pointer gap-3 rounded-md border p-3 transition-colors",
              selected ? "border-accent bg-accent-soft/50" : "border-line hover:bg-canvas",
              unavailable && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name="model"
              value={m.name}
              checked={selected}
              disabled={unavailable}
              onChange={() => onChange(m.name)}
              className="mt-1 accent-[var(--color-accent)]"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{MODEL_LABELS[m.name] ?? m.name}</span>
                <span className="num text-xs text-ink-muted">{m.feature_count} engineered features</span>
                {m.is_default ? <Badge tone="accent">Default</Badge> : null}
                {unavailable ? <Badge tone="anomaly">Model files missing</Badge> : null}
              </div>
              <div className="mt-0.5 text-[13px] text-ink">{DETECTORS_LABEL}</div>
              <p className="mt-1 text-xs text-ink-muted">{m.description}</p>
            </div>
          </label>
        );
      })}
      <p className="text-xs text-ink-muted">{DETECTORS_SUMMARY}</p>
    </fieldset>
  );
}

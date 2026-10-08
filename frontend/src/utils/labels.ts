import { DERIVED_LABELS, SIGNALS } from "../constants";

/** Human label for a base signal or derived feature name; falls back to the raw name. */
export function signalLabel(name: string): string {
  return SIGNALS[name]?.label ?? DERIVED_LABELS[name] ?? name;
}

/** "collectorEmitterCurrent_std" -> "Collector-Emitter Current · variation (std)" using the backend's indicator text. */
export function featureLabel(f: { signal: string; indicator: string }): string {
  return `${signalLabel(f.signal)} · ${f.indicator}`;
}

export function pctText(fraction: number): string {
  return `${(fraction * 100).toFixed(fraction < 0.1 ? 1 : 0)}%`;
}

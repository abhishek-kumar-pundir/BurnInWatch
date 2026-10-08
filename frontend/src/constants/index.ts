export const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const DEVICE_ID_HINT = "1–64 characters: letters, digits, '.', '_' or '-' (must start with a letter or digit).";

/** Measurement signals the backend can return series for. Units are as named in the CSV header. */
export const SIGNALS: Record<string, { label: string; unit: string }> = {
  supplyVoltage: { label: "Supply Voltage", unit: "V" },
  node1Voltage: { label: "Node 1 Voltage", unit: "V" },
  node2Voltage: { label: "Node 2 Voltage", unit: "V" },
  collectorEmitterCurrent: { label: "Collector-Emitter Current", unit: "" },
  heatSinkTemperature: { label: "Heat Sink Temperature", unit: "°C" },
  packageTemperature: { label: "Package Temperature", unit: "°C" },
  internalTemperature: { label: "Internal Temperature", unit: "°C" },
};

/** Features derived from several signals; they have no single measured series. */
export const DERIVED_LABELS: Record<string, string> = {
  current_per_node2V: "Current per Node 2 Voltage",
  node_voltage_drop: "Node Voltage Drop",
  supply_node1_mean_diff: "Supply – Node 1 Difference",
  node1_node2_mean_diff: "Node 1 – Node 2 Difference",
  estimated_power_proxy: "Estimated Power Proxy",
};

export const MODEL_LABELS: Record<string, string> = {
  response_focused: "Response-Focused",
  expanded: "Expanded",
};

export const DETECTORS_LABEL = "Isolation Forest + Autoencoder";
export const DETECTORS_SUMMARY =
  "Combines statistical isolation and reconstruction-based anomaly detection to identify unusual burn-in behavior.";

export const PIPELINE_STEPS: { label: string; detail: string }[] = [
  { label: "CSV", detail: "Chronological burn-in measurements" },
  { label: "Validation", detail: "Columns, numeric values, ordering" },
  { label: "Windowing", detail: "Overlapping measurement windows" },
  { label: "Feature extraction", detail: "Engineered window statistics" },
  { label: "Isolation Forest + Autoencoder", detail: "Two unsupervised detectors" },
  { label: "Engineering review", detail: "Timeline, windows, abnormal signals" },
];

/** Work the server performs inside the single analyze request, in order. */
export const SERVER_STEPS = [
  "Generating measurement windows",
  "Extracting engineering features",
  "Running Isolation Forest and Autoencoder",
  "Detecting anomaly episodes and computing explanations",
] as const;

export const SIGNAL_DISCLAIMER =
  "Highlighted features are associated with the anomaly score and deviated from learned normal behavior. They are observations, not causes of failure.";

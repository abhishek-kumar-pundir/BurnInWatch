/**
 * Dataset Statistics & Signal Bounds: Single Source of Truth for Digital Twin.
 * 
 * Source file: processed/eda_robust_statistics.csv (computed across the 68,761 valid canonical records)
 * Additional reference: processed/sample_burnin_device4_main.csv (Device 4 replay file)
 * 
 * Rules:
 * - Voltages in V, current in A (~0.04-0.20 A).
 * - packageTemperature: "dataset units" (unit not recorded in repo; values 26-281 in the dataset).
 * - internalTemperature and heatSinkTemperature: "raw sensor units (uncalibrated)".
 *   Never show them as °C; they are not used by the models.
 * - Every slider range, particle mapping, color scale, and HUD readout must derive from these definitions.
 */

export interface SignalStat {
  key: string;
  label: string;
  unitLabel: string;
  p01: number;
  median: number;
  p99: number;
  minObserved: number;
  maxObserved: number;
  usedByModels: boolean;
  notes?: string;
}

export type SignalKey =
  | 'supplyVoltage'
  | 'node1Voltage'
  | 'node2Voltage'
  | 'collectorEmitterCurrent'
  | 'packageTemperature'
  | 'heatSinkTemperature'
  | 'internalTemperature';

export const DATASET_STATS: Record<SignalKey, SignalStat> = {
  supplyVoltage: {
    key: 'supplyVoltage',
    label: 'Supply Voltage',
    unitLabel: 'V',
    p01: 2.449,
    median: 4.937,
    p99: 5.927,
    minObserved: 2.411,
    maxObserved: 5.930,
    usedByModels: true,
  },
  node1Voltage: {
    key: 'node1Voltage',
    label: 'Node 1 Voltage',
    unitLabel: 'V',
    p01: 2.446,
    median: 4.936,
    p99: 5.926,
    minObserved: 2.399,
    maxObserved: 5.930,
    usedByModels: true,
  },
  node2Voltage: {
    key: 'node2Voltage',
    label: 'Collector Node Voltage',
    unitLabel: 'V',
    p01: 1.926,
    median: 4.912,
    p99: 5.925,
    minObserved: 1.330,
    maxObserved: 5.925,
    usedByModels: true,
  },
  collectorEmitterCurrent: {
    key: 'collectorEmitterCurrent',
    label: 'Collector-Emitter Current',
    unitLabel: 'A',
    p01: 0.041,
    median: 0.092, // Dataset median ~0.092 A; Device 4 baseline reference ~0.106 A
    p99: 0.206,
    minObserved: 0.039,
    maxObserved: 0.450,
    usedByModels: true,
  },
  packageTemperature: {
    key: 'packageTemperature',
    label: 'Package Temperature',
    unitLabel: 'dataset units',
    p01: 59.652,
    median: 254.417,
    p99: 280.822,
    minObserved: 26.96,
    maxObserved: 281.80,
    usedByModels: true,
    notes: 'Unit not recorded in repo; values 26-281 in the dataset.',
  },
  heatSinkTemperature: {
    key: 'heatSinkTemperature',
    label: 'Heat Sink Temperature',
    unitLabel: 'raw sensor units (uncalibrated)',
    p01: 718.815,
    median: 719.172,
    p99: 719.278,
    minObserved: 718.77,
    maxObserved: 719.46,
    usedByModels: false,
    notes: 'Not used by the models; raw uncalibrated ADC counts.',
  },
  internalTemperature: {
    key: 'internalTemperature',
    label: 'Internal Temperature',
    unitLabel: 'raw sensor units (uncalibrated)',
    p01: -2262.474,
    median: -2261.473,
    p99: -2254.488,
    minObserved: -2266.38,
    maxObserved: -2249.25,
    usedByModels: false,
    notes: 'Not used by the models; raw uncalibrated ADC counts.',
  },
};

/**
 * Model Thresholds (Reconciled from burninwatch_expanded_artifacts_v2.json & backend/models)
 */
export const MODEL_THRESHOLDS = {
  response_focused: {
    isolationForest: 0.06908179599444629,
    autoencoder: 0.2876077890396118,
    maxObservedIF: 0.175,
    maxObservedAE: 4.23,
  },
  expanded: {
    isolationForest: 0.10458415425735054,
    autoencoder: 0.36070457100868225,
    maxObservedIF: 0.220,
    maxObservedAE: 5.10,
  },
};

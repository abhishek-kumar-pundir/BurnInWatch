/**
 * BurnInWatch 3D Digital Twin — Illustrative Scoring Engine (Manual Lab Mode)
 * 
 * HONESTY RULE:
 * This deterministic module is strictly for illustrative presentation and education.
 * It is NOT the trained machine learning models (Isolation Forest / PyTorch Autoencoder).
 * It calculates standardized deviations (z-scores) relative to baseline burn-in statistics
 * from processed/eda_robust_statistics.csv to demonstrate how multi-sensor departures
 * map to consensus screening classifications.
 */

import { DEMO_DATA, SensorValues, ModelTelemetry } from './demoData';
import { DATASET_STATS, MODEL_THRESHOLDS } from './data/datasetStats';

export interface DerivedMetrics {
  node_voltage_drop: number;      // V: node1Voltage - node2Voltage
  power_proxy: number;            // W: node2Voltage * collectorEmitterCurrent
}

export function computeDerivedMetrics(sensors: SensorValues): DerivedMetrics {
  const node_voltage_drop = Math.max(0, sensors.node1Voltage - sensors.node2Voltage);
  const power_proxy = Math.max(0, sensors.node2Voltage * sensors.collectorEmitterCurrent);

  return {
    node_voltage_drop,
    power_proxy,
  };
}

export interface ManualScoringResult {
  telemetry: ModelTelemetry;
  derived: DerivedMetrics;
  topDeviations: { name: string; zScore: number; unit: string; value: number }[];
}

/**
 * Deterministically maps manual sensor inputs and fault toggles to illustrative IF & AE scores.
 */
export function computeIllustrativeScores(
  sensors: SensorValues,
  faultWireIndex: number, // -1 if none, 0-4 for wire index
  solderDelamination: boolean
): ManualScoringResult {
  const { thresholds } = DEMO_DATA;

  // 1. Compute standardized z-score deviations for actively modeled signals
  const iStats = DATASET_STATS.collectorEmitterCurrent;
  const pStats = DATASET_STATS.packageTemperature;
  const v2Stats = DATASET_STATS.node2Voltage;
  const vsStats = DATASET_STATS.supplyVoltage;

  const currentDev = Math.abs(sensors.collectorEmitterCurrent - iStats.median) / 0.038;
  const pkgDev = Math.abs(sensors.packageTemperature - pStats.median) / 25.0;
  const dropDev = Math.abs((sensors.node1Voltage - sensors.node2Voltage) - 0.43) / 0.20;
  const v2Dev = Math.abs(sensors.node2Voltage - v2Stats.median) / 0.50;
  const vsDev = Math.abs(sensors.supplyVoltage - vsStats.median) / 0.50;

  const deviations: { name: string; zScore: number; unit: string; value: number }[] = [
    {
      name: 'collectorEmitterCurrent',
      zScore: currentDev,
      unit: 'A',
      value: sensors.collectorEmitterCurrent,
    },
    {
      name: 'packageTemperature',
      zScore: pkgDev,
      unit: 'dataset units',
      value: sensors.packageTemperature,
    },
    {
      name: 'node_voltage_drop',
      zScore: dropDev,
      unit: 'V',
      value: sensors.node1Voltage - sensors.node2Voltage,
    },
    {
      name: 'node2Voltage',
      zScore: v2Dev,
      unit: 'V',
      value: sensors.node2Voltage,
    },
    {
      name: 'supplyVoltage',
      zScore: vsDev,
      unit: 'V',
      value: sensors.supplyVoltage,
    },
  ];

  // 2. Sort by largest deviation to provide XAI ranking
  deviations.sort((a, b) => b.zScore - a.zScore);

  const topZ = deviations[0]?.zScore ?? 0;
  const avgZ = deviations.slice(0, 3).reduce((sum, d) => sum + d.zScore, 0) / 3;

  // 3. Fault toggle boosts
  let faultMultiplier = 1.0;
  if (faultWireIndex >= 0) faultMultiplier += 1.8;
  if (solderDelamination) faultMultiplier += 1.4;

  // 4. Map to Isolation Forest score (Nominal ~0.035, threshold 0.0691, max 0.175)
  const baseIf = 0.035;
  let ifScore = baseIf + (topZ * 0.015 + avgZ * 0.010) * (faultMultiplier * 0.85);
  ifScore = Math.max(0.010, Math.min(MODEL_THRESHOLDS.response_focused.maxObservedIF, ifScore));

  // 5. Map to Autoencoder reconstruction loss (Nominal ~0.120, threshold 0.2876, max 4.23)
  const baseAe = 0.100;
  let aeLoss = baseAe + (Math.pow(avgZ, 1.4) * 0.09) * faultMultiplier;
  aeLoss = Math.max(0.020, Math.min(MODEL_THRESHOLDS.response_focused.maxObservedAE, aeLoss));

  const ifFlagged = ifScore >= thresholds.isolationForest;
  const aeFlagged = aeLoss >= thresholds.autoencoder;

  // 6. Consensus State Rule
  let consensus: 'NORMAL' | 'REVIEW' | 'ANOMALY' = 'NORMAL';
  if (ifFlagged && aeFlagged) {
    consensus = 'ANOMALY';
  } else if (ifFlagged || aeFlagged) {
    consensus = 'REVIEW';
  }

  const derived = computeDerivedMetrics(sensors);

  return {
    telemetry: {
      ifScore,
      ifThreshold: thresholds.isolationForest,
      ifFlagged,
      aeLoss,
      aeThreshold: thresholds.autoencoder,
      aeFlagged,
      consensus,
      windowIndex: 130,
      leadingFeatures: deviations.slice(0, 2).map((d) => `${d.name} (${d.zScore.toFixed(1)}σ)`),
    },
    derived,
    topDeviations: deviations,
  };
}

/**
 * BurnInWatch 3D Digital Twin — Illustrative Scoring Engine (Manual Lab Mode)
 * 
 * HONESTY RULE:
 * This deterministic module is strictly for illustrative presentation and education.
 * It is NOT the trained machine learning models (Isolation Forest / PyTorch Autoencoder).
 * It calculates standardized deviations (z-scores) relative to baseline burn-in statistics
 * to demonstrate how multi-sensor anomalies translate into screening scores and consensus.
 */

import { DEMO_DATA, SensorValues, ModelTelemetry } from './demoData';

export interface DerivedMetrics {
  node_voltage_drop: number;      // V: node1Voltage - node2Voltage
  power_proxy: number;            // W: node2Voltage * collectorEmitterCurrent
  /**
   * Thermal resistance proxy formula:
   * R_th = (T_junction - T_heatsink) / P_loss
   * Measures how effectively heat travels from silicon junction through baseplate into cooling fins.
   */
  thermal_resistance_ratio: number; // °C/W: (internalTemp - heatSinkTemp) / power_proxy
}

export function computeDerivedMetrics(sensors: SensorValues): DerivedMetrics {
  const node_voltage_drop = sensors.node1Voltage - sensors.node2Voltage;
  const power_proxy = Math.max(1, sensors.node2Voltage * sensors.collectorEmitterCurrent);
  const thermal_resistance_ratio =
    Math.max(0, sensors.internalTemperature - sensors.heatSinkTemperature) / power_proxy;

  return {
    node_voltage_drop,
    power_proxy,
    thermal_resistance_ratio,
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
  const { baselineStats, thresholds } = DEMO_DATA;

  // 1. Compute standardized z-score deviations for monitored signals
  const deviations: { name: string; zScore: number; unit: string; value: number }[] = [
    {
      name: 'collectorEmitterCurrent',
      zScore: Math.abs(sensors.collectorEmitterCurrent - baselineStats.collectorEmitterCurrent.mean) / baselineStats.collectorEmitterCurrent.std,
      unit: 'A',
      value: sensors.collectorEmitterCurrent,
    },
    {
      name: 'internalTemperature',
      zScore: Math.abs(sensors.internalTemperature - baselineStats.internalTemperature.mean) / baselineStats.internalTemperature.std,
      unit: '°C',
      value: sensors.internalTemperature,
    },
    {
      name: 'node_voltage_drop',
      zScore: Math.abs((sensors.node1Voltage - sensors.node2Voltage) - 0.33) / 0.15,
      unit: 'V',
      value: sensors.node1Voltage - sensors.node2Voltage,
    },
    {
      name: 'packageTemperature',
      zScore: Math.abs(sensors.packageTemperature - baselineStats.packageTemperature.mean) / baselineStats.packageTemperature.std,
      unit: '°C',
      value: sensors.packageTemperature,
    },
    {
      name: 'heatSinkTemperature',
      zScore: Math.abs(sensors.heatSinkTemperature - baselineStats.heatSinkTemperature.mean) / baselineStats.heatSinkTemperature.std,
      unit: '°C',
      value: sensors.heatSinkTemperature,
    },
    {
      name: 'supplyVoltage',
      zScore: Math.abs(sensors.supplyVoltage - baselineStats.supplyVoltage.mean) / baselineStats.supplyVoltage.std,
      unit: 'V',
      value: sensors.supplyVoltage,
    },
  ];

  // 2. Sort by largest deviation to provide XAI "Why?" explanation
  deviations.sort((a, b) => b.zScore - a.zScore);

  const topZ = deviations[0]?.zScore ?? 0;
  const avgZ = deviations.slice(0, 3).reduce((sum, d) => sum + d.zScore, 0) / 3;

  // 3. Fault toggle boosts
  let faultMultiplier = 1.0;
  if (faultWireIndex >= 0) faultMultiplier += 1.8;
  if (solderDelamination) faultMultiplier += 1.4;

  // 4. Map to Isolation Forest score (Nominal ~0.15 - 0.25, threshold 0.35, max 0.85)
  // Isolation Forest acts as an outlier detector sensitive to multi-variate distance
  let ifScore = 0.15 + (topZ * 0.08 + avgZ * 0.04) * (faultMultiplier * 0.8);
  ifScore = Math.max(0.08, Math.min(0.85, ifScore));

  // 5. Map to Autoencoder reconstruction loss (Nominal ~0.03 - 0.05, threshold 0.08, max 0.40)
  // Autoencoder loss surges when non-linear physical correlation breaks (e.g. current vs temp)
  let aeLoss = 0.035 + (Math.pow(avgZ, 1.35) * 0.018) * faultMultiplier;
  aeLoss = Math.max(0.015, Math.min(0.40, aeLoss));

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

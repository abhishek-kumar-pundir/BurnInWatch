import { DEMO_DATA, SensorValues, ModelTelemetry, ScenarioConfig } from './demoData';

export type StageId = 1 | 2 | 3 | 4;

export interface TimelineState {
  currentTime: number;
  stageId: StageId;
  stageProgress: number; // 0 to 1 within the current stage
  totalProgress: number; // 0 to 1 across 36s
  isPlaying: boolean;
  isCompleted: boolean;
  sensorValues: SensorValues;
  telemetry: ModelTelemetry;
}

// Math utilities for smooth animation
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * Returns the active stage (1-4) given timestamp in seconds.
 */
export function getStageId(time: number): StageId {
  if (time < 6) return 1;
  if (time < 13) return 2;
  if (time < 22) return 3;
  return 4;
}

/**
 * Computes interpolated sensor values for any point in the timeline based on active scenario.
 */
export function getInterpolatedSensors(time: number, scenario: ScenarioConfig): SensorValues {
  const { nominal, stressed, final } = scenario.sensors;

  if (time <= 6) {
    // Stage 1: Cold / baseline state
    return { ...nominal };
  } else if (time <= 13) {
    // Stage 2: Low-power idle verification
    const t = (time - 6) / 7;
    return {
      supplyVoltage: lerp(nominal.supplyVoltage, nominal.supplyVoltage, t),
      node1Voltage: lerp(nominal.node1Voltage, nominal.node1Voltage, t),
      node2Voltage: lerp(nominal.node2Voltage, nominal.node2Voltage, t),
      node_voltage_drop: lerp(nominal.node_voltage_drop, nominal.node_voltage_drop, t),
      collectorEmitterCurrent: lerp(nominal.collectorEmitterCurrent, nominal.collectorEmitterCurrent, t),
      internalTemperature: lerp(nominal.internalTemperature, nominal.internalTemperature + 3, t),
      packageTemperature: lerp(nominal.packageTemperature, nominal.packageTemperature + 2, t),
      heatSinkTemperature: lerp(nominal.heatSinkTemperature, nominal.heatSinkTemperature + 2, t),
    };
  } else if (time <= 22) {
    // Stage 3: Live stress ramps up
    const t = easeInOutCubic((time - 13) / 9);
    return {
      supplyVoltage: lerp(nominal.supplyVoltage, stressed.supplyVoltage, t),
      node1Voltage: lerp(nominal.node1Voltage, stressed.node1Voltage, t),
      node2Voltage: lerp(nominal.node2Voltage, stressed.node2Voltage, t),
      node_voltage_drop: lerp(nominal.node_voltage_drop, stressed.node_voltage_drop, t),
      collectorEmitterCurrent: lerp(nominal.collectorEmitterCurrent, stressed.collectorEmitterCurrent, t),
      internalTemperature: lerp(nominal.internalTemperature + 3, stressed.internalTemperature, t),
      packageTemperature: lerp(nominal.packageTemperature + 2, stressed.packageTemperature, t),
      heatSinkTemperature: lerp(nominal.heatSinkTemperature + 2, stressed.heatSinkTemperature, t),
    };
  } else {
    // Stage 4: Runaway or stabilization
    const t = easeInOutCubic((time - 22) / 14);
    return {
      supplyVoltage: lerp(stressed.supplyVoltage, final.supplyVoltage, t),
      node1Voltage: lerp(stressed.node1Voltage, final.node1Voltage, t),
      node2Voltage: lerp(stressed.node2Voltage, final.node2Voltage, t),
      node_voltage_drop: lerp(stressed.node_voltage_drop, final.node_voltage_drop, t),
      collectorEmitterCurrent: lerp(stressed.collectorEmitterCurrent, final.collectorEmitterCurrent, t),
      internalTemperature: lerp(stressed.internalTemperature, final.internalTemperature, t),
      packageTemperature: lerp(stressed.packageTemperature, final.packageTemperature, t),
      heatSinkTemperature: lerp(stressed.heatSinkTemperature, final.heatSinkTemperature, t),
    };
  }
}

/**
 * Computes model scores, thresholds, and consensus state based on active scenario.
 */
export function getModelTelemetry(time: number, scenario: ScenarioConfig): ModelTelemetry {
  const { thresholds, slidingWindow } = DEMO_DATA;
  const { models } = scenario;

  // Window counter (sweeping in stage 4)
  let windowIndex = slidingWindow.startWindow;
  if (time >= 22) {
    const sweepProgress = clamp((time - 22) / 10, 0, 1);
    windowIndex = Math.floor(lerp(slidingWindow.startWindow, slidingWindow.endWindow, sweepProgress));
  }

  // Isolation Forest score
  const nominalIfScore = 0.18;
  let ifScore = nominalIfScore;
  if (time >= 22) {
    const t = clamp((time - 22) / 6, 0, 1);
    ifScore = lerp(nominalIfScore, models.ifFinalScore, easeInOutCubic(t));
  }
  const ifFlagged = models.ifFlagTime !== null && time >= models.ifFlagTime;

  // Autoencoder loss
  const nominalAeLoss = 0.04;
  let aeLoss = nominalAeLoss;
  if (time >= 23.5) {
    const t = clamp((time - 23.5) / 7, 0, 1);
    aeLoss = lerp(nominalAeLoss, models.aeFinalLoss, easeInOutCubic(t));
  }
  const aeFlagged = models.aeFlagTime !== null && time >= models.aeFlagTime;

  // Consensus logic
  let consensusState: 'NORMAL' | 'REVIEW' | 'ANOMALY' = 'NORMAL';
  if (models.anomalyTime !== null && time >= models.anomalyTime) {
    consensusState = 'ANOMALY';
  } else if (models.reviewTime !== null && time >= models.reviewTime) {
    consensusState = 'REVIEW';
  }

  return {
    ifScore,
    ifThreshold: thresholds.isolationForest,
    ifFlagged,
    aeLoss,
    aeThreshold: thresholds.autoencoder,
    aeFlagged,
    consensus: consensusState,
    windowIndex,
  };
}

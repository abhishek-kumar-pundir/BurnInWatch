/**
 * BurnInWatch 3D Digital Twin — Scripted Demonstration Data & Scenarios
 * 
 * Single source of truth: src/digitalTwin/data/datasetStats.ts
 * Sourced from processed/eda_robust_statistics.csv & sample_burnin_device4_main.csv
 * 
 * Rules:
 * - Voltages in V, collectorEmitterCurrent in A (~0.04-0.20 A).
 * - packageTemperature: "dataset units" (values 26-281 in the dataset).
 * - internalTemperature and heatSinkTemperature: "raw sensor units (uncalibrated)".
 *   Never show them as °C; they are not used by the models.
 * - Gauge rings use the real thresholds (tau_IF = 0.069082, tau_AE = 0.287608).
 * - No hardcoded 55 A / 40 A / 88.5 / 148.7 / 165 anywhere.
 */

import { DATASET_STATS, MODEL_THRESHOLDS } from './data/datasetStats';

export interface SensorValues {
  supplyVoltage: number;          // V
  node1Voltage: number;           // V
  node2Voltage: number;           // V
  node_voltage_drop: number;      // V (node1 - node2)
  collectorEmitterCurrent: number;// A
  internalTemperature: number;    // raw sensor units (uncalibrated)
  packageTemperature: number;     // dataset units
  heatSinkTemperature: number;    // raw sensor units (uncalibrated)
}

export interface ModelTelemetry {
  ifScore: number;
  ifThreshold: number;
  ifFlagged: boolean;
  aeLoss: number;
  aeThreshold: number;
  aeFlagged: boolean;
  consensus: 'NORMAL' | 'REVIEW' | 'ANOMALY';
  windowIndex: number;
  leadingFeatures?: string[];
}

export type ScenarioId = 'healthy' | 'fatigue' | 'drift' | 'cooling' | 'manual' | 'replay';

export interface ScenarioConfig {
  id: ScenarioId;
  name: string;
  tagline: string;
  description: string;
  hasCrack: boolean;
  crackedWireIndex?: number;
  hasHotspot: boolean;
  coolingDegraded?: boolean;
  sensors: {
    nominal: SensorValues;
    stressed: SensorValues;
    final: SensorValues;
  };
  models: {
    ifFlagTime: number | null; // null if never flags
    aeFlagTime: number | null; // null if never flags
    ifFinalScore: number;
    aeFinalLoss: number;
    reviewTime: number | null;
    anomalyTime: number | null;
  };
  xai: {
    title: string;
    leadFeature: string;
    lines: string[];
  };
}

export interface PartInfo {
  id: string;
  name: string;
  role: string;
  relatedSensor: keyof SensorValues | 'nodeVoltages' | 'none';
  sensorLabel: string;
  failureMode: string;
}

export const PART_CATALOG: Record<string, PartInfo> = {
  die_igbt: {
    id: 'die_igbt',
    name: 'Silicon IGBT Switching Die',
    role: 'Primary high-voltage semiconductor switch conducting main collector-emitter current.',
    relatedSensor: 'packageTemperature',
    sensorLabel: 'packageTemperature (dataset units)',
    failureMode: 'Die localized overheating, gate oxide breakdown, latch-up.',
  },
  die_diode: {
    id: 'die_diode',
    name: 'Freewheeling Diode (FWD) Die',
    role: 'Protects switching die by providing safe inductive recirculation during switch-off.',
    relatedSensor: 'packageTemperature',
    sensorLabel: 'packageTemperature (dataset units)',
    failureMode: 'Reverse recovery stress, forward voltage drop drift.',
  },
  bond_wire_0: {
    id: 'bond_wire_0',
    name: 'Gate Bond Wire (Wire 1)',
    role: 'Transmits gate switching pulse from control terminal to the IGBT gate contact pad.',
    relatedSensor: 'node1Voltage',
    sensorLabel: 'node1Voltage (V)',
    failureMode: 'Gate wire heel cracking, parasitic oscillation.',
  },
  bond_wire_1: {
    id: 'bond_wire_1',
    name: 'Main Emitter Bond Wire A (Wire 2)',
    role: 'High-current interconnect carrying primary power from terminal to silicon die.',
    relatedSensor: 'collectorEmitterCurrent',
    sensorLabel: 'collectorEmitterCurrent (A)',
    failureMode: 'Electromigration, thermal cycling fatigue.',
  },
  bond_wire_2: {
    id: 'bond_wire_2',
    name: 'Main Emitter Bond Wire B (Wire 3 — Fault Susceptible)',
    role: 'High-current interconnect subject to repetitive CTE thermal expansion mismatch.',
    relatedSensor: 'collectorEmitterCurrent',
    sensorLabel: 'collectorEmitterCurrent (A)',
    failureMode: 'Thermal fatigue heel-cracking, bond wire lift-off.',
  },
  bond_wire_3: {
    id: 'bond_wire_3',
    name: 'Main Emitter Bond Wire C (Wire 4)',
    role: 'Parallel current share path to maintain uniform current density across the die.',
    relatedSensor: 'collectorEmitterCurrent',
    sensorLabel: 'collectorEmitterCurrent (A)',
    failureMode: 'Current crowding overload following adjacent wire failure.',
  },
  bond_wire_4: {
    id: 'bond_wire_4',
    name: 'Diode Anode Bond Wire (Wire 5)',
    role: 'Interconnect routing inductive discharge current into the freewheeling diode.',
    relatedSensor: 'node2Voltage',
    sensorLabel: 'node2Voltage (V)',
    failureMode: 'Thermal cycling stress, bond lift.',
  },
  dbc_substrate: {
    id: 'dbc_substrate',
    name: 'Direct Bonded Copper (DBC) Ceramic Substrate',
    role: 'Provides electrical isolation between high-voltage silicon and baseplate while conducting heat.',
    relatedSensor: 'packageTemperature',
    sensorLabel: 'packageTemperature (dataset units)',
    failureMode: 'Solder voiding, ceramic substrate cracking, copper delamination.',
  },
  baseplate: {
    id: 'baseplate',
    name: 'Heavy Copper Baseplate',
    role: 'Mechanical structural foundation spreading heat horizontally from the DBC substrate.',
    relatedSensor: 'packageTemperature',
    sensorLabel: 'packageTemperature (dataset units)',
    failureMode: 'Baseplate warpage, thermal interface degradation.',
  },
  heatsink: {
    id: 'heatsink',
    name: 'Aluminum Cold Plate & Dissipation Fins',
    role: 'Dissipates thermal loads into the forced-air or liquid coolant stream.',
    relatedSensor: 'heatSinkTemperature',
    sensorLabel: 'heatSinkTemperature (raw sensor units, uncalibrated)',
    failureMode: 'Finned channel blockage, thermal interface dry-out.',
  },
  casing: {
    id: 'casing',
    name: 'Protective Molded Epoxy Housing',
    role: 'Hermetically encapsulates silicon components and silicone gel against moisture and debris.',
    relatedSensor: 'packageTemperature',
    sensorLabel: 'packageTemperature (dataset units)',
    failureMode: 'High-temperature plastic embrittlement, seal rupture.',
  },
  terminals: {
    id: 'terminals',
    name: 'Screw & Kelvin Power Terminals',
    role: 'External electrical interface for DC bus voltage and gate drive instrumentation.',
    relatedSensor: 'nodeVoltages',
    sensorLabel: 'node1Voltage / node2Voltage (V)',
    failureMode: 'Contact fretting corrosion, screw torque relaxation.',
  },
  clamps: {
    id: 'clamps',
    name: 'Pneumatic Fixture Clamps',
    role: 'Applies calibrated mechanical pressure to guarantee uniform thermal contact.',
    relatedSensor: 'none',
    sensorLabel: 'Test Fixture Pressure',
    failureMode: 'Pneumatic cylinder pressure loss, uneven clamping.',
  },
  probes: {
    id: 'probes',
    name: 'Overhead Kelvin Contact Probes',
    role: 'Four-point electrical Kelvin sensing to measure microvolt drops without lead resistance.',
    relatedSensor: 'nodeVoltages',
    sensorLabel: 'node1Voltage / node2Voltage (V)',
    failureMode: 'Probe tip oxidation, mechanical spring fatigue.',
  },
};

export const DEMO_DATA = {
  disclaimer: "Illustrative simulation — values are scripted for demonstration",
  manualHonestyLabel: "Illustrative scoring — not the trained models (single-point slider inputs do not constitute a 100-sample temporal window with 20 engineered features)",

  // Baseline distribution parameters from real NASA aging dataset (processed/eda_robust_statistics.csv)
  baselineStats: {
    supplyVoltage: { mean: 4.707, std: 1.090, min: DATASET_STATS.supplyVoltage.p01, max: DATASET_STATS.supplyVoltage.p99, unit: 'V' },
    node1Voltage: { mean: 4.705, std: 1.090, min: DATASET_STATS.node1Voltage.p01, max: DATASET_STATS.node1Voltage.p99, unit: 'V' },
    node2Voltage: { mean: 4.374, std: 1.104, min: DATASET_STATS.node2Voltage.p01, max: DATASET_STATS.node2Voltage.p99, unit: 'V' },
    collectorEmitterCurrent: { mean: 0.106, std: 0.038, min: DATASET_STATS.collectorEmitterCurrent.p01, max: DATASET_STATS.collectorEmitterCurrent.p99, unit: 'A' },
    internalTemperature: { mean: -2260.58, std: 1.98, min: DATASET_STATS.internalTemperature.p01, max: DATASET_STATS.internalTemperature.p99, unit: 'raw sensor units (uncalibrated)' },
    packageTemperature: { mean: 220.00, std: 63.96, min: DATASET_STATS.packageTemperature.p01, max: DATASET_STATS.packageTemperature.p99, unit: 'dataset units' },
    heatSinkTemperature: { mean: 719.13, std: 0.10, min: DATASET_STATS.heatSinkTemperature.p01, max: DATASET_STATS.heatSinkTemperature.p99, unit: 'raw sensor units (uncalibrated)' },
  },

  // Manual Mode Presets based on real dataset statistics
  presets: {
    normal: {
      name: 'Normal Operation',
      values: {
        supplyVoltage: 4.94,
        node1Voltage: 4.94,
        node2Voltage: 4.51,
        collectorEmitterCurrent: 0.092,
        internalTemperature: -2261.5,
        packageTemperature: 254.4,
        heatSinkTemperature: 719.2,
      },
      faultWireIndex: -1,
      solderDelamination: false,
    },
    overstress: {
      name: 'Current Overstress',
      values: {
        supplyVoltage: 5.43,
        node1Voltage: 5.43,
        node2Voltage: 3.20,
        collectorEmitterCurrent: 0.175,
        internalTemperature: -2261.5,
        packageTemperature: 279.5,
        heatSinkTemperature: 719.2,
      },
      faultWireIndex: 2, // Wire #3
      solderDelamination: false,
    },
    coolingFailure: {
      name: 'Package Temp Drift',
      values: {
        supplyVoltage: 4.94,
        node1Voltage: 4.94,
        node2Voltage: 4.30,
        collectorEmitterCurrent: 0.102,
        internalTemperature: -2261.5,
        packageTemperature: 280.5,
        heatSinkTemperature: 719.2,
      },
      faultWireIndex: -1,
      solderDelamination: true,
    },
  },

  stages: [
    {
      id: 1,
      name: "Stage 1 — Burn-in Test Fixture",
      subtitle: "Component loading, pneumatic clamping, and Kelvin probe contact verification",
      startTime: 0,
      endTime: 6,
      duration: 6,
    },
    {
      id: 2,
      name: "Stage 2 — Internal Anatomy & Sensors",
      subtitle: "X-ray view of silicon dies, aluminum bond wires, DBC ceramic substrate, and thermal hierarchy",
      startTime: 6,
      endTime: 13,
      duration: 7,
    },
    {
      id: 3,
      name: "Stage 3 — Live Stress & Thermal Diffusion",
      subtitle: "Accelerated current cycling, localized ohmic heating, and thermal diffusion to heatsink",
      startTime: 13,
      endTime: 22,
      duration: 9,
    },
    {
      id: 4,
      name: "Stage 4 — Degradation & Dual AI Anomaly Screening",
      subtitle: "Detector consensus, rolling window sweep, and XAI root cause attribution",
      startTime: 22,
      endTime: 36,
      duration: 14,
    },
  ],

  totalDuration: 36,

  // Real thresholds from model_registry & burninwatch_expanded_artifacts_v2.json
  thresholds: {
    isolationForest: MODEL_THRESHOLDS.response_focused.isolationForest,
    autoencoder: MODEL_THRESHOLDS.response_focused.autoencoder,
    maxObservedIF: MODEL_THRESHOLDS.response_focused.maxObservedIF,
    maxObservedAE: MODEL_THRESHOLDS.response_focused.maxObservedAE,
  },

  slidingWindow: {
    size: 100,
    stride: 25,
    startWindow: 128,
    endWindow: 134,
  },

  // 4 Curated Presentation Scenarios (rebuilt on real baselines and % deviations)
  scenarios: {
    healthy: {
      id: 'healthy',
      name: 'Healthy Run',
      tagline: 'Device passes accelerated stress without anomaly',
      description: 'Stress increases normally. Both models remain comfortably within baseline thresholds; consensus remains NORMAL throughout the test cycle.',
      hasCrack: false,
      hasHotspot: false,
      coolingDegraded: false,
      sensors: {
        nominal: {
          supplyVoltage: 4.937,
          node1Voltage: 4.936,
          node2Voltage: 4.507,
          node_voltage_drop: 0.429,
          collectorEmitterCurrent: 0.092,
          internalTemperature: -2261.5,
          packageTemperature: 254.4,
          heatSinkTemperature: 719.2,
        },
        stressed: {
          supplyVoltage: 4.937,
          node1Voltage: 4.936,
          node2Voltage: 4.450,
          node_voltage_drop: 0.486,
          collectorEmitterCurrent: 0.106, // +15% over baseline
          internalTemperature: -2261.5,
          packageTemperature: 262.0,
          heatSinkTemperature: 719.2,
        },
        final: {
          supplyVoltage: 4.937,
          node1Voltage: 4.936,
          node2Voltage: 4.400,
          node_voltage_drop: 0.536,
          collectorEmitterCurrent: 0.110, // +20% over baseline
          internalTemperature: -2261.5,
          packageTemperature: 264.0,
          heatSinkTemperature: 719.2,
        },
      },
      models: {
        ifFlagTime: null,
        aeFlagTime: null,
        ifFinalScore: 0.038, // 0.55 * tau_IF (0.0691)
        aeFinalLoss: 0.120,  // 0.42 * tau_AE (0.2876)
        reviewTime: null,
        anomalyTime: null,
      },
      xai: {
        title: "Quality Verification Passed",
        leadFeature: "Nominal Conduction & Stable Operating Envelope",
        lines: [
          "Δ Package Temp: +9.6 dataset units (Within observed baseline band)",
          "Collector Current: 0.110 A (Nominal conduction band 0.04–0.20 A)",
          "Screening Result: 100% Windows Confirmed NORMAL",
        ],
      },
    } as ScenarioConfig,

    fatigue: {
      id: 'fatigue',
      name: 'Bond-Wire Fatigue',
      tagline: 'Micro-crack on emitter wire leading to current constriction and thermal hotspot',
      description: 'Repeated thermal cycling cracks emitter bond wire #3. Constricted current creates a localized hotspot; Isolation Forest flags first, followed by Autoencoder consensus.',
      hasCrack: true,
      crackedWireIndex: 2,
      hasHotspot: true,
      coolingDegraded: false,
      sensors: {
        nominal: {
          supplyVoltage: 4.937,
          node1Voltage: 4.936,
          node2Voltage: 4.507,
          node_voltage_drop: 0.429,
          collectorEmitterCurrent: 0.092,
          internalTemperature: -2261.5,
          packageTemperature: 254.4,
          heatSinkTemperature: 719.2,
        },
        stressed: {
          supplyVoltage: 4.940,
          node1Voltage: 4.930,
          node2Voltage: 3.900,
          node_voltage_drop: 1.030,
          collectorEmitterCurrent: 0.129, // +40% over baseline
          internalTemperature: -2261.5,
          packageTemperature: 268.0,
          heatSinkTemperature: 719.2,
        },
        final: {
          supplyVoltage: 4.950,
          node1Voltage: 4.930,
          node2Voltage: 2.650,
          node_voltage_drop: 2.280,
          collectorEmitterCurrent: 0.175, // +90% over baseline, within real ~0.04-0.20 A range
          internalTemperature: -2261.5,
          packageTemperature: 279.5,
          heatSinkTemperature: 719.2,
        },
      },
      models: {
        ifFlagTime: 24.5,
        aeFlagTime: 27.0,
        ifFinalScore: 0.125, // 1.81 * tau_IF (0.0691)
        aeFinalLoss: 0.850,  // 2.96 * tau_AE (0.2876)
        reviewTime: 24.5,
        anomalyTime: 27.0,
      },
      xai: {
        title: "XAI Root Cause Attribution",
        leadFeature: "Collector Terminal Voltage Drop & Hotspot",
        lines: [
          "Δ Package Temp: +25.1 dataset units (+9.9% vs baseline)",
          "Node Voltage Drop: 2.28 V (+431% over nominal baseline 0.43 V)",
          "Consensus: ANOMALY confirmed across dual screening windows",
        ],
      },
    } as ScenarioConfig,

    drift: {
      id: 'drift',
      name: 'Early Drift (REVIEW)',
      tagline: 'Single-detector outlier flag without catastrophic fault',
      description: 'Parametric contact resistance slowly creeps upward. Isolation Forest detects an atypical multi-variate signature, while Autoencoder reconstruction error remains under threshold.',
      hasCrack: false,
      hasHotspot: false,
      coolingDegraded: false,
      sensors: {
        nominal: {
          supplyVoltage: 4.937,
          node1Voltage: 4.936,
          node2Voltage: 4.507,
          node_voltage_drop: 0.429,
          collectorEmitterCurrent: 0.092,
          internalTemperature: -2261.5,
          packageTemperature: 254.4,
          heatSinkTemperature: 719.2,
        },
        stressed: {
          supplyVoltage: 4.940,
          node1Voltage: 4.930,
          node2Voltage: 4.100,
          node_voltage_drop: 0.830,
          collectorEmitterCurrent: 0.106, // +15% over baseline
          internalTemperature: -2261.5,
          packageTemperature: 258.0,
          heatSinkTemperature: 719.2,
        },
        final: {
          supplyVoltage: 4.940,
          node1Voltage: 4.930,
          node2Voltage: 3.750,
          node_voltage_drop: 1.180,
          collectorEmitterCurrent: 0.115, // +25% over baseline
          internalTemperature: -2261.5,
          packageTemperature: 262.5,
          heatSinkTemperature: 719.2,
        },
      },
      models: {
        ifFlagTime: 25.0,
        aeFlagTime: null,   // Never flags
        ifFinalScore: 0.088, // 1.27 * tau_IF (0.0691)
        aeFinalLoss: 0.195,  // 0.68 * tau_AE (0.2876) - below threshold
        reviewTime: 25.0,
        anomalyTime: null,  // Stays REVIEW
      },
      xai: {
        title: "Engineering Review Recommended",
        leadFeature: "Terminal Voltage Drop Drift",
        lines: [
          "Isolation Forest flagged atypical terminal voltage drop (score: 0.088 > 0.069)",
          "Autoencoder reconstruction loss: 0.195 (Within 0.288 threshold)",
          "Recommended Action: Retest contact torque before deployment",
        ],
      },
    } as ScenarioConfig,

    cooling: {
      id: 'cooling',
      name: 'Package Temperature Drift',
      tagline: 'Thermal accumulation during extended accelerated burn-in',
      description: 'Package temperature drifts upward beyond observed normal operating quantiles. Both models flag the correlated thermal-electrical deviation.',
      hasCrack: false,
      hasHotspot: false,
      coolingDegraded: true,
      sensors: {
        nominal: {
          supplyVoltage: 4.937,
          node1Voltage: 4.936,
          node2Voltage: 4.507,
          node_voltage_drop: 0.429,
          collectorEmitterCurrent: 0.092,
          internalTemperature: -2261.5,
          packageTemperature: 254.4,
          heatSinkTemperature: 719.2,
        },
        stressed: {
          supplyVoltage: 4.940,
          node1Voltage: 4.930,
          node2Voltage: 4.400,
          node_voltage_drop: 0.530,
          collectorEmitterCurrent: 0.098,
          internalTemperature: -2261.5,
          packageTemperature: 272.0,
          heatSinkTemperature: 719.2,
        },
        final: {
          supplyVoltage: 4.940,
          node1Voltage: 4.930,
          node2Voltage: 4.300,
          node_voltage_drop: 0.630,
          collectorEmitterCurrent: 0.102,
          internalTemperature: -2261.5,
          packageTemperature: 280.5,
          heatSinkTemperature: 719.2,
        },
      },
      models: {
        ifFlagTime: 24.0,
        aeFlagTime: 26.5,
        ifFinalScore: 0.110, // 1.59 * tau_IF (0.0691)
        aeFinalLoss: 0.620,  // 2.16 * tau_AE (0.2876)
        reviewTime: 24.0,
        anomalyTime: 26.5,
      },
      xai: {
        title: "Package Temperature Drift",
        leadFeature: "Package Temperature Accumulation",
        lines: [
          "Package Temp: 280.5 dataset units (Approaches observed p99 limit 280.8)",
          "Delta from baseline: +26.1 dataset units (+10.3% relative change)",
          "Consensus: ANOMALY confirmed across thermal monitoring windows",
        ],
      },
    } as ScenarioConfig,
  },
};

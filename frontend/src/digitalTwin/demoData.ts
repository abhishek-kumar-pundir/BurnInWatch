/**
 * BurnInWatch 3D Digital Twin — Scripted Demonstration Data & Scenarios
 * 
 * HONESTY RULE:
 * This is an illustrative simulation for presentation and demonstration purposes.
 * Values are scripted to depict canonical degradation scenarios of an IGBT module
 * during accelerated burn-in testing.
 */

export interface SensorValues {
  supplyVoltage: number;          // V
  node1Voltage: number;           // V
  node2Voltage: number;           // V
  node_voltage_drop: number;      // V (node1 - node2)
  collectorEmitterCurrent: number;// A
  internalTemperature: number;    // °C (die/junction)
  packageTemperature: number;     // °C (casing)
  heatSinkTemperature: number;    // °C (cold plate / fins)
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
    relatedSensor: 'internalTemperature',
    sensorLabel: 'internalTemperature',
    failureMode: 'Localized junction runaway, gate oxide breakdown, latch-up.',
  },
  die_diode: {
    id: 'die_diode',
    name: 'Freewheeling Diode (FWD) Die',
    role: 'Protects switching die by providing safe inductive recirculation during switch-off.',
    relatedSensor: 'internalTemperature',
    sensorLabel: 'internalTemperature',
    failureMode: 'Reverse recovery stress, forward voltage drop drift.',
  },
  bond_wire_0: {
    id: 'bond_wire_0',
    name: 'Gate Bond Wire (Wire 1)',
    role: 'Transmits gate switching pulse from control terminal to the IGBT gate contact pad.',
    relatedSensor: 'node1Voltage',
    sensorLabel: 'node1Voltage',
    failureMode: 'Gate wire heel cracking, parasitic oscillation.',
  },
  bond_wire_1: {
    id: 'bond_wire_1',
    name: 'Main Emitter Bond Wire A (Wire 2)',
    role: 'High-current interconnect carrying primary power from terminal to silicon die.',
    relatedSensor: 'collectorEmitterCurrent',
    sensorLabel: 'collectorEmitterCurrent',
    failureMode: 'Electromigration, thermal cycling fatigue.',
  },
  bond_wire_2: {
    id: 'bond_wire_2',
    name: 'Main Emitter Bond Wire B (Wire 3 — Fault Susceptible)',
    role: 'High-current interconnect subject to repetitive CTE thermal expansion mismatch.',
    relatedSensor: 'collectorEmitterCurrent',
    sensorLabel: 'collectorEmitterCurrent',
    failureMode: 'Thermal fatigue heel-cracking, bond wire lift-off.',
  },
  bond_wire_3: {
    id: 'bond_wire_3',
    name: 'Main Emitter Bond Wire C (Wire 4)',
    role: 'Parallel current share path to maintain uniform current density across the die.',
    relatedSensor: 'collectorEmitterCurrent',
    sensorLabel: 'collectorEmitterCurrent',
    failureMode: 'Current crowding overload following adjacent wire failure.',
  },
  bond_wire_4: {
    id: 'bond_wire_4',
    name: 'Diode Anode Bond Wire (Wire 5)',
    role: 'Interconnect routing inductive discharge current into the freewheeling diode.',
    relatedSensor: 'node2Voltage',
    sensorLabel: 'node2Voltage',
    failureMode: 'Thermal cycling stress, bond lift.',
  },
  dbc_substrate: {
    id: 'dbc_substrate',
    name: 'Direct Bonded Copper (DBC) Ceramic Substrate',
    role: 'Provides electrical isolation between high-voltage silicon and baseplate while conducting heat.',
    relatedSensor: 'packageTemperature',
    sensorLabel: 'packageTemperature',
    failureMode: 'Solder voiding, ceramic substrate cracking, copper delamination.',
  },
  baseplate: {
    id: 'baseplate',
    name: 'Heavy Copper Baseplate',
    role: 'Mechanical structural foundation spreading heat horizontally from the DBC substrate.',
    relatedSensor: 'packageTemperature',
    sensorLabel: 'packageTemperature',
    failureMode: 'Baseplate warpage, thermal interface degradation.',
  },
  heatsink: {
    id: 'heatsink',
    name: 'Aluminum Cold Plate & Dissipation Fins',
    role: 'Dissipates multi-kilowatt thermal loads into the forced-air or liquid coolant stream.',
    relatedSensor: 'heatSinkTemperature',
    sensorLabel: 'heatSinkTemperature',
    failureMode: 'Finned channel blockage, thermal paste pump-out / dry-out.',
  },
  casing: {
    id: 'casing',
    name: 'Protective Molded Epoxy Housing',
    role: 'Hermetically encapsulates silicon components and silicone gel against moisture and debris.',
    relatedSensor: 'packageTemperature',
    sensorLabel: 'packageTemperature',
    failureMode: 'High-temperature plastic embrittlement, seal rupture.',
  },
  terminals: {
    id: 'terminals',
    name: 'Screw & Kelvin Power Terminals',
    role: 'External electrical interface for DC bus voltage and gate drive instrumentation.',
    relatedSensor: 'nodeVoltages',
    sensorLabel: 'node1Voltage / node2Voltage',
    failureMode: 'Contact fretting corrosion, screw torque relaxation.',
  },
  clamps: {
    id: 'clamps',
    name: 'Pneumatic Fixture Clamps',
    role: 'Applies calibrated mechanical pressure to guarantee uniform thermal interface resistance.',
    relatedSensor: 'none',
    sensorLabel: 'Test Fixture Pressure',
    failureMode: 'Pneumatic cylinder pressure loss, uneven clamping.',
  },
  probes: {
    id: 'probes',
    name: 'Overhead Kelvin Contact Probes',
    role: 'Four-point electrical Kelvin sensing to measure microvolt drops without lead resistance.',
    relatedSensor: 'nodeVoltages',
    sensorLabel: 'node1Voltage / node2Voltage',
    failureMode: 'Probe tip oxidation, mechanical spring fatigue.',
  },
};

export const DEMO_DATA = {
  disclaimer: "Illustrative simulation — values are scripted for demonstration",
  manualHonestyLabel: "Illustrative scoring — not the trained models (single-point slider inputs do not constitute a 100-sample temporal window with 20 engineered features)",

  // Baseline distribution parameters from real NASA aging dataset (sample_burnin_device4_main.csv p01-p99)
  baselineStats: {
    supplyVoltage: { mean: 4.49, std: 0.99, min: 2.45, max: 5.43, unit: 'V' },
    node1Voltage: { mean: 4.49, std: 0.99, min: 2.45, max: 5.43, unit: 'V' },
    node2Voltage: { mean: 4.16, std: 1.01, min: 1.94, max: 5.43, unit: 'V' },
    collectorEmitterCurrent: { mean: 0.106, std: 0.040, min: 0.04, max: 0.20, unit: 'A' },
    internalTemperature: { mean: 45.0, std: 15.0, min: 25.0, max: 175.0, unit: '°C' },
    packageTemperature: { mean: 214.3, std: 60.9, min: 37.0, max: 266.0, unit: '°C' },
    heatSinkTemperature: { mean: 50.0, std: 12.0, min: 25.0, max: 120.0, unit: '°C' },
  },

  // Manual Mode Presets based on real dataset statistics
  presets: {
    normal: {
      name: 'Normal Operation',
      values: {
        supplyVoltage: 4.5,
        node1Voltage: 4.5,
        node2Voltage: 4.2,
        collectorEmitterCurrent: 0.10,
        internalTemperature: 45.0,
        packageTemperature: 75.0,
        heatSinkTemperature: 32.0,
      },
      faultWireIndex: -1,
      solderDelamination: false,
    },
    overstress: {
      name: 'Current Overstress',
      values: {
        supplyVoltage: 5.4,
        node1Voltage: 5.3,
        node2Voltage: 3.2,
        collectorEmitterCurrent: 0.20,
        internalTemperature: 165.0,
        packageTemperature: 250.0,
        heatSinkTemperature: 95.0,
      },
      faultWireIndex: 2, // Wire #3
      solderDelamination: false,
    },
    coolingFailure: {
      name: 'Thermal Dissipation Failure',
      values: {
        supplyVoltage: 4.5,
        node1Voltage: 4.4,
        node2Voltage: 4.0,
        collectorEmitterCurrent: 0.12,
        internalTemperature: 150.0,
        packageTemperature: 240.0,
        heatSinkTemperature: 115.0,
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

  thresholds: {
    isolationForest: 0.35,
    autoencoder: 0.08,
  },

  slidingWindow: {
    size: 100,
    stride: 25,
    startWindow: 128,
    endWindow: 134,
  },

  // 4 Curated Presentation Scenarios
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
          supplyVoltage: 15.0,
          node1Voltage: 12.4,
          node2Voltage: 10.8,
          node_voltage_drop: 1.6,
          collectorEmitterCurrent: 38.5,
          internalTemperature: 42.1,
          packageTemperature: 38.4,
          heatSinkTemperature: 32.0,
        },
        stressed: {
          supplyVoltage: 15.0,
          node1Voltage: 12.2,
          node2Voltage: 10.3,
          node_voltage_drop: 1.9,
          collectorEmitterCurrent: 52.0,
          internalTemperature: 76.0,
          packageTemperature: 64.0,
          heatSinkTemperature: 50.0,
        },
        final: {
          supplyVoltage: 15.0,
          node1Voltage: 12.1,
          node2Voltage: 10.1,
          node_voltage_drop: 2.0,
          collectorEmitterCurrent: 54.0,
          internalTemperature: 79.5,
          packageTemperature: 66.8,
          heatSinkTemperature: 52.4,
        },
      },
      models: {
        ifFlagTime: null,
        aeFlagTime: null,
        ifFinalScore: 0.22, // Well below 0.35
        aeFinalLoss: 0.045,  // Well below 0.08
        reviewTime: null,
        anomalyTime: null,
      },
      xai: {
        title: "Quality Verification Passed",
        leadFeature: "Nominal Conduction & Stable Thermal Gradient",
        lines: [
          "Δ Package Temp: +8.4 °C (Within ±15% nominal band)",
          "Node Voltage Drop: 2.0 V (Zero baseline deviation)",
          "100/25 Screening Result: 100% Windows Confirmed NORMAL",
        ],
      },
    } as ScenarioConfig,

    fatigue: {
      id: 'fatigue',
      name: 'Bond-Wire Fatigue',
      tagline: 'Micro-crack on emitter wire leading to thermal runaway',
      description: 'Repeated thermal cycling cracks emitter bond wire #3. Constricted current creates a localized hotspot; Isolation Forest flags first, followed by Autoencoder consensus.',
      hasCrack: true,
      crackedWireIndex: 2,
      hasHotspot: true,
      coolingDegraded: false,
      sensors: {
        nominal: {
          supplyVoltage: 15.0,
          node1Voltage: 12.4,
          node2Voltage: 10.8,
          node_voltage_drop: 1.6,
          collectorEmitterCurrent: 38.5,
          internalTemperature: 42.1,
          packageTemperature: 38.4,
          heatSinkTemperature: 32.0,
        },
        stressed: {
          supplyVoltage: 15.0,
          node1Voltage: 12.1,
          node2Voltage: 9.9,
          node_voltage_drop: 2.2,
          collectorEmitterCurrent: 55.0,
          internalTemperature: 88.5,
          packageTemperature: 74.2,
          heatSinkTemperature: 58.6,
        },
        final: {
          supplyVoltage: 15.1,
          node1Voltage: 11.5,
          node2Voltage: 7.2,
          node_voltage_drop: 4.3,
          collectorEmitterCurrent: 68.2,
          internalTemperature: 148.7,
          packageTemperature: 112.4,
          heatSinkTemperature: 82.1,
        },
      },
      models: {
        ifFlagTime: 24.5,
        aeFlagTime: 27.0,
        ifFinalScore: 0.62,
        aeFinalLoss: 0.28,
        reviewTime: 24.5,
        anomalyTime: 27.0,
      },
      xai: {
        title: "XAI Root Cause Attribution",
        leadFeature: "Collector-Emitter Voltage Drop & Junction Hotspot",
        lines: [
          "Δ Package Temp: +38.2 °C (+51.5% vs baseline)",
          "Node Voltage Drop: 4.3 V (Exceeds 3.5σ reference threshold)",
          "Anomaly Episode #1: Windows 128 – 134 confirmed",
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
          supplyVoltage: 15.0,
          node1Voltage: 12.4,
          node2Voltage: 10.8,
          node_voltage_drop: 1.6,
          collectorEmitterCurrent: 38.5,
          internalTemperature: 42.1,
          packageTemperature: 38.4,
          heatSinkTemperature: 32.0,
        },
        stressed: {
          supplyVoltage: 15.0,
          node1Voltage: 12.2,
          node2Voltage: 10.0,
          node_voltage_drop: 2.2,
          collectorEmitterCurrent: 48.0,
          internalTemperature: 68.0,
          packageTemperature: 58.0,
          heatSinkTemperature: 44.0,
        },
        final: {
          supplyVoltage: 15.0,
          node1Voltage: 11.8,
          node2Voltage: 9.0,
          node_voltage_drop: 2.8,
          collectorEmitterCurrent: 51.5,
          internalTemperature: 74.5,
          packageTemperature: 64.0,
          heatSinkTemperature: 48.0,
        },
      },
      models: {
        ifFlagTime: 25.0,
        aeFlagTime: null, // Never flags
        ifFinalScore: 0.44, // Breaches 0.35
        aeFinalLoss: 0.062, // Below 0.08
        reviewTime: 25.0,
        anomalyTime: null,  // Stays REVIEW
      },
      xai: {
        title: "Engineering Review Recommended",
        leadFeature: "Subtle Node 2 Voltage Contact Resistance Drift",
        lines: [
          "Isolation Forest flagged atypical terminal voltage drop",
          "Autoencoder reconstruction loss: 0.062 (Within 0.08 tolerance)",
          "Recommended Action: Retest contact torque before deployment",
        ],
      },
    } as ScenarioConfig,

    cooling: {
      id: 'cooling',
      name: 'Cooling Degradation',
      tagline: 'Thermal interface grease dry-out / fin blockage',
      description: 'Thermal resistance spikes between baseplate and heatsink. Heat visibly pools in the module, driving packageTemperature high and triggering dual-model thermal anomaly.',
      hasCrack: false,
      hasHotspot: false,
      coolingDegraded: true,
      sensors: {
        nominal: {
          supplyVoltage: 15.0,
          node1Voltage: 12.4,
          node2Voltage: 10.8,
          node_voltage_drop: 1.6,
          collectorEmitterCurrent: 38.5,
          internalTemperature: 42.1,
          packageTemperature: 38.4,
          heatSinkTemperature: 32.0,
        },
        stressed: {
          supplyVoltage: 15.0,
          node1Voltage: 12.2,
          node2Voltage: 10.2,
          node_voltage_drop: 2.0,
          collectorEmitterCurrent: 46.0,
          internalTemperature: 98.0,
          packageTemperature: 92.0,
          heatSinkTemperature: 78.0,
        },
        final: {
          supplyVoltage: 15.0,
          node1Voltage: 11.9,
          node2Voltage: 9.8,
          node_voltage_drop: 2.1,
          collectorEmitterCurrent: 48.0,
          internalTemperature: 134.0,
          packageTemperature: 124.0,
          heatSinkTemperature: 102.0,
        },
      },
      models: {
        ifFlagTime: 24.0,
        aeFlagTime: 26.5,
        ifFinalScore: 0.58,
        aeFinalLoss: 0.22,
        reviewTime: 24.0,
        anomalyTime: 26.5,
      },
      xai: {
        title: "Thermal Interface Runaway",
        leadFeature: "Heatsink Thermal Dissipation Bottleneck",
        lines: [
          "Package Temp: 124.0 °C (Exceeds 85 °C burn-in thermal limit)",
          "Thermal Resistance Ratio: Spiked +112% above nominal",
          "Consensus: ANOMALY confirmed across thermal monitoring windows",
        ],
      },
    } as ScenarioConfig,
  },
};

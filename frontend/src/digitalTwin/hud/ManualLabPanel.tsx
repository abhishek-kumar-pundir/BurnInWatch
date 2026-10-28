import React from 'react';
import { DEMO_DATA, SensorValues } from '../demoData';
import { DerivedMetrics } from '../illustrativeScoring';
import { DATASET_STATS } from '../data/datasetStats';
import { SlidersIcon, AlertTriangleIcon, ReplayIcon, SparklesIcon } from '../icons';

interface ManualLabPanelProps {
  sensors: SensorValues;
  derived: DerivedMetrics;
  faultWireIndex: number; // -1 if none, 0-4
  solderDelamination: boolean;
  onUpdateSensor: (key: keyof SensorValues, val: number) => void;
  onToggleWireFault: (wireIdx: number) => void;
  onToggleDelamination: (val: boolean) => void;
  onApplyPreset: (presetKey: 'normal' | 'overstress' | 'coolingFailure') => void;
  onResetBaseline: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const ManualLabPanel: React.FC<ManualLabPanelProps> = ({
  sensors,
  derived,
  faultWireIndex,
  solderDelamination,
  onUpdateSensor,
  onToggleWireFault,
  onToggleDelamination,
  onApplyPreset,
  onResetBaseline,
  isCollapsed,
  onToggleCollapse,
}) => {
  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-md border shadow-sm text-xs font-semibold bg-white text-slate-800 border-slate-300 hover:bg-slate-50 transition-colors"
      >
        <SlidersIcon size={14} />
        <span>Open manual controls</span>
      </button>
    );
  }

  return (
    <div className="pointer-events-auto w-84 rounded-md border p-3.5 shadow-sm bg-white border-slate-200 flex flex-col gap-3 max-h-[calc(100vh-140px)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-slate-100 text-slate-700">
            <SlidersIcon size={14} />
          </span>
          <div>
            <h3 className="text-xs font-semibold text-slate-900">
              Manual stress lab
            </h3>
            <span className="text-[11px] text-slate-500">
              Interactive signal inputs
            </span>
          </div>
        </div>

        <button
          onClick={onToggleCollapse}
          className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          Hide
        </button>
      </div>

      {/* Honest disclaimer notice */}
      <div className="p-2 rounded bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-1.5 leading-normal">
        <SparklesIcon size={14} className="shrink-0 mt-0.5 text-slate-500" />
        <span>{DEMO_DATA.manualHonestyLabel}</span>
      </div>

      {/* Quick Presets */}
      <div>
        <div className="text-xs font-medium text-slate-500 mb-1.5">
          Preset scenarios
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onApplyPreset('normal')}
            className="py-1 px-2 rounded border text-xs font-medium bg-slate-50 hover:bg-slate-100 transition-colors text-slate-800 border-slate-200 text-center"
          >
            Nominal
          </button>
          <button
            onClick={() => onApplyPreset('overstress')}
            className="py-1 px-2 rounded border text-xs font-medium bg-slate-50 hover:bg-slate-100 transition-colors text-slate-800 border-slate-200 text-center"
          >
            Overstress
          </button>
          <button
            onClick={() => onApplyPreset('coolingFailure')}
            className="py-1 px-2 rounded border text-xs font-medium bg-slate-50 hover:bg-slate-100 transition-colors text-slate-800 border-slate-200 text-center"
          >
            Temp Drift
          </button>
        </div>
      </div>

      {/* Sliders for Primary Signals (Active Model Inputs) */}
      <div className="space-y-2.5">
        <div className="text-xs font-medium text-slate-500">
          Model-Monitored Telemetry Sliders
        </div>

        {/* collectorEmitterCurrent */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600">Collector current (ICE)</span>
            <span className="font-semibold tabular-nums text-slate-900">
              {sensors.collectorEmitterCurrent.toFixed(3)} A
            </span>
          </div>
          <input
            type="range"
            min={0.02}
            max={0.35}
            step={0.005}
            value={sensors.collectorEmitterCurrent}
            onChange={(e) =>
              onUpdateSensor('collectorEmitterCurrent', parseFloat(e.target.value))
            }
            className="w-full accent-slate-700 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>p01: {DATASET_STATS.collectorEmitterCurrent.p01} A</span>
            <span>median: {DATASET_STATS.collectorEmitterCurrent.median} A</span>
            <span>p99: {DATASET_STATS.collectorEmitterCurrent.p99} A</span>
          </div>
        </div>

        {/* packageTemperature */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600">Package temperature</span>
            <span className="font-semibold tabular-nums text-slate-900">
              {sensors.packageTemperature.toFixed(1)} {DATASET_STATS.packageTemperature.unitLabel}
            </span>
          </div>
          <input
            type="range"
            min={30}
            max={300}
            step={1}
            value={sensors.packageTemperature}
            onChange={(e) =>
              onUpdateSensor('packageTemperature', parseFloat(e.target.value))
            }
            className="w-full accent-slate-700 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>p01: {DATASET_STATS.packageTemperature.p01.toFixed(0)}</span>
            <span>median: {DATASET_STATS.packageTemperature.median.toFixed(0)}</span>
            <span>p99: {DATASET_STATS.packageTemperature.p99.toFixed(0)}</span>
          </div>
        </div>

        {/* node1Voltage & node2Voltage */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-slate-600">Node 1</span>
              <span className="font-semibold tabular-nums">{sensors.node1Voltage.toFixed(2)} V</span>
            </div>
            <input
              type="range"
              min={2.0}
              max={6.2}
              step={0.05}
              value={sensors.node1Voltage}
              onChange={(e) =>
                onUpdateSensor('node1Voltage', parseFloat(e.target.value))
              }
              className="w-full accent-slate-700 cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-slate-600">Node 2</span>
              <span className="font-semibold tabular-nums">{sensors.node2Voltage.toFixed(2)} V</span>
            </div>
            <input
              type="range"
              min={1.5}
              max={6.0}
              step={0.05}
              value={sensors.node2Voltage}
              onChange={(e) =>
                onUpdateSensor('node2Voltage', parseFloat(e.target.value))
              }
              className="w-full accent-slate-700 cursor-pointer"
            />
          </div>
        </div>

        {/* supplyVoltage */}
        <div>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-slate-600">Supply voltage</span>
            <span className="font-semibold tabular-nums">{sensors.supplyVoltage.toFixed(2)} V</span>
          </div>
          <input
            type="range"
            min={2.0}
            max={6.5}
            step={0.05}
            value={sensors.supplyVoltage}
            onChange={(e) =>
              onUpdateSensor('supplyVoltage', parseFloat(e.target.value))
            }
            className="w-full accent-slate-700 cursor-pointer"
          />
        </div>
      </div>

      {/* Uncalibrated Signals: Read-only info card */}
      <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-xs space-y-1">
        <div className="font-semibold text-slate-700">Uncalibrated Sensors (Read-only)</div>
        <div className="flex justify-between text-slate-600">
          <span>Heat sink sensor:</span>
          <span className="font-mono tabular-nums">{sensors.heatSinkTemperature.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Internal sensor:</span>
          <span className="font-mono tabular-nums">{sensors.internalTemperature.toFixed(2)}</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1 italic">
          Not used by the models (raw ADC counts, no physical calibration recorded).
        </div>
      </div>

      {/* Fault Injection Toggles */}
      <div className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-2">
        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <AlertTriangleIcon size={13} className="text-amber-600" />
          Physical fault injection
        </div>

        {/* Wire Crack Selector */}
        <div>
          <div className="text-xs text-slate-600 mb-1">
            Emitter bond-wire crack:
          </div>
          <div className="grid grid-cols-6 gap-1 text-xs text-center">
            <button
              onClick={() => onToggleWireFault(-1)}
              className={`py-1 rounded border font-medium ${
                faultWireIndex === -1 ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              Off
            </button>
            {[0, 1, 2, 3, 4].map((idx) => (
              <button
                key={idx}
                onClick={() => onToggleWireFault(idx)}
                className={`py-1 rounded border font-medium ${
                  faultWireIndex === idx
                    ? 'bg-red-700 text-white border-red-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                W{idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Solder delamination */}
        <label className="flex items-center gap-2 cursor-pointer pt-0.5">
          <input
            type="checkbox"
            checked={solderDelamination}
            onChange={(e) => onToggleDelamination(e.target.checked)}
            className="size-3.5 accent-red-700 rounded"
          />
          <span className="text-xs text-slate-700">
            DBC solder delamination
          </span>
        </label>
      </div>

      {/* Live Derived Physical Metrics */}
      <div className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
        <div className="text-xs font-semibold text-slate-700 mb-1">
          Derived engineering features
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Voltage drop (ΔV):</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {derived.node_voltage_drop.toFixed(2)} V
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Power proxy:</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {derived.power_proxy.toFixed(3)} W
          </span>
        </div>
      </div>

      {/* Reset button */}
      <button
        onClick={onResetBaseline}
        className="w-full flex items-center justify-center gap-2 py-1.5 rounded border text-xs font-medium text-slate-700 bg-slate-50 border-slate-200 hover:bg-slate-100 transition-colors"
      >
        <ReplayIcon size={14} />
        Reset to baseline
      </button>
    </div>
  );
};

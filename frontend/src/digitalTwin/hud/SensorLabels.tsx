import React from 'react';
import { SensorValues } from '../demoData';
import { THEME } from '../theme';
import { DATASET_STATS } from '../data/datasetStats';

interface SensorLabelsProps {
  stageId: number;
  sensorValues: SensorValues;
  isManual?: boolean;
}

export const SensorLabels: React.FC<SensorLabelsProps> = ({
  stageId,
  sensorValues,
  isManual = false,
}) => {
  // Show in Stages 3 & 4 (or always in manual mode)
  const isTelemetryVisible = isManual || stageId === 3 || stageId === 4;

  if (!isTelemetryVisible) return null;

  return (
    <div className="pointer-events-auto">
      <div
        className="rounded-md p-3 border shadow-sm max-w-sm w-84 bg-white"
        style={{
          borderColor: THEME.ui.border,
        }}
      >
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200">
          <span className="text-xs font-semibold text-slate-900">
            Sensor telemetry
          </span>
          <span className="text-[11px] tabular-nums text-slate-500">
            100-sample window
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Package Temperature */}
          <div
            className="flex flex-col py-1.5 px-2 rounded bg-slate-50 border border-slate-200 col-span-2"
            title="Color shows package temperature relative to the observed range"
          >
            <div className="flex justify-between items-center">
              <span className="text-slate-700 font-medium">Package temperature</span>
              <span
                className="font-semibold tabular-nums"
                style={{
                  color:
                    sensorValues.packageTemperature > 275
                      ? THEME.status.anomaly.solid
                      : sensorValues.packageTemperature > 265
                      ? THEME.status.review.solid
                      : THEME.status.normal.solid,
                }}
              >
                {sensorValues.packageTemperature.toFixed(1)} {DATASET_STATS.packageTemperature.unitLabel}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">
              Observed dataset range: 26.96 – 281.80
            </span>
          </div>

          {/* ICE Current */}
          <div className="flex justify-between items-center py-1.5 px-2 rounded bg-slate-50 border border-slate-200 col-span-2">
            <span className="text-slate-600">Collector current (ICE)</span>
            <span
              className="font-semibold tabular-nums"
              style={{
                color:
                  sensorValues.collectorEmitterCurrent > 0.16
                    ? THEME.status.anomaly.solid
                    : sensorValues.collectorEmitterCurrent > 0.12
                    ? THEME.status.review.solid
                    : THEME.status.normal.solid,
              }}
            >
              {sensorValues.collectorEmitterCurrent.toFixed(3)} A
            </span>
          </div>

          {/* Node 1 Voltage */}
          <div className="flex justify-between items-center py-1.5 px-2 rounded bg-slate-50 border border-slate-200">
            <span className="text-slate-600">Node 1</span>
            <span className="font-semibold tabular-nums text-slate-900">
              {sensorValues.node1Voltage.toFixed(2)} V
            </span>
          </div>

          {/* Node 2 Voltage */}
          <div className="flex justify-between items-center py-1.5 px-2 rounded bg-slate-50 border border-slate-200">
            <span className="text-slate-600">Node 2</span>
            <span className="font-semibold tabular-nums text-slate-900">
              {sensorValues.node2Voltage.toFixed(2)} V
            </span>
          </div>

          {/* Voltage Drop ΔV */}
          <div className="flex justify-between items-center py-1.5 px-2 rounded bg-slate-100 border border-slate-300 col-span-2">
            <span className="font-medium text-slate-700">Voltage drop (ΔV)</span>
            <span
              className="font-semibold tabular-nums"
              style={{
                color:
                  sensorValues.node_voltage_drop > 1.8
                    ? THEME.status.anomaly.solid
                    : sensorValues.node_voltage_drop > 0.8
                    ? THEME.status.review.solid
                    : THEME.status.normal.solid,
              }}
            >
              {sensorValues.node_voltage_drop.toFixed(2)} V
            </span>
          </div>

          {/* Internal & Heatsink Temperature: Uncalibrated read-only */}
          <div className="col-span-2 pt-1 border-t border-slate-100 flex flex-col gap-1 text-[11px] text-slate-500">
            <div className="flex justify-between">
              <span>Heat sink sensor:</span>
              <span className="tabular-nums font-mono">{sensorValues.heatSinkTemperature.toFixed(2)} (raw ADC)</span>
            </div>
            <div className="flex justify-between">
              <span>Internal sensor:</span>
              <span className="tabular-nums font-mono">{sensorValues.internalTemperature.toFixed(2)} (raw ADC)</span>
            </div>
            <span className="text-[10px] text-slate-400 italic">
              Note: Uncalibrated sensor units; not used by the ML screening models.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

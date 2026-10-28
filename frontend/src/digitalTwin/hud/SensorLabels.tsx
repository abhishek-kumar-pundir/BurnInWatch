import React from 'react';
import { SensorValues } from '../demoData';
import { THEME } from '../theme';

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
        className="rounded-md p-3 border shadow-sm max-w-sm w-80 bg-white"
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
          {/* Internal Temperature */}
          <div className="flex justify-between items-center py-1.5 px-2 rounded bg-slate-50 border border-slate-200">
            <span className="text-slate-600">Junction temp</span>
            <span
              className="font-semibold tabular-nums"
              style={{
                color:
                  sensorValues.internalTemperature > 110
                    ? THEME.status.anomaly.solid
                    : sensorValues.internalTemperature > 75
                    ? THEME.status.review.solid
                    : THEME.status.normal.solid,
              }}
            >
              {sensorValues.internalTemperature.toFixed(1)}°C
            </span>
          </div>

          {/* Package Temperature */}
          <div className="flex justify-between items-center py-1.5 px-2 rounded bg-slate-50 border border-slate-200">
            <span className="text-slate-600">Package temp</span>
            <span
              className="font-semibold tabular-nums"
              style={{
                color:
                  sensorValues.packageTemperature > 90
                    ? THEME.status.anomaly.solid
                    : sensorValues.packageTemperature > 60
                    ? THEME.status.review.solid
                    : THEME.status.normal.solid,
              }}
            >
              {sensorValues.packageTemperature.toFixed(1)}°C
            </span>
          </div>

          {/* Heatsink Temperature */}
          <div className="flex justify-between items-center py-1.5 px-2 rounded bg-slate-50 border border-slate-200">
            <span className="text-slate-600">Heatsink temp</span>
            <span
              className="font-semibold tabular-nums"
              style={{
                color:
                  sensorValues.heatSinkTemperature > 80
                    ? THEME.status.anomaly.solid
                    : THEME.ui.ink,
              }}
            >
              {sensorValues.heatSinkTemperature.toFixed(1)}°C
            </span>
          </div>

          {/* ICE Current */}
          <div className="flex justify-between items-center py-1.5 px-2 rounded bg-slate-50 border border-slate-200">
            <span className="text-slate-600">ICE current</span>
            <span
              className="font-semibold tabular-nums"
              style={{
                color:
                  sensorValues.collectorEmitterCurrent > 60
                    ? THEME.status.anomaly.solid
                    : sensorValues.collectorEmitterCurrent > 50
                    ? THEME.status.review.solid
                    : THEME.status.normal.solid,
              }}
            >
              {sensorValues.collectorEmitterCurrent.toFixed(1)} A
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
                  sensorValues.node_voltage_drop > 3.0
                    ? THEME.status.anomaly.solid
                    : sensorValues.node_voltage_drop > 2.2
                    ? THEME.status.review.solid
                    : THEME.status.normal.solid,
              }}
            >
              {sensorValues.node_voltage_drop.toFixed(2)} V
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

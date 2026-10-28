import React from 'react';
import { PART_CATALOG, SensorValues } from '../demoData';
import { THEME } from '../theme';
import { CloseIcon, ChipIcon } from '../icons';

interface PartInfoCardProps {
  selectedPartId: string | null;
  sensorValues: SensorValues;
  onClose: () => void;
  isManual?: boolean;
  onToggleWireFault?: (wireIndex: number) => void;
}

export const PartInfoCard: React.FC<PartInfoCardProps> = ({
  selectedPartId,
  sensorValues,
  onClose,
  isManual = false,
  onToggleWireFault,
}) => {
  if (!selectedPartId) return null;

  const part = PART_CATALOG[selectedPartId];
  if (!part) return null;

  let currentValueText: string | null = null;
  if (part.relatedSensor !== 'none' && part.relatedSensor !== 'nodeVoltages') {
    const val = sensorValues[part.relatedSensor as keyof SensorValues];
    if (typeof val === 'number') {
      const unit = part.relatedSensor.includes('Temp')
        ? '°C'
        : part.relatedSensor.includes('Current')
        ? 'A'
        : 'V';
      currentValueText = `${val.toFixed(2)} ${unit}`;
    }
  } else if (part.relatedSensor === 'nodeVoltages') {
    currentValueText = `${sensorValues.node1Voltage.toFixed(2)} V / ${sensorValues.node2Voltage.toFixed(2)} V (drop: ${sensorValues.node_voltage_drop.toFixed(2)} V)`;
  }

  const isWire = part.id.startsWith('bond_wire_');
  const wireIndex = isWire ? parseInt(part.id.replace('bond_wire_', ''), 10) : -1;

  return (
    <div
      className="w-full rounded-md border p-3.5 shadow-sm transition-all"
      style={{
        backgroundColor: THEME.ui.surface,
        borderColor: THEME.ui.border,
      }}
    >
      <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b border-slate-200">
        <div className="flex items-center gap-2 min-w-0">
          <span className="p-1 rounded bg-slate-100 text-slate-700 shrink-0">
            <ChipIcon size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-xs text-slate-500 font-medium">
              Component inspection
            </div>
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {part.name}
            </h3>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Close component info"
        >
          <CloseIcon size={14} />
        </button>
      </div>

      <div className="space-y-2 text-xs leading-normal">
        <div>
          <span className="font-semibold text-slate-700">Role: </span>
          <span className="text-slate-600 break-words">{part.role}</span>
        </div>

        {currentValueText && (
          <div className="p-2 rounded bg-slate-50 border border-slate-200 flex justify-between items-center">
            <span className="text-slate-600 font-medium">Reading ({part.sensorLabel}):</span>
            <span className="font-mono font-semibold tabular-nums text-slate-900">
              {currentValueText}
            </span>
          </div>
        )}

        <div>
          <span className="font-semibold text-slate-700">Failure mode: </span>
          <span className="text-slate-600 break-words">{part.failureMode}</span>
        </div>

        {isManual && isWire && onToggleWireFault && (
          <button
            onClick={() => onToggleWireFault(wireIndex)}
            className="w-full mt-1.5 py-1.5 px-3 rounded border text-xs font-semibold text-red-700 bg-red-50 border-red-200 hover:bg-red-100 transition-colors"
          >
            Toggle crack on wire #{wireIndex + 1}
          </button>
        )}
      </div>
    </div>
  );
};

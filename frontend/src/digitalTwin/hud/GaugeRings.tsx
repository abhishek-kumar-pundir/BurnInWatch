import React from 'react';
import { ModelTelemetry } from '../demoData';
import { THEME } from '../theme';
import { MODEL_THRESHOLDS } from '../data/datasetStats';

interface GaugeRingsProps {
  telemetry: ModelTelemetry;
  visible: boolean;
}

export const GaugeRings: React.FC<GaugeRingsProps> = ({ telemetry, visible }) => {
  if (!visible) return null;

  const { ifScore, ifThreshold, ifFlagged, aeLoss, aeThreshold, aeFlagged } = telemetry;

  const radius = 30;
  const circ = 2 * Math.PI * radius;

  // Real observed scales (IF max ~0.175, AE max ~4.23)
  const ifMax = MODEL_THRESHOLDS.response_focused.maxObservedIF; // 0.175
  const aeMax = MODEL_THRESHOLDS.response_focused.maxObservedAE; // 4.23

  const ifPct = Math.min(Math.max(ifScore / ifMax, 0), 1);
  const ifOffset = circ * (1 - ifPct);

  // For AE, map power-scaled (or linear) so nominal range remains clearly legible
  const aePct = Math.min(Math.max(aeLoss / aeMax, 0), 1);
  const aeOffset = circ * (1 - aePct);

  // Position of threshold ticks along circumference
  const ifThreshPct = Math.min(Math.max(ifThreshold / ifMax, 0), 1);
  const aeThreshPct = Math.min(Math.max(aeThreshold / aeMax, 0), 1);

  return (
    <div className="grid grid-cols-2 gap-2.5 w-full pointer-events-auto">
      {/* Gauge 1: Isolation Forest */}
      <div
        className="flex flex-col items-center rounded-md p-3 border shadow-sm transition-all bg-white"
        style={{
          borderColor: ifFlagged ? THEME.status.review.border : THEME.ui.border,
        }}
      >
        <div className="text-xs font-semibold text-slate-700 mb-1 text-center truncate w-full">
          Isolation Forest
        </div>

        <div className="relative size-20 flex items-center justify-center my-1">
          <svg className="size-full -rotate-90" viewBox="0 0 80 80">
            {/* Background ring */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="#e2e8f0"
              strokeWidth="6"
              fill="none"
            />
            {/* Threshold marker ring arc */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="#cbd5e1"
              strokeWidth="6"
              fill="none"
              strokeDasharray={`${circ * ifThreshPct} ${circ * (1 - ifThreshPct)}`}
            />
            {/* Threshold Notch */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="#64748b"
              strokeWidth="7"
              fill="none"
              strokeDasharray={`2 ${circ - 2}`}
              strokeDashoffset={-circ * ifThreshPct}
            />
            {/* Active score ring */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke={ifFlagged ? THEME.status.review.solid : THEME.series.if}
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circ}
              strokeDashoffset={ifOffset}
              className="transition-all duration-150 ease-out"
            />
          </svg>

          {/* Center value */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-sm font-semibold tabular-nums text-slate-900"
              style={{
                color: ifFlagged ? THEME.status.review.solid : THEME.ui.ink,
              }}
            >
              {ifScore.toFixed(3)}
            </span>
            <span className="text-[9px] tabular-nums text-slate-500">
              limit {ifThreshold.toFixed(3)}
            </span>
          </div>
        </div>

        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded border mt-1"
          style={{
            backgroundColor: ifFlagged ? THEME.status.review.bg : THEME.ui.surfaceMuted,
            color: ifFlagged ? THEME.status.review.text : THEME.ui.inkMuted,
            borderColor: ifFlagged ? THEME.status.review.border : THEME.ui.border,
          }}
        >
          {ifFlagged ? 'Flagged' : 'Normal'}
        </span>
      </div>

      {/* Gauge 2: Autoencoder Reconstruction Error */}
      <div
        className="flex flex-col items-center rounded-md p-3 border shadow-sm transition-all bg-white"
        style={{
          borderColor: aeFlagged ? THEME.status.anomaly.border : THEME.ui.border,
        }}
      >
        <div className="text-xs font-semibold text-slate-700 mb-1 text-center truncate w-full">
          Autoencoder error
        </div>

        <div className="relative size-20 flex items-center justify-center my-1">
          <svg className="size-full -rotate-90" viewBox="0 0 80 80">
            {/* Background ring */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="#e2e8f0"
              strokeWidth="6"
              fill="none"
            />
            {/* Threshold marker ring arc */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="#cbd5e1"
              strokeWidth="6"
              fill="none"
              strokeDasharray={`${circ * aeThreshPct} ${circ * (1 - aeThreshPct)}`}
            />
            {/* Threshold Notch */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="#64748b"
              strokeWidth="7"
              fill="none"
              strokeDasharray={`2 ${circ - 2}`}
              strokeDashoffset={-circ * aeThreshPct}
            />
            {/* Active score ring */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke={aeFlagged ? THEME.status.anomaly.solid : THEME.series.ae}
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circ}
              strokeDashoffset={aeOffset}
              className="transition-all duration-150 ease-out"
            />
          </svg>

          {/* Center value */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-sm font-semibold tabular-nums text-slate-900"
              style={{
                color: aeFlagged ? THEME.status.anomaly.solid : THEME.ui.ink,
              }}
            >
              {aeLoss.toFixed(3)}
            </span>
            <span className="text-[9px] tabular-nums text-slate-500">
              limit {aeThreshold.toFixed(3)}
            </span>
          </div>
        </div>

        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded border mt-1"
          style={{
            backgroundColor: aeFlagged ? THEME.status.anomaly.bg : THEME.ui.surfaceMuted,
            color: aeFlagged ? THEME.status.anomaly.text : THEME.ui.inkMuted,
            borderColor: aeFlagged ? THEME.status.anomaly.border : THEME.ui.border,
          }}
        >
          {aeFlagged ? 'Flagged' : 'Normal'}
        </span>
      </div>
    </div>
  );
};

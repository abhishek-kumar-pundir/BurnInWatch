import React from 'react';
import { THEME } from '../theme';
import { AlertTriangleIcon, InfoIcon } from '../icons';

interface XaiCalloutProps {
  visible: boolean;
  title?: string;
  leadFeature?: string;
  lines?: string[];
  isManual?: boolean;
  disclaimer?: string;
}

export const XaiCallout: React.FC<XaiCalloutProps> = ({
  visible,
  title = 'Attribution summary',
  leadFeature = 'Voltage drop and internal temperature',
  lines = [
    'Package temperature deviation: +38.2 °C',
    'Collector-emitter voltage drop: 4.3 V',
    'Anomaly episode confirmed across windows 128 to 134',
  ],
  isManual = false,
  disclaimer,
}) => {
  if (!visible) return null;

  return (
    <div
      className="w-full rounded-md p-3 border shadow-sm transition-all"
      style={{
        backgroundColor: THEME.ui.surface,
        borderColor: isManual ? THEME.ui.border : THEME.status.anomaly.border,
      }}
    >
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-200">
        <span
          className="p-1 rounded shrink-0"
          style={{
            backgroundColor: isManual ? THEME.ui.accentSoft : THEME.status.anomaly.bg,
            color: isManual ? THEME.ui.accentStrong : THEME.status.anomaly.solid,
          }}
        >
          {isManual ? <InfoIcon size={14} /> : <AlertTriangleIcon size={14} />}
        </span>

        <div className="min-w-0">
          <div className="text-xs text-slate-500 font-medium">
            {isManual ? 'Signal ranking by deviation' : title}
          </div>
          <div className="text-xs font-semibold text-slate-900 truncate">
            {leadFeature}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 text-xs">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className="flex items-start gap-1.5 p-1.5 rounded bg-slate-50 border border-slate-200 text-slate-700"
          >
            <span
              className="font-bold shrink-0 mt-0.5"
              style={{
                color: isManual ? THEME.ui.accent : THEME.status.anomaly.solid,
              }}
            >
              •
            </span>
            <span className="leading-snug break-words">{line}</span>
          </div>
        ))}
      </div>

      {disclaimer && (
        <div className="mt-2.5 pt-2 border-t border-slate-200 text-[11px] text-amber-800 bg-amber-50/80 px-2 py-1.5 rounded border border-amber-200/60 leading-tight">
          {disclaimer}
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { THEME } from '../theme';
import { ShieldCheckIcon, AlertTriangleIcon, AlertOctagonIcon } from '../icons';

interface ConsensusBadgeProps {
  status: 'NORMAL' | 'REVIEW' | 'ANOMALY';
  windowIndex: number;
}

export const ConsensusBadge: React.FC<ConsensusBadgeProps> = ({ status, windowIndex }) => {
  const configs = {
    NORMAL: {
      label: 'Normal',
      subtitle: 'Both models within nominal boundaries',
      colors: THEME.status.normal,
      Icon: ShieldCheckIcon,
    },
    REVIEW: {
      label: 'Review',
      subtitle: 'One detection model flagged unusual behavior',
      colors: THEME.status.review,
      Icon: AlertTriangleIcon,
    },
    ANOMALY: {
      label: 'Anomaly',
      subtitle: 'Both models confirmed anomalous behavior',
      colors: THEME.status.anomaly,
      Icon: AlertOctagonIcon,
    },
  };

  const current = configs[status];
  const Icon = current.Icon;

  return (
    <div
      className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-md border shadow-sm transition-colors"
      style={{
        backgroundColor: current.colors.bg,
        borderColor: current.colors.border,
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="size-7 rounded flex items-center justify-center shrink-0 text-white"
          style={{ backgroundColor: current.colors.solid }}
        >
          <Icon size={16} />
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-semibold tracking-tight"
              style={{ color: current.colors.text }}
            >
              {current.label}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 bg-white/70 px-1.5 py-0.2 rounded border border-slate-200">
              window {windowIndex}
            </span>
          </div>
          <div className="text-xs text-slate-600 truncate mt-0.5">
            {current.subtitle}
          </div>
        </div>
      </div>
    </div>
  );
};

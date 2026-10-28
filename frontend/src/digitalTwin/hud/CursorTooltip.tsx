import React from 'react';
import { useHoverStore } from '../hoverStore';
import { PART_CATALOG } from '../demoData';
import { THEME } from '../theme';

export const CursorTooltip: React.FC = () => {
  const { id, x, y } = useHoverStore();

  if (!id) return null;

  const part = PART_CATALOG[id];
  const label = part ? part.name : id.replace(/_/g, ' ');

  return (
    <div
      className="fixed pointer-events-none z-50 px-2.5 py-1 rounded border shadow-sm text-xs font-medium transition-opacity animate-in fade-in duration-100"
      style={{
        left: Math.min(window.innerWidth - 180, x + 14),
        top: Math.min(window.innerHeight - 40, y + 14),
        backgroundColor: THEME.ui.surface,
        borderColor: THEME.ui.borderStrong,
        color: THEME.ui.ink,
        boxShadow: THEME.ui.shadowSm,
      }}
    >
      <span className="font-semibold text-slate-900">{label}</span>
      {part && part.sensorLabel && part.relatedSensor !== 'none' && (
        <span className="ml-1.5 text-[11px] text-slate-500">({part.sensorLabel})</span>
      )}
    </div>
  );
};

import React from 'react';
import { DEMO_DATA } from '../demoData';
import { StageId } from '../timeline';
import { THEME } from '../theme';

interface StageTitleProps {
  stageId: StageId;
  stageProgress: number;
}

export const StageTitle: React.FC<StageTitleProps> = ({ stageId, stageProgress }) => {
  const currentStage = DEMO_DATA.stages.find((s) => s.id === stageId) ?? DEMO_DATA.stages[0]!;

  return (
    <div className="pointer-events-none select-none max-w-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-slate-500">
          Stage {stageId} of 4
        </span>

        <div
          className="w-20 h-1.5 rounded-full overflow-hidden border border-slate-200"
          style={{ backgroundColor: THEME.ui.surfaceMuted }}
        >
          <div
            className="h-full transition-all duration-100 ease-out"
            style={{
              width: `${Math.round(stageProgress * 100)}%`,
              backgroundColor: THEME.ui.accent,
            }}
          />
        </div>
      </div>

      <h1 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight leading-snug">
        {currentStage.name}
      </h1>
      <p className="mt-0.5 text-xs text-slate-600 leading-normal">
        {currentStage.subtitle}
      </p>
    </div>
  );
};

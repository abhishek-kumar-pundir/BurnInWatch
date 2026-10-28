import React from 'react';
import { IconBase, IconProps } from './IconBase';

export const PlayIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
  </IconBase>
);

export const PauseIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
  </IconBase>
);

export const ReplayIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </IconBase>
);

export const FullscreenIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </IconBase>
);

export const MinimizeIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M4 14h6v6" />
    <path d="M20 10h-6V4" />
    <path d="M14 10l7-7" />
    <path d="M3 21l7-7" />
  </IconBase>
);

export const EyeIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </IconBase>
);

export const EyeOffIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </IconBase>
);

export const ResetViewIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M3 12h3m12 0h3M12 3v3m0 12v3" />
  </IconBase>
);

export const ChipIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 1v3m6-3v3M9 20v3m6-3v3M20 9h3m-3 6h3M1 9h3m-3 6h3" />
  </IconBase>
);

export const BondWireIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M4 18c2-8 6-12 10-12s5 3 6 8" />
    <circle cx="4" cy="18" r="1.5" fill="currentColor" />
    <circle cx="20" cy="14" r="1.5" fill="currentColor" />
  </IconBase>
);

export const ThermometerIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </IconBase>
);

export const VoltageBoltIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </IconBase>
);

export const CurrentFlowIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M2 12h20M17 7l5 5-5 5M7 17l-5-5 5-5" />
  </IconBase>
);

export const HeatsinkIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <rect x="3" y="18" width="18" height="3" rx="1" />
    <path d="M5 18V6m3.5 12V6M12 18V6m3.5 12V6M19 18V6" />
  </IconBase>
);

export const ScannerIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2M3 17v2a2 2 0 0 0 2 2h2m10 0h2a2 2 0 0 0 2-2v-2" />
    <line x1="2" y1="12" x2="22" y2="12" />
  </IconBase>
);

export const ShieldCheckIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </IconBase>
);

export const AlertTriangleIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </IconBase>
);

export const AlertOctagonIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </IconBase>
);

export const SlidersIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </IconBase>
);

// Scenario Icons
export const HealthyScenarioIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 5-5" />
  </IconBase>
);

export const FatigueScenarioIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M4 14c3-5 7-8 10-8s5 2 6 6" />
    <path d="M12 9l2 2-2 2" strokeWidth={2.5} />
  </IconBase>
);

export const DriftScenarioIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M3 18l6-6 4 4 8-8" />
    <path d="M17 8h4v4" />
  </IconBase>
);

export const CoolingFanScenarioIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 9C9 9 7 7 7 4c3 0 5 2 5 5zm0 6c3 0 5 2 5 5-3 0-5-2-5-5zm-3-3c0-3-2-5-5-5 0 3 2 5 5 5zm6 0c0 3 2 5 5 5 0-3-2-5-5-5z" />
  </IconBase>
);

export const HandCursorIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M18 11V6a2 2 0 0 0-4 0v5" />
    <path d="M14 10V4a2 2 0 0 0-4 0v7" />
    <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
    <path d="M6 14v1a7 7 0 0 0 14 0v-4a2 2 0 0 0-4 0" />
  </IconBase>
);

export const InfoIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </IconBase>
);

export const CloseIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </IconBase>
);

export const ArrowLeftIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </IconBase>
);

export const ChevronLeftIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <polyline points="15 18 9 12 15 6" />
  </IconBase>
);

export const ChevronRightIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <polyline points="9 18 15 12 9 6" />
  </IconBase>
);

export const SparklesIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="m12 3 1.9 4.8L18.7 9.7l-4.8 1.9L12 16.4l-1.9-4.8L5.3 9.7l4.8-1.9L12 3z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
  </IconBase>
);

export const DatabaseIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </IconBase>
);

export const FastForwardIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <polygon points="13 19 22 12 13 5 13 19" fill="currentColor" stroke="none" />
    <polygon points="2 19 11 12 2 5 2 19" fill="currentColor" stroke="none" />
  </IconBase>
);


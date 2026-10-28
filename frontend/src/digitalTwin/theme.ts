/**
 * BurnInWatch 3D Digital Twin — Theme & Design Tokens
 * 
 * Sourced directly from the main BurnInWatch frontend styling:
 * - Canvas: #f4f6f8 (soft off-white)
 * - Surfaces: #ffffff
 * - Borders: #dde2e8 (line), #c3cbd5 (line-strong)
 * - Inks: #17202b (ink), #556270 (ink-muted), #7b8794 (ink-faint)
 * - Accent: #1f5f8b (deep industrial blue), #e6f0f7 (accent-soft)
 * - Status Normal: #1d6b4a (soft: #e7f4ed, line: #a9d3bd)
 * - Status Review: #8f5a00 (soft: #fdf3dc, line: #ecc779)
 * - Status Anomaly: #b4261f (soft: #fceceb, line: #eba9a5)
 */

export const THEME = {
  // UI & Layout tokens
  ui: {
    canvas: '#f4f6f8',
    canvasGradientTop: '#fafbfc',
    canvasGradientBottom: '#f1f4f8',
    surface: '#ffffff',
    surfaceSubtle: '#f8fafc',
    surfaceMuted: '#f1f5f9',
    surfaceHover: '#f8fafc',
    border: '#dde2e8',
    borderStrong: '#c3cbd5',
    borderFocus: '#1f5f8b',
    ink: '#17202b',
    inkMuted: '#556270',
    inkFaint: '#7b8794',
    accent: '#1f5f8b',
    accentStrong: '#174a6e',
    accentSoft: '#e6f0f7',
    shadow: '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
    shadowSm: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
    shadowLg: '0 4px 16px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
  },

  // Status & Consensus colors
  status: {
    normal: {
      text: '#1d6b4a',
      bg: '#e7f4ed',
      border: '#a9d3bd',
      solid: '#1d6b4a',
    },
    review: {
      text: '#8f5a00',
      bg: '#fdf3dc',
      border: '#ecc779',
      solid: '#b47200',
    },
    anomaly: {
      text: '#b4261f',
      bg: '#fceceb',
      border: '#eba9a5',
      solid: '#b4261f',
    },
  },

  // Series & Gauge tokens
  series: {
    if: '#1f5f8b',
    ae: '#7a4fa3',
    threshold: '#94a3b8',
  },

  // 3D Scene Material & Lighting Tokens (Part A: Visual Definition & Physical Stack)
  scene: {
    fogColor: '#f4f6f8',
    floorColor: '#f8fafc',
    gridPrimary: '#cbd5e1',
    gridSecondary: '#e2e8f0',
    lightHemisphereSky: '#ffffff',
    lightHemisphereGround: '#cbd5e1',
    lightKey: '#ffffff',
    lightFill: '#f1f5f9',
    lightRim: '#93c5fd',

    // Test Fixture Materials
    benchTop: '#d8dee6',
    benchEdge: '#1f5f8b',
    coldPlateCopper: '#c47847',
    clampSteel: '#475569',
    clampFoot: '#64748b',
    pinsBrass: '#b45309',
    probeBody: '#334155',

    // IGBT Module Materials (Bottom to Top physical stack)
    // 1. Heatsink Base & Downward Fins
    heatsinkBase: '#64748b',
    heatsinkFins: '#475569',
    
    // 2. Copper Baseplate
    baseplateCopper: '#c87a48', // Rich brushed copper

    // 3. Solder Layer
    solderLayer: '#94a3b8',
    solderDelaminated: '#b45309',

    // 4. DBC Ceramic Substrate
    ceramicDbc: '#f1f5f9',
    dbcCopperIslands: '#b45309',

    // 5. Silicon Dies
    dieNominal: '#0f766e',      // Saturated deep teal (40°C)
    dieWarm: '#d97706',         // Saturated amber (90°C)
    dieHot: '#b91c1c',          // Saturated crimson (148°C)
    hotspotPulse: '#dc2626',
    diodeDie: '#1e293b',        // Dark silicon diode

    // 6. Bond Wires
    bondWireNormal: '#334155',  // Saturated mid-tone, clearly visible against light casing
    bondWireHighlight: '#0284c7',
    bondWireCracked: '#991b1b',
    particleNormal: '#0f766e',
    particleWarning: '#c2410c',
    particleFault: '#b91c1c',

    // 7. Casing Shell (Enclosing stack)
    casingOpaque: '#cbd5e1',     // Light warm-gray / pale slate (semi-glossy)
    casingXray: '#94a3b8',       // Translucent tinted slate in X-ray
    casingEdgeOutline: '#0f766e',// Dark-teal edge lines in X-ray mode
    partOutlineDefault: '#1e293b', // 1.5px crisp dark-slate outline

    // 8. Terminals (On top of casing)
    terminalsSteel: '#475569',   // Brushed steel-gray

    // Scanner Plane
    scannerPlane: '#0284c7',
    scannerLaserEdge: '#0369a1',
  },
} as const;

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { StatusPill } from '../components/StatusPill';

import { DEMO_DATA, ScenarioId, SensorValues } from './demoData';
import { DATASET_STATS } from './data/datasetStats';
import { THEME } from './theme';
import {
  StageId,
  getStageId,
  getInterpolatedSensors,
  getModelTelemetry,
  clamp,
} from './timeline';
import { computeIllustrativeScores } from './illustrativeScoring';

import { TestFixture } from './scene/TestFixture';
import { IGBTModule } from './scene/IGBTModule';
import { CurrentFlow } from './scene/CurrentFlow';
import { ScannerBar } from './scene/ScannerBar';
import { CameraRig } from './scene/CameraRig';

import { StageTitle } from './hud/StageTitle';
import { SensorLabels } from './hud/SensorLabels';
import { GaugeRings } from './hud/GaugeRings';
import { ConsensusBadge } from './hud/ConsensusBadge';
import { XaiCallout } from './hud/XaiCallout';
import { PartInfoCard } from './hud/PartInfoCard';
import { ManualLabPanel } from './hud/ManualLabPanel';
import { CursorTooltip } from './hud/CursorTooltip';

import {
  PlayIcon,
  PauseIcon,
  ReplayIcon,
  FullscreenIcon,
  MinimizeIcon,
  EyeIcon,
  EyeOffIcon,
  ResetViewIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
  SlidersIcon,
  HealthyScenarioIcon,
  FatigueScenarioIcon,
  DriftScenarioIcon,
  CoolingFanScenarioIcon,
  InfoIcon,
  DatabaseIcon,
  FastForwardIcon,
} from './icons';

import {
  loadRealReplayDataset,
  ReplayDataset,
  ReplayWindow,
  ReplayWindowFeature,
  toModelTelemetry,
  getFlaggedWindowIndices,
} from './data/realDataAdapter';

// Canvas WebGL Error Boundary
class CanvasErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-100"
          style={{ color: THEME.ui.ink }}
        >
          <div
            className="size-16 rounded-lg flex items-center justify-center mb-4 border"
            style={{
              backgroundColor: THEME.status.anomaly.bg,
              borderColor: THEME.status.anomaly.border,
              color: THEME.status.anomaly.solid,
            }}
          >
            <InfoIcon size={32} />
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: THEME.ui.ink }}>
            Hardware acceleration notice
          </h2>
          <p className="max-w-md text-sm mb-6 text-slate-600">
            Hardware acceleration could not initialize the 3D scene canvas. Please verify your browser WebGL support.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-md font-medium text-sm transition-colors text-white"
            style={{ backgroundColor: THEME.ui.accent }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DigitalTwinPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const outletContext = useOutletContext<{ onOpenNav?: () => void } | null>();

  // Scenario Selection (healthy | fatigue | drift | cooling | manual | replay)
  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioId>('fatigue');
  const isManual = activeScenarioId === 'manual';
  const isReplay = activeScenarioId === 'replay';

  // Real Replay Dataset State
  const [replayDataset, setReplayDataset] = useState<ReplayDataset | null>(null);
  const [replayWindowIndex, setReplayWindowIndex] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState<0.5 | 1 | 2 | 4>(1);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | 'all'>('all');
  const replayWindowFloatRef = useRef<number>(0);

  // Load real replay data on mount
  useEffect(() => {
    let mounted = true;
    loadRealReplayDataset()
      .then((data) => {
        if (mounted) {
          setReplayDataset(data);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error('Failed to load replay data:', err);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Flagged anomalous window indices for quick jumping
  const flaggedWindowIndices = useMemo(() => {
    return replayDataset ? getFlaggedWindowIndices(replayDataset) : [];
  }, [replayDataset]);

  // Current replay window
  const currentReplayWindow: ReplayWindow | null = useMemo(() => {
    if (!replayDataset || replayDataset.windows.length === 0) return null;
    const idx = Math.max(0, Math.min(replayWindowIndex, replayDataset.windows.length - 1));
    return replayDataset.windows[idx] ?? null;
  }, [replayDataset, replayWindowIndex]);

  // Active episode containing current window (if any)
  const activeEpisode = useMemo(() => {
    if (!replayDataset || !currentReplayWindow) return null;
    return (
      replayDataset.episodes.find(
        (e) =>
          currentReplayWindow.window_index >= e.first_window &&
          currentReplayWindow.window_index <= e.last_window
      ) ?? null
    );
  }, [replayDataset, currentReplayWindow]);

  // Presentation Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showHud, setShowHud] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Responsive Drawer State (for screen widths < 1100px)
  const [isBelow1100, setIsBelow1100] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsBelow1100(window.innerWidth < 1100);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Camera & Interactivity State
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [resetViewTrigger, setResetViewTrigger] = useState(0);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);

  // Manual Lab State
  const [isLabCollapsed, setIsLabCollapsed] = useState(false);
  const [manualSensors, setManualSensors] = useState<SensorValues>({
    supplyVoltage: DATASET_STATS.supplyVoltage.median,
    node1Voltage: DATASET_STATS.node1Voltage.median,
    node2Voltage: 4.507,
    node_voltage_drop: 0.429,
    collectorEmitterCurrent: DATASET_STATS.collectorEmitterCurrent.median,
    internalTemperature: DATASET_STATS.internalTemperature.median,
    packageTemperature: DATASET_STATS.packageTemperature.median,
    heatSinkTemperature: DATASET_STATS.heatSinkTemperature.median,
  });
  const [manualFaultWire, setManualFaultWire] = useState<number>(-1);
  const [manualDelamination, setManualDelamination] = useState<boolean>(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Active scenario config
  const activeScenarioConfig = useMemo(() => {
    if (activeScenarioId === 'manual' || activeScenarioId === 'replay') {
      return DEMO_DATA.scenarios.fatigue;
    }
    return DEMO_DATA.scenarios[activeScenarioId] || DEMO_DATA.scenarios.fatigue;
  }, [activeScenarioId]);

  // Compute current timeline state
  const stageId: StageId = getStageId(currentTime);
  const currentStageDef = DEMO_DATA.stages.find((s) => s.id === stageId) ?? DEMO_DATA.stages[0]!;
  const stageProgress = clamp(
    (currentTime - currentStageDef.startTime) / currentStageDef.duration,
    0,
    1
  );

  // Derive sensor values & telemetry
  const timelineSensors = getInterpolatedSensors(currentTime, activeScenarioConfig);
  const timelineTelemetry = getModelTelemetry(currentTime, activeScenarioConfig);

  // Manual lab scoring computation
  const manualResult = useMemo(() => {
    return computeIllustrativeScores(manualSensors, manualFaultWire, manualDelamination);
  }, [manualSensors, manualFaultWire, manualDelamination]);

  // Replay mode telemetry & sensors
  const replaySensors = useMemo<SensorValues>(() => {
    return currentReplayWindow ? currentReplayWindow.sensors : manualSensors;
  }, [currentReplayWindow, manualSensors]);

  const replayTelemetry = useMemo(() => {
    if (currentReplayWindow && replayDataset) {
      return toModelTelemetry(currentReplayWindow, replayDataset.thresholds);
    }
    return timelineTelemetry;
  }, [currentReplayWindow, replayDataset, timelineTelemetry]);

  const activeSensors = isReplay ? replaySensors : isManual ? manualSensors : timelineSensors;
  const activeTelemetry = isReplay ? replayTelemetry : isManual ? manualResult.telemetry : timelineTelemetry;

  // Visual aid constraints for 3D module
  // In replay mode, the crack/hotspot/delamination appears ONLY when consensus === 'ANOMALY'
  const isReplayAnomaly = isReplay && activeTelemetry.consensus === 'ANOMALY';

  const activeFaultWire = isReplay
    ? (isReplayAnomaly ? 2 : -1)
    : isManual
    ? manualFaultWire
    : activeScenarioConfig.hasCrack && currentTime >= 22.0
    ? (activeScenarioConfig.crackedWireIndex ?? 2)
    : -1;

  const activeDelamination = isReplay
    ? isReplayAnomaly
    : isManual
    ? manualDelamination
    : activeScenarioConfig.coolingDegraded;

  const activeHotspot = isReplay
    ? isReplayAnomaly
    : isManual
    ? manualSensors.packageTemperature > 275
    : activeScenarioConfig.hasHotspot && currentTime >= 22.0;

  // RAF loop for smooth playback timer
  const lastTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying || isManual) {
      lastTimestampRef.current = null;
      return;
    }

    let animId: number;
    const tick = (now: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = now;
      }
      const deltaSec = (now - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = now;

      if (isReplay) {
        if (replayDataset && replayDataset.windows.length > 0) {
          const maxIdx = replayDataset.windows.length - 1;
          // Advance window index at 0.20s per window at 1x speed
          replayWindowFloatRef.current += (deltaSec / 0.20) * replaySpeed;
          if (replayWindowFloatRef.current >= maxIdx) {
            replayWindowFloatRef.current = maxIdx;
            setReplayWindowIndex(maxIdx);
            setIsPlaying(false);
          } else {
            setReplayWindowIndex(Math.floor(replayWindowFloatRef.current));
          }
        }
        setCurrentTime((prev) => (prev + deltaSec) % DEMO_DATA.totalDuration);
      } else {
        setCurrentTime((prev) => {
          const next = prev + deltaSec;
          if (next >= DEMO_DATA.totalDuration) {
            setIsPlaying(false);
            return DEMO_DATA.totalDuration;
          }
          return next;
        });
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, isManual, isReplay, replayDataset, replaySpeed]);

  const handleScrubReplayWindow = useCallback((idx: number) => {
    setReplayWindowIndex(idx);
    replayWindowFloatRef.current = idx;
  }, []);

  const handleJumpNextFlagged = useCallback(() => {
    if (!flaggedWindowIndices.length) return;
    const next = flaggedWindowIndices.find((idx) => idx > replayWindowIndex);
    const target = next !== undefined ? next : flaggedWindowIndices[0]!;
    handleScrubReplayWindow(target);
  }, [flaggedWindowIndices, replayWindowIndex, handleScrubReplayWindow]);

  const handleJumpPrevFlagged = useCallback(() => {
    if (!flaggedWindowIndices.length) return;
    const rev = [...flaggedWindowIndices].reverse();
    const prev = rev.find((idx) => idx < replayWindowIndex);
    const target = prev !== undefined ? prev : flaggedWindowIndices[flaggedWindowIndices.length - 1]!;
    handleScrubReplayWindow(target);
  }, [flaggedWindowIndices, replayWindowIndex, handleScrubReplayWindow]);

  const handleSelectEpisode = useCallback(
    (epId: number | 'all') => {
      setSelectedEpisodeId(epId);
      if (epId === 'all') {
        handleScrubReplayWindow(0);
      } else {
        const ep = replayDataset?.episodes.find((e) => e.id === epId);
        if (ep) {
          handleScrubReplayWindow(ep.first_window);
        }
      }
    },
    [replayDataset, handleScrubReplayWindow]
  );

  // Playback transport actions
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev) {
        if (isReplay && replayDataset && replayWindowIndex >= replayDataset.windows.length - 1) {
          handleScrubReplayWindow(0);
        } else if (!isReplay && !isManual && currentTime >= DEMO_DATA.totalDuration) {
          setCurrentTime(0);
        }
      }
      return !prev;
    });
  }, [isReplay, replayDataset, replayWindowIndex, isManual, currentTime, handleScrubReplayWindow]);

  const handleReplay = useCallback(() => {
    if (isReplay) {
      handleScrubReplayWindow(0);
      setIsPlaying(true);
      setIsUserInteracting(false);
    } else {
      setCurrentTime(0);
      setIsPlaying(true);
      setIsUserInteracting(false);
    }
  }, [isReplay, handleScrubReplayWindow]);

  const jumpToStage = useCallback((targetStageId: StageId) => {
    const target = DEMO_DATA.stages.find((s) => s.id === targetStageId);
    if (target) {
      setCurrentTime(target.startTime + 0.05);
      setIsUserInteracting(false);
    }
  }, []);

  const handleNextStage = useCallback(() => {
    const nextId = Math.min(stageId + 1, 4) as StageId;
    jumpToStage(nextId);
  }, [stageId, jumpToStage]);

  const handlePrevStage = useCallback(() => {
    const prevId = Math.max(stageId - 1, 1) as StageId;
    jumpToStage(prevId);
  }, [stageId, jumpToStage]);

  const handleResetCamera = useCallback(() => {
    setIsUserInteracting(false);
    setResetViewTrigger((c) => c + 1);
  }, []);

  // Scenario switching
  const handleSelectScenario = useCallback(
    (id: ScenarioId) => {
      setActiveScenarioId(id);
      setSelectedPartId(null);
      setIsUserInteracting(false);
      if (id === 'manual') {
        setIsPlaying(false);
      } else if (id === 'replay') {
        handleScrubReplayWindow(0);
        setIsPlaying(true);
      } else {
        setCurrentTime(0);
        setIsPlaying(true);
      }
    },
    [handleScrubReplayWindow]
  );

  // Manual sensor updater
  const handleUpdateManualSensor = useCallback(
    (key: keyof SensorValues, val: number) => {
      setManualSensors((prev) => {
        const next = { ...prev, [key]: val };
        if (key === 'node1Voltage' || key === 'node2Voltage') {
          next.node_voltage_drop = Math.max(0, next.node1Voltage - next.node2Voltage);
        }
        return next;
      });
    },
    []
  );

  const handleApplyPreset = useCallback((presetKey: 'normal' | 'overstress' | 'coolingFailure') => {
    const p = DEMO_DATA.presets[presetKey];
    if (p) {
      setManualSensors({
        ...p.values,
        node_voltage_drop: Math.max(0, p.values.node1Voltage - p.values.node2Voltage),
      });
      setManualFaultWire(p.faultWireIndex);
      setManualDelamination(p.solderDelamination);
    }
  }, []);

  const handleResetBaseline = useCallback(() => {
    setManualSensors({
      supplyVoltage: DATASET_STATS.supplyVoltage.median,
      node1Voltage: DATASET_STATS.node1Voltage.median,
      node2Voltage: 4.507,
      node_voltage_drop: 0.429,
      collectorEmitterCurrent: DATASET_STATS.collectorEmitterCurrent.median,
      internalTemperature: DATASET_STATS.internalTemperature.median,
      packageTemperature: DATASET_STATS.packageTemperature.median,
      heatSinkTemperature: DATASET_STATS.heatSinkTemperature.median,
    });
    setManualFaultWire(-1);
    setManualDelamination(false);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard presentation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextStage();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevStage();
          break;
        case 'KeyR':
          e.preventDefault();
          handleReplay();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyH':
          e.preventDefault();
          setShowHud((prev) => !prev);
          break;
        case 'Digit1':
          handleSelectScenario('healthy');
          break;
        case 'Digit2':
          handleSelectScenario('fatigue');
          break;
        case 'Digit3':
          handleSelectScenario('drift');
          break;
        case 'Digit4':
          handleSelectScenario('cooling');
          break;
        case 'Digit5':
          handleSelectScenario('manual');
          break;
        case 'Digit6':
          handleSelectScenario('replay');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, handleNextStage, handlePrevStage, handleReplay, toggleFullscreen, handleSelectScenario]);

  const canvasCursor = isPointerDown ? 'grabbing' : 'grab';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden font-sans select-none bg-slate-100"
      style={{ color: THEME.ui.ink }}
    >
      {/* ============================================================== */}
      {/* 1. 3D WEBGL CANVAS (Occupies 100% of the screen underneath)    */}
      {/* ============================================================== */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{ cursor: canvasCursor }}
        onPointerDown={() => setIsPointerDown(true)}
        onPointerUp={() => setIsPointerDown(false)}
      >
        <CanvasErrorBoundary>
          <Canvas
            shadows
            dpr={[1, 1.75]}
            camera={{ position: [0, 3.6, 5.8], fov: 42 }}
            gl={{
              antialias: true,
              alpha: false,
              toneMapping: 4, // ACESFilmicToneMapping
              toneMappingExposure: 1.18,
            }}
            onPointerMissed={() => setSelectedPartId(null)}
          >
            <color attach="background" args={[THEME.scene.floorColor]} />
            <fog attach="fog" args={[THEME.scene.floorColor, 10, 24]} />

            {/* Light Theme Clean Lighting Setup */}
            <hemisphereLight
              color={THEME.scene.lightHemisphereSky}
              groundColor={THEME.scene.lightHemisphereGround}
              intensity={1.2}
            />
            <directionalLight
              position={[5, 8, 5]}
              intensity={1.4}
              castShadow
              shadow-mapSize={[1024, 1024]}
              color={THEME.scene.lightKey}
            />
            <directionalLight
              position={[-4, 3, -3]}
              intensity={0.5}
              color={THEME.scene.lightRim}
            />
            <directionalLight
              position={[3, 2, -4]}
              intensity={0.4}
              color={THEME.scene.lightFill}
            />

            {/* Floor Plane (toneMapped=false so floor renders crisp light gray-white) */}
            <mesh position={[0, -0.61, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[40, 40]} />
              <meshStandardMaterial
                color={THEME.scene.floorColor}
                roughness={0.8}
                metalness={0.05}
                toneMapped={false}
              />
            </mesh>
            <gridHelper
              args={[24, 24, THEME.scene.gridPrimary, THEME.scene.gridSecondary]}
              position={[0, -0.6, 0]}
            />

            {/* Soft, light contact shadow under fixture */}
            <ContactShadows
              position={[0, -0.59, 0]}
              opacity={0.32}
              scale={8.5}
              blur={2.2}
              far={3}
              color="#334155"
            />

            {/* Scene Components */}
            <TestFixture
              currentTime={currentTime}
              onSelectPart={(id) => setSelectedPartId(id)}
              selectedPartId={selectedPartId}
            />
            <IGBTModule
              currentTime={currentTime}
              faultWireIndex={activeFaultWire}
              solderDelaminated={activeDelamination}
              hasHotspot={activeHotspot}
              packageTemperature={activeSensors.packageTemperature}
              manualTemp={activeSensors.packageTemperature}
              onSelectPart={(id) => setSelectedPartId(id)}
              selectedPartId={selectedPartId}
            />
            <CurrentFlow
              currentTime={currentTime}
              manualCurrent={isManual || isReplay ? activeSensors.collectorEmitterCurrent : undefined}
              faultWireIndex={activeFaultWire}
              isManual={isManual || isReplay}
            />
            <ScannerBar
              currentTime={currentTime}
              active={(!isManual && !isReplay && activeScenarioConfig.id === 'fatigue') || isReplayAnomaly}
            />

            <CameraRig
              currentTime={currentTime}
              stageId={stageId}
              isPlaying={isPlaying}
              reducedMotion={reducedMotion}
              isUserInteracting={isUserInteracting}
              onUserStartInteraction={() => setIsUserInteracting(true)}
              resetViewTrigger={resetViewTrigger}
            />
          </Canvas>
        </CanvasErrorBoundary>
      </div>

      {/* ============================================================== */}
      {/* 2. FIXED-POSITION CSS GRID HUD OVERLAY                         */}
      {/* ============================================================== */}
      {showHud && (
        <div
          className="pointer-events-none absolute inset-0 z-20 grid h-full w-full"
          style={{
            gridTemplateRows: '48px 1fr auto',
            gridTemplateColumns: isBelow1100 ? '1fr' : '1fr 360px',
            gridTemplateAreas: isBelow1100
              ? `
                  "top"
                  "main"
                  "bottom"
                `
              : `
                  "top top"
                  "main right"
                  "bottom bottom"
                `,
          }}
        >
          {/* AREA "TOP": Full-Width Header Bar */}
          <header
            style={{ gridArea: 'top' }}
            className="pointer-events-auto flex items-center justify-between px-4 sm:px-6 h-12 bg-white border-b border-slate-200 shadow-xs z-30"
          >
            <div className="flex items-center gap-2.5">
              {outletContext?.onOpenNav && (
                <button
                  type="button"
                  aria-label="Open navigation"
                  className="rounded p-1 text-slate-600 hover:bg-slate-100 lg:hidden"
                  onClick={outletContext.onOpenNav}
                >
                  <Menu className="size-5" aria-hidden />
                </button>
              )}
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded bg-slate-100 text-slate-700 border border-slate-200">
                  <SparklesIcon size={14} />
                </span>
                <span className="text-sm font-semibold text-slate-900 tracking-tight">
                  3D Digital Twin
                </span>
              </div>
            </div>

            {/* Scenario Segmented Selector */}
            <div className="flex items-center p-0.5 rounded-md border border-slate-200 bg-slate-100 gap-0.5">
              {[
                { id: 'healthy', label: '1. Nominal', Icon: HealthyScenarioIcon },
                { id: 'fatigue', label: '2. Wire fatigue', Icon: FatigueScenarioIcon },
                { id: 'drift', label: '3. Voltage drift', Icon: DriftScenarioIcon },
                { id: 'cooling', label: '4. Temp drift', Icon: CoolingFanScenarioIcon },
                { id: 'manual', label: '5. Manual lab', Icon: SlidersIcon },
                { id: 'replay', label: '6. Real replay', Icon: DatabaseIcon },
              ].map(({ id, label, Icon }) => {
                const isActive = activeScenarioId === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleSelectScenario(id as ScenarioId)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right Toolbar Controls */}
            <div className="flex items-center gap-1.5">
              {isUserInteracting && isPlaying && !isManual && (
                <button
                  onClick={() => setIsUserInteracting(false)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-white shadow-xs"
                  style={{ backgroundColor: THEME.ui.accent }}
                >
                  Resume tour
                </button>
              )}

              <button
                onClick={handleResetCamera}
                title="Reset Camera View"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                <ResetViewIcon size={13} />
                <span className="hidden md:inline">Reset view</span>
              </button>

              <button
                onClick={() => setShowHud((v) => !v)}
                title="Toggle HUD (H)"
                className="p-1.5 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                {showHud ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
              </button>

              <button
                onClick={toggleFullscreen}
                title="Toggle Fullscreen (F)"
                className="p-1.5 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                {isFullscreen ? <MinimizeIcon size={14} /> : <FullscreenIcon size={14} />}
              </button>

              {/* Drawer Toggle for small screens (<1100px) */}
              {isBelow1100 && (
                <button
                  onClick={() => setIsDrawerOpen((v) => !v)}
                  className="px-2 py-1 rounded text-xs font-semibold border border-slate-300 bg-slate-50 text-slate-800"
                >
                  {isDrawerOpen ? 'Close panel' : 'Detection panel'}
                </button>
              )}

              <div className="h-4 w-px bg-slate-200" />
              <StatusPill />
            </div>
          </header>

          {/* AREA "MAIN": Left Narrative & Live Telemetry / Lab Controls */}
          <main
            style={{ gridArea: 'main' }}
            className="pointer-events-none p-4 sm:p-6 flex flex-col justify-between overflow-hidden"
          >
            {/* Top Left: Stage Title or Lab / Replay Info */}
            <div className="pointer-events-auto">
              {isReplay ? (
                <div className="max-w-md bg-white/90 backdrop-blur-xs p-3.5 rounded-md border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1">
                    <div className="flex items-center gap-1.5">
                      <DatabaseIcon size={14} className="text-teal-700" />
                      <span className="text-teal-900 font-semibold">NASA Ames IGBT Replay Adapter</span>
                    </div>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-800 font-medium">
                      Run device_4
                    </span>
                  </div>
                  <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                    Accelerated life test replay
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5 leading-normal">
                    Source: Device 4 accelerated aging run (<code className="font-mono text-[11px] text-slate-800">sample_burnin_device4_main.csv</code>, 427 windows, 10,770 raw measurements).
                  </p>

                  {replayDataset && replayDataset.episodes.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center gap-1.5 text-xs">
                      <span className="text-slate-500 font-medium shrink-0">Episode:</span>
                      <select
                        value={selectedEpisodeId}
                        onChange={(e) => {
                          const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                          handleSelectEpisode(val);
                        }}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
                      >
                        <option value="all">All windows (0–426, full run)</option>
                        {replayDataset.episodes.map((ep) => (
                          <option key={ep.id} value={ep.id}>
                            Episode {ep.id}: w{ep.first_window}{ep.first_window !== ep.last_window ? `–${ep.last_window}` : ''} ({ep.top_signals.slice(0, 2).join(', ')})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : isManual ? (
                <div className="max-w-md bg-white/90 backdrop-blur-xs p-3.5 rounded-md border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
                    <SlidersIcon size={14} />
                    <span>Interactive signal generator</span>
                  </div>
                  <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
                    Manual component stress lab
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5 leading-normal">
                    Adjust telemetry sliders or inject physical bond-wire / solder faults to observe detection scoring.
                  </p>
                </div>
              ) : (
                <div className="bg-white/90 backdrop-blur-xs p-3.5 rounded-md border border-slate-200 shadow-xs inline-block">
                  <StageTitle stageId={stageId} stageProgress={stageProgress} />
                </div>
              )}
            </div>

            {/* Bottom Left: Sensor Telemetry or Manual Lab Controls */}
            <div className="pointer-events-auto mt-auto pb-2">
              {isManual ? (
                <ManualLabPanel
                  sensors={manualSensors}
                  derived={manualResult.derived}
                  faultWireIndex={manualFaultWire}
                  solderDelamination={manualDelamination}
                  onUpdateSensor={handleUpdateManualSensor}
                  onToggleWireFault={(idx) =>
                    setManualFaultWire((prev) => (prev === idx ? -1 : idx))
                  }
                  onToggleDelamination={setManualDelamination}
                  onApplyPreset={handleApplyPreset}
                  onResetBaseline={handleResetBaseline}
                  isCollapsed={isLabCollapsed}
                  onToggleCollapse={() => setIsLabCollapsed((v) => !v)}
                />
              ) : (
                <SensorLabels
                  stageId={stageId}
                  sensorValues={activeSensors}
                  isManual={isReplay}
                />
              )}
            </div>
          </main>

          {/* AREA "RIGHT": Fixed-Width Panel (Desktop: >=1100px) */}
          {!isBelow1100 && (
            <aside
              style={{ gridArea: 'right' }}
              className="pointer-events-auto w-[360px] min-w-0 max-h-[calc(100vh-112px)] overflow-y-auto flex flex-col gap-2.5 p-3 pr-4 z-20"
            >
              {/* 1. Consensus Badge */}
              <ConsensusBadge
                status={activeTelemetry.consensus}
                windowIndex={isReplay ? replayWindowIndex : activeTelemetry.windowIndex}
              />

              {/* 2. Part Info Card (Accordion section replacing/stacked in this panel) */}
              {selectedPartId && (
                <PartInfoCard
                  selectedPartId={selectedPartId}
                  sensorValues={activeSensors}
                  onClose={() => setSelectedPartId(null)}
                  isManual={isManual}
                  onToggleWireFault={(idx) =>
                    setManualFaultWire((prev) => (prev === idx ? -1 : idx))
                  }
                />
              )}

              {/* 3. Dual-Model Gauge Rings */}
              <GaugeRings
                telemetry={activeTelemetry}
                visible={isReplay || isManual || stageId === 4}
              />

              {/* 4. XAI Root-Cause Attribution */}
              {isReplay ? (
                <XaiCallout
                  visible={true}
                  isManual={false}
                  title={`Window ${replayWindowIndex} attribution`}
                  leadFeature={
                    currentReplayWindow?.top_features[0]
                      ? `${currentReplayWindow.top_features[0].feature} (residual error ${currentReplayWindow.top_features[0].squared_error.toFixed(4)})`
                      : 'Nominal baseline'
                  }
                  lines={
                    currentReplayWindow?.top_features && currentReplayWindow.top_features.length > 0
                      ? currentReplayWindow.top_features.map(
                          (f: ReplayWindowFeature) => `${f.feature}: residual squared error ${f.squared_error.toFixed(4)}`
                        )
                      : ['Sensor signals within normal operating distribution']
                  }
                  disclaimer={
                    isReplayAnomaly
                      ? 'Visual aid — indicates dual-model anomaly consensus, not a physical measurement'
                      : undefined
                  }
                />
              ) : isManual ? (
                <XaiCallout
                  visible={true}
                  isManual={true}
                  lines={manualResult.topDeviations.slice(0, 3).map((d) => `${d.name}: ${d.value.toFixed(1)}${d.unit} (${d.zScore.toFixed(1)}σ deviation)`)}
                />
              ) : (
                <XaiCallout
                  visible={currentTime >= 26.5}
                  title={activeScenarioConfig.xai.title}
                  leadFeature={activeScenarioConfig.xai.leadFeature}
                  lines={activeScenarioConfig.xai.lines}
                />
              )}
            </aside>
          )}

          {/* Collapsible Bottom Drawer for small screens (<1100px) */}
          {isBelow1100 && isDrawerOpen && (
            <div className="pointer-events-auto fixed bottom-14 right-4 w-88 max-h-[70vh] overflow-y-auto bg-white rounded-t-lg border border-slate-300 shadow-xl p-3 flex flex-col gap-2.5 z-40">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-800">Detection summary</span>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Close
                </button>
              </div>
              <ConsensusBadge
                status={activeTelemetry.consensus}
                windowIndex={isReplay ? replayWindowIndex : activeTelemetry.windowIndex}
              />
              {selectedPartId && (
                <PartInfoCard
                  selectedPartId={selectedPartId}
                  sensorValues={activeSensors}
                  onClose={() => setSelectedPartId(null)}
                  isManual={isManual}
                  onToggleWireFault={(idx) =>
                    setManualFaultWire((prev) => (prev === idx ? -1 : idx))
                  }
                />
              )}
              <GaugeRings
                telemetry={activeTelemetry}
                visible={isReplay || isManual || stageId === 4}
              />
              {isReplay ? (
                <XaiCallout
                  visible={true}
                  isManual={false}
                  title={`Window ${replayWindowIndex} attribution`}
                  leadFeature={
                    currentReplayWindow?.top_features[0]
                      ? `${currentReplayWindow.top_features[0].feature} (residual error ${currentReplayWindow.top_features[0].squared_error.toFixed(4)})`
                      : 'Nominal baseline'
                  }
                  lines={
                    currentReplayWindow?.top_features && currentReplayWindow.top_features.length > 0
                      ? currentReplayWindow.top_features.map(
                          (f: ReplayWindowFeature) => `${f.feature}: residual squared error ${f.squared_error.toFixed(4)}`
                        )
                      : ['Sensor signals within normal operating distribution']
                  }
                  disclaimer={
                    isReplayAnomaly
                      ? 'Visual aid — indicates dual-model anomaly consensus, not a physical measurement'
                      : undefined
                  }
                />
              ) : isManual ? (
                <XaiCallout
                  visible={true}
                  isManual={true}
                  lines={manualResult.topDeviations.slice(0, 3).map((d) => `${d.name}: ${d.value.toFixed(1)}${d.unit} (${d.zScore.toFixed(1)}σ deviation)`)}
                />
              ) : (
                <XaiCallout
                  visible={currentTime >= 26.5}
                  title={activeScenarioConfig.xai.title}
                  leadFeature={activeScenarioConfig.xai.leadFeature}
                  lines={activeScenarioConfig.xai.lines}
                />
              )}
            </div>
          )}

          {/* AREA "BOTTOM": Transport Controls & Stage / Window Scrubber */}
          <footer
            style={{ gridArea: 'bottom' }}
            className="pointer-events-auto px-4 sm:px-6 py-2 bg-white border-t border-slate-200 shadow-xs z-30"
          >
            <div className="max-w-7xl mx-auto flex flex-col gap-1.5">
              {isReplay ? (
                <div className="flex flex-col gap-1.5">
                  {/* Replay Scrub Bar & Stats */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          Window {replayWindowIndex} of {replayDataset ? replayDataset.windows.length - 1 : 426}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          · Run Time: {currentReplayWindow ? `${currentReplayWindow.start_time.toFixed(1)}s` : '0.0s'} (~{currentReplayWindow ? (currentReplayWindow.start_time / 60).toFixed(0) : '0'}m test)
                        </span>
                        {activeEpisode && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                            Episode {activeEpisode.id}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                        <span>
                          IF score: <strong className="tabular-nums text-slate-800">{activeTelemetry.ifScore.toFixed(3)}</strong> (th: {activeTelemetry.ifThreshold.toFixed(3)})
                        </span>
                        <span>
                          AE loss: <strong className="tabular-nums text-slate-800">{activeTelemetry.aeLoss.toFixed(3)}</strong> (th: {activeTelemetry.aeThreshold.toFixed(3)})
                        </span>
                      </div>
                    </div>

                    {/* Scrub range slider */}
                    <div className="relative flex items-center w-full py-0.5">
                      <input
                        type="range"
                        min={0}
                        max={replayDataset ? replayDataset.windows.length - 1 : 426}
                        value={replayWindowIndex}
                        onChange={(e) => handleScrubReplayWindow(Number(e.target.value))}
                        className="w-full accent-teal-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Transport buttons & Speed selector */}
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleJumpPrevFlagged}
                        title="Previous anomaly window"
                        className="px-2 py-1 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium flex items-center gap-1"
                      >
                        <ChevronLeftIcon size={13} />
                        <span>Prev anomaly</span>
                      </button>

                      <button
                        onClick={togglePlay}
                        title="Play/Pause (Space)"
                        className="flex items-center justify-center size-8 rounded font-semibold text-white shadow-xs transition-colors"
                        style={{ backgroundColor: THEME.ui.accent }}
                      >
                        {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
                      </button>

                      <button
                        onClick={handleJumpNextFlagged}
                        title="Jump to next anomaly window"
                        className="px-2 py-1 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium flex items-center gap-1"
                      >
                        <FastForwardIcon size={13} />
                        <span>Next anomaly</span>
                      </button>

                      <button
                        onClick={handleReplay}
                        title="Restart from window 0 (R)"
                        className="p-1.5 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                      >
                        <ReplayIcon size={14} />
                      </button>

                      {/* Speed Selector */}
                      <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
                        <span className="text-[11px] text-slate-500 mr-1">Speed:</span>
                        {([0.5, 1, 2, 4] as const).map((spd) => (
                          <button
                            key={spd}
                            onClick={() => setReplaySpeed(spd)}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                              replaySpeed === spd
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs text-slate-500">
                      Real pipeline output (run device_4, windows 0–426, sample_burnin_device4_main.csv)
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Stage Progress Scrubbers */}
                  {!isManual && (
                    <div className="grid grid-cols-4 gap-2">
                      {DEMO_DATA.stages.map((stg) => {
                        const isActive = stageId === stg.id;
                        const isPast = currentTime >= stg.endTime;
                        let fillPct = 0;
                        if (isPast) fillPct = 100;
                        else if (isActive) fillPct = stageProgress * 100;

                        return (
                          <button
                            key={stg.id}
                            onClick={() => jumpToStage(stg.id as StageId)}
                            className={`text-left p-1.5 rounded border transition-colors ${
                              isActive
                                ? 'bg-slate-50 border-slate-400'
                                : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs mb-0.5">
                              <span
                                className="font-medium"
                                style={{ color: isActive ? THEME.ui.accentStrong : THEME.ui.inkMuted }}
                              >
                                Stage {stg.id}
                              </span>
                              <span className="text-[11px] tabular-nums text-slate-500">
                                {stg.startTime.toFixed(0)}s - {stg.endTime.toFixed(0)}s
                              </span>
                            </div>
                            <div className="text-xs font-semibold truncate mb-1 text-slate-900">
                              {stg.name.split('—')[1]?.trim() || stg.name}
                            </div>
                            <div className="w-full h-1 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full transition-all duration-100 ease-out"
                                style={{
                                  width: `${fillPct}%`,
                                  backgroundColor: THEME.ui.accent,
                                }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Master Transport Controls */}
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center gap-2.5">
                      {!isManual && (
                        <>
                          <button
                            onClick={handlePrevStage}
                            title="Previous stage (←)"
                            className="p-1.5 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                          >
                            <ChevronLeftIcon size={14} />
                          </button>

                          <button
                            onClick={togglePlay}
                            title="Play/Pause (Space)"
                            className="flex items-center justify-center size-8 rounded font-semibold text-white shadow-xs transition-colors"
                            style={{ backgroundColor: THEME.ui.accent }}
                          >
                            {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
                          </button>

                          <button
                            onClick={handleNextStage}
                            title="Next stage (→)"
                            className="p-1.5 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                          >
                            <ChevronRightIcon size={14} />
                          </button>

                          <button
                            onClick={handleReplay}
                            title="Replay (R)"
                            className="p-1.5 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                          >
                            <ReplayIcon size={14} />
                          </button>

                          <div className="text-xs text-slate-600 pl-2">
                            <span className="font-semibold tabular-nums text-slate-900">
                              {currentTime.toFixed(1)}s
                            </span>{' '}
                            / {DEMO_DATA.totalDuration.toFixed(1)}s
                          </div>
                        </>
                      )}

                      {isManual && (
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                          <SlidersIcon size={14} />
                          <span>Manual mode — Telemetry sliders control 3D components directly</span>
                        </div>
                      )}
                    </div>

                    {/* Honest labeling notice */}
                    <div className="text-xs text-slate-500">
                      {isManual ? DEMO_DATA.manualHonestyLabel : DEMO_DATA.disclaimer}
                    </div>
                  </div>
                </>
              )}
            </div>
          </footer>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. CURSOR-FOLLOWING HOVER TOOLTIP (Zero Reflow via Store)       */}
      {/* ============================================================== */}
      <CursorTooltip />


    </div>
  );
}

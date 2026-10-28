import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clamp } from '../timeline';
import { THEME } from '../theme';
import { DATASET_STATS } from '../data/datasetStats';

interface ThermalDieProps {
  currentTime: number;
  hasHotspot?: boolean;
  packageTemperature?: number; // in dataset units (values ~26 to 281)
  onSelectPart?: (partId: string) => void;
  onHoverPart?: (partId: string | null) => void;
  selectedPartId?: string | null;
}

export const ThermalDie: React.FC<ThermalDieProps> = ({
  currentTime,
  hasHotspot = false,
  packageTemperature,
  onSelectPart,
  onHoverPart,
  selectedPartId,
}) => {
  const dieMeshRef = useRef<THREE.Mesh>(null);
  const dieMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const hotspotMeshRef = useRef<THREE.Mesh>(null);
  const hotspotMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    if (!dieMatRef.current) return;

    // Single source of truth: packageTemperature normalized over observed p01-p99 range
    const p01 = DATASET_STATS.packageTemperature.p01; // ~59.65
    const p99 = DATASET_STATS.packageTemperature.p99; // ~280.82
    const pkgTemp = typeof packageTemperature === 'number' ? packageTemperature : DATASET_STATS.packageTemperature.median;
    const normalizedT = clamp((pkgTemp - p01) / (p99 - p01), 0, 1);

    // Color gradient driven by normalized package temperature:
    // <= 0.70 (nominal): teal (#0f766e)
    // 0.70 - 0.90 (elevated): amber (#d97706)
    // > 0.90 (near p99 / overstress): critical crimson (#b91c1c)
    if (normalizedT <= 0.70) {
      dieMatRef.current.color.set(THEME.scene.dieNominal);
      dieMatRef.current.emissive.set(THEME.scene.dieNominal);
      dieMatRef.current.emissiveIntensity = 0.25;
    } else if (normalizedT <= 0.90) {
      const t = (normalizedT - 0.70) / 0.20;
      dieMatRef.current.color.lerpColors(
        new THREE.Color(THEME.scene.dieNominal),
        new THREE.Color(THEME.scene.dieWarm),
        t
      );
      dieMatRef.current.emissive.lerpColors(
        new THREE.Color(THEME.scene.dieNominal),
        new THREE.Color(THEME.scene.dieWarm),
        t
      );
      dieMatRef.current.emissiveIntensity = 0.25 + t * 0.4;
    } else {
      const t = clamp((normalizedT - 0.90) / 0.10, 0, 1);
      dieMatRef.current.color.lerpColors(
        new THREE.Color(THEME.scene.dieWarm),
        new THREE.Color(THEME.scene.dieHot),
        t
      );
      dieMatRef.current.emissive.lerpColors(
        new THREE.Color(THEME.scene.dieWarm),
        new THREE.Color(THEME.scene.dieHot),
        t
      );
      dieMatRef.current.emissiveIntensity = 0.65 + t * 0.55;
    }

    // Highlight if selected
    if (selectedPartId === 'die_igbt') {
      dieMatRef.current.emissive.set(THEME.ui.accent);
      dieMatRef.current.emissiveIntensity = 0.5;
    }

    // Localized Hotspot bloom on Die Pad 2
    if (hotspotMeshRef.current && hotspotMatRef.current) {
      const showHotspot = hasHotspot || normalizedT > 0.92;
      if (showHotspot) {
        const pulse = 1.0 + Math.sin(currentTime * 3.5) * 0.15;
        hotspotMeshRef.current.scale.set(pulse, 1, pulse);
        hotspotMatRef.current.opacity = 0.85;
      } else {
        hotspotMeshRef.current.scale.set(0, 0, 0);
        hotspotMatRef.current.opacity = 0;
      }
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Primary IGBT Die */}
      <mesh
        ref={dieMeshRef}
        position={[-0.45, 0.18, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectPart?.('die_igbt');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverPart?.('die_igbt');
        }}
        onPointerOut={() => onHoverPart?.(null)}
      >
        <boxGeometry args={[1.05, 0.035, 1.25]} />
        <meshStandardMaterial
          ref={dieMatRef}
          color={THEME.scene.dieNominal}
          roughness={0.25}
          metalness={0.85}
          emissive={THEME.scene.dieNominal}
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Localized Hotspot Mesh */}
      <mesh
        ref={hotspotMeshRef}
        position={[-0.45, 0.20, 0.05]}
        scale={[0, 0, 0]}
      >
        <cylinderGeometry args={[0.22, 0.22, 0.015, 24]} />
        <meshBasicMaterial
          ref={hotspotMatRef}
          color="#ff2200"
          transparent
          opacity={0}
        />
      </mesh>
    </group>
  );
};

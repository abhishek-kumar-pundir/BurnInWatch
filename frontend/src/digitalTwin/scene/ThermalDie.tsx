import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clamp, lerp } from '../timeline';
import { THEME } from '../theme';

interface ThermalDieProps {
  currentTime: number;
  hasHotspot?: boolean;
  manualTemp?: number;
  onSelectPart?: (partId: string) => void;
  onHoverPart?: (partId: string | null) => void;
  selectedPartId?: string | null;
}

export const ThermalDie: React.FC<ThermalDieProps> = ({
  currentTime,
  hasHotspot = false,
  manualTemp,
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

    // Determine temperature (either manual lab override or timeline-based)
    let temp = 42.0;
    if (typeof manualTemp === 'number') {
      temp = manualTemp;
    } else {
      if (currentTime <= 13) {
        temp = 42.0;
      } else if (currentTime <= 22) {
        const t = clamp((currentTime - 13) / 9, 0, 1);
        temp = lerp(42.0, 88.5, t);
      } else {
        const t = clamp((currentTime - 22) / 10, 0, 1);
        temp = lerp(88.5, 148.7, t);
      }
    }

    // Map temperature to color gradient:
    // <= 50°C: nominal deep teal (#0f766e)
    // 50°C - 100°C: warm amber (#d97706)
    // > 100°C: critical crimson (#b91c1c)
    if (temp <= 50) {
      dieMatRef.current.color.set(THEME.scene.dieNominal);
      dieMatRef.current.emissive.set(THEME.scene.dieNominal);
      dieMatRef.current.emissiveIntensity = 0.2;
    } else if (temp <= 100) {
      const t = (temp - 50) / 50;
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
      dieMatRef.current.emissiveIntensity = 0.2 + t * 0.4;
    } else {
      const t = clamp((temp - 100) / 50, 0, 1);
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
      dieMatRef.current.emissiveIntensity = 0.6 + t * 0.6;
    }

    // Highlight if selected
    if (selectedPartId === 'die_igbt') {
      dieMatRef.current.emissive.set(THEME.ui.accent);
      dieMatRef.current.emissiveIntensity = 0.5;
    }

    // Localized Hotspot bloom on Die Pad 2
    if (hotspotMeshRef.current && hotspotMatRef.current) {
      const showHotspot = hasHotspot || (typeof manualTemp === 'number' && manualTemp > 120);
      if (showHotspot) {
        const pulse = 1.0 + Math.sin(currentTime * 3.0) * 0.15;
        hotspotMeshRef.current.scale.set(pulse, 1, pulse);
        hotspotMatRef.current.opacity = 0.85;
      } else {
        hotspotMeshRef.current.scale.set(0, 0, 0);
        hotspotMatRef.current.opacity = 0;
      }
    }
  });

  return (
    <group
      position={[-0.5, -0.05, 0]}
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
      {/* Silicon IGBT Switching Die */}
      <mesh ref={dieMeshRef} position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.05, 0.035, 1.25]} />
        <meshStandardMaterial
          ref={dieMatRef}
          color={THEME.scene.dieNominal}
          metalness={0.6}
          roughness={0.3}
          emissive={THEME.scene.dieNominal}
          emissiveIntensity={0.2}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(1.055, 0.036, 1.255)]} />
        <lineBasicMaterial color={THEME.scene.partOutlineDefault} linewidth={1.5} />
      </lineSegments>

      {/* Bond wire contact pads on die surface */}
      {[-0.35, 0.0, 0.35].map((z, i) => (
        <mesh key={i} position={[0.3, 0.02, z]}>
          <boxGeometry args={[0.2, 0.01, 0.2]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* Localized Hotspot on Pad 2 */}
      <group position={[0.3, 0.03, 0.35]}>
        <mesh ref={hotspotMeshRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.02, 0.26, 32]} />
          <meshBasicMaterial
            ref={hotspotMatRef}
            color={THEME.scene.hotspotPulse}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
};

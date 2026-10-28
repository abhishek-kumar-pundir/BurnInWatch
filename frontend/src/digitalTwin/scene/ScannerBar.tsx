import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { THEME } from '../theme';

interface ScannerBarProps {
  currentTime: number;
  active?: boolean;
}

export const ScannerBar: React.FC<ScannerBarProps> = ({ currentTime, active = true }) => {
  const barGroupRef = useRef<THREE.Group>(null);
  const planeMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    if (!barGroupRef.current) return;

    if (!active || currentTime < 22.0) {
      barGroupRef.current.visible = false;
      return;
    }

    barGroupRef.current.visible = true;

    // Rolling window sweep across x-axis
    const cycleTime = (currentTime - 22.0) % 2.5;
    const sweepProgress = cycleTime / 2.5;

    const posX = -1.5 + sweepProgress * 3.0;
    barGroupRef.current.position.x = posX;

    if (planeMatRef.current) {
      planeMatRef.current.opacity = 0.28 + Math.sin(cycleTime * Math.PI) * 0.12;
    }
  });

  return (
    <group ref={barGroupRef} position={[0, 0.25, 0]} visible={false}>
      {/* Translucent holographic scan plane */}
      <mesh>
        <boxGeometry args={[0.28, 0.9, 2.2]} />
        <meshBasicMaterial
          ref={planeMatRef}
          color={THEME.scene.scannerPlane}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Luminous leading laser edge */}
      <mesh position={[0.14, 0, 0]}>
        <boxGeometry args={[0.02, 0.92, 2.22]} />
        <meshBasicMaterial
          color={THEME.scene.scannerLaserEdge}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createBondWireCurves } from './IGBTModule';
import { clamp } from '../timeline';
import { THEME } from '../theme';

interface CurrentFlowProps {
  currentTime: number;
  manualCurrent?: number;
  faultWireIndex?: number; // -1 for none, 0-4
  isManual?: boolean;
}

export const CurrentFlow: React.FC<CurrentFlowProps> = ({
  currentTime,
  manualCurrent,
  faultWireIndex = -1,
  isManual = false,
}) => {
  const curves = useMemo(() => createBondWireCurves(), []);

  // 50 particles per wire * 5 wires = 250 particles
  const particlesPerWire = 50;
  const totalParticles = curves.length * particlesPerWire;

  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorHelper = useMemo(() => new THREE.Color(), []);

  const offsets = useMemo(() => {
    const arr = new Float32Array(totalParticles);
    for (let i = 0; i < totalParticles; i++) {
      arr[i] = (i % particlesPerWire) / particlesPerWire;
    }
    return arr;
  }, [totalParticles, particlesPerWire]);

  useFrame(() => {
    if (!instancedMeshRef.current) return;

    // Particles become active in Stage 3 & 4 (or always in manual mode)
    if (!isManual && currentTime < 12.5) {
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      for (let i = 0; i < totalParticles; i++) {
        instancedMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
      instancedMeshRef.current.instanceMatrix.needsUpdate = true;
      return;
    }

    const currentVal = typeof manualCurrent === 'number' ? manualCurrent : 55.0;
    const baseSpeed = (currentVal / 40.0) * 0.45;

    let index = 0;
    curves.forEach((curve, wireIdx) => {
      const isCrackedWire = faultWireIndex === wireIdx;

      for (let p = 0; p < particlesPerWire; p++) {
        const offset = offsets[index] ?? 0;
        let t = (offset + (isManual ? performance.now() * 0.001 : currentTime) * baseSpeed) % 1.0;

        let scale = 1.0;

        // Crack stutter logic for cracked wire
        if (isCrackedWire) {
          if (t > 0.55 && t < 0.8) {
            scale = 0.0; // Break gap
          } else if (t >= 0.8) {
            scale = Math.sin((isManual ? performance.now() * 0.02 : currentTime * 18.0) + p) > 0 ? 0.6 : 0.0;
          }
        }

        if (scale > 0) {
          const edgeFade = Math.sin(t * Math.PI);
          scale *= edgeFade;
        }

        const point = curve.getPoint(t);
        dummy.position.copy(point);
        // Slightly larger radius (0.045) for crisp visibility on light background
        dummy.scale.setScalar(scale * 0.045);
        dummy.updateMatrix();

        instancedMeshRef.current!.setMatrixAt(index, dummy.matrix);

        // Color coding with normal blending
        if (isCrackedWire) {
          colorHelper.set(THEME.scene.particleFault);
        } else if (currentVal > 50) {
          const warmT = clamp((currentVal - 50) / 25, 0, 1);
          colorHelper.lerpColors(
            new THREE.Color(THEME.scene.particleNormal),
            new THREE.Color(THEME.scene.particleWarning),
            warmT
          );
        } else {
          colorHelper.set(THEME.scene.particleNormal);
        }

        instancedMeshRef.current!.setColorAt(index, colorHelper);
        index++;
      }
    });

    instancedMeshRef.current.instanceMatrix.needsUpdate = true;
    if (instancedMeshRef.current.instanceColor) {
      instancedMeshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={instancedMeshRef}
      args={[undefined, undefined, totalParticles]}
    >
      <sphereGeometry args={[1, 10, 10]} />
      {/* Normal blending with saturated colors for light theme */}
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
};

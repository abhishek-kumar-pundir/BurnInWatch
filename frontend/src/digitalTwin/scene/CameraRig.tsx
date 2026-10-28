import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { clamp, easeInOutCubic } from '../timeline';

interface CameraRigProps {
  currentTime: number;
  stageId: number;
  isPlaying: boolean;
  reducedMotion: boolean;
  isUserInteracting: boolean;
  onUserStartInteraction: () => void;
  resetViewTrigger: number;
}

export const CameraRig: React.FC<CameraRigProps> = ({
  currentTime,
  stageId,
  isPlaying,
  reducedMotion,
  isUserInteracting,
  onUserStartInteraction,
  resetViewTrigger,
}) => {
  const { camera } = useThree();
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const prevResetTrigger = useRef(resetViewTrigger);

  useFrame((_, delta) => {
    // Check if user requested a camera reset
    if (resetViewTrigger !== prevResetTrigger.current) {
      prevResetTrigger.current = resetViewTrigger;
      camera.position.set(0, 3.6, 5.8);
      currentLookAt.current.set(0, 0, 0);
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
      return;
    }

    // If user is currently dragging with OrbitControls, do not override with tour lerp
    if (isUserInteracting || !isPlaying) return;

    let desiredPos = new THREE.Vector3(0, 3.6, 5.8);
    let desiredLook = new THREE.Vector3(0, 0, 0);

    if (stageId === 1) {
      desiredPos.set(0, 3.8, 5.8);
      desiredLook.set(0, 0, 0);
    } else if (stageId === 2) {
      const t = clamp((currentTime - 6.0) / 7.0, 0, 1);
      const easedT = reducedMotion ? t : easeInOutCubic(t);
      desiredPos.set(
        1.2 * (1 - easedT * 0.4),
        3.8 - easedT * 1.8,
        5.8 - easedT * 2.6
      );
      desiredLook.set(0, 0.15 * easedT, 0);
    } else if (stageId === 3) {
      const orbitT = (currentTime - 13.0) / 9.0;
      const angle = orbitT * 0.35;
      const radius = 3.2;

      desiredPos.set(
        Math.sin(angle + 0.4) * radius,
        1.8 + Math.cos(orbitT * Math.PI) * 0.15,
        Math.cos(angle + 0.4) * radius
      );
      desiredLook.set(-0.1, 0.1, 0);
    } else {
      desiredPos.set(0.9, 1.6, 2.8);
      desiredLook.set(0.15, 0.1, 0.15);
    }

    const lerpFactor = reducedMotion ? 0.03 : Math.min(delta * 2.8, 0.15);
    camera.position.lerp(desiredPos, lerpFactor);
    currentLookAt.current.lerp(desiredLook, lerpFactor);
    camera.lookAt(currentLookAt.current);

    if (controlsRef.current) {
      controlsRef.current.target.copy(currentLookAt.current);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2 + 0.04}
      minDistance={1.0}
      maxDistance={9.5}
      onStart={() => onUserStartInteraction()}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
};

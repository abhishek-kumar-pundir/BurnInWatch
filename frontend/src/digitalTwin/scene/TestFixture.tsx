import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clamp, lerp } from '../timeline';
import { THEME } from '../theme';
import { setHoveredPart } from '../hoverStore';

interface TestFixtureProps {
  currentTime: number;
  onSelectPart?: (partId: string) => void;
  onHoverPart?: (partId: string | null) => void;
  selectedPartId?: string | null;
}

export const TestFixture: React.FC<TestFixtureProps> = ({
  currentTime,
  onSelectPart,
  onHoverPart,
  selectedPartId,
}) => {
  const leftClampRef = useRef<THREE.Group>(null);
  const rightClampRef = useRef<THREE.Group>(null);
  const probeRef = useRef<THREE.Group>(null);
  const sparkLightRef = useRef<THREE.PointLight>(null);
  const sparkMeshRef = useRef<THREE.Mesh>(null);
  const ledRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  const handleHoverOver = (id: string, e: any) => {
    e.stopPropagation();
    setHoveredPart(id, e.clientX, e.clientY);
    onHoverPart?.(id);
  };
  const handleHoverMove = (id: string, e: any) => {
    e.stopPropagation();
    setHoveredPart(id, e.clientX, e.clientY);
  };
  const handleHoverOut = (e: any) => {
    e.stopPropagation();
    setHoveredPart(null);
    onHoverPart?.(null);
  };

  useFrame(() => {
    // Stage 1 animation logic:
    // Clamps: slide inward
    const clampProgress = clamp((currentTime - 2.2) / 1.8, 0, 1);
    const leftClampX = lerp(-2.8, -2.1, clampProgress);
    const rightClampX = lerp(2.8, 2.1, clampProgress);

    if (leftClampRef.current) leftClampRef.current.position.x = leftClampX;
    if (rightClampRef.current) rightClampRef.current.position.x = rightClampX;

    // Probes descend to touch top terminals at Y = 0.85
    const probeProgress = clamp((currentTime - 3.8) / 1.0, 0, 1);
    const probeY = lerp(2.2, 1.0, probeProgress);
    if (probeRef.current) probeRef.current.position.y = probeY;

    // Spark flash between 4.4s and 4.8s
    let sparkIntensity = 0;
    if (currentTime >= 4.4 && currentTime <= 4.8) {
      const sparkT = (currentTime - 4.4) / 0.4;
      sparkIntensity = Math.sin(sparkT * Math.PI) * 12;
    }
    if (sparkLightRef.current) sparkLightRef.current.intensity = sparkIntensity;
    if (sparkMeshRef.current) {
      sparkMeshRef.current.scale.setScalar(sparkIntensity > 0.1 ? sparkIntensity * 0.08 : 0);
    }

    // Status LEDs: amber before 4.6s, vibrant green after
    const isReady = currentTime >= 4.6;
    ledRefs.current.forEach((mat) => {
      if (mat) {
        if (isReady) {
          mat.color.set(THEME.status.normal.solid);
          mat.emissive.set(THEME.status.normal.solid);
          mat.emissiveIntensity = 1.2;
        } else {
          mat.color.set(THEME.status.review.solid);
          mat.emissive.set(THEME.status.review.solid);
          mat.emissiveIntensity = 0.8;
        }
      }
    });
  });

  const isClampsSelected = selectedPartId === 'clamps';
  const isProbesSelected = selectedPartId === 'probes';

  return (
    <group position={[0, -0.6, 0]}>
      {/* Heavy industrial bench table */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <boxGeometry args={[8.5, 0.4, 5.8]} />
        <meshStandardMaterial
          color={THEME.scene.benchTop}
          metalness={0.4}
          roughness={0.6}
        />
      </mesh>

      {/* Bench edge line */}
      <mesh position={[0, -0.1, 2.91]}>
        <boxGeometry args={[8.5, 0.03, 0.03]} />
        <meshStandardMaterial
          color={THEME.scene.benchEdge}
          emissive={THEME.scene.benchEdge}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Copper cold plate / test socket */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[3.8, 0.12, 2.6]} />
        <meshStandardMaterial
          color={THEME.scene.coldPlateCopper}
          metalness={0.85}
          roughness={0.3}
        />
      </mesh>

      {/* Guide alignment pins on cold plate */}
      {[-1.7, 1.7].map((x) =>
        [-1.1, 1.1].map((z, j) => (
          <mesh key={`${x}-${j}`} position={[x, 0.05, z]}>
            <cylinderGeometry args={[0.04, 0.04, 0.15, 16]} />
            <meshStandardMaterial color={THEME.scene.pinsBrass} metalness={0.9} roughness={0.2} />
          </mesh>
        ))
      )}

      {/* Left pneumatic clamp arm */}
      <group
        ref={leftClampRef}
        position={[-2.8, 0.2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectPart?.('clamps');
        }}
        onPointerOver={(e) => handleHoverOver('clamps', e)}
        onPointerMove={(e) => handleHoverMove('clamps', e)}
        onPointerOut={handleHoverOut}
      >
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.12, 0.15, 0.7, 16]} />
          <meshStandardMaterial
            color={THEME.scene.clampSteel}
            emissive={isClampsSelected ? THEME.ui.accent : '#000000'}
            emissiveIntensity={isClampsSelected ? 0.4 : 0}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0.35, 0.7, 0]}>
          <boxGeometry args={[0.7, 0.12, 0.35]} />
          <meshStandardMaterial
            color={THEME.scene.clampSteel}
            emissive={isClampsSelected ? THEME.ui.accent : '#000000'}
            emissiveIntensity={isClampsSelected ? 0.4 : 0}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0.65, 0.58, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
          <meshStandardMaterial color={THEME.scene.clampFoot} metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Right pneumatic clamp arm */}
      <group
        ref={rightClampRef}
        position={[2.8, 0.2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectPart?.('clamps');
        }}
        onPointerOver={(e) => handleHoverOver('clamps', e)}
        onPointerMove={(e) => handleHoverMove('clamps', e)}
        onPointerOut={handleHoverOut}
      >
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.12, 0.15, 0.7, 16]} />
          <meshStandardMaterial
            color={THEME.scene.clampSteel}
            emissive={isClampsSelected ? THEME.ui.accent : '#000000'}
            emissiveIntensity={isClampsSelected ? 0.4 : 0}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[-0.35, 0.7, 0]}>
          <boxGeometry args={[0.7, 0.12, 0.35]} />
          <meshStandardMaterial
            color={THEME.scene.clampSteel}
            emissive={isClampsSelected ? THEME.ui.accent : '#000000'}
            emissiveIntensity={isClampsSelected ? 0.4 : 0}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[-0.65, 0.58, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
          <meshStandardMaterial color={THEME.scene.clampFoot} metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Overhead Kelvin electrical probe assembly */}
      <group
        ref={probeRef}
        position={[0, 2.2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectPart?.('probes');
        }}
        onPointerOver={(e) => handleHoverOver('probes', e)}
        onPointerMove={(e) => handleHoverMove('probes', e)}
        onPointerOut={handleHoverOut}
      >
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[2.0, 0.15, 0.6]} />
          <meshStandardMaterial
            color={THEME.scene.probeBody}
            emissive={isProbesSelected ? THEME.ui.accent : '#000000'}
            emissiveIntensity={isProbesSelected ? 0.4 : 0}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        {[-0.6, -0.2, 0.2, 0.6].map((x, i) => (
          <mesh key={i} position={[x, -0.05, 0]}>
            <cylinderGeometry args={[0.02, 0.015, 0.35, 12]} />
            <meshStandardMaterial color={THEME.scene.pinsBrass} metalness={0.95} roughness={0.1} />
          </mesh>
        ))}
        {/* Contact spark flash point */}
        <pointLight ref={sparkLightRef} color="#0284c7" distance={4} intensity={0} position={[0, -0.15, 0]} />
        <mesh ref={sparkMeshRef} position={[0, -0.15, 0]} scale={0}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>

      {/* Status LEDs along front panel */}
      {[-1.2, -0.4, 0.4, 1.2].map((x, i) => (
        <mesh key={i} position={[x, -0.05, 1.8]}>
          <cylinderGeometry args={[0.045, 0.045, 0.05, 16]} />
          <meshStandardMaterial
            ref={(el) => {
              ledRefs.current[i] = el;
            }}
            color={THEME.status.review.solid}
            emissive={THEME.status.review.solid}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
};

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { clamp, lerp, easeInOutCubic } from '../timeline';
import { THEME } from '../theme';
import { setHoveredPart } from '../hoverStore';

// Export bond wire curves for particle flow and crack animation
export function createBondWireCurves(): THREE.CatmullRomCurve3[] {
  // Wire 0: Gate wire (Leadframe to Gate pad)
  const c0 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.1, 0.50, -0.6),
    new THREE.Vector3(-0.75, 0.68, -0.45),
    new THREE.Vector3(-0.4, 0.45, -0.3),
    new THREE.Vector3(-0.25, 0.245, -0.2),
  ]);

  // Wire 1: Primary Emitter Wire A (Leadframe to IGBT Die Pad 1)
  const c1 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.1, 0.52, -0.2),
    new THREE.Vector3(-0.7, 0.72, -0.15),
    new THREE.Vector3(-0.2, 0.52, -0.05),
    new THREE.Vector3(0.15, 0.245, 0.0),
  ]);

  // Wire 2: Primary Emitter Wire B (Fault Susceptible: Leadframe to Overheated Die Pad 2)
  const c2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.1, 0.52, 0.1),
    new THREE.Vector3(-0.65, 0.74, 0.15),
    new THREE.Vector3(-0.15, 0.54, 0.2),
    new THREE.Vector3(0.35, 0.245, 0.25),
  ]);

  // Wire 3: Auxiliary Emitter Wire C
  const c3 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.1, 0.52, 0.4),
    new THREE.Vector3(-0.65, 0.72, 0.38),
    new THREE.Vector3(-0.15, 0.50, 0.35),
    new THREE.Vector3(0.2, 0.245, 0.35),
  ]);

  // Wire 4: Freewheeling Diode Wire (Leadframe to Diode Die Pad)
  const c4 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.1, 0.52, -0.2),
    new THREE.Vector3(0.8, 0.70, -0.15),
    new THREE.Vector3(0.6, 0.46, -0.1),
    new THREE.Vector3(0.45, 0.245, -0.05),
  ]);

  return [c0, c1, c2, c3, c4];
}

interface IGBTModuleProps {
  currentTime: number;
  faultWireIndex?: number; // -1 for none, 0-4
  solderDelaminated?: boolean;
  hasHotspot?: boolean;
  manualTemp?: number;
  onSelectPart?: (partId: string) => void;
  onHoverPart?: (partId: string | null) => void;
  selectedPartId?: string | null;
}

export const IGBTModule: React.FC<IGBTModuleProps> = ({
  currentTime,
  faultWireIndex = -1,
  solderDelaminated = false,
  hasHotspot = false,
  manualTemp,
  onSelectPart,
  onHoverPart,
  selectedPartId,
}) => {
  const moduleGroupRef = useRef<THREE.Group>(null);
  const casingMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const casingEdgesRef = useRef<THREE.LineSegments>(null);
  const wireMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const igbtDieMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const hotspotMeshRef = useRef<THREE.Mesh>(null);
  const hotspotMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const bondWireCurves = useMemo(() => createBondWireCurves(), []);

  // Thicker bond wire radius (0.024) for clear visibility on projector
  const tubeGeometries = useMemo(() => {
    return bondWireCurves.map((curve) => new THREE.TubeGeometry(curve, 32, 0.024, 8, false));
  }, [bondWireCurves]);

  useFrame(() => {
    // Stage 1 (0s - 2.5s): Entire module group descends onto cold plate
    const dropProgress = clamp((currentTime - 0.4) / 2.0, 0, 1);
    const moduleY = lerp(2.2, 0.0, easeInOutCubic(dropProgress));
    if (moduleGroupRef.current) {
      moduleGroupRef.current.position.y = moduleY;
    }

    // Stage 2 (6s - 13s): Casing transparency fades to X-ray mode
    let opacity = 1.0;
    if (currentTime >= 6.0) {
      const fadeProgress = clamp((currentTime - 6.0) / 3.5, 0, 1);
      opacity = lerp(1.0, 0.18, easeInOutCubic(fadeProgress));
    }

    if (casingMatRef.current) {
      casingMatRef.current.opacity = opacity;
      casingMatRef.current.transparent = opacity < 0.99;
      // In X-ray mode, casing is translucent pale slate
      casingMatRef.current.color.set(
        opacity < 0.99 ? THEME.scene.casingXray : THEME.scene.casingOpaque
      );
      casingMatRef.current.roughness = opacity < 0.99 ? 0.25 : 0.45;
    }

    if (casingEdgesRef.current) {
      const edgeMat = casingEdgesRef.current.material as THREE.LineBasicMaterial;
      if (edgeMat) {
        // Crisp dark-teal edge line in X-ray mode, dark-slate in opaque mode
        edgeMat.color.set(
          opacity < 0.99 ? THEME.scene.casingEdgeOutline : THEME.scene.partOutlineDefault
        );
        edgeMat.opacity = opacity < 0.99 ? 0.85 : 0.95;
      }
    }

    // Dynamic Thermal Die Color (Teal -> Amber -> Crimson)
    if (igbtDieMatRef.current) {
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

      if (temp <= 50) {
        igbtDieMatRef.current.color.set(THEME.scene.dieNominal);
        igbtDieMatRef.current.emissive.set(THEME.scene.dieNominal);
        igbtDieMatRef.current.emissiveIntensity = 0.25;
      } else if (temp <= 100) {
        const t = (temp - 50) / 50;
        igbtDieMatRef.current.color.lerpColors(
          new THREE.Color(THEME.scene.dieNominal),
          new THREE.Color(THEME.scene.dieWarm),
          t
        );
        igbtDieMatRef.current.emissive.lerpColors(
          new THREE.Color(THEME.scene.dieNominal),
          new THREE.Color(THEME.scene.dieWarm),
          t
        );
        igbtDieMatRef.current.emissiveIntensity = 0.25 + t * 0.4;
      } else {
        const t = clamp((temp - 100) / 50, 0, 1);
        igbtDieMatRef.current.color.lerpColors(
          new THREE.Color(THEME.scene.dieWarm),
          new THREE.Color(THEME.scene.dieHot),
          t
        );
        igbtDieMatRef.current.emissive.lerpColors(
          new THREE.Color(THEME.scene.dieWarm),
          new THREE.Color(THEME.scene.dieHot),
          t
        );
        igbtDieMatRef.current.emissiveIntensity = 0.65 + t * 0.6;
      }

      if (selectedPartId === 'die_igbt') {
        igbtDieMatRef.current.emissive.set(THEME.ui.accent);
        igbtDieMatRef.current.emissiveIntensity = 0.6;
      }
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

    // Bond Wire crack state
    wireMatRefs.current.forEach((mat, idx) => {
      if (!mat) return;
      const isCracked = faultWireIndex === idx;
      if (isCracked) {
        mat.color.set(THEME.scene.bondWireCracked);
        mat.emissive.set('#ef4444');
        mat.emissiveIntensity = 1.6;
      } else {
        const isSelected = selectedPartId === `bond_wire_${idx}`;
        mat.color.set(isSelected ? THEME.scene.bondWireHighlight : THEME.scene.bondWireNormal);
        mat.emissive.set(isSelected ? THEME.ui.accent : '#000000');
        mat.emissiveIntensity = isSelected ? 0.5 : 0;
      }
    });
  });

  const isSelected = (id: string) => selectedPartId === id;

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

  return (
    <group ref={moduleGroupRef} position={[0, 0, 0]}>
      {/* ============================================================== */}
      {/* 1. BOTTOM: HEATSINK (Fins pointing DOWN below the baseplate)   */}
      {/* ============================================================== */}
      <group
        position={[0, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectPart?.('heatsink');
        }}
        onPointerOver={(e) => handleHoverOver('heatsink', e)}
        onPointerMove={(e) => handleHoverMove('heatsink', e)}
        onPointerOut={handleHoverOut}
      >
        {/* Heatsink Base Plate (thickness 0.10, from Y = -0.05 to Y = 0.05) */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[3.2, 0.10, 2.2]} />
          <meshStandardMaterial
            color={THEME.scene.heatsinkBase}
            emissive={isSelected('heatsink') ? THEME.ui.accent : '#000000'}
            emissiveIntensity={isSelected('heatsink') ? 0.35 : 0}
            metalness={0.65}
            roughness={0.35}
          />
          <Edges threshold={15} color={THEME.scene.partOutlineDefault} />
        </mesh>

        {/* 9 Extruded Cooling Fins pointing DOWN (from Y = -0.05 down to Y = -0.35) */}
        {[-1.4, -1.05, -0.7, -0.35, 0, 0.35, 0.7, 1.05, 1.4].map((x, i) => (
          <mesh key={i} position={[x, -0.20, 0]}>
            <boxGeometry args={[0.045, 0.30, 2.15]} />
            <meshStandardMaterial
              color={THEME.scene.heatsinkFins}
              metalness={0.7}
              roughness={0.3}
            />
            <Edges threshold={15} color={THEME.scene.partOutlineDefault} />
          </mesh>
        ))}
      </group>

      {/* ============================================================== */}
      {/* 2. COPPER BASEPLATE (Flush on top of heatsink plate)           */}
      {/* ============================================================== */}
      <group
        position={[0, 0.09, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectPart?.('baseplate');
        }}
        onPointerOver={(e) => handleHoverOver('baseplate', e)}
        onPointerMove={(e) => handleHoverMove('baseplate', e)}
        onPointerOut={handleHoverOut}
      >
        <mesh>
          <boxGeometry args={[3.0, 0.08, 2.0]} />
          <meshStandardMaterial
            color={THEME.scene.baseplateCopper}
            emissive={isSelected('baseplate') ? THEME.ui.accent : '#000000'}
            emissiveIntensity={isSelected('baseplate') ? 0.35 : 0}
            metalness={0.88}
            roughness={0.25}
          />
          <Edges threshold={15} color={THEME.scene.partOutlineDefault} />
        </mesh>
      </group>

      {/* ============================================================== */}
      {/* 3. SOLDER LAYER (Between baseplate and DBC ceramic)            */}
      {/* ============================================================== */}
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[2.8, 0.02, 1.8]} />
        <meshStandardMaterial
          color={solderDelaminated ? THEME.scene.solderDelaminated : THEME.scene.solderLayer}
          emissive={solderDelaminated ? '#b45309' : '#000000'}
          emissiveIntensity={solderDelaminated ? 0.6 : 0}
          metalness={0.85}
          roughness={0.3}
        />
        <Edges threshold={15} color={THEME.scene.partOutlineDefault} />
      </mesh>

      {/* ============================================================== */}
      {/* 4. DIRECT BONDED COPPER (DBC) CERAMIC SUBSTRATE                */}
      {/* ============================================================== */}
      <group
        position={[0, 0.17, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectPart?.('dbc_substrate');
        }}
        onPointerOver={(e) => handleHoverOver('dbc_substrate', e)}
        onPointerMove={(e) => handleHoverMove('dbc_substrate', e)}
        onPointerOut={handleHoverOut}
      >
        {/* White Ceramic Substrate Layer */}
        <mesh>
          <boxGeometry args={[2.7, 0.04, 1.7]} />
          <meshStandardMaterial
            color={THEME.scene.ceramicDbc}
            emissive={isSelected('dbc_substrate') ? THEME.ui.accent : '#000000'}
            emissiveIntensity={isSelected('dbc_substrate') ? 0.3 : 0}
            metalness={0.1}
            roughness={0.65}
          />
          <Edges threshold={15} color={THEME.scene.partOutlineDefault} />
        </mesh>

        {/* Etched Copper Circuit Islands on top of ceramic */}
        <mesh position={[-0.5, 0.0275, 0]}>
          <boxGeometry args={[1.2, 0.015, 1.4]} />
          <meshStandardMaterial
            color={THEME.scene.dbcCopperIslands}
            metalness={0.8}
            roughness={0.3}
          />
          <Edges threshold={15} color={THEME.scene.partOutlineDefault} />
        </mesh>
        <mesh position={[0.6, 0.0275, 0]}>
          <boxGeometry args={[0.9, 0.015, 1.4]} />
          <meshStandardMaterial
            color={THEME.scene.dbcCopperIslands}
            metalness={0.8}
            roughness={0.3}
          />
          <Edges threshold={15} color={THEME.scene.partOutlineDefault} />
        </mesh>
      </group>

      {/* ============================================================== */}
      {/* 5. SILICON DIES (Mounted on Copper Circuit Islands)             */}
      {/* ============================================================== */}
      {/* IGBT Switching Die */}
      <group
        position={[-0.5, 0.2225, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectPart?.('die_igbt');
        }}
        onPointerOver={(e) => handleHoverOver('die_igbt', e)}
        onPointerMove={(e) => handleHoverMove('die_igbt', e)}
        onPointerOut={handleHoverOut}
      >
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.05, 0.035, 1.25]} />
          <meshStandardMaterial
            ref={igbtDieMatRef}
            color={THEME.scene.dieNominal}
            metalness={0.65}
            roughness={0.25}
            emissive={THEME.scene.dieNominal}
            emissiveIntensity={0.25}
          />
          <Edges threshold={15} color={THEME.scene.partOutlineDefault} />
        </mesh>

        {/* Die contact pads */}
        {[-0.35, 0.0, 0.35].map((z, i) => (
          <mesh key={i} position={[0.3, 0.02, z]}>
            <boxGeometry args={[0.2, 0.01, 0.2]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
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

      {/* Freewheeling Diode (FWD) Die */}
      <group
        position={[0.6, 0.22, -0.2]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectPart?.('die_diode');
        }}
        onPointerOver={(e) => handleHoverOver('die_diode', e)}
        onPointerMove={(e) => handleHoverMove('die_diode', e)}
        onPointerOut={handleHoverOut}
      >
        <mesh>
          <boxGeometry args={[0.55, 0.03, 0.55]} />
          <meshStandardMaterial
            color={THEME.scene.diodeDie}
            emissive={isSelected('die_diode') ? THEME.ui.accent : '#000000'}
            emissiveIntensity={isSelected('die_diode') ? 0.35 : 0}
            metalness={0.8}
            roughness={0.25}
          />
          <Edges threshold={15} color={THEME.scene.partOutlineDefault} />
        </mesh>
      </group>

      {/* ============================================================== */}
      {/* 6. BOND WIRES (Arched 3D Tubes with Thicker Radius)           */}
      {/* ============================================================== */}
      {tubeGeometries.map((geom, idx) => (
        <mesh
          key={idx}
          geometry={geom}
          onClick={(e) => {
            e.stopPropagation();
            onSelectPart?.(`bond_wire_${idx}`);
          }}
          onPointerOver={(e) => handleHoverOver(`bond_wire_${idx}`, e)}
          onPointerMove={(e) => handleHoverMove(`bond_wire_${idx}`, e)}
          onPointerOut={handleHoverOut}
        >
          <meshStandardMaterial
            ref={(el) => {
              wireMatRefs.current[idx] = el;
            }}
            color={THEME.scene.bondWireNormal}
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
      ))}

      {/* ============================================================== */}
      {/* 7. CASING SHELL (Enclosing Stack, Pale Slate, Semi-Glossy)     */}
      {/* ============================================================== */}
      <group
        position={[0, 0.375, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectPart?.('casing');
        }}
        onPointerOver={(e) => handleHoverOver('casing', e)}
        onPointerMove={(e) => handleHoverMove('casing', e)}
        onPointerOut={handleHoverOut}
      >
        <mesh>
          <boxGeometry args={[3.02, 0.49, 2.02]} />
          <meshPhysicalMaterial
            ref={casingMatRef}
            color={THEME.scene.casingOpaque}
            metalness={0.2}
            roughness={0.45}
            transmission={0.75}
            thickness={0.5}
            transparent={false}
            opacity={1.0}
          />
        </mesh>
        <lineSegments ref={casingEdgesRef}>
          <edgesGeometry args={[new THREE.BoxGeometry(3.025, 0.495, 2.025)]} />
          <lineBasicMaterial
            color={THEME.scene.partOutlineDefault}
            linewidth={1.5}
            transparent
            opacity={0.95}
          />
        </lineSegments>
      </group>

      {/* ============================================================== */}
      {/* 8. TERMINALS (Mounted ON TOP OF CASING ROOF)                   */}
      {/* ============================================================== */}
      <group
        position={[0, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectPart?.('terminals');
        }}
        onPointerOver={(e) => handleHoverOver('terminals', e)}
        onPointerMove={(e) => handleHoverMove('terminals', e)}
        onPointerOut={handleHoverOut}
      >
        {/* Gate & Emitter Control Terminals on Roof (X = -1.15, Y = 0.725) */}
        {[-0.6, -0.2, 0.1, 0.4].map((z, i) => (
          <mesh key={i} position={[-1.15, 0.725, z]}>
            <boxGeometry args={[0.22, 0.25, 0.16]} />
            <meshStandardMaterial
              color={THEME.scene.terminalsSteel}
              emissive={isSelected('terminals') ? THEME.ui.accent : '#000000'}
              emissiveIntensity={isSelected('terminals') ? 0.4 : 0}
              metalness={0.85}
              roughness={0.25}
            />
            <Edges threshold={15} color={THEME.scene.partOutlineDefault} />
          </mesh>
        ))}

        {/* Collector Power Terminal on Roof (X = 1.15, Y = 0.725) */}
        <mesh position={[1.15, 0.725, -0.2]}>
          <boxGeometry args={[0.26, 0.25, 0.24]} />
          <meshStandardMaterial
            color={THEME.scene.terminalsSteel}
            emissive={isSelected('terminals') ? THEME.ui.accent : '#000000'}
            emissiveIntensity={isSelected('terminals') ? 0.4 : 0}
            metalness={0.85}
            roughness={0.25}
          />
          <Edges threshold={15} color={THEME.scene.partOutlineDefault} />
        </mesh>
      </group>
    </group>
  );
};

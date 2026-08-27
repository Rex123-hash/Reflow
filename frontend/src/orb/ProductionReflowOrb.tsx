import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  BRASS_PIN_PLACEMENTS,
  OUTER_TRACK_SEGMENTS,
  RADIAL_SEAM_ANGLES,
  REFLOW_ORB_DIMENSIONS,
  SATELLITE_PLACEMENTS,
  TRACK_SEGMENTS,
  createFittedArcGeometry,
  createRadialSeamGeometry,
  createTrackSegmentGeometry,
} from "./reflowOrbGeometry";
import { REFLOW_MATERIALS, useReflowSurfaceMaps } from "./reflowOrbMaterials";

export interface ProductionReflowOrbProps {
  rootRef: RefObject<THREE.Group | null>;
  motionEnabled?: boolean;
}

function BrassFastener({ angle, radius }: { angle: number; radius: number }) {
  return (
    <group position={[Math.cos(angle) * radius, 0.475, Math.sin(angle) * radius]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.034, 0.039, 0.038, 32]} />
        <meshPhysicalMaterial {...REFLOW_MATERIALS.brass} />
      </mesh>
      <mesh position-y={0.029} castShadow>
        <sphereGeometry args={[0.047, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshPhysicalMaterial {...REFLOW_MATERIALS.brass} />
      </mesh>
    </group>
  );
}

function SageSatellite({ angle, radius, size, index, motionEnabled }: { angle: number; radius: number; size: number; index:number; motionEnabled:boolean }) {
  const groupRef=useRef<THREE.Group>(null);
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const centerY = -0.18 + size * 0.86;
  useFrame((state)=>{if(!motionEnabled||!groupRef.current)return; const speeds=[.105,.135,.082]; const phase=angle+state.clock.elapsedTime*speeds[index]; const drift=Math.sin(state.clock.elapsedTime*(.13+index*.025))*size*.16; groupRef.current.position.set(Math.cos(phase)*radius,drift,Math.sin(phase)*radius);});
  return (
    <group ref={groupRef} position={[x, 0, z]}>
      <mesh position-y={-0.247} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[size * 0.8, 40]} />
        <meshBasicMaterial color="#17211c" transparent opacity={0.075} depthWrite={false} />
      </mesh>
      <mesh position-y={centerY} castShadow scale={[1.02, 0.84, 0.97]} rotation={[0.04, angle * 0.13, -0.025]}>
        <icosahedronGeometry args={[size, 5]} />
        <meshPhysicalMaterial {...REFLOW_MATERIALS.sage} />
      </mesh>
    </group>
  );
}

export function ProductionReflowOrb({ rootRef, motionEnabled=false }: ProductionReflowOrbProps) {
  const surfaceMaps = useReflowSurfaceMaps();
  const hubMaterial = useRef<THREE.MeshPhysicalMaterial>(null);
  useFrame((state)=>{if(!motionEnabled||!hubMaterial.current)return;hubMaterial.current.emissiveIntensity=.018+Math.sin(state.clock.elapsedTime*.22)*.006;});
  const bodyProfile = useMemo(
    () => [
      new THREE.Vector2(0, -0.18),
      new THREE.Vector2(2.49, -0.18),
      new THREE.Vector2(2.61, -0.155),
      new THREE.Vector2(2.7, -0.09),
      new THREE.Vector2(2.72, -0.015),
      new THREE.Vector2(2.69, 0.095),
      new THREE.Vector2(2.61, 0.15),
      new THREE.Vector2(0, 0.15),
    ],
    [],
  );
  const topProfile = useMemo(
    () => [
      new THREE.Vector2(0, 0.145),
      new THREE.Vector2(2.34, 0.145),
      new THREE.Vector2(2.42, 0.17),
      new THREE.Vector2(2.46, 0.225),
      new THREE.Vector2(2.43, 0.31),
      new THREE.Vector2(2.35, 0.335),
      new THREE.Vector2(0, 0.335),
    ],
    [],
  );
  const trackGeometries = useMemo(
    () => TRACK_SEGMENTS.map((segment) => createTrackSegmentGeometry(segment.start, segment.end)),
    [],
  );
  const outerTrackGeometries = useMemo(
    () => OUTER_TRACK_SEGMENTS.map((segment) => createFittedArcGeometry({
      inner: 2.5,
      outer: 2.585,
      bottom: 0.145,
      top: 0.208,
      bevel: 0.014,
      start: segment.start,
      end: segment.end,
      segments: 100,
    })),
    [],
  );
  const centerTrackGeometry = useMemo(
    () => createFittedArcGeometry({
      inner: 0.43,
      outer: 0.515,
      bottom: 0.487,
      top: 0.51,
      bevel: 0.008,
      start: -0.42,
      end: Math.PI * 1.38,
      segments: 96,
    }),
    [],
  );
  const radialSeams = useMemo(
    () => RADIAL_SEAM_ANGLES.map((angle) => createRadialSeamGeometry(angle)),
    [],
  );

  return (
    <group ref={rootRef} name="ProductionReflowOrb" rotation-y={-0.18}>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[bodyProfile, 192]} />
        <meshPhysicalMaterial
          {...REFLOW_MATERIALS.ceramicBase}
          map={surfaceMaps.color}
          roughnessMap={surfaceMaps.roughness}
          bumpMap={surfaceMaps.bump}
          bumpScale={0.013}
        />
      </mesh>
      <mesh castShadow receiveShadow>
        <latheGeometry args={[topProfile, 192]} />
        <meshPhysicalMaterial
          {...REFLOW_MATERIALS.ceramicTop}
          map={surfaceMaps.color}
          roughnessMap={surfaceMaps.roughness}
          bumpMap={surfaceMaps.bump}
          bumpScale={0.012}
        />
      </mesh>

      <mesh position-y={0.338} rotation-x={Math.PI / 2}>
        <torusGeometry args={[REFLOW_ORB_DIMENSIONS.seamRadius, 0.0045, 6, 192]} />
        <meshStandardMaterial color="#817a70" roughness={0.98} transparent opacity={0.52} />
      </mesh>
      <mesh position-y={0.338} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.48, 0.0038, 6, 160]} />
        <meshStandardMaterial color="#817a70" roughness={0.98} transparent opacity={0.44} />
      </mesh>
      {radialSeams.map((geometry, index) => (
        <lineSegments key={index} geometry={geometry}>
          <lineBasicMaterial color="#7e776e" transparent opacity={0.4} />
        </lineSegments>
      ))}

      {trackGeometries.map((geometry, index) => (
        <mesh key={TRACK_SEGMENTS[index].id} geometry={geometry} castShadow receiveShadow>
          <meshPhysicalMaterial {...REFLOW_MATERIALS.forestInsert} roughnessMap={surfaceMaps.roughness} bumpMap={surfaceMaps.bump} bumpScale={0.0038} />
        </mesh>
      ))}
      {outerTrackGeometries.map((geometry, index) => (
        <mesh key={OUTER_TRACK_SEGMENTS[index].id} geometry={geometry} castShadow receiveShadow>
          <meshPhysicalMaterial {...REFLOW_MATERIALS.forestInsert} roughness={0.72} roughnessMap={surfaceMaps.roughness} bumpMap={surfaceMaps.bump} bumpScale={0.0032} />
        </mesh>
      ))}

      <mesh position-y={0.365} castShadow receiveShadow>
        <cylinderGeometry args={[0.94, 0.99, 0.09, 144]} />
        <meshPhysicalMaterial
          {...REFLOW_MATERIALS.ceramicHighlight}
          map={surfaceMaps.color}
          roughnessMap={surfaceMaps.roughness}
          bumpMap={surfaceMaps.bump}
          bumpScale={0.0048}
        />
      </mesh>
      <mesh position-y={0.431} castShadow receiveShadow>
        <cylinderGeometry args={[0.63, 0.67, 0.07, 128]} />
        <meshPhysicalMaterial
          {...REFLOW_MATERIALS.ceramicTop}
          map={surfaceMaps.color}
          roughnessMap={surfaceMaps.roughness}
          bumpMap={surfaceMaps.bump}
          bumpScale={0.0042}
        />
      </mesh>
      <mesh geometry={centerTrackGeometry} castShadow>
        <meshPhysicalMaterial {...REFLOW_MATERIALS.forestInsert} />
      </mesh>
      <mesh position-y={0.512} castShadow>
        <cylinderGeometry args={[0.16, 0.17, 0.06, 72]} />
        <meshPhysicalMaterial ref={hubMaterial} color="#24382f" emissive="#29463b" emissiveIntensity={0.018} roughness={0.66} metalness={0.03} />
      </mesh>

      {BRASS_PIN_PLACEMENTS.map((pin) => (
        <BrassFastener key={pin.angle} {...pin} />
      ))}
      {SATELLITE_PLACEMENTS.map((satellite,index) => (
        <SageSatellite key={satellite.angle} {...satellite} index={index} motionEnabled={motionEnabled} />
      ))}
    </group>
  );
}

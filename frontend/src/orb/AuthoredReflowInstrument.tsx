import { useFrame, useLoader } from "@react-three/fiber";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { StoryStageId } from "../data/proofManifest";
import {
  AuthoredSatelliteInstrument,
  SATELLITE_PROFILES,
  useSatelliteMaterials,
  type SatelliteKind,
} from "./AuthoredSatelliteInstrument";
import {
  AUTHORED_REFLOW_GLB,
  tuneAuthoredMaterial,
  useAuthoredMicroMaps,
} from "./authoredReflowRendering";

export interface AuthoredReflowInstrumentProps {
  rootRef: RefObject<THREE.Group | null>;
  progress: MutableRefObject<number>;
  activeStage: StoryStageId;
  motionEnabled: boolean;
  /** The GLB parsed and materials were tuned. NOT the same as a drawn frame. */
  onModelReady: () => void;
}

interface SatelliteOrbit {
  kind: SatelliteKind;
  bodyRadius: number;
  scale: [number, number, number];
  radiusX: number;
  radiusZ: number;
  period: number;
  phase: number;
  inclination: number;
  height: number;
  verticalBias: number;
}

const SATELLITES: SatelliteOrbit[] = [
  {
    kind: "plan",
    bodyRadius: 0.19,
    scale: [1, 0.96, 1.05],
    radiusX: 3.05,
    radiusZ: 2.52,
    period: 45,
    phase: 3.52,
    inclination: 0.018,
    height: 0.035,
    verticalBias: 0.1,
  },
  {
    kind: "act",
    bodyRadius: 0.205,
    scale: [1.02, 0.97, 1],
    radiusX: 3.55,
    radiusZ: 2.94,
    period: 57,
    phase: 1.86,
    inclination: -0.03,
    height: 0.045,
    verticalBias: 0.11,
  },
  {
    kind: "verify",
    bodyRadius: 0.2,
    scale: [1.04, 0.97, 1.02],
    radiusX: 4.05,
    radiusZ: 3.32,
    period: 68,
    phase: 5.68,
    inclination: 0.038,
    height: 0.055,
    verticalBias: 0.12,
  },
];

function smoothRange(value: number, start: number, end: number) {
  const raw = Math.max(
    0,
    Math.min(1, (value - start) / Math.max(0.0001, end - start)),
  );
  return raw * raw * (3 - 2 * raw);
}

function AuthoredSatellite({
  bodyRadius,
  scale,
  radiusX,
  radiusZ,
  period,
  phase,
  inclination,
  height,
  verticalBias,
  index,
  motionEnabled,
  progress,
  kind,
  materials,
}: SatelliteOrbit & {
  index: number;
  motionEnabled: boolean;
  progress: MutableRefObject<number>;
  materials: ReturnType<typeof useSatelliteMaterials>;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!motionEnabled || !ref.current) return;
    const storyProgress = progress.current;
    const impact = smoothRange(storyProgress, 0.08, 0.19);
    const futures = smoothRange(storyProgress, 0.23, 0.36);
    const action = smoothRange(storyProgress, 0.39, 0.52);
    const incomplete = smoothRange(storyProgress, 0.55, 0.65);
    const replan =
      smoothRange(storyProgress, 0.675, 0.79) *
      (1 - smoothRange(storyProgress, 0.84, 0.955));
    const restored = smoothRange(storyProgress, 0.84, 0.96);
    const storyAngle =
      impact * ([0.05, -0.035, 0.065][index] ?? 0) +
      futures * ([0.07, 0.045, -0.055][index] ?? 0) +
      action * ([-0.04, 0.055, 0.025][index] ?? 0) +
      incomplete * ([-0.035, 0.02, -0.025][index] ?? 0) +
      replan * ([0.16, -0.13, 0.19][index] ?? 0) +
      restored * ([-0.025, 0.02, -0.018][index] ?? 0);
    const radiusScale =
      1 +
      impact * 0.035 +
      futures * ([0.035, 0.055, 0.07][index] ?? 0) -
      action * ([0.025, 0.012, 0.035][index] ?? 0) +
      replan * ([0.025, -0.018, 0.035][index] ?? 0) -
      restored * 0.025;
    const angle =
      phase + (state.clock.elapsedTime * Math.PI * 2) / period + storyAngle;
    const localX = Math.cos(angle) * radiusX * radiusScale;
    const localZ = Math.sin(angle) * radiusZ * radiusScale;
    ref.current.position.set(
      localX,
      verticalBias +
        localZ * inclination +
        Math.sin(angle * 2 + phase) * height +
        replan * ([0.025, -0.018, 0.03][index] ?? 0),
      localZ,
    );
  });
  const frozenAngle = phase;
  const frozenZ = Math.sin(frozenAngle) * radiusZ;
  return (
    <group
      ref={ref}
      position={[
        Math.cos(frozenAngle) * radiusX,
        verticalBias +
          frozenZ * inclination +
          Math.sin(frozenAngle * 2 + phase) * height,
        frozenZ,
      ]}
      scale={scale}
    >
      <AuthoredSatelliteInstrument
        profile={SATELLITE_PROFILES[kind]}
        materials={materials}
      />
    </group>
  );
}

export function AuthoredReflowInstrument({
  rootRef,
  progress,
  activeStage,
  motionEnabled,
  onModelReady,
}: AuthoredReflowInstrumentProps) {
  const gltf = useLoader(GLTFLoader, AUTHORED_REFLOW_GLB);
  const maps = useAuthoredMicroMaps();
  const satelliteMaterials = useSatelliteMaterials();
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const materials = new Map<string, THREE.Material>();
    clone.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
      const source = Array.isArray(node.material)
        ? node.material
        : [node.material];
      const tuned = source.map((material) => {
        const reflectionGroup =
          material.name === "ForestEnamel" &&
          (node.name === "PrimaryForestTrack_1" ||
            node.name === "InnerRecoveryArc")
            ? node.name
            : "shared";
        const key = `${material.uuid}:${reflectionGroup}`;
        if (!materials.has(key))
          materials.set(key, tuneAuthoredMaterial(material, maps, node.name));
        return materials.get(key)!;
      });
      node.material = Array.isArray(node.material) ? tuned : tuned[0];
    });
    const partNames = [
      "PrimaryForestTrack_0",
      "PrimaryForestTrack_1",
      "PrimaryTrackRecess_0",
      "PrimaryTrackRecess_1",
      "InnerRecoveryArc",
      "InnerRecoveryRecess",
      "SecondaryForestTrack_0",
      "SecondaryTrackRecess_0",
    ];
    const parts = new Map<
      string,
      { node: THREE.Object3D; rotationY: number }
    >();
    partNames.forEach((name) => {
      const node = clone.getObjectByName(name);
      if (node) parts.set(name, { node, rotationY: node.rotation.y });
    });
    return { scene: clone, materials: [...materials.values()], parts };
  }, [gltf.scene, maps]);

  useFrame(() => {
    const phase = motionEnabled
      ? smoothRange(progress.current, 0.675, 0.79) *
        (1 - smoothRange(progress.current, 0.84, 0.955))
      : 0;
    const rotations: Record<string, number> = {
      PrimaryForestTrack_0: -9,
      PrimaryTrackRecess_0: -9,
      PrimaryForestTrack_1: 14,
      PrimaryTrackRecess_1: 14,
      InnerRecoveryArc: -11,
      InnerRecoveryRecess: -11,
      SecondaryForestTrack_0: 8,
      SecondaryTrackRecess_0: 8,
    };
    model.parts.forEach(({ node, rotationY }, name) => {
      node.rotation.y =
        rotationY + THREE.MathUtils.degToRad(rotations[name] ?? 0) * phase;
    });
  });

  // Signals only that the model exists. Whether anything was *drawn* is decided
  // by SceneReadyGate, from the renderer's own frame statistics.
  useLayoutEffect(() => {
    model.scene.updateMatrixWorld(true);
    onModelReady();
  }, [model, onModelReady]);

  useEffect(
    () => () => {
      model.materials.forEach((material) => material.dispose());
    },
    [model],
  );

  return (
    <group
      ref={rootRef}
      name="AuthoredReflowInstrument"
      userData={{ activeStage }}
    >
      <primitive object={model.scene} />
      {SATELLITES.map((satellite, index) => (
        <AuthoredSatellite
          key={index}
          {...satellite}
          index={index}
          motionEnabled={motionEnabled}
          progress={progress}
          materials={satelliteMaterials}
        />
      ))}
    </group>
  );
}

useLoader.preload(GLTFLoader, AUTHORED_REFLOW_GLB);

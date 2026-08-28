import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export const AUTHORED_REFLOW_GLB = "/experiments/browser-converged-v1/reflow-orb-browser-converged-v1.glb";

export const AUTHORED_ORB_ANCHORS = {
  objectiveHub: new THREE.Vector3(0, 0.48, 0),
  recoveryTrackTangent: new THREE.Vector3(2.420764, 0.34, 0.490713),
  impactSource: new THREE.Vector3(-2.962439, 0.3, 0.473237),
  futureA: new THREE.Vector3(-2.322983, 0.3, 2.200852),
  futureB: new THREE.Vector3(-0.039644, 0.3, 3.199754),
  futureC: new THREE.Vector3(2.967931, 0.3, 1.196405),
  actionExit: new THREE.Vector3(2.383417, 0.34, 0.685362),
} as const;

export const AUTHORED_ORB_RAILS = {
  nearInner: 3.0456,
  nearMiddle: 3.4122,
  nearOuter: 3.7788,
  outerInner: 4.7658,
  outerOuter: 5.4426,
} as const;

export const AUTHORED_RAIL_HEIGHT = 0.22;
export const AUTHORED_BODY_RADIUS = 2.82;
export const AUTHORED_BODY_FLOOR = -0.165;

function seeded(index: number) {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export interface AuthoredMicroMaps {
  normal: THREE.DataTexture;
  roughness: THREE.DataTexture;
}

export function useAuthoredMicroMaps(): AuthoredMicroMaps {
  const maps = useMemo(() => {
    const size = 512;
    const count = size * size;
    const heights = new Float32Array(count);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const index = y * size + x;
        const broad = Math.sin(x * 0.071) * 0.17 + Math.cos(y * 0.083) * 0.15;
        const fine = (seeded(index) - 0.5) * 0.34 + (seeded(index * 7 + 19) - 0.5) * 0.12;
        heights[index] = broad + fine;
      }
    }
    const normalData = new Uint8Array(count * 4);
    const roughnessData = new Uint8Array(count * 4);
    const sample = (x: number, y: number) => heights[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const index = y * size + x;
        const dx = (sample(x + 1, y) - sample(x - 1, y)) * 0.42;
        const dy = (sample(x, y + 1) - sample(x, y - 1)) * 0.42;
        const normal = new THREE.Vector3(-dx, -dy, 1).normalize();
        const offset = index * 4;
        normalData[offset] = Math.round((normal.x * 0.5 + 0.5) * 255);
        normalData[offset + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
        normalData[offset + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
        normalData[offset + 3] = 255;
        const roughness = Math.round(224 + Math.max(-12, Math.min(12, heights[index] * 24)));
        roughnessData[offset] = 255;
        roughnessData[offset + 1] = roughness;
        roughnessData[offset + 2] = 255;
        roughnessData[offset + 3] = 255;
      }
    }
    const normal = new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat);
    const roughness = new THREE.DataTexture(roughnessData, size, size, THREE.RGBAFormat);
    for (const texture of [normal, roughness]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(7, 7);
      texture.colorSpace = THREE.NoColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
    }
    return { normal, roughness };
  }, []);
  useEffect(() => () => {
    maps.normal.dispose();
    maps.roughness.dispose();
  }, [maps]);
  return maps;
}

export function tuneAuthoredMaterial(material: THREE.Material, maps: AuthoredMicroMaps, nodeName: string) {
  if (!(material instanceof THREE.MeshPhysicalMaterial)) return material.clone();
  const next = material.clone();
  next.envMapIntensity = 0.8;
  if (next.name === "CeramicTop") {
    next.color.set("#fff6e9");
    next.roughness = 0.62;
    next.clearcoat = 0.055;
    next.clearcoatRoughness = 0.58;
    next.envMapIntensity = 0.65;
    next.normalMap = maps.normal;
    next.normalScale.set(0.022, 0.022);
    next.roughnessMap = maps.roughness;
  } else if (next.name === "ProductionWarmSidewall") {
    next.color.set("#e1d3c0");
    next.roughness = 0.71;
    next.clearcoat = 0.02;
    next.clearcoatRoughness = 0.68;
    next.envMapIntensity = 0.62;
    next.normalMap = maps.normal;
    next.normalScale.set(0.013, 0.013);
  } else if (next.name === "ForestEnamel") {
    next.color.set("#073821");
    next.metalness = 0.06;
    next.roughness = 0.41;
    next.clearcoat = 0.14;
    next.clearcoatRoughness = 0.39;
    next.ior = 1.48;
    const reflectionFacing = nodeName === "PrimaryForestTrack_1" || nodeName === "InnerRecoveryArc";
    next.envMapIntensity = nodeName === "PrimaryForestTrack_1" ? 2.25 : nodeName === "InnerRecoveryArc" ? 1.2 : 0.34;
    if (reflectionFacing) {
      next.clearcoat = 0.2;
      next.clearcoatRoughness = 0.34;
    }
  } else if (next.name === "MutedPrecisionBrass") {
    next.color.set("#b7965a");
    next.metalness = 0.92;
    next.roughness = 0.26;
    next.clearcoat = 0.035;
    next.clearcoatRoughness = 0.3;
    next.envMapIntensity = 1.72;
  } else if (next.name === "CeramicGroove") {
    next.color.set("#9d9485");
    next.roughness = 0.9;
    next.envMapIntensity = 0.35;
  } else if (next.name === "MicroInterface") {
    next.color.set("#4e5146");
    next.roughness = 0.88;
    next.envMapIntensity = 0.32;
  }
  next.needsUpdate = true;
  return next;
}

function addReflectionPanel(
  scene: THREE.Scene,
  position: [number, number, number],
  size: [number, number],
  color: string,
  intensity: number,
) {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(intensity),
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
  panel.position.set(...position);
  panel.lookAt(0, 0.2, 0);
  scene.add(panel);
}

/**
 * Renderer state, aligned to the authored Blender reference.
 *
 * The reference renders with view transform AgX and `view_settings.exposure = 0`,
 * which is a linear multiplier of 2^0 = 1.0. The browser was running
 * `toneMappingExposure = 1.1` — about +0.14 stops — which lifted every material
 * and is a large part of why the browser reads brighter and flatter than the
 * reference. Matching the reference exposure is the correct baseline; lighting is
 * tuned from there rather than compensated for here.
 *
 * Still unmatched: Blender's look is "AgX - Medium High Contrast", while three's
 * `AgXToneMapping` implements base AgX with no look variant. The browser is
 * therefore slightly lower in contrast than the reference by construction.
 */
export function AuthoredRendererSetup() {
  const gl = useThree((state) => state.gl);
  useLayoutEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.AgXToneMapping;
    gl.toneMappingExposure = 1;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.VSMShadowMap;
  }, [gl]);
  return null;
}

export function AuthoredStudioEnvironment({
  onReady,
}: {
  /** Fires once the PMREM environment is on the scene, so a demand-mode
   *  renderer can be woken and readiness can wait for it. */
  onReady?: () => void;
} = {}) {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const studio = new RoomEnvironment();
    addReflectionPanel(studio, [-5.4, 5.8, 1], [5.2, 1.8], "#fff7ea", 1.35);
    addReflectionPanel(studio, [5.7, 2.7, 1.2], [1.5, 5.4], "#eef7ee", 0.22);
    addReflectionPanel(studio, [-2.2, 2, -5.8], [5.6, 2.4], "#e4d5bd", 0.52);
    addReflectionPanel(studio, [2.7, 6.7, -1.8], [0.9, 0.9], "#fff2ce", 1.3);
    const environment = generator.fromScene(studio, 0.04).texture;
    scene.environment = environment;
    scene.environmentIntensity = 0.48;
    onReady?.();
    invalidate();
    return () => {
      scene.environment = null;
      environment.dispose();
      studio.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });
      studio.dispose();
      generator.dispose();
    };
  }, [gl, scene, invalidate, onReady]);
  return null;
}

export function AuthoredStudioLights() {
  return <>
    <hemisphereLight args={["#fffaf1", "#aaa193", 1.12]} />
    <spotLight
      castShadow
      position={[-4.9, 8.4, 5.4]}
      intensity={54}
      distance={32}
      angle={0.76}
      penumbra={1}
      color="#fff4e7"
      shadow-mapSize={[2048, 2048]}
      shadow-camera-near={1}
      shadow-camera-far={24}
      shadow-bias={-0.001}
      shadow-normalBias={0.018}
      shadow-radius={4.2}
      shadow-blurSamples={12}
    />
    <rectAreaLight position={[4.8, 4.2, 1.8]} rotation={[-0.82, 0.68, 0.38]} width={5.8} height={3.2} intensity={0.18} color="#edf4ea" />
    <rectAreaLight position={[-4.1, 2.4, -2.8]} rotation={[-1.18, -0.58, -0.24]} width={4.4} height={2.6} intensity={0.35} color="#f2dfc7" />
  </>;
}

export function AuthoredGroundShadow() {
  return <mesh position-y={-0.18} rotation-x={-Math.PI / 2} receiveShadow>
    <planeGeometry args={[24, 24]} />
    <shadowMaterial transparent opacity={0.065} color="#29342d" />
  </mesh>;
}

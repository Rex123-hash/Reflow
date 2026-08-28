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

/**
 * Browser materials, realigned to the authored Blender base colours.
 *
 * Converting the reference's linear values to sRGB exposed three real
 * divergences (the browser values were drifting, not deliberate):
 *
 *   CeramicTop   #fff6e9 -> #f8f3e9   red was clipped at 1.0, so the warm ivory
 *                                      read as flat white
 *   Sidewall     #e1d3c0 -> #d3c4b2   ~15% too bright, collapsing its separation
 *                                      from the top face
 *   ForestEnamel #073821 -> #1f4032   linear red 0.0021 against the authored
 *                                      0.014 — 6.6x too dark, reading near-black
 *                                      instead of deep forest enamel
 *
 * Brass already matched the reference exactly and is untouched. Roughness,
 * clearcoat and envMapIntensity are appearance-matched rather than copied, since
 * Cycles and three's PBR differ.
 */
export function tuneAuthoredMaterial(material: THREE.Material, maps: AuthoredMicroMaps, nodeName: string) {
  if (!(material instanceof THREE.MeshPhysicalMaterial)) return material.clone();
  const next = material.clone();
  next.envMapIntensity = 0.8;
  if (next.name === "CeramicTop") {
    next.color.set("#f8f3e9");
    next.roughness = 0.62;
    next.clearcoat = 0.055;
    next.clearcoatRoughness = 0.58;
    next.envMapIntensity = 0.65;
    next.normalMap = maps.normal;
    next.normalScale.set(0.022, 0.022);
    next.roughnessMap = maps.roughness;
  } else if (next.name === "ProductionWarmSidewall") {
    next.color.set("#d3c4b2");
    next.roughness = 0.71;
    next.clearcoat = 0.02;
    next.clearcoatRoughness = 0.68;
    next.envMapIntensity = 0.62;
    next.normalMap = maps.normal;
    next.normalScale.set(0.013, 0.013);
  } else if (next.name === "ForestEnamel") {
    next.color.set("#1f4032");
    next.metalness = 0.06;
    next.roughness = 0.41;
    next.clearcoat = 0.14;
    next.clearcoatRoughness = 0.39;
    next.ior = 1.48;
    // One value for one material. The six ForestEnamel meshes are all near-flat
    // horizontal arcs on the top face at similar height (thickness 0.030-0.052,
    // identical node transforms), so they share an orientation and the shader
    // already computes their reflection vectors per pixel. Scaling IBL per node
    // was compensating for something the renderer does correctly.
    //
    // Measured before removal: PrimaryForestTrack_1 at 2.25 rendered #234334 and
    // PrimaryForestTrack_0 at 0.34 rendered #294637 — about six points apart
    // despite a 6.6x difference, because environmentIntensity is 0.46 against a
    // soft neutral room and direct light dominates. The numbers were near-inert.
    next.envMapIntensity = 0.34;
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
 * Exposure: the reference renders at Blender `view_settings.exposure = 0`, a
 * linear multiplier of 1.0. The browser was at 1.1 (~+0.14 stops), lifting every
 * material. Now 1.0.
 *
 * Tone mapping: the reference uses AgX with the "Medium High Contrast" look.
 * three implements base AgX with no look variant, and base AgX desaturates
 * heavily — captured side by side against the Blender render at identical
 * framing, it was the dominant reason the ivory read as cool grey and the forest
 * enamel lost its depth. Emulating Blender's look would need a postprocessing
 * stack; `NeutralToneMapping` (Khronos PBR Neutral, built for product viewing)
 * preserves saturation and reaches a materially closer match at no bundle cost.
 * Evidence: visual-qa/light-reduced-1440.png (AgX) vs neutral-reduced-1440.png.
 */
export function AuthoredRendererSetup() {
  const gl = useThree((state) => state.gl);
  useLayoutEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.NeutralToneMapping;
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
    scene.environmentIntensity = 0.46;
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

/**
 * Key / fill / ambient hierarchy rather than broad brightness.
 *
 * The hemisphere light was at 1.12 — a large flat fill that erased the form
 * shading the reference gets from a warm key against a dark warm ambient, and
 * which also desaturated the ivory toward grey. It drops to 0.42 and warms, while
 * the key rises to carry the modelling.
 */
export function AuthoredStudioLights() {
  return <>
    <hemisphereLight args={["#fff3e2", "#9b9080", 0.72]} />
    <spotLight
      castShadow
      position={[-4.9, 8.4, 5.4]}
      intensity={88}
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
    <shadowMaterial transparent opacity={0.17} color="#3a3229" />
  </mesh>;
}

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type Variant = "initial" | "final";
type StoryScale = "hero" | "impact" | "futures" | "action";
type TextureSize = 0 | 512 | 1024;
type Metrics = {
  calls: number;
  triangles: number;
  materials: number;
  textures: number;
  average: number;
  p95: number;
  fetchMs: number;
  parseMs: number;
};

const TARGET = "/experiments/browser-converged-v1/approved-cycles-target.png";
const INITIAL_GLB = "/experiments/production-presentation-v1/reflow-orb-production-presentation-v1.glb";
const FINAL_GLB = "/experiments/browser-converged-v1/reflow-orb-browser-converged-v1.glb";
const PAGE = "#f6f3ea";

const PLACEMENT: Record<StoryScale, { scale: number; x: number; y: number }> = {
  hero: { scale: 1, x: 0, y: 0 },
  impact: { scale: 0.82, x: 0.65, y: 0.15 },
  futures: { scale: 0.65, x: 0, y: 0.45 },
  action: { scale: 0.67, x: -2.05, y: 0.55 },
};

function seeded(index: number) {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function makeMicroMaps(size: TextureSize) {
  if (!size) return null;
  const count = size * size;
  const heights = new Float32Array(count);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const broad = Math.sin(x * 0.071) * 0.17 + Math.cos(y * 0.083) * 0.15;
      const fine = (seeded(i) - 0.5) * 0.34 + (seeded(i * 7 + 19) - 0.5) * 0.12;
      heights[i] = broad + fine;
    }
  }
  const normalData = new Uint8Array(count * 4);
  const roughData = new Uint8Array(count * 4);
  const sample = (x: number, y: number) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * 0.42;
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * 0.42;
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      normalData[i * 4] = Math.round((n.x * 0.5 + 0.5) * 255);
      normalData[i * 4 + 1] = Math.round((n.y * 0.5 + 0.5) * 255);
      normalData[i * 4 + 2] = Math.round((n.z * 0.5 + 0.5) * 255);
      normalData[i * 4 + 3] = 255;
      const rough = Math.round(224 + Math.max(-12, Math.min(12, heights[i] * 24)));
      roughData[i * 4] = 255;
      roughData[i * 4 + 1] = rough;
      roughData[i * 4 + 2] = 255;
      roughData[i * 4 + 3] = 255;
    }
  }
  const normal = new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat);
  const roughness = new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat);
  for (const texture of [normal, roughness]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(7, 7);
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
  }
  return { normal, roughness };
}

function CameraAim({ variant }: { variant: Variant }) {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.lookAt(0, 0.2, 0);
    if (camera instanceof THREE.PerspectiveCamera) camera.fov = variant === "final" ? 20.58 : 24;
    camera.updateProjectionMatrix();
  }, [camera, variant]);
  return null;
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

function StudioEnvironment({ variant }: { variant: Variant }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const studio = new RoomEnvironment();
    if (variant === "final") {
      addReflectionPanel(studio, [-5.4, 5.8, 1.0], [5.2, 1.8], "#fff7ea", 1.35);
      addReflectionPanel(studio, [5.7, 2.7, 1.2], [1.5, 5.4], "#eef7ee", 0.22);
      addReflectionPanel(studio, [-2.2, 2.0, -5.8], [5.6, 2.4], "#e4d5bd", 0.52);
      addReflectionPanel(studio, [2.7, 6.7, -1.8], [0.9, 0.9], "#fff2ce", 1.3);
    }
    const texture = generator.fromScene(studio, 0.04).texture;
    scene.environment = texture;
    scene.environmentIntensity = variant === "final" ? 0.48 : 0.3;
    return () => {
      scene.environment = null;
      texture.dispose();
      studio.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });
      studio.dispose();
      generator.dispose();
    };
  }, [gl, scene, variant]);
  return null;
}

function tuneMaterial(material: THREE.Material, maps: ReturnType<typeof makeMicroMaps>, nodeName: string) {
  if (!(material instanceof THREE.MeshPhysicalMaterial)) return material;
  const next = material.clone();
  next.envMapIntensity = 0.8;
  if (next.name === "CeramicTop") {
    next.color.set("#fff6e9");
    next.roughness = 0.62;
    next.clearcoat = 0.055;
    next.clearcoatRoughness = 0.58;
    next.envMapIntensity = 0.65;
    if (maps) {
      next.normalMap = maps.normal;
      next.normalScale.set(0.022, 0.022);
      next.roughnessMap = maps.roughness;
    }
  } else if (next.name === "ProductionWarmSidewall") {
    next.color.set("#e1d3c0");
    next.roughness = 0.71;
    next.clearcoat = 0.02;
    next.clearcoatRoughness = 0.68;
    next.envMapIntensity = 0.62;
    if (maps) {
      next.normalMap = maps.normal;
      next.normalScale.set(0.013, 0.013);
    }
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

function Model({ variant, textureSize, onLoad }: { variant: Variant; textureSize: TextureSize; onLoad: (timing: { fetchMs: number; parseMs: number }) => void }) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const maps = useMemo(() => (variant === "final" ? makeMicroMaps(textureSize) : null), [textureSize, variant]);
  useEffect(() => {
    let live = true;
    const start = performance.now();
    const url = variant === "final" ? FINAL_GLB : INITIAL_GLB;
    const loader = new GLTFLoader();
    fetch(url).then((response) => response.arrayBuffer()).then((buffer) => {
      const fetched = performance.now();
      loader.parse(buffer, "/", (gltf) => {
      if (!live) return;
      const clone = gltf.scene.clone(true);
      const materialCache = new Map<string, THREE.Material>();
      clone.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.castShadow = true;
        node.receiveShadow = true;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        const tuned = materials.map((material) => {
          if (variant === "initial") return material;
          const reflectionGroup = material.name === "ForestEnamel" && (node.name === "PrimaryForestTrack_1" || node.name === "InnerRecoveryArc") ? node.name : "shared";
          const key = `${material.uuid}:${reflectionGroup}`;
          if (!materialCache.has(key)) materialCache.set(key, tuneMaterial(material, maps, node.name));
          return materialCache.get(key)!;
        });
        node.material = Array.isArray(node.material) ? tuned : tuned[0];
      });
      setModel(clone);
      onLoad({ fetchMs: fetched - start, parseMs: performance.now() - fetched });
      });
    });
    return () => {
      live = false;
    };
  }, [maps, onLoad, variant]);
  useEffect(() => () => {
    maps?.normal.dispose();
    maps?.roughness.dispose();
  }, [maps]);
  return model ? <primitive object={model} /> : null;
}

function Satellites({ variant }: { variant: Variant }) {
  const items: [[number, number, number], number, [number, number, number]][] = [
    [[-3.4, 0.02, -0.92], 0.205, [1, 0.96, 1.05]],
    [[-3.26, 0.02, 1.76], 0.22, [1.02, 0.97, 1]],
    [[3.42, 0.02, -0.88], 0.215, [1.04, 0.97, 1.02]],
  ];
  return <>{items.map(([position, radius, scale], index) => (
    <mesh key={index} position={position} scale={scale} castShadow receiveShadow>
      <icosahedronGeometry args={[radius, 5]} />
      <meshPhysicalMaterial
        color={variant === "final" ? "#9ead99" : "#aeb7a7"}
        roughness={variant === "final" ? 0.72 : 0.64}
        clearcoat={0.025}
        clearcoatRoughness={0.72}
        envMapIntensity={variant === "final" ? 0.62 : 1}
      />
    </mesh>
  ))}</>;
}

function PerformanceProbe({ timing, onMetrics }: { timing: { fetchMs: number; parseMs: number }; onMetrics: (metrics: Metrics) => void }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const samples = useRef<number[]>([]);
  const reported = useRef(false);
  const frame = useRef(0);
  useFrame((_, delta) => {
    frame.current += 1;
    if (frame.current <= 90) return;
    samples.current.push(delta * 1000);
    if (samples.current.length > 240) samples.current.shift();
    if (samples.current.length === 240 && !reported.current) {
      reported.current = true;
      const sorted = [...samples.current].sort((a, b) => a - b);
      const materials = new Set<THREE.Material>();
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) => materials.add(material));
        }
      });
      onMetrics({
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        materials: materials.size,
        textures: gl.info.memory.textures,
        average: +(sorted.reduce((sum, value) => sum + value, 0) / sorted.length).toFixed(2),
        p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
        fetchMs: +timing.fetchMs.toFixed(2),
        parseMs: +timing.parseMs.toFixed(2),
      });
    }
  });
  return null;
}

function RendererSetup({ variant }: { variant: Variant }) {
  const gl = useThree((state) => state.gl);
  useLayoutEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = variant === "final" ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = variant === "final" ? 1.1 : 1;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = variant === "final" ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;
  }, [gl, variant]);
  return null;
}

function OrbCanvas({
  variant,
  scale,
  yaw,
  tilt,
  textureSize,
  detail,
  onMetrics,
}: {
  variant: Variant;
  scale: StoryScale;
  yaw: number;
  tilt: number;
  textureSize: TextureSize;
  detail: string;
  onMetrics: (metrics: Metrics) => void;
}) {
  const detailPlacement: Record<string, { scale: number; x: number; y: number }> = {
    forest: { scale: 1.58, x: -1.25, y: 0.42 },
    ceramic: { scale: 1.48, x: 0, y: 0.32 },
    brass: { scale: 2.3, x: 0, y: 1.1 },
    sidewall: { scale: 1.48, x: 0, y: 0.72 },
    seam: { scale: 1.78, x: 0, y: 0.62 },
    shadow: { scale: 0.96, x: 0, y: -0.05 },
  };
  const placement = detailPlacement[detail] ?? PLACEMENT[scale];
  const [timing, setTiming] = useState({ fetchMs: 0, parseMs: 0 });
  return <Canvas
    className="convergence-canvas"
    dpr={1}
    shadows
    camera={{ position: [0, 6.55, 9.75], fov: variant === "final" ? 20.58 : 24, near: 0.1, far: 80 }}
    gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
  >
    <color attach="background" args={[PAGE]} />
    <RendererSetup variant={variant} />
    <CameraAim variant={variant} />
    <StudioEnvironment variant={variant} />
    {variant === "initial" ? <>
      <hemisphereLight args={["#fffaf1", "#abb9ad", 1.38]} />
      <spotLight castShadow position={[-4.7, 8.2, 5.2]} intensity={74} distance={30} angle={0.72} penumbra={0.98} color="#fff1df" shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[5, 3.3, -3]} intensity={0.8} color="#dce8dd" />
      <directionalLight position={[-4, 2, -4]} intensity={0.34} color="#f0d9bc" />
    </> : <>
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
        shadow-bias={-0.00012}
        shadow-normalBias={0.018}
        shadow-radius={4.2}
        shadow-blurSamples={12}
      />
      <rectAreaLight position={[4.8, 4.2, 1.8]} rotation={[-0.82, 0.68, 0.38]} width={5.8} height={3.2} intensity={0.18} color="#edf4ea" />
      <rectAreaLight position={[-4.1, 2.4, -2.8]} rotation={[-1.18, -0.58, -0.24]} width={4.4} height={2.6} intensity={0.35} color="#f2dfc7" />
    </>}
    <Suspense fallback={null}>
      <group position={[placement.x, -0.165 * (1 - placement.scale), placement.y]} scale={placement.scale} rotation={[THREE.MathUtils.degToRad(tilt), THREE.MathUtils.degToRad(yaw), 0]}>
        <Model variant={variant} textureSize={textureSize} onLoad={setTiming} />
        <Satellites variant={variant} />
      </group>
    </Suspense>
    <mesh position-y={-0.18} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[24, 24]} />
      <shadowMaterial transparent opacity={variant === "final" ? 0.065 : 0.055} color="#29342d" />
    </mesh>
    <PerformanceProbe timing={timing} onMetrics={onMetrics} />
  </Canvas>;
}

function CyclesLayer({ className = "" }: { className?: string }) {
  return <img className={`convergence-layer convergence-cycles ${className}`} src={TARGET} alt="Approved Phase 3.6D Cycles target" />;
}

export function BrowserConvergenceLab() {
  const query = new URLSearchParams(location.search);
  const view = query.get("view") ?? "final";
  const scale = (query.get("scale") ?? "hero") as StoryScale;
  const yaw = Number(query.get("yaw") ?? 0);
  const tilt = Number(query.get("tilt") ?? 0);
  const textureRaw = Number(query.get("texture") ?? 512);
  const textureSize: TextureSize = textureRaw === 1024 ? 1024 : textureRaw === 0 ? 0 : 512;
  const detail = query.get("detail") ?? "";
  const hideUi = query.get("ui") === "0";
  const [metrics, setMetrics] = useState<Partial<Record<Variant, Metrics>>>({});
  const setVariantMetrics = (variant: Variant) => (value: Metrics) => {
    setMetrics((current) => ({ ...current, [variant]: value }));
    (window as typeof window & { __reflowFidelityMetrics?: unknown }).__reflowFidelityMetrics = { ...metrics, [variant]: value };
  };
  const canvas = (variant: Variant, className = "") => <div className={`convergence-layer ${className}`}>
    <OrbCanvas variant={variant} scale={scale} yaw={yaw} tilt={tilt} textureSize={variant === "final" ? textureSize : 0} detail={detail} onMetrics={setVariantMetrics(variant)} />
  </div>;

  let stage: React.ReactNode;
  if (view === "cycles") stage = <CyclesLayer />;
  else if (view === "initial") stage = canvas("initial");
  else if (view === "cycles-split") stage = <><CyclesLayer className="clip-left" />{canvas("final", "clip-right")}</>;
  else if (view === "browser-split") stage = <>{canvas("initial", "clip-left")}{canvas("final", "clip-right")}</>;
  else if (view === "overlay") stage = <>{canvas("final")}<CyclesLayer className="overlay-half" /></>;
  else if (view === "difference") stage = <>{canvas("final")}<CyclesLayer className="difference-layer" /></>;
  else if (view === "grayscale") stage = <><CyclesLayer className="clip-left grayscale" />{canvas("final", "clip-right grayscale")}</>;
  else stage = canvas("final");

  return <main className={`convergence-lab ${hideUi ? "hide-ui" : ""}`}>
    {!hideUi && <header>
      <p>Phase 3.6E · isolated browser convergence</p>
      <h1>Cycles authority / realtime candidate</h1>
      <nav>
        <a href="?lab=browser-convergence&view=cycles">Cycles</a>
        <a href="?lab=browser-convergence&view=initial">Initial</a>
        <a href="?lab=browser-convergence&view=final">Final</a>
        <a href="?lab=browser-convergence&view=cycles-split">Cycles / browser</a>
        <a href="?lab=browser-convergence&view=browser-split">Initial / final</a>
      </nav>
    </header>}
    <section className="convergence-stage">{stage}</section>
    {!hideUi && <aside className="convergence-metrics">
      {Object.entries(metrics).map(([variant, value]) => value && <span key={variant}>
        {variant}: {value.calls} calls · {value.triangles.toLocaleString()} tris · {value.materials} mats · {value.textures} tex · {value.average} ms avg · {value.p95} ms p95 · {value.fetchMs} ms fetch · {value.parseMs} ms parse
      </span>)}
    </aside>}
  </main>;
}

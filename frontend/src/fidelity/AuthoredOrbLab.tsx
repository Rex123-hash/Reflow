import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ProductionReflowOrb } from "../orb/ProductionReflowOrb";

const GLB_URL = "/experiments/authored-orb/reflow-orb-authored.glb";
const PNG_URL = "/experiments/authored-orb/authored-final.png";

type View = "browser" | "png" | "phase13" | "compare";
type Metrics = { calls: number; triangles: number; materials: number; average: number; p95: number };

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const map = generator.fromScene(room, 0.04).texture;
    scene.environment = map;
    scene.environmentIntensity = 0.34;
    return () => { scene.environment = null; map.dispose(); room.dispose(); generator.dispose(); };
  }, [gl, scene]);
  return null;
}

function CameraAim({ detail }: { detail: boolean }) {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => { camera.lookAt(0, 0.25, 0); camera.updateProjectionMatrix(); }, [camera, detail]);
  return null;
}

function Probe({ onMetrics }: { onMetrics: (value: Metrics) => void }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const samples = useRef<number[]>([]);
  useFrame((_, delta) => {
    samples.current.push(delta * 1000);
    if (samples.current.length > 180) samples.current.shift();
    if (samples.current.length === 180) {
      const sorted = [...samples.current].sort((a, b) => a - b);
      const materials = new Set<THREE.Material>();
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh) (Array.isArray(node.material) ? node.material : [node.material]).forEach((m) => materials.add(m));
      });
      onMetrics({
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        materials: materials.size,
        average: Number((sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2)),
        p95: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(2)),
      });
    }
  });
  return null;
}

function AuthoredModel({ yaw, tilt, scale, x }: { yaw: number; tilt: number; scale: number; x: number }) {
  const gltf = useLoader(GLTFLoader, GLB_URL);
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  useLayoutEffect(() => {
    model.traverse((node) => {
      if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; }
    });
  }, [model]);
  return <primitive object={model} position-x={x} scale={scale} rotation={[THREE.MathUtils.degToRad(tilt), THREE.MathUtils.degToRad(yaw), 0]} />;
}

function Stage({ kind, yaw, tilt, scale, x, detail, onMetrics }: { kind: "browser" | "phase13"; yaw: number; tilt: number; scale: number; x: number; detail: boolean; onMetrics: (value: Metrics) => void }) {
  const phase13Ref = useRef<THREE.Group>(null);
  return (
    <Canvas
      className="authored-orb-canvas"
      dpr={[1, 1.5]}
      shadows
      camera={{ position: detail ? [0, 5.3, 6.55] : [0, 7.25, 8.9], fov: detail ? 19 : 24, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <CameraAim detail={detail} />
      <Environment />
      <hemisphereLight args={["#fff8ec", "#aeb8ae", 1.55]} />
      <spotLight castShadow position={[-4.5, 8.5, 5]} intensity={85} distance={30} angle={0.72} penumbra={0.96} color="#fff3df" shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[5, 4, -3]} intensity={1.25} color="#dce8df" />
      <directionalLight position={[-4, 3, -4]} intensity={0.55} color="#f2dfc6" />
      <Suspense fallback={null}>
        {kind === "browser" ? <AuthoredModel yaw={yaw} tilt={tilt} scale={scale} x={x} /> : <group position-x={x} scale={scale} rotation={[THREE.MathUtils.degToRad(tilt), THREE.MathUtils.degToRad(yaw), 0]}><ProductionReflowOrb rootRef={phase13Ref} /></group>}
      </Suspense>
      <mesh position-y={-0.27} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[18, 18]} />
        <shadowMaterial transparent opacity={0.12} color="#27372f" />
      </mesh>
      <Probe onMetrics={onMetrics} />
    </Canvas>
  );
}

function queryView(): View {
  const value = new URLSearchParams(location.search).get("view");
  return value === "png" || value === "phase13" || value === "compare" ? value : "browser";
}

export function AuthoredOrbLab() {
  const params = new URLSearchParams(location.search);
  const view = queryView();
  const yaw = Number(params.get("yaw") ?? 0);
  const tilt = Number(params.get("tilt") ?? 0);
  const scale = Number(params.get("scale") ?? 1);
  const x = Number(params.get("x") ?? 0);
  const detail = params.get("detail") === "1";
  const hideUi = params.get("ui") === "0";
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [resource, setResource] = useState<{ duration: number; transfer: number } | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const entry = performance.getEntriesByName(new URL(GLB_URL, location.href).href).at(-1) as PerformanceResourceTiming | undefined;
      if (entry) { setResource({ duration: Number(entry.duration.toFixed(1)), transfer: entry.transferSize }); window.clearInterval(timer); }
    }, 100);
    return () => window.clearInterval(timer);
  }, []);
  const browserStage = <Stage kind="browser" yaw={yaw} tilt={tilt} scale={scale} x={x} detail={detail} onMetrics={setMetrics} />;
  return (
    <main className={`authored-orb-lab ${hideUi ? "hide-ui" : ""}`}>
      {!hideUi && <header><p>Phase 3.6 · isolated authored PBR spike</p><h1>Reflow instrument A/B</h1><nav><a href="?lab=authored-orb&view=browser">Browser GLB</a><a href="?lab=authored-orb&view=png">Cycles</a><a href="?lab=authored-orb&view=phase13">Phase 1.3</a><a href="?lab=authored-orb&view=compare">Compare</a></nav></header>}
      {view === "png" && <section className="authored-orb-still"><img src={PNG_URL} alt="Blender Cycles authored Reflow orb" /></section>}
      {view === "browser" && <section className="authored-orb-stage">{browserStage}</section>}
      {view === "phase13" && <section className="authored-orb-stage"><Stage kind="phase13" yaw={yaw} tilt={tilt} scale={scale} x={x} detail={detail} onMetrics={setMetrics} /></section>}
      {view === "compare" && <section className="authored-orb-compare"><figure><img src={PNG_URL} alt="Cycles reference" /><figcaption>Blender Cycles</figcaption></figure><figure>{browserStage}<figcaption>Browser GLB</figcaption></figure></section>}
      {!hideUi && metrics && <aside className="authored-orb-metrics">{metrics.calls} calls · {metrics.triangles.toLocaleString()} triangles · {metrics.materials} materials · {metrics.average} ms avg · {metrics.p95} ms p95{resource ? ` · ${resource.duration} ms GLB · ${resource.transfer.toLocaleString()} B transfer` : ""}</aside>}
    </main>
  );
}

useLoader.preload(GLTFLoader, GLB_URL);

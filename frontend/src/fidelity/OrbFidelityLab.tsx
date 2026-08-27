import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type FidelityApproach = "procedural" | "glb";

interface RenderMetrics {
  approach: FidelityApproach;
  drawCalls: number;
  triangles: number;
  averageFrameMs: number;
  p95FrameMs: number;
  dpr: number;
}

declare global {
  interface Window {
    __REFLOW_FIDELITY_METRICS__?: RenderMetrics;
  }
}

const MATERIALS = {
  ivory: {
    color: "#eee8dc",
    roughness: 0.68,
    metalness: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.72,
  },
  ivoryHigh: {
    color: "#f8f3e9",
    roughness: 0.62,
    metalness: 0,
    clearcoat: 0.1,
    clearcoatRoughness: 0.7,
  },
  forest: {
    color: "#173d2e",
    roughness: 0.3,
    metalness: 0.08,
    clearcoat: 0.2,
    clearcoatRoughness: 0.42,
  },
  brass: {
    color: "#b89a64",
    roughness: 0.24,
    metalness: 0.84,
    clearcoat: 0.1,
    clearcoatRoughness: 0.3,
  },
} as const;

function CameraTarget() {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.lookAt(0, 0.04, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

function FidelityLighting() {
  return (
    <>
      <hemisphereLight args={["#fffaf0", "#b9c8bd", 1.55]} />
      <directionalLight position={[-5, 8, 6]} intensity={2.8} color="#fff7e8" />
      <spotLight
        castShadow
        position={[4.5, 8.5, 5.5]}
        intensity={95}
        distance={28}
        angle={0.52}
        penumbra={0.92}
        color="#fffaf1"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00008}
        shadow-normalBias={0.018}
        shadow-radius={5}
      />
      <pointLight position={[-4, 2.4, -3]} intensity={12} distance={12} color="#d7e4d9" />
      <mesh position={[0, -0.255, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <shadowMaterial color="#17211c" opacity={0.19} />
      </mesh>
    </>
  );
}

function BrassPin({ angle }: { angle: number }) {
  const radius = 1.72;
  return (
    <group position={[Math.cos(angle) * radius, 0.45, Math.sin(angle) * radius]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.065, 0.07, 0.08, 48]} />
        <meshPhysicalMaterial {...MATERIALS.brass} />
      </mesh>
      <mesh position-y={0.075} castShadow>
        <sphereGeometry args={[0.105, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshPhysicalMaterial {...MATERIALS.brass} />
      </mesh>
    </group>
  );
}

function ProceduralFidelitySlice() {
  return (
    <group name="ProceduralFidelitySlice">
      <mesh position-y={-0.045} castShadow receiveShadow>
        <cylinderGeometry args={[2.68, 2.74, 0.39, 192]} />
        <meshPhysicalMaterial {...MATERIALS.ivory} />
      </mesh>
      <mesh position-y={0.135} rotation-x={Math.PI / 2} castShadow>
        <torusGeometry args={[2.66, 0.085, 32, 192]} />
        <meshPhysicalMaterial {...MATERIALS.ivory} />
      </mesh>
      <mesh position-y={0.225} castShadow receiveShadow>
        <cylinderGeometry args={[2.12, 2.16, 0.16, 192]} />
        <meshPhysicalMaterial {...MATERIALS.ivoryHigh} />
      </mesh>
      <mesh position-y={0.205} rotation-x={Math.PI / 2}>
        <torusGeometry args={[2.2, 0.024, 20, 192]} />
        <meshStandardMaterial color="#b8b0a2" roughness={0.88} />
      </mesh>
      <mesh position-y={0.37} rotation-x={Math.PI / 2} castShadow>
        <torusGeometry args={[1.715, 0.195, 36, 192, 2.61]} />
        <meshPhysicalMaterial {...MATERIALS.forest} />
      </mesh>
      <BrassPin angle={0.18} />
      <BrassPin angle={2.08} />
    </group>
  );
}

function GlbFidelitySlice() {
  const gltf = useLoader(GLTFLoader, "/models/reflow-fidelity-slice.glb");
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useLayoutEffect(() => {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}

function MetricsProbe({
  approach,
  onMetrics,
}: {
  approach: FidelityApproach;
  onMetrics: (metrics: RenderMetrics) => void;
}) {
  const gl = useThree((state) => state.gl);
  const samples = useRef<number[]>([]);
  const frames = useRef(0);
  const lastPublish = useRef(0);

  useFrame((_, delta) => {
    frames.current += 1;
    if (frames.current > 24) {
      samples.current.push(delta * 1000);
      if (samples.current.length > 180) samples.current.shift();
    }
    if (samples.current.length >= 60 && performance.now() - lastPublish.current > 450) {
      const sorted = [...samples.current].sort((a, b) => a - b);
      const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      const metrics: RenderMetrics = {
        approach,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        averageFrameMs: Number(average.toFixed(2)),
        p95FrameMs: Number(p95.toFixed(2)),
        dpr: gl.getPixelRatio(),
      };
      lastPublish.current = performance.now();
      window.__REFLOW_FIDELITY_METRICS__ = metrics;
      onMetrics(metrics);
    }
  });
  return null;
}

function FidelityScene({
  approach,
  onMetrics,
}: {
  approach: FidelityApproach;
  onMetrics: (metrics: RenderMetrics) => void;
}) {
  return (
    <>
      <CameraTarget />
      <FidelityLighting />
      <group rotation-y={-0.28} scale={1.05}>
        {approach === "procedural" ? <ProceduralFidelitySlice /> : <GlbFidelitySlice />}
      </group>
      <MetricsProbe approach={approach} onMetrics={onMetrics} />
    </>
  );
}

function approachFromUrl(): FidelityApproach {
  return new URLSearchParams(window.location.search).get("approach") === "glb" ? "glb" : "procedural";
}

export function OrbFidelityLab() {
  const approach = approachFromUrl();
  const [metrics, setMetrics] = useState<RenderMetrics | null>(null);

  useEffect(() => {
    document.body.dataset.fidelityApproach = approach;
    return () => {
      delete document.body.dataset.fidelityApproach;
    };
  }, [approach]);

  return (
    <main className="fidelity-lab" data-fidelity-ready={metrics ? "true" : "false"}>
      <Canvas
        className="fidelity-canvas"
        shadows="variance"
        dpr={2}
        frameloop="always"
        camera={{ position: [0, 5.15, 7.35], fov: 31, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Suspense fallback={null}>
          <FidelityScene approach={approach} onMetrics={setMetrics} />
        </Suspense>
      </Canvas>
      <header className="fidelity-header">
        <div>
          <p className="eyebrow">UI-M2A · controlled fidelity spike</p>
          <h1>{approach === "procedural" ? "Procedural geometry" : "Modular GLB asset"}</h1>
          <p>Identical camera · lighting · DPR 2 · scale · viewport · background</p>
        </div>
        <nav aria-label="Fidelity approaches">
          <a className={approach === "procedural" ? "is-active" : ""} href="?lab=orb&approach=procedural">A · Procedural</a>
          <a className={approach === "glb" ? "is-active" : ""} href="?lab=orb&approach=glb">B · Modular GLB</a>
        </nav>
      </header>
      <aside className="fidelity-metrics" aria-live="polite">
        <span>Approach <b>{approach.toUpperCase()}</b></span>
        <span>Draw calls <b>{metrics?.drawCalls ?? "—"}</b></span>
        <span>Triangles <b>{metrics?.triangles.toLocaleString() ?? "—"}</b></span>
        <span>Average frame <b>{metrics ? `${metrics.averageFrameMs} ms` : "sampling"}</b></span>
        <span>P95 frame <b>{metrics ? `${metrics.p95FrameMs} ms` : "sampling"}</b></span>
      </aside>
      <p className="fidelity-caption">
        Representative slice only: ceramic rim, recess, seam, fitted insert, and brass hardware.
      </p>
    </main>
  );
}

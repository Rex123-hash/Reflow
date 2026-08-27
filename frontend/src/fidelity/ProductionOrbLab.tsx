import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import referenceTargetUrl from "../../../REFERENCE PAGES/2.png";
import referencePhase12Url from "../../artifacts/phase1.2/orb-1440x900.jpg";
import { ProductionReflowOrb } from "../orb/ProductionReflowOrb";
import { REFLOW_ORB_RAILS } from "../orb/reflowOrbGeometry";
import {
  localRailPoint,
  pointsToSvgPath,
  projectOrbLocalPoint,
  projectRail,
  splitRailDepth,
} from "../orb/projectOrbitalRails";

type LabView = "target" | "instrument" | "rails" | "compare" | "detail" | "finish" | "delta";

interface RenderMetrics {
  drawCalls: number;
  triangles: number;
  materials: number;
  averageFrameMs: number;
  p95FrameMs: number;
  dpr: number;
}

interface RailProjection {
  paths: Record<string, { rear: string; front: string }>;
  labels: Array<{ id: string; x: number; y: number; tickX: number; tickY: number }>;
  nodes: Array<{ x: number; y: number }>;
}

const RAIL_DEFINITIONS = [
  { id: "near-inner", radius: REFLOW_ORB_RAILS.nearInner },
  { id: "near-middle", radius: REFLOW_ORB_RAILS.nearMiddle },
  { id: "near-outer", radius: REFLOW_ORB_RAILS.nearOuter },
  { id: "outer-inner", radius: REFLOW_ORB_RAILS.outerInner },
  { id: "outer-outer", radius: REFLOW_ORB_RAILS.outerOuter },
] as const;

const RAIL_LABELS = [
  { id: "PLAN", angle: Math.PI * 1.2 },
  { id: "DETECT", angle: Math.PI * 1.5 },
  { id: "ACT", angle: Math.PI * 1.82 },
  { id: "VERIFY", angle: Math.PI * 0.12 },
] as const;

const NODE_ANGLES = [0.58, 1.42, 2.36, 3.22, 4.18, 5.22];

function CameraCalibration() {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.lookAt(0, 0.35, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, 0.035).texture;
    scene.environment = environment;
    scene.environmentIntensity = 0.26;
    return () => {
      scene.environment = null;
      environment.dispose();
      room.dispose();
      generator.dispose();
    };
  }, [gl, scene]);
  return null;
}

function ProductLighting() {
  const softShadow = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(128, 128, 20, 128, 128, 122);
      gradient.addColorStop(0, "rgba(23,33,28,0.38)");
      gradient.addColorStop(0.42, "rgba(23,33,28,0.20)");
      gradient.addColorStop(0.74, "rgba(23,33,28,0.07)");
      gradient.addColorStop(1, "rgba(23,33,28,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 256, 256);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => () => softShadow.dispose(), [softShadow]);

  return (
    <>
      <hemisphereLight args={["#fffaf0", "#bcc4b9", 1.48]} />
      <spotLight
        castShadow
        position={[-4.8, 8.6, 5.8]}
        intensity={72}
        distance={30}
        angle={0.7}
        penumbra={0.98}
        color="#fff8ed"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00008}
        shadow-normalBias={0.018}
        shadow-radius={1}
      />
      <directionalLight position={[5, 4, -4]} intensity={0.72} color="#dfe8de" />
      <directionalLight position={[-5, 2.5, -5]} intensity={0.22} color="#f0e5d5" />
      <rectAreaLight position={[-3.8, 5.5, 4.5]} rotation={[-0.72, -0.38, -0.18]} width={7.5} height={4.2} intensity={2.4} color="#fff3df" />
      <mesh position-y={-0.251} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[18, 18]} />
        <shadowMaterial transparent opacity={0.055} color="#344139" />
      </mesh>
      <mesh position={[0.22, -0.248, 0.28]} rotation-x={-Math.PI / 2} renderOrder={-1}>
        <planeGeometry args={[6.5, 5.3]} />
        <meshBasicMaterial map={softShadow} transparent opacity={0.31} depthWrite={false} />
      </mesh>
      <mesh position={[0.08, -0.246, 0.16]} rotation-x={-Math.PI / 2} renderOrder={-1}>
        <planeGeometry args={[4.6, 3.35]} />
        <meshBasicMaterial map={softShadow} transparent opacity={0.27} depthWrite={false} />
      </mesh>
    </>
  );
}

function RailProjectionProbe({
  orbRef,
  stageRef,
  onProjection,
}: {
  orbRef: React.RefObject<THREE.Group | null>;
  stageRef: React.RefObject<HTMLElement | null>;
  onProjection: (projection: RailProjection) => void;
}) {
  const { camera, gl } = useThree();
  const lastSignature = useRef("");

  useFrame(() => {
    const orb = orbRef.current;
    const stage = stageRef.current;
    if (!orb || !stage) return;
    const rects = { canvas: gl.domElement.getBoundingClientRect(), stage: stage.getBoundingClientRect() };
    const paths: RailProjection["paths"] = {};
    for (const rail of RAIL_DEFINITIONS) {
      const depth = splitRailDepth(projectRail(rail.radius, orb, camera, rects));
      paths[rail.id] = {
        rear: pointsToSvgPath(depth.rear),
        front: pointsToSvgPath(depth.front),
      };
    }
    const labels = RAIL_LABELS.map((label) => {
      const tick = projectOrbLocalPoint(localRailPoint(REFLOW_ORB_RAILS.outerOuter, label.angle), orb, camera, rects);
      const text = projectOrbLocalPoint(localRailPoint(REFLOW_ORB_RAILS.outerOuter * 1.075, label.angle, 0.25), orb, camera, rects);
      return { id: label.id, x: text.x, y: text.y, tickX: tick.x, tickY: tick.y };
    });
    const nodes = NODE_ANGLES.map((angle) =>
      projectOrbLocalPoint(localRailPoint(REFLOW_ORB_RAILS.nearMiddle, angle, 0.25), orb, camera, rects),
    );
    const signature = `${rects.canvas.width}:${rects.canvas.height}:${labels.map((label) => `${label.x.toFixed(1)},${label.y.toFixed(1)}`).join(";")}`;
    if (signature !== lastSignature.current) {
      lastSignature.current = signature;
      onProjection({ paths, labels, nodes });
    }
  });
  return null;
}

function MetricsProbe({ onMetrics }: { onMetrics: (metrics: RenderMetrics) => void }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const samples = useRef<number[]>([]);
  const frames = useRef(0);
  const lastPublish = useRef(0);

  useFrame((_, delta) => {
    frames.current += 1;
    if (frames.current > 20) {
      samples.current.push(delta * 1000);
      if (samples.current.length > 180) samples.current.shift();
    }
    if (samples.current.length >= 60 && performance.now() - lastPublish.current > 500) {
      const sorted = [...samples.current].sort((a, b) => a - b);
      const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          const entries = Array.isArray(object.material) ? object.material : [object.material];
          entries.forEach((material) => materials.add(material));
        }
      });
      onMetrics({
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        materials: materials.size,
        averageFrameMs: Number(average.toFixed(2)),
        p95FrameMs: Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(2)),
        dpr: gl.getPixelRatio(),
      });
      lastPublish.current = performance.now();
    }
  });
  return null;
}

function ProjectionSvg({ projection, depth }: { projection: RailProjection | null; depth: "rear" | "front" }) {
  if (!projection) return null;
  return (
    <svg className={`production-orb-rails rail-layer-${depth}`} aria-hidden="true">
      {RAIL_DEFINITIONS.map((rail, index) => (
        <path
          key={`${rail.id}-${depth}`}
          d={projection.paths[rail.id]?.[depth]}
          className={`rail rail-${index} rail-${depth}`}
        />
      ))}
      {projection.nodes.map((node, index) => NODE_ANGLES[index] && (Math.sin(NODE_ANGLES[index]) < 0 ? depth === "rear" : depth === "front") && (
        <circle key={index} cx={node.x} cy={node.y} r={index % 2 === 0 ? 2.3 : 1.7} className="rail-node" />
      ))}
      {depth === "front" && projection.labels.map((label) => (
        <g key={label.id} className="rail-label">
          <line x1={label.tickX} y1={label.tickY} x2={label.x} y2={label.y} />
          <circle cx={label.tickX} cy={label.tickY} r="2.5" />
          <text x={label.x} y={label.y - 8} textAnchor="middle">{label.id}</text>
        </g>
      ))}
    </svg>
  );
}

function viewFromUrl(): LabView {
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "target" || view === "instrument" || view === "compare" || view === "detail" || view === "finish" || view === "delta") return view;
  return "rails";
}

export function ProductionOrbLab() {
  const view = viewFromUrl();
  const stageRef = useRef<HTMLElement>(null);
  const orbRef = useRef<THREE.Group>(null);
  const [projection, setProjection] = useState<RailProjection | null>(null);
  const [metrics, setMetrics] = useState<RenderMetrics | null>(null);
  const hideUi = new URLSearchParams(window.location.search).get("ui") === "0";
  const overlay = new URLSearchParams(window.location.search).get("overlay") === "1";
  const photographicFinish = new URLSearchParams(window.location.search).get("finish") !== "raw";
  const canvasCamera = useMemo(
    () => ({ position: view === "detail" ? [0, 10.5, 15] as [number, number, number] : [0, 16, 22.9] as [number, number, number], fov: 20, near: 0.1, far: 120 }),
    [view],
  );

  return (
    <main className={`production-orb-lab view-${view} ${hideUi ? "hide-ui" : ""}`} ref={stageRef}>
      {view === "target" ? (
        <img className="production-orb-target" src={referenceTargetUrl} alt="OG Reflow instrument reference" />
      ) : (
        <>
          {view === "compare" && <img className={`production-orb-target comparison-target ${overlay ? "is-overlay" : ""}`} src={referenceTargetUrl} alt="OG Reflow comparison half" />}
          {view === "delta" && <img className="production-orb-target comparison-target" src={referencePhase12Url} alt="Phase 1.2 comparison half" />}
          {view === "rails" && <ProjectionSvg projection={projection} depth="rear" />}
          <Canvas
            className={`production-orb-canvas ${view === "compare" && !overlay ? "comparison-render" : ""}`}
            shadows={{ type: THREE.PCFShadowMap }}
            dpr={2}
            frameloop="always"
            camera={canvasCamera}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.08;
              gl.outputColorSpace = THREE.SRGBColorSpace;
            }}
          >
            <CameraCalibration />
            <StudioEnvironment />
            <ProductLighting />
            <ProductionReflowOrb rootRef={orbRef} />
            {view === "rails" && (
              <RailProjectionProbe orbRef={orbRef} stageRef={stageRef} onProjection={setProjection} />
            )}
            <MetricsProbe onMetrics={setMetrics} />
          </Canvas>
          {view === "rails" && <ProjectionSvg projection={projection} depth="front" />}
        </>
      )}

      {view !== "target" && photographicFinish && (
        <div className={`production-orb-photographic-finish ${view === "finish" ? "finish-half" : ""}`} aria-hidden="true" />
      )}

      <header className="production-orb-lab-header">
        <div>
          <p>Phase 1.1 · precision instrument</p>
          <h1>{view === "target" ? "OG visual target" : view === "instrument" ? "Production instrument" : view === "compare" ? "OG / Phase 1.3" : view === "delta" ? "Phase 1.2 / Phase 1.3" : view === "detail" ? "Material detail" : view === "finish" ? "Raw / photographic finish" : "Instrument + projected rails"}</h1>
        </div>
        <nav aria-label="Production orb comparison views">
          <a className={view === "target" ? "is-active" : ""} href="?lab=production-orb&view=target">A · Target</a>
          <a className={view === "instrument" ? "is-active" : ""} href="?lab=production-orb&view=instrument">B · Instrument</a>
          <a className={view === "rails" ? "is-active" : ""} href="?lab=production-orb&view=rails">C · Rails</a>
          <a className={view === "compare" ? "is-active" : ""} href="?lab=production-orb&view=compare">D · Compare</a>
          <a className={view === "detail" ? "is-active" : ""} href="?lab=production-orb&view=detail">E · Detail</a>
          <a className={view === "finish" ? "is-active" : ""} href="?lab=production-orb&view=finish">F · Finish</a>
          <a className={view === "delta" ? "is-active" : ""} href="?lab=production-orb&view=delta">G · Delta</a>
        </nav>
      </header>
      {view !== "target" && (
        <aside className="production-orb-metrics">
          <span>Draws <b>{metrics?.drawCalls ?? "—"}</b></span>
          <span>Triangles <b>{metrics?.triangles.toLocaleString() ?? "—"}</b></span>
          <span>Materials <b>{metrics?.materials ?? "—"}</b></span>
          <span>Average <b>{metrics ? `${metrics.averageFrameMs} ms` : "sampling"}</b></span>
          <span>P95 <b>{metrics ? `${metrics.p95FrameMs} ms` : "sampling"}</b></span>
          <span>DPR <b>{metrics?.dpr ?? 2}</b></span>
        </aside>
      )}
      {!hideUi && <aside className="production-orb-known-differences"><b>Known OG differences</b><span>Real-time environment bounce · reference-specific grading/compression · microscopic manufacturing variation</span></aside>}
    </main>
  );
}

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { useAnchorController } from "../anchors";
import { AuthoredReflowInstrument } from "../orb/AuthoredReflowInstrument";
import {
  AUTHORED_BODY_FLOOR,
  AUTHORED_BODY_RADIUS,
  AUTHORED_REFLOW_GLB,
  AUTHORED_ORB_ANCHORS,
  AUTHORED_ORB_RAILS,
  AuthoredGroundShadow,
  AuthoredRendererSetup,
  AuthoredStudioEnvironment,
  AuthoredStudioLights,
} from "../orb/authoredReflowRendering";
import {
  localRailPoint,
  pointsToSvgPath,
  projectOrbLocalPoint,
  projectRail,
  splitRailDepth,
} from "../orb/projectOrbitalRails";
import type { StoryStageId } from "../data/proofManifest";
import type { OrbPose } from "../story/storyTypes";
import { CinematicOrbLayer, type CinematicOrbBounds } from "./CinematicOrbLayer";

class WebGLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    document.documentElement.dataset.storyWebglFallback = "true";
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface ReflowInstrumentProps {
  pose: MutableRefObject<OrbPose>;
  progress: MutableRefObject<number>;
  activeStage: StoryStageId;
  reducedMotion: boolean;
  registerInvalidator: (invalidate: (() => void) | null) => void;
}

const RAILS = Object.entries(AUTHORED_ORB_RAILS);
function CameraSetup() {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.lookAt(0, 0.2, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

type InstrumentProjection = {
  paths: string[];
  labels: Array<{ text: string; x: number; y: number }>;
  cinematicBounds: CinematicOrbBounds | null;
};

const LABELS = [
  { text: "PLAN", angle: Math.PI * 1.2 },
  { text: "DETECT", angle: Math.PI * 1.5 },
  { text: "ACT", angle: Math.PI * 1.82 },
  { text: "VERIFY", angle: Math.PI * 0.12 },
];

function InstrumentBody({
  pose,
  progress,
  activeStage,
  onProjection,
  onReady,
  motionEnabled,
}: {
  pose: MutableRefObject<OrbPose>;
  progress: MutableRefObject<number>;
  activeStage: StoryStageId;
  onProjection: (value: InstrumentProjection) => void;
  onReady: () => void;
  motionEnabled: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const anchorController = useAnchorController();
  const projectionAccumulator = useRef(0);
  const lastPose = useRef({ x: Number.NaN, y: Number.NaN, scale: Number.NaN, yaw: Number.NaN });
  const projectionSamples = useRef<number[]>([]);

  useFrame((state, delta) => {
    const value = pose.current;
    if (!root.current) return;

    const idle = motionEnabled ? Math.sin(state.clock.elapsedTime * 0.095) : 0;
    const groundCorrection = AUTHORED_BODY_FLOOR * (1 - value.scale);
    root.current.position.set(value.x, groundCorrection + idle * 0.006, value.y);
    root.current.rotation.set(value.tilt, value.yaw, 0);
    root.current.scale.setScalar(value.scale);
    root.current.updateWorldMatrix(true, true);

    const previous = lastPose.current;
    const moving = Math.abs(previous.x - value.x) + Math.abs(previous.y - value.y)
      + Math.abs(previous.scale - value.scale) * 4 + Math.abs(previous.yaw - value.yaw) > 0.0007;
    lastPose.current = { x: value.x, y: value.y, scale: value.scale, yaw: value.yaw };
    projectionAccumulator.current += delta;
    const projectionInterval = moving ? 1 / 60 : 1 / 30;
    if (motionEnabled && projectionAccumulator.current < projectionInterval) return;
    projectionAccumulator.current = 0;

    const start = performance.now();
    const rect = gl.domElement.getBoundingClientRect();
    const rects = { canvas: rect, stage: rect };
    anchorController.setAnchors({
      orbRecoveryRoute: projectOrbLocalPoint(AUTHORED_ORB_ANCHORS.actionExit, root.current, camera, rects, undefined, false),
      orbRecoveryTangent: projectOrbLocalPoint(AUTHORED_ORB_ANCHORS.recoveryTrackTangent, root.current, camera, rects, undefined, false),
      orbImpactSource: projectOrbLocalPoint(AUTHORED_ORB_ANCHORS.impactSource, root.current, camera, rects, undefined, false),
      orbFutureA: projectOrbLocalPoint(AUTHORED_ORB_ANCHORS.futureA, root.current, camera, rects, undefined, false),
      orbFutureB: projectOrbLocalPoint(AUTHORED_ORB_ANCHORS.futureB, root.current, camera, rects, undefined, false),
      orbFutureC: projectOrbLocalPoint(AUTHORED_ORB_ANCHORS.futureC, root.current, camera, rects, undefined, false),
      orbObjectiveHub: projectOrbLocalPoint(AUTHORED_ORB_ANCHORS.objectiveHub, root.current, camera, rects, undefined, false),
    });

    const paths = RAILS.map(([, radius]) => {
      const depth = splitRailDepth(projectRail(radius, root.current!, camera, rects));
      return `${pointsToSvgPath(depth.rear)} ${pointsToSvgPath(depth.front)}`;
    });
    const labels = LABELS.map((label) => ({
      ...label,
      ...projectOrbLocalPoint(
        localRailPoint(AUTHORED_ORB_RAILS.outerOuter * 1.04, label.angle, 0.25),
        root.current!,
        camera,
        rects,
        undefined,
        false,
      ),
    }));
    const silhouette = Array.from({ length: 64 }, (_, index) => {
      const angle = (index / 64) * Math.PI * 2;
      return projectOrbLocalPoint(
        new THREE.Vector3(
          Math.cos(angle) * AUTHORED_BODY_RADIUS,
          index % 2 ? 0.51 : AUTHORED_BODY_FLOOR,
          Math.sin(angle) * AUTHORED_BODY_RADIUS,
        ),
        root.current!,
        camera,
        rects,
        undefined,
        false,
      );
    });
    const xs = silhouette.map((point) => point.x);
    const ys = silhouette.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cinematicBounds = {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      width: maxX - minX,
      height: maxY - minY,
    };
    const projectionMs = performance.now() - start;
    projectionSamples.current.push(projectionMs);
    if (projectionSamples.current.length > 240) projectionSamples.current.shift();
    const sorted = [...projectionSamples.current].sort((a, b) => a - b);
    document.documentElement.dataset.storyProjectionMs = projectionMs.toFixed(3);
    document.documentElement.dataset.storyProjectionMedianMs = sorted[Math.floor(sorted.length * 0.5)].toFixed(3);
    document.documentElement.dataset.storyProjectionP95Ms = sorted[Math.floor(sorted.length * 0.95)].toFixed(3);
    document.documentElement.dataset.storyProjectionHz = moving ? "60" : "30";
    onProjection({ paths, labels, cinematicBounds });
  });

  return (
    <AuthoredReflowInstrument
      rootRef={root}
      progress={progress}
      activeStage={activeStage}
      motionEnabled={motionEnabled}
      onReady={onReady}
    />
  );
}

export function ReflowInstrument({ pose, progress, activeStage, reducedMotion, registerInvalidator }: ReflowInstrumentProps) {
  const [cinematicBounds, setCinematicBounds] = useState<CinematicOrbBounds | null>(null);
  const [ready, setReady] = useState(false);
  const railRefs = useRef<Array<SVGPathElement | null>>([]);
  const labelRefs = useRef<Array<SVGTextElement | null>>([]);
  const renderCount = useRef(0);
  renderCount.current += 1;
  const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const experiment = query?.get("hybridOrb") === "1";
  const mix = experiment ? Math.min(1, Math.max(0, Number(query?.get("mix") ?? "1"))) : 0;
  const handleProjection = useCallback((value: InstrumentProjection) => {
    const storyProgress = progress.current;
    const clamp = (next: number) => Math.max(0, Math.min(1, next));
    const smooth = (start: number, end: number) => {
      const raw = clamp((storyProgress - start) / Math.max(0.0001, end - start));
      return raw * raw * (3 - 2 * raw);
    };
    const windowed = (enterStart: number, enterEnd: number, exitStart: number, exitEnd: number) =>
      smooth(enterStart, enterEnd) * (1 - smooth(exitStart, exitEnd));
    const hero = windowed(0, 0.01, 0.09, 0.16);
    const impact = windowed(0.09, 0.14, 0.245, 0.3);
    const futures = windowed(0.23, 0.28, 0.405, 0.45);
    const action = windowed(0.39, 0.44, 0.56, 0.61);
    const incomplete = windowed(0.54, 0.59, 0.69, 0.75);
    const replan = windowed(0.67, 0.72, 0.84, 0.89);
    const restored = smooth(0.83, 0.9);
    const railOpacity = [
      0.025 + impact * 0.31 + incomplete * 0.34,
      0.025 + action * 0.5 + replan * 0.22,
      0.025 + impact * 0.16 + futures * 0.24,
      0.02 + futures * 0.34 + replan * 0.34,
      0.025 + hero * 0.28 + restored * 0.09,
    ];
    const failure = windowed(0.57, 0.615, 0.72, 0.79);
    const forest = new THREE.Color("#1d4c39");
    const rust = new THREE.Color("#a76658");
    value.paths.forEach((d, index) => {
      const path = railRefs.current[index];
      if (!path) return;
      path.setAttribute("d", d);
      path.style.opacity = clamp(railOpacity[index]).toFixed(3);
      path.style.stroke = index === 0 ? forest.clone().lerp(rust, failure * 0.72).getStyle() : "#1d4c39";
    });

    const replanLocal = clamp((storyProgress - 0.69) / 0.14);
    const labelOpacity = [
      0.06 + hero * 0.11 + futures * 0.84 + replan * (1 - replanLocal) * 0.76 + restored * 0.08,
      0.06 + hero * 0.11 + impact * 0.88 + restored * 0.08,
      0.06 + hero * 0.11 + action * 0.9 + replan * Math.sin(replanLocal * Math.PI) * 0.72 + restored * 0.08,
      0.06 + hero * 0.11 + incomplete * 0.9 + replan * replanLocal * 0.78 + restored * 0.12,
    ];
    value.labels.forEach((label, index) => {
      const text = labelRefs.current[index];
      if (!text) return;
      text.setAttribute("x", label.x.toFixed(1));
      text.setAttribute("y", label.y.toFixed(1));
      text.setAttribute("transform", `translate(0 ${(1 - clamp(labelOpacity[index])) * 5})`);
      text.style.opacity = clamp(labelOpacity[index]).toFixed(3);
    });
    if (experiment) setCinematicBounds(value.cinematicBounds);
  }, [experiment, progress]);
  const handleReady = useCallback(() => {
    document.documentElement.dataset.storyReadyMs = performance.now().toFixed(1);
    const resource = performance.getEntriesByName(new URL(AUTHORED_REFLOW_GLB, window.location.href).href).at(-1) as PerformanceResourceTiming | undefined;
    if (resource) {
      document.documentElement.dataset.storyGlbDurationMs = resource.duration.toFixed(1);
      document.documentElement.dataset.storyGlbTransferBytes = String(resource.transferSize);
      document.documentElement.dataset.storyGlbDecodedBytes = String(resource.decodedBodySize);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.storyInstrumentInstances = "1";
    document.documentElement.dataset.storyInstrumentRenders = String(renderCount.current);
  });
  useEffect(() => {
    let count = 0;
    let total = 0;
    if (typeof PerformanceObserver === "undefined") return;
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        count += 1;
        total += entry.duration;
      });
      document.documentElement.dataset.storyLongTasks = String(count);
      document.documentElement.dataset.storyLongTaskMs = total.toFixed(1);
    });
    try {
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      return;
    }
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cls = 0;
    let lcp = 0;
    const observers: PerformanceObserver[] = [];
    if (typeof PerformanceObserver === "undefined") return;
    document.documentElement.dataset.storyCls = "0.0000";
    try {
      const layoutObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!shift.hadRecentInput) cls += shift.value ?? 0;
        }
        document.documentElement.dataset.storyCls = cls.toFixed(4);
      });
      layoutObserver.observe({ type: "layout-shift", buffered: true });
      observers.push(layoutObserver);
    } catch { /* Unsupported performance entry type. */ }
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        lcp = entries.at(-1)?.startTime ?? lcp;
        document.documentElement.dataset.storyLcpMs = lcp.toFixed(1);
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
      observers.push(lcpObserver);
    } catch { /* Unsupported performance entry type. */ }
    return () => observers.forEach((observer) => observer.disconnect());
  }, []);

  return (
    <div
      className={`orb-layer production-instrument-layer ${ready ? "is-ready" : "is-loading"} stage-${activeStage}`}
      data-authored-instrument="persistent"
      aria-hidden="true"
    >
      <div className="authored-orb-placeholder">
        <i className="authored-placeholder-disc" />
        <i className="authored-placeholder-track authored-placeholder-track-outer" />
        <i className="authored-placeholder-track authored-placeholder-track-inner" />
        <i className="authored-placeholder-hub" />
      </div>
      <svg className="production-story-rails">
        {RAILS.map(([name], index) => (
          <path key={name} ref={(node) => { railRefs.current[index] = node; }} />
        ))}
        {LABELS.map((label, index) => (
          <text key={label.text} ref={(node) => { labelRefs.current[index] = node; }}>{label.text}</text>
        ))}
      </svg>
      <WebGLBoundary>
        <Canvas
          className="orb-canvas"
          shadows={{ type: THREE.VSMShadowMap }}
          dpr={[1, 2]}
          frameloop={reducedMotion ? "demand" : "always"}
          camera={{ position: [0, 6.55, 9.75], fov: 20.58, near: 0.1, far: 120 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        >
          <CameraSetup />
          <AuthoredRendererSetup />
          <AuthoredStudioEnvironment />
          <AuthoredStudioLights />
          <AuthoredGroundShadow />
          <Suspense fallback={null}>
            <InstrumentBody
              pose={pose}
              progress={progress}
              activeStage={activeStage}
              onProjection={handleProjection}
              onReady={handleReady}
              motionEnabled={!reducedMotion}
            />
          </Suspense>
          <SceneInvalidator register={registerInvalidator} />
          <StoryProfiler />
        </Canvas>
      </WebGLBoundary>
      {experiment && <CinematicOrbLayer bounds={cinematicBounds} mix={mix} />}
    </div>
  );
}

function SceneInvalidator({ register }: { register: (invalidate: (() => void) | null) => void }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    register(invalidate);
    return () => register(null);
  }, [invalidate, register]);
  return null;
}

function StoryProfiler() {
  const gl = useThree((state) => state.gl);
  const samples = useRef<number[]>([]);
  useFrame((_, delta) => {
    samples.current.push(delta * 1000);
    if (samples.current.length > 240) samples.current.shift();
    if (samples.current.length >= 120) {
      const sorted = [...samples.current].sort((a, b) => a - b);
      document.documentElement.dataset.storyAverageMs = (samples.current.reduce((a, b) => a + b, 0) / samples.current.length).toFixed(2);
      document.documentElement.dataset.storyP95Ms = sorted[Math.floor(sorted.length * 0.95)].toFixed(2);
      document.documentElement.dataset.storyP99Ms = sorted[Math.floor(sorted.length * 0.99)].toFixed(2);
      document.documentElement.dataset.storyFramesOver16 = String(samples.current.filter((sample) => sample > 16.7).length);
      document.documentElement.dataset.storyFramesOver33 = String(samples.current.filter((sample) => sample > 33).length);
      document.documentElement.dataset.storyDrawCalls = String(gl.info.render.calls);
      document.documentElement.dataset.storyTriangles = String(gl.info.render.triangles);
      document.documentElement.dataset.storyTextures = String(gl.info.memory.textures);
      document.documentElement.dataset.storyGeometries = String(gl.info.memory.geometries);
    }
  });
  return null;
}

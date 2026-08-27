import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  STORY_FRAME_PROGRESS,
  stageFromProgress,
  type StoryStageId,
} from "../data/proofManifest";
import { INITIAL_ORB_POSE, type OrbPose, type StoryController } from "./storyTypes";
import { useReducedMotion } from "./useReducedMotion";

gsap.registerPlugin(ScrollTrigger);

const STAGE_IDS = Object.keys(STORY_FRAME_PROGRESS) as StoryStageId[];
const PROGRESS_CENTERS: Record<StoryStageId, number> = {
  hero: 0.055,
  risk: 0.185,
  futures: 0.33,
  action: 0.48,
  incomplete: 0.62,
  replan: 0.76,
  restored: 0.92,
};

const GLOBAL_ORIENTATION_KEYFRAMES = [
  { progress: 0, degrees: -8.6 },
  { progress: 0.04, degrees: -8.45 },
  { progress: 0.09, degrees: -7 },
  { progress: 0.15, degrees: -4.5 },
  { progress: 0.23, degrees: -4.3 },
  { progress: 0.3, degrees: -1 },
  { progress: 0.39, degrees: -0.8 },
  { progress: 0.45, degrees: 1.8 },
  { progress: 0.54, degrees: 2.2 },
  { progress: 0.6, degrees: 0.2 },
  { progress: 0.67, degrees: 0.1 },
  { progress: 0.76, degrees: 1.1 },
  { progress: 0.83, degrees: 1.3 },
  { progress: 0.91, degrees: 5 },
  { progress: 1, degrees: 5.2 },
] as const;

function globalOrientationDegrees(progress: number) {
  const value = clamp01(progress);
  for (let index = 1; index < GLOBAL_ORIENTATION_KEYFRAMES.length; index += 1) {
    const previous = GLOBAL_ORIENTATION_KEYFRAMES[index - 1];
    const next = GLOBAL_ORIENTATION_KEYFRAMES[index];
    if (value <= next.progress) {
      const local = clamp01((value - previous.progress) / (next.progress - previous.progress));
      const eased = local * local * (3 - 2 * local);
      return previous.degrees + (next.degrees - previous.degrees) * eased;
    }
  }
  return GLOBAL_ORIENTATION_KEYFRAMES[GLOBAL_ORIENTATION_KEYFRAMES.length - 1].degrees;
}

function captureFrameFromUrl(): StoryStageId | null {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("frame");
  return STAGE_IDS.includes(requested as StoryStageId) ? (requested as StoryStageId) : null;
}

function captureProgressFromUrl(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("progress");
  if (raw === null || raw.trim() === "") return null;
  const requested = Number(raw);
  return Number.isFinite(requested) ? Math.min(1, Math.max(0, requested)) : null;
}

function resetPose(pose: OrbPose) {
  Object.assign(pose, INITIAL_ORB_POSE);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function range(progress: number, start: number, end: number) {
  const raw = clamp01((progress - start) / Math.max(0.0001, end - start));
  return raw * raw * (3 - 2 * raw);
}

function windowed(progress: number, enterStart: number, enterEnd: number, exitStart: number, exitEnd: number) {
  return range(progress, enterStart, enterEnd) * (1 - range(progress, exitStart, exitEnd));
}

interface UseStoryControllerOptions {
  rootRef: RefObject<HTMLElement | null>;
  trackRef: RefObject<HTMLDivElement | null>;
}

export function useStoryController({ rootRef, trackRef }: UseStoryControllerOptions): StoryController {
  const progress = useRef(0);
  const pose = useRef<OrbPose>({ ...INITIAL_ORB_POSE });
  const invalidator = useRef<(() => void) | null>(null);
  const reducedMotion = useReducedMotion();
  const [captureFrame] = useState(captureFrameFromUrl);
  const [captureProgress] = useState(captureProgressFromUrl);
  const initialCaptureProgress = captureProgress ?? (captureFrame ? STORY_FRAME_PROGRESS[captureFrame] : 0);
  const initialCaptureStage = captureFrame ?? stageFromProgress(initialCaptureProgress);
  const [activeStage, setActiveStage] = useState<StoryStageId>(initialCaptureStage);
  const activeStageRef = useRef<StoryStageId>(initialCaptureStage);

  const registerInvalidator = useCallback((next: (() => void) | null) => {
    invalidator.current = next;
    next?.();
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    if (!root || !track) return;

    if (reducedMotion) {
      resetPose(pose.current);
      pose.current.y = 0.2;
      pose.current.scale = 0.7;
      root.dataset.motion = "reduced";
      root.style.setProperty("--story-progress", "0");
      invalidator.current?.();
      return;
    }

    root.dataset.motion = "cinematic";
    const media = gsap.matchMedia();

    media.add(
      {
        desktop: "(min-width: 1100px)",
        tablet: "(min-width: 700px) and (max-width: 1099px)",
        mobile: "(max-width: 699px)",
      },
      (context) => {
        const conditions = context.conditions as { desktop: boolean; tablet: boolean; mobile: boolean };
        const p = pose.current;
        resetPose(p);

        const xAction = conditions.desktop ? -1.55 : conditions.tablet ? -1 : 0;
        const xReplan = conditions.desktop ? -0.6 : 0;
        const heroScale = conditions.desktop ? 0.38 : conditions.tablet ? 0.42 : 0.22;
        const riskScale = conditions.desktop ? 0.56 : conditions.tablet ? 0.52 : 0.32;
        const futureScale = conditions.desktop ? 0.45 : conditions.tablet ? 0.46 : 0.3;
        p.scale = heroScale;
        p.y = conditions.mobile ? 1.5 : conditions.tablet ? 2.35 : 2.7;

        const beats = gsap.utils.toArray<HTMLElement>("[data-beat]", root);
        const progressItems = gsap.utils.toArray<HTMLElement>("[data-progress-stage]", root);
        gsap.set(beats, { autoAlpha: 0, pointerEvents: "none" });
        gsap.set("[data-beat='hero']", { autoAlpha: 1, pointerEvents: "auto" });
        gsap.set("[data-sequence], [data-impact-node], [data-future-card], [data-proof-step], [data-replan-step], [data-invariant]", { autoAlpha: 0, y: 16 });
        gsap.set("[data-beat='hero'] .hero-copy > *", { autoAlpha: 1, y: 0 });

        const updateContinuousPresentation = (value: number) => {
          progress.current = value;
          const globalYawDegrees = globalOrientationDegrees(value);
          p.yaw = globalYawDegrees * Math.PI / 180;
          root.dataset.storyGlobalYawDeg = globalYawDegrees.toFixed(3);
          root.style.setProperty("--story-progress", value.toFixed(5));
          root.style.setProperty("--futures-route-opacity", windowed(value, 0.235, 0.265, 0.405, 0.445).toFixed(4));
          root.style.setProperty("--future-route-a", range(value, 0.25, 0.305).toFixed(4));
          root.style.setProperty("--future-route-b", range(value, 0.27, 0.335).toFixed(4));
          root.style.setProperty("--future-route-c", range(value, 0.29, 0.365).toFixed(4));
          root.style.setProperty("--action-route-opacity", windowed(value, 0.395, 0.425, 0.56, 0.61).toFixed(4));
          root.style.setProperty("--action-route-progress", range(value, 0.41, 0.49).toFixed(4));
          root.style.setProperty("--failure-accent", windowed(value, 0.57, 0.615, 0.72, 0.79).toFixed(4));
          root.style.setProperty("--replan-route-opacity", windowed(value, 0.675, 0.705, 0.84, 0.89).toFixed(4));
          root.style.setProperty("--replan-route-progress", range(value, 0.705, 0.815).toFixed(4));
          root.style.setProperty("--restored-route-opacity", range(value, 0.82, 0.865).toFixed(4));
          root.style.setProperty("--restored-route-progress", range(value, 0.845, 0.94).toFixed(4));

          progressItems.forEach((item) => {
            const id = item.dataset.progressStage as StoryStageId;
            const weight = clamp01(1 - Math.abs(value - PROGRESS_CENTERS[id]) / 0.125);
            item.style.setProperty("--progress-weight", weight.toFixed(4));
            const label = item.querySelector<HTMLElement>("b");
            const dot = item.querySelector<HTMLElement>("i");
            if (label) {
              label.style.opacity = weight.toFixed(4);
            }
            if (dot) dot.style.transform = `scale(${(1 + weight * 0.6).toFixed(4)})`;
          });

          const nextStage = stageFromProgress(value);
          if (!captureFrame && captureProgress === null && nextStage !== activeStageRef.current) {
            activeStageRef.current = nextStage;
            setActiveStage(nextStage);
          }
          invalidator.current?.();
        };

        const timeline = gsap.timeline({
          paused: true,
          defaults: { ease: "power2.inOut" },
          onUpdate: function () { updateContinuousPresentation(this.progress()); },
        });

        timeline.addLabel("hero", 0);
        timeline.to("[data-beat='hero'] .lede", { autoAlpha: 0, y: -16, duration: 5 }, 5.5);
        timeline.to("[data-beat='hero'] .hero-actions", { autoAlpha: 0, y: -14, duration: 5 }, 7);
        timeline.to("[data-beat='hero'] .credibility", { autoAlpha: 0, y: -10, duration: 4 }, 8);
        timeline.to("[data-beat='hero'] .evidence-badge, [data-beat='hero'] .eyebrow, [data-beat='hero'] h1", { autoAlpha: 0, y: -22, duration: 7 }, 7);
        timeline.to("[data-beat='hero']", { autoAlpha: 0, pointerEvents: "none", duration: 2 }, 13);
        timeline.to(p, { x: 0, y: conditions.mobile ? 1.5 : 0.15, scale: riskScale, duration: 15, ease: "sine.inOut" }, 4);

        timeline.addLabel("impact", 10);
        timeline.to("[data-beat='risk']", { autoAlpha: 1, pointerEvents: "auto", duration: 2 }, 9);
        timeline.to("[data-sequence='impact-objective']", { autoAlpha: 1, y: 0, duration: 4 }, 10);
        timeline.to("[data-sequence='impact-disruption']", { autoAlpha: 1, y: 0, duration: 4 }, 12.5);
        timeline.to("[data-sequence='impact-flow']", { autoAlpha: 1, y: 0, duration: 3 }, 14.5);
        [0, 1, 2, 3, 4].forEach((index) => timeline.to(`[data-impact-node='${index}']`, { autoAlpha: 1, y: 0, duration: 3.4 }, 15.2 + index * 1.65));
        timeline.to("[data-beat='risk']", { autoAlpha: 0, y: -18, pointerEvents: "none", duration: 6 }, 24);
        timeline.to(p, { x: 0, y: conditions.mobile ? 1.5 : conditions.tablet ? 0.5 : 0.45, scale: futureScale, duration: 13, ease: "sine.inOut" }, 23);

        timeline.addLabel("futures", 24);
        timeline.to("[data-beat='futures']", { autoAlpha: 1, pointerEvents: "auto", duration: 2 }, 23.5);
        timeline.to("[data-sequence='futures-heading']", { autoAlpha: 1, y: 0, duration: 5 }, 24);
        timeline.to("[data-future-card='a']", { autoAlpha: 1, y: 0, duration: 4 }, 30.5);
        timeline.to("[data-future-card='b']", { autoAlpha: 1, y: 0, duration: 4 }, 32.2);
        timeline.to("[data-future-card='c']", { autoAlpha: 1, y: 0, duration: 4 }, 33.9);
        timeline.to("[data-future-card='a'], [data-future-card='c']", { autoAlpha: 0.42, duration: 3 }, 37);
        timeline.to("[data-beat='futures']", { autoAlpha: 0, y: -16, pointerEvents: "none", duration: 6 }, 39);
        timeline.to(p, { x: xAction, y: conditions.mobile ? 1.55 : 0.55, scale: riskScale * 0.8, duration: 14, ease: "sine.inOut" }, 38);

        timeline.addLabel("action", 39);
        timeline.to("[data-beat='action']", { autoAlpha: 1, pointerEvents: "auto", duration: 2 }, 39);
        timeline.to("[data-sequence='action-copy']", { autoAlpha: 1, y: 0, duration: 5 }, 39.5);
        timeline.fromTo("[data-sequence='action-receipt']", { autoAlpha: 0, y: 17, scale: 0.985 }, { autoAlpha: 1, y: 0, scale: 1, duration: 5, ease: "power3.out" }, 42);
        timeline.to("[data-proof-step='write']", { autoAlpha: 1, y: 0, duration: 3.5 }, 45);
        timeline.to("[data-proof-step='read']", { autoAlpha: 1, y: 0, duration: 3.5 }, 48);
        timeline.to("[data-proof-step='verify']", { autoAlpha: 1, y: 0, duration: 3.5 }, 51);
        timeline.to("[data-beat='action']", { autoAlpha: 0, y: -15, pointerEvents: "none", duration: 6 }, 54);
        timeline.to(p, { x: conditions.desktop ? 1.65 : 0, y: conditions.mobile ? 1.5 : 0.75, scale: riskScale * 0.75, alert: 1, ringSpread: 0.8, duration: 14, ease: "sine.inOut" }, 53);

        timeline.addLabel("incomplete", 54);
        timeline.to("[data-beat='incomplete']", { autoAlpha: 1, pointerEvents: "auto", duration: 2 }, 54);
        timeline.to("[data-sequence='incomplete-heading']", { autoAlpha: 1, y: 0, duration: 5 }, 55);
        timeline.to("[data-sequence='failure-marker']", { autoAlpha: 1, y: 0, duration: 4 }, 59.5);
        timeline.to("[data-beat='incomplete']", { autoAlpha: 0, y: -16, pointerEvents: "none", duration: 6 }, 67);
        timeline.to(p, { x: xReplan, y: conditions.mobile ? 1.5 : 0.35, scale: riskScale * 0.82, alert: 0.05, ringSpread: 1, duration: 14, ease: "sine.inOut" }, 67);

        timeline.addLabel("replan", 67);
        timeline.to("[data-beat='replan']", { autoAlpha: 1, pointerEvents: "auto", duration: 2 }, 67);
        timeline.to("[data-sequence='replan-copy']", { autoAlpha: 1, y: 0, duration: 5 }, 68);
        timeline.to("[data-sequence='replan-steps']", { autoAlpha: 1, y: 0, duration: 3 }, 71);
        [0, 1, 2, 3].forEach((index) => timeline.to(`[data-replan-step='${index}']`, { autoAlpha: 1, y: 0, duration: 3.2 }, 71.5 + index * 2.45));
        timeline.to("[data-beat='replan']", { autoAlpha: 0, y: -14, pointerEvents: "none", duration: 6 }, 83);
        timeline.to(p, { x: conditions.desktop ? -1.1 : 0, y: conditions.mobile ? 1.5 : 0.3, scale: riskScale * 0.78, alert: 0, verified: 1, ringSpread: 0, duration: 14, ease: "sine.inOut" }, 82);

        timeline.addLabel("restored", 83);
        timeline.to("[data-beat='restored']", { autoAlpha: 1, pointerEvents: "auto", duration: 2 }, 83);
        timeline.to("[data-sequence='restored-copy']", { autoAlpha: 1, y: 0, duration: 5 }, 84);
        timeline.to("[data-sequence='restored-proof']", { autoAlpha: 1, y: 0, duration: 5 }, 87);
        [0, 1, 2, 3].forEach((index) => timeline.to(`[data-invariant='${index}']`, { autoAlpha: 1, y: 0, duration: 3 }, 89 + index * 1.7));
        timeline.to({}, { duration: 4 });

        if (captureFrame || captureProgress !== null) {
          const requestedProgress = captureProgress ?? STORY_FRAME_PROGRESS[captureFrame!];
          const requestedStage = captureFrame ?? stageFromProgress(requestedProgress);
          timeline.progress(requestedProgress);
          updateContinuousPresentation(requestedProgress);
          root.dataset.capture = captureFrame ?? `progress-${requestedProgress.toFixed(3)}`;
          activeStageRef.current = requestedStage;
          setActiveStage(requestedStage);
          return () => timeline.kill();
        }

        const trigger = ScrollTrigger.create({
          trigger: track,
          start: "top top",
          end: "bottom bottom",
          animation: timeline,
          scrub: 0.42,
          invalidateOnRefresh: true,
        });
        updateContinuousPresentation(trigger.progress);

        return () => { trigger.kill(); timeline.kill(); };
      },
      root,
    );

    return () => {
      media.revert();
      delete root.dataset.capture;
      delete root.dataset.storyGlobalYawDeg;
    };
  }, [captureFrame, captureProgress, reducedMotion, rootRef, trackRef]);

  return {
    progress: progress as MutableRefObject<number>,
    pose: pose as MutableRefObject<OrbPose>,
    activeStage,
    reducedMotion,
    captureFrame,
    captureProgress,
    registerInvalidator,
  };
}

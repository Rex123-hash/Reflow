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

function captureFrameFromUrl(): StoryStageId | null {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("frame");
  return STAGE_IDS.includes(requested as StoryStageId) ? (requested as StoryStageId) : null;
}

function resetPose(pose: OrbPose) {
  Object.assign(pose, INITIAL_ORB_POSE);
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
  const [activeStage, setActiveStage] = useState<StoryStageId>(captureFrame ?? "hero");
  const activeStageRef = useRef<StoryStageId>(captureFrame ?? "hero");

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
      pose.current.y = -0.15;
      pose.current.scale = 0.85;
      root.dataset.motion = "reduced";
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
        const conditions = context.conditions as {
          desktop: boolean;
          tablet: boolean;
          mobile: boolean;
        };
        const p = pose.current;
        resetPose(p);

        const xAction = conditions.desktop ? -1.75 : conditions.tablet ? -1.1 : 0;
        const xReplan = conditions.desktop ? -0.6 : 0;
        const heroScale = conditions.desktop ? 1.35 : conditions.tablet ? 1.08 : 0.55;
        const riskScale = conditions.desktop ? 1.05 : conditions.tablet ? 0.9 : 0.5;
        const futureScale = conditions.desktop ? 0.48 : conditions.tablet ? 0.5 : 0.4;
        p.scale = heroScale;
        p.y = conditions.mobile ? 1.5 : conditions.tablet ? -3.8 : -4.8;

        const beats = gsap.utils.toArray<HTMLElement>("[data-beat]", root);
        const topologyGroups = gsap.utils.toArray<SVGGElement>("[data-topology]", root);
        const topologyPaths = gsap.utils.toArray<SVGPathElement>("[data-draw]", root);
        gsap.set(beats, { autoAlpha: 0, y: 28, pointerEvents: "none" });
        gsap.set("[data-beat='hero']", { autoAlpha: 1, y: 0, pointerEvents: "auto" });
        gsap.set(topologyGroups, { autoAlpha: 0 });
        gsap.set(topologyPaths, { strokeDasharray: 1, strokeDashoffset: 1 });

        const timeline = gsap.timeline({
          paused: true,
          defaults: { ease: "power2.inOut" },
          onUpdate: () => invalidator.current?.(),
        });

        const transitionBeat = (from: StoryStageId, to: StoryStageId, at: number) => {
          timeline.to(
            `[data-beat='${from}']`,
            { autoAlpha: 0, y: -24, pointerEvents: "none", duration: 5 },
            at,
          );
          timeline.fromTo(
            `[data-beat='${to}']`,
            { autoAlpha: 0, y: 28 },
            { autoAlpha: 1, y: 0, pointerEvents: "auto", duration: 6 },
            at + 2,
          );
        };

        timeline.addLabel("hero", 0);
        transitionBeat("hero", "risk", 9);
        timeline.to(
          p,
          { x: 0, y: conditions.mobile ? 1.5 : -0.35, scale: riskScale, yaw: 0.28, duration: 10 },
          8,
        );
        timeline.to("[data-topology='impact']", { autoAlpha: 1, duration: 3 }, 13);
        timeline.to("[data-topology='impact'] [data-draw]", { strokeDashoffset: 0, duration: 8 }, 13);

        timeline.addLabel("risk", 18);
        transitionBeat("risk", "futures", 25);
        timeline.to("[data-topology='impact']", { autoAlpha: 0, duration: 4 }, 25);
        timeline.to(
          p,
          { x: 0, y: conditions.mobile ? 1.5 : conditions.tablet ? -0.7 : -1.1, scale: futureScale, yaw: -0.18, duration: 10 },
          25,
        );
        timeline.to("[data-topology='futures']", { autoAlpha: 1, duration: 3 }, 29);
        timeline.to("[data-topology='futures'] [data-draw]", { strokeDashoffset: 0, duration: 8 }, 29);

        timeline.addLabel("futures", 35);
        transitionBeat("futures", "action", 42);
        timeline.to("[data-topology='futures']", { autoAlpha: 0, duration: 5 }, 42);
        timeline.to(
          p,
          { x: xAction, y: conditions.mobile ? 1.55 : -2, scale: riskScale * 0.76, yaw: 0.36, duration: 11 },
          42,
        );
        timeline.to("[data-topology='selected']", { autoAlpha: 1, duration: 3 }, 46);
        timeline.to("[data-topology='selected'] [data-draw]", { strokeDashoffset: 0, duration: 7 }, 46);

        timeline.addLabel("action", 51);
        transitionBeat("action", "incomplete", 59);
        timeline.to("[data-topology='selected']", { autoAlpha: 0.25, duration: 4 }, 59);
        timeline.to(
          p,
          { x: 0, y: conditions.mobile ? 1.5 : -2.1, scale: riskScale * 0.75, yaw: -0.08, alert: 1, ringSpread: 0.8, duration: 10 },
          58,
        );
        timeline.to("[data-topology='failure']", { autoAlpha: 1, duration: 3 }, 62);
        timeline.to("[data-topology='failure'] [data-draw]", { strokeDashoffset: 0, duration: 6 }, 62);

        timeline.addLabel("incomplete", 67);
        transitionBeat("incomplete", "replan", 70);
        timeline.to("[data-topology='failure']", { autoAlpha: 0.4, duration: 5 }, 72);
        timeline.to(
          p,
          { x: xReplan, y: conditions.mobile ? 1.5 : -1.8, scale: riskScale * 0.77, yaw: 0.54, alert: 0.05, ringSpread: 1, duration: 9 },
          70,
        );
        timeline.to("[data-topology='replan']", { autoAlpha: 1, duration: 3 }, 73);
        timeline.to("[data-topology='replan'] [data-draw]", { strokeDashoffset: 0, duration: 7 }, 73);

        timeline.addLabel("replan", 78);
        transitionBeat("replan", "restored", 82);
        timeline.to("[data-topology='failure']", { autoAlpha: 0, duration: 4 }, 82);
        timeline.to("[data-topology='replan']", { autoAlpha: 0.35, duration: 5 }, 83);
        timeline.to(
          p,
          { x: conditions.desktop ? -1.1 : 0, y: conditions.mobile ? 1.5 : -1.2, scale: riskScale * 0.72, yaw: 0, alert: 0, verified: 1, ringSpread: 0, duration: 10 },
          82,
        );
        timeline.to("[data-topology='restored']", { autoAlpha: 1, duration: 3 }, 86);
        timeline.to("[data-topology='restored'] [data-draw]", { strokeDashoffset: 0, duration: 7 }, 86);
        timeline.addLabel("restored", 90);
        timeline.to({}, { duration: 10 });

        if (captureFrame) {
          const captureProgress = STORY_FRAME_PROGRESS[captureFrame];
          progress.current = captureProgress;
          timeline.progress(captureProgress);
          root.dataset.capture = captureFrame;
          activeStageRef.current = captureFrame;
          setActiveStage(captureFrame);
          invalidator.current?.();
          return () => timeline.kill();
        }

        const trigger = ScrollTrigger.create({
          trigger: track,
          start: "top top",
          end: "bottom bottom",
          animation: timeline,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            progress.current = self.progress;
            const nextStage = stageFromProgress(self.progress);
            if (nextStage !== activeStageRef.current) {
              activeStageRef.current = nextStage;
              setActiveStage(nextStage);
            }
          },
        });

        return () => {
          trigger.kill();
          timeline.kill();
        };
      },
      root,
    );

    return () => {
      media.revert();
      delete root.dataset.capture;
    };
  }, [captureFrame, reducedMotion, rootRef, trackRef]);

  return {
    progress: progress as MutableRefObject<number>,
    pose: pose as MutableRefObject<OrbPose>,
    activeStage,
    reducedMotion,
    captureFrame,
    registerInvalidator,
  };
}

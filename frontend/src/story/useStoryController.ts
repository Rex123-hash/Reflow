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
import {
  STORY_BEATS,
  STORY_BEAT_ORDER,
  STORY_TIMELINE_DURATION,
  beatWeight,
} from "../data/storySchedule";
import { RAIL_WINDOWS, railIndexAt } from "../data/storyRail";
import { INITIAL_ORB_POSE, type OrbPose, type StoryController } from "./storyTypes";
import { useReducedMotion } from "./useReducedMotion";

gsap.registerPlugin(ScrollTrigger);

const STAGE_IDS = Object.keys(STORY_FRAME_PROGRESS) as StoryStageId[];

/**
 * The instrument's heading at each settled beat.
 *
 * These are the same angles the previous hand-written keyframe curve passed
 * through at each beat, but they are now *held* for the whole of a beat's settled
 * plateau and only interpolated across the transitions. The instrument therefore
 * stops turning at exactly the moment the text stops moving, which is what makes a
 * settled state read as settled rather than as a slow drift.
 */
const BEAT_YAW_DEGREES: Record<StoryStageId, number> = {
  hero: -8.5,
  risk: -4.4,
  futures: -0.9,
  action: 2,
  incomplete: 0.15,
  replan: 1.2,
  restored: 5.1,
};

const ORIENTATION_KEYFRAMES = STORY_BEAT_ORDER.flatMap((id, index) => {
  const beat = STORY_BEATS[id];
  const degrees = BEAT_YAW_DEGREES[id];
  const from = index === 0 ? 0 : beat.settleP;
  const to = index === STORY_BEAT_ORDER.length - 1 ? 1 : beat.exitP;
  return [
    { progress: from, degrees },
    { progress: to, degrees },
  ];
});

function globalOrientationDegrees(progress: number) {
  const value = clamp01(progress);
  for (let index = 1; index < ORIENTATION_KEYFRAMES.length; index += 1) {
    const previous = ORIENTATION_KEYFRAMES[index - 1];
    const next = ORIENTATION_KEYFRAMES[index];
    if (value <= next.progress) {
      const span = next.progress - previous.progress;
      if (span <= 0) return next.degrees;
      const local = clamp01((value - previous.progress) / span);
      const eased = local * local * (3 - 2 * local);
      return previous.degrees + (next.degrees - previous.degrees) * eased;
    }
  }
  return ORIENTATION_KEYFRAMES[ORIENTATION_KEYFRAMES.length - 1].degrees;
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

/**
 * A ramp across a fraction of one beat's ENTER phase, in progress space.
 *
 * The SVG route overlays used to be driven by loose progress constants that had
 * drifted out of step with the beats they belong to — the action route finished
 * drawing at 0.49 while the ACT beat was still assembling until 0.53. Expressing
 * them as a fraction of the beat's own arrival guarantees a route has finished
 * drawing by the time the beat settles, and never moves during the plateau.
 */
function enterRamp(
  progress: number,
  id: StoryStageId,
  from: number,
  to: number,
) {
  const beat = STORY_BEATS[id];
  const span = beat.settleP - beat.startP;
  return range(progress, beat.startP + span * from, beat.startP + span * to);
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
      // Reduced motion collapses the sticky scroll stage into normal flow, so the
      // orb layer is much shorter than the viewport. This nearer, larger framing
      // is what fits that box — the desktop hero pose gets clipped by the section
      // edge. Verified by capture: visual-qa/before-reduced-1440.png.
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
        // Reference PAGES/1.png shows the instrument considerably larger in the
        // hero than 0.38 produced — roughly half the frame height rather than a
        // third, with the raised centre hub clearly readable. Measured against a
        // matched-crop overlay (visual-qa/compare-hero-orb.png).
        const heroScale = conditions.desktop ? 0.52 : conditions.tablet ? 0.5 : 0.26;
        const riskScale = conditions.desktop ? 0.56 : conditions.tablet ? 0.52 : 0.32;
        const futureScale = conditions.desktop ? 0.45 : conditions.tablet ? 0.46 : 0.3;
        p.scale = heroScale;
        // Mobile pushes the instrument nearer the camera, which drops it lower on
        // screen so it clears the headline and lede. At 1.5 it sat directly behind
        // the copy; legible only while the render was washed out, which it no
        // longer is. Verified at 390px: visual-qa/after-normal-390.png.
        // Pushing the instrument further from the camera raises it in frame, which
        // is where the reference places it — the full top face and the centre hub
        // are visible above the fold rather than half-cropped by the viewport.
        p.y = conditions.mobile ? 3.4 : conditions.tablet ? 2.1 : 2.15;

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

          // Every route overlay is bound to the beat it belongs to: it arrives
          // during that beat's ENTER, is completely still through the plateau, and
          // clears with the beat.
          root.style.setProperty("--futures-route-opacity", beatWeight(STORY_BEATS.futures, value).toFixed(4));
          root.style.setProperty("--future-route-a", enterRamp(value, "futures", 0.14, 0.7).toFixed(4));
          root.style.setProperty("--future-route-b", enterRamp(value, "futures", 0.29, 0.85).toFixed(4));
          root.style.setProperty("--future-route-c", enterRamp(value, "futures", 0.44, 1).toFixed(4));
          root.style.setProperty("--action-route-opacity", beatWeight(STORY_BEATS.action, value).toFixed(4));
          root.style.setProperty("--action-route-progress", enterRamp(value, "action", 0.18, 1).toFixed(4));
          root.style.setProperty("--failure-accent", beatWeight(STORY_BEATS.incomplete, value).toFixed(4));
          root.style.setProperty("--replan-route-opacity", beatWeight(STORY_BEATS.replan, value).toFixed(4));
          root.style.setProperty("--replan-route-progress", enterRamp(value, "replan", 0.14, 1).toFixed(4));
          // The restored route is the story's last statement and is never taken
          // away, so it ramps in with the beat but has no matching fade.
          root.style.setProperty("--restored-route-opacity", enterRamp(value, "restored", 0, 0.6).toFixed(4));
          root.style.setProperty("--restored-route-progress", enterRamp(value, "restored", 0.22, 1).toFixed(4));

          /**
           * The rail advances *inside* a beat, not once per beat: the ACT beat
           * contains both the action and its independent read-back, and the
           * REPLAN beat contains replanning, the new action and the second
           * verification. Each of those is a real story state with its own slice
           * of the beat's window, so the reader watches the rail travel while the
           * thing it names is actually happening.
           */
          const currentRail = railIndexAt(value);
          // Fraction of the spine already travelled, used to draw the forest
          // overlay over the faint full-length one.
          root.style.setProperty(
            "--rail-travelled",
            (
              (currentRail + 0.5) /
              Math.max(1, RAIL_WINDOWS.length - 0.0)
            ).toFixed(4),
          );
          progressItems.forEach((item, index) => {
            const state =
              index < currentRail ? "done" : index === currentRail ? "active" : "next";
            if (item.dataset.railState !== state) {
              item.dataset.railState = state;
              if (state === "active") item.setAttribute("aria-current", "step");
              else item.removeAttribute("aria-current");
            }
            // Weight fades a row in as its own slice approaches, so the rail
            // breathes with the scroll instead of snapping between rows.
            const window = RAIL_WINDOWS[index];
            const distance =
              value < window.fromP
                ? window.fromP - value
                : value > window.toP
                  ? value - window.toP
                  : 0;
            const weight = clamp01(1 - distance / 0.06);
            item.style.setProperty("--progress-weight", weight.toFixed(4));
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

        const { hero, risk, futures, action, incomplete, replan, restored } = STORY_BEATS;

        /**
         * Every beat below follows the same contract, and the schedule guarantees
         * it: nothing inside a beat starts arriving before `start`, everything has
         * landed by `settleAt`, nothing moves at all between `settleAt` and
         * `exitAt`, and the beat is gone by `end` — which is exactly when the next
         * beat's `start` is. Two narrative blocks can therefore never be legible in
         * the same region at the same time.
         */

        // --- OBJECTIVE ------------------------------------------------------
        // The hero needs no entrance; it is what the page loads on.
        timeline.addLabel("hero", hero.start);
        timeline.to("[data-beat='hero'] .lede", { autoAlpha: 0, y: -16, duration: 4 }, hero.exitAt);
        timeline.to("[data-beat='hero'] .hero-actions", { autoAlpha: 0, y: -14, duration: 3.5 }, hero.exitAt + 0.5);
        timeline.to("[data-beat='hero'] .credibility", { autoAlpha: 0, y: -10, duration: 3 }, hero.exitAt + 0.5);
        timeline.to("[data-beat='hero'] .evidence-badge, [data-beat='hero'] .eyebrow, [data-beat='hero'] h1", { autoAlpha: 0, y: -22, duration: 4.25 }, hero.exitAt + 0.75);
        timeline.to("[data-beat='hero']", { autoAlpha: 0, pointerEvents: "none", duration: 1.75 }, hero.end - 1.75);
        timeline.to(p, { x: 0, y: conditions.mobile ? 1.5 : 0.15, scale: riskScale, duration: risk.settleAt - hero.exitAt, ease: "sine.inOut" }, hero.exitAt);

        // --- DETECT ---------------------------------------------------------
        timeline.addLabel("impact", risk.start);
        timeline.to("[data-beat='risk']", { autoAlpha: 1, pointerEvents: "auto", duration: 2 }, risk.start);
        timeline.to("[data-sequence='impact-objective']", { autoAlpha: 1, y: 0, duration: 3 }, risk.start + 0.6);
        timeline.to("[data-sequence='impact-disruption']", { autoAlpha: 1, y: 0, duration: 3 }, risk.start + 1.8);
        timeline.to("[data-sequence='impact-flow']", { autoAlpha: 1, y: 0, duration: 2.6 }, risk.start + 3);
        [0, 1, 2, 3, 4].forEach((index) => timeline.to(`[data-impact-node='${index}']`, { autoAlpha: 1, y: 0, duration: 2.4 }, risk.start + 3.4 + index * 0.55));
        timeline.to("[data-beat='risk']", { autoAlpha: 0, y: -18, pointerEvents: "none", duration: risk.exit }, risk.exitAt);
        timeline.to(p, { x: 0, y: conditions.mobile ? 1.5 : conditions.tablet ? 0.5 : 0.45, scale: futureScale, duration: futures.settleAt - risk.exitAt, ease: "sine.inOut" }, risk.exitAt);

        // --- PLAN -----------------------------------------------------------
        timeline.addLabel("futures", futures.start);
        timeline.to("[data-beat='futures']", { autoAlpha: 1, pointerEvents: "auto", duration: 2 }, futures.start);
        timeline.to("[data-sequence='futures-heading']", { autoAlpha: 1, y: 0, duration: 3 }, futures.start + 0.5);
        timeline.to("[data-future-card='a']", { autoAlpha: 1, y: 0, duration: 3.4 }, futures.start + 2.6);
        timeline.to("[data-future-card='b']", { autoAlpha: 1, y: 0, duration: 3.4 }, futures.start + 3.4);
        timeline.to("[data-future-card='c']", { autoAlpha: 1, y: 0, duration: 2.8 }, futures.start + 4.2);
        // Dimming the unselected routes belongs to the composition, not to its
        // exit, so it lands inside the arrival and holds through the plateau.
        timeline.to("[data-future-card='a'], [data-future-card='c']", { autoAlpha: 0.42, duration: 2 }, futures.start + 5);
        timeline.to("[data-beat='futures']", { autoAlpha: 0, y: -16, pointerEvents: "none", duration: futures.exit }, futures.exitAt);
        timeline.to(p, { x: xAction, y: conditions.mobile ? 1.55 : 0.55, scale: riskScale * 0.8, duration: action.settleAt - futures.exitAt, ease: "sine.inOut" }, futures.exitAt);

        // --- ACT ------------------------------------------------------------
        timeline.addLabel("action", action.start);
        timeline.to("[data-beat='action']", { autoAlpha: 1, pointerEvents: "auto", duration: 2 }, action.start);
        timeline.to("[data-sequence='action-copy']", { autoAlpha: 1, y: 0, duration: 3.4 }, action.start + 0.5);
        timeline.fromTo("[data-sequence='action-receipt']", { autoAlpha: 0, y: 17, scale: 0.985 }, { autoAlpha: 1, y: 0, scale: 1, duration: 3.5, ease: "power3.out" }, action.start + 2.5);
        timeline.to("[data-proof-step='write']", { autoAlpha: 1, y: 0, duration: 2.6 }, action.start + 4.5);
        timeline.to("[data-proof-step='read']", { autoAlpha: 1, y: 0, duration: 2.6 }, action.start + 5.8);
        timeline.to("[data-proof-step='verify']", { autoAlpha: 1, y: 0, duration: 2.1 }, action.start + 6.9);
        timeline.to("[data-beat='action']", { autoAlpha: 0, y: -15, pointerEvents: "none", duration: action.exit }, action.exitAt);
        timeline.to(p, { x: conditions.desktop ? 1.65 : 0, y: conditions.mobile ? 1.5 : 0.75, scale: riskScale * 0.75, alert: 1, ringSpread: 0.8, duration: incomplete.settleAt - action.exitAt, ease: "sine.inOut" }, action.exitAt);

        // --- VERIFY (incomplete) --------------------------------------------
        timeline.addLabel("incomplete", incomplete.start);
        timeline.to("[data-beat='incomplete']", { autoAlpha: 1, pointerEvents: "auto", duration: 2 }, incomplete.start);
        timeline.to("[data-sequence='incomplete-heading']", { autoAlpha: 1, y: 0, duration: 3.4 }, incomplete.start + 0.6);
        timeline.to("[data-sequence='failure-marker']", { autoAlpha: 1, y: 0, duration: 3.4 }, incomplete.start + 2.6);
        timeline.to("[data-beat='incomplete']", { autoAlpha: 0, y: -16, pointerEvents: "none", duration: incomplete.exit }, incomplete.exitAt);
        timeline.to(p, { x: xReplan, y: conditions.mobile ? 1.5 : 0.35, scale: riskScale * 0.82, alert: 0.05, ringSpread: 1, duration: replan.settleAt - incomplete.exitAt, ease: "sine.inOut" }, incomplete.exitAt);

        // --- REPLAN ----------------------------------------------------------
        timeline.addLabel("replan", replan.start);
        timeline.to("[data-beat='replan']", { autoAlpha: 1, pointerEvents: "auto", duration: 2 }, replan.start);
        timeline.to("[data-sequence='replan-copy']", { autoAlpha: 1, y: 0, duration: 3.4 }, replan.start + 0.6);
        timeline.to("[data-sequence='replan-steps']", { autoAlpha: 1, y: 0, duration: 2.4 }, replan.start + 2.5);
        [0, 1, 2, 3].forEach((index) => timeline.to(`[data-replan-step='${index}']`, { autoAlpha: 1, y: 0, duration: 2.2 }, replan.start + 3.4 + index * 1.1));
        timeline.to("[data-beat='replan']", { autoAlpha: 0, y: -14, pointerEvents: "none", duration: replan.exit }, replan.exitAt);
        timeline.to(p, { x: conditions.desktop ? -1.1 : 0, y: conditions.mobile ? 1.5 : 0.3, scale: riskScale * 0.78, alert: 0, verified: 1, ringSpread: 0, duration: restored.settleAt - replan.exitAt, ease: "sine.inOut" }, replan.exitAt);

        // --- RESTORED --------------------------------------------------------
        // The closing beat is never taken away: its plateau runs to the end of the
        // track, which is what gives the story somewhere to rest before the page
        // continues.
        timeline.addLabel("restored", restored.start);
        timeline.to("[data-beat='restored']", { autoAlpha: 1, pointerEvents: "auto", duration: 2 }, restored.start);
        timeline.to("[data-sequence='restored-copy']", { autoAlpha: 1, y: 0, duration: 3.4 }, restored.start + 0.6);
        timeline.to("[data-sequence='restored-proof']", { autoAlpha: 1, y: 0, duration: 3.4 }, restored.start + 2.8);
        [0, 1, 2, 3].forEach((index) => timeline.to(`[data-invariant='${index}']`, { autoAlpha: 1, y: 0, duration: 2 }, restored.start + 3.8 + index * 1.1));
        // Pins the timeline's length to the schedule so progress and the schedule's
        // published windows describe the same thing.
        timeline.set({}, {}, STORY_TIMELINE_DURATION);

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

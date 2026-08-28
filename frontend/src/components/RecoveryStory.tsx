import { useRef } from "react";
import { RAIL_STATES, railKicker } from "../data/storyRail";
import { useStoryController } from "../story/useStoryController";
import { ReflowInstrument } from "./ReflowInstrument";
import { StoryBeats } from "./StoryBeats";
import { StoryTopology } from "./StoryTopology";
import { AnchorProvider, useAnchorStage } from "../anchors";
import { ActionProofRoute } from "./ActionProofRoute";
import { ThreeFuturesRoute } from "./ThreeFuturesRoute";
import { RestoredRoute } from "./RestoredRoute";
import { ReplanRoute } from "./ReplanRoute";
import { ReflowIcon } from "./ReflowIcon";

/**
 * The story rail.
 *
 * It used to be seven anonymous dots with a single label appearing beside
 * whichever one was current, and the labels were laid out to the *right* of their
 * dot, so they grew toward the viewport edge and clipped.
 *
 * It is now a named progression on a spine. Each row is a real story state, and
 * the operational phase — Reflow's five-word cycle — rides above it as a brass
 * kicker. The two lists are deliberately different lengths: the cycle runs twice,
 * and RECOVERY INCOMPLETE and OBJECTIVE RESTORED are outcomes rather than phases,
 * so they carry no phase kicker at all. Flattening them into a five-item list
 * would erase the exact claim the product is built on.
 *
 * Labels are right-aligned and extend left from the spine, so nothing can run off
 * the right edge however long a state name becomes. The live done/active/next
 * state is written by the story controller against `data-progress-stage`, because
 * a beat can own several states and the rail has to advance inside a beat rather
 * than once per beat.
 */
function StoryRail() {
  return (
    <aside className="story-progress" aria-label="Recovery story progress">
      <ol className="story-rail">
        {RAIL_STATES.map((state) => (
          <li
            key={state.id}
            data-progress-stage={state.id}
            className={`rail-state${state.outcome ? " is-outcome" : ""}${
              state.attempt === 2 ? " is-second-pass" : ""
            }`}
          >
            <span className="rail-text">
              <b
                className={`rail-phase${state.outcome ? " is-outcome-kicker" : ""}`}
              >
                {railKicker(state)}
              </b>
              <b className="rail-name">{state.label}</b>
            </span>
            <i className="rail-node" aria-hidden="true" />
          </li>
        ))}
      </ol>
    </aside>
  );
}

function RecoveryStoryContent() {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const controller = useStoryController({ rootRef, trackRef });

  const isDebug = typeof window !== "undefined" && window.location.search.includes("debug=true");

  useAnchorStage(stageRef);

  return (
    <section
      className={`recovery-story ${controller.reducedMotion ? "reduced-motion" : "cinematic-motion"} ${controller.captureFrame || controller.captureProgress !== null ? "capture-mode" : ""}`}
      id="recovery-story"
      ref={rootRef}
      aria-label="How Reflow recovers an objective"
    >
      <div className="story-track" ref={trackRef}>
        <div className="sticky-stage" ref={stageRef}>
          <ReflowInstrument
            pose={controller.pose}
            progress={controller.progress}
            activeStage={controller.activeStage}
            reducedMotion={controller.reducedMotion}
            registerInvalidator={controller.registerInvalidator}
          />
          <ThreeFuturesRoute />
          <ActionProofRoute debug={isDebug} />
          <ReplanRoute />
          <RestoredRoute />
          <StoryTopology />
          <StoryBeats />
          <StoryRail />
        </div>
        <span className="story-anchor" id="recovery-impact" aria-hidden="true" />
      </div>
    </section>
  );
}

export function RecoveryStory() {
  return (
    <AnchorProvider>
      <RecoveryStoryContent />
    </AnchorProvider>
  );
}

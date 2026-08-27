import { useRef } from "react";
import { STORY_CAPABILITIES } from "../data/proofManifest";
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
          <aside className="story-progress" aria-label="Recovery story progress">
            {STORY_CAPABILITIES.map((stage) => (
              <span
                key={stage.id}
                data-progress-stage={stage.id}
                className={controller.activeStage === stage.id ? "is-active" : ""}
                aria-current={controller.activeStage === stage.id ? "step" : undefined}
              >
                <i aria-hidden="true" />
                <b>{stage.label}</b>
              </span>
            ))}
          </aside>
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

import { useRef } from "react";
import { STORY_CAPABILITIES } from "../data/proofManifest";
import { useStoryController } from "../story/useStoryController";
import { PlaceholderOrbScene } from "./PlaceholderOrbScene";
import { StoryBeats } from "./StoryBeats";
import { StoryTopology } from "./StoryTopology";

export function RecoveryStory() {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const controller = useStoryController({ rootRef, trackRef });

  return (
    <section
      className={`recovery-story ${controller.reducedMotion ? "reduced-motion" : "cinematic-motion"} ${controller.captureFrame ? "capture-mode" : ""}`}
      id="recovery-story"
      ref={rootRef}
      aria-label="How Reflow recovers an objective"
    >
      <div className="story-track" ref={trackRef}>
        <div className="sticky-stage">
          <PlaceholderOrbScene
            pose={controller.pose}
            reducedMotion={controller.reducedMotion}
            registerInvalidator={controller.registerInvalidator}
          />
          <StoryTopology />
          <StoryBeats />
          <aside className="story-progress" aria-label="Recovery story progress">
            {STORY_CAPABILITIES.map((stage) => (
              <span
                key={stage.id}
                className={controller.activeStage === stage.id ? "is-active" : ""}
                aria-current={controller.activeStage === stage.id ? "step" : undefined}
              >
                <i aria-hidden="true" />
                <b>{stage.label}</b>
              </span>
            ))}
          </aside>
          <p className="viewport-label" aria-hidden="true">
            UI-M1 · persistent coordinate skeleton
          </p>
        </div>
      </div>
    </section>
  );
}

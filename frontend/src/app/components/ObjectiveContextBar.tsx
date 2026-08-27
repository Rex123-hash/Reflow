import type { ObjectiveContext } from "../contract/uiContract";
import type { ProvenanceInfo } from "../data/UiDataProvider";
import { formatDeadline, formatDuration } from "../semantics/format";
import { ContractGap } from "./Feedback";
import { HealthPill, StageChip } from "./StatusVocabulary";

export interface ObjectiveContextBarProps {
  objective: ObjectiveContext;
  provenance: ProvenanceInfo;
  /**
   * Backend-supplied seconds between restoration and the protected deadline, when
   * an authority provides one. `CurrentPriority.time_remaining_seconds` carries
   * this on Overview; `ObjectiveContext` does not yet expose an equivalent
   * (known gap 4), so Recovery passes nothing and renders the gap honestly.
   */
  marginSeconds?: number | null;
}

/**
 * Persistent objective identity.
 *
 * Health and workflow stage sit side by side in two different shapes, on purpose:
 * an objective can be RECOVERING while its stage is VERIFY on Recovery 02, and the
 * moment those merge into one badge a verified action starts reading as a restored
 * objective.
 */
export function ObjectiveContextBar({
  objective,
  provenance,
  marginSeconds = null,
}: ObjectiveContextBarProps) {
  const isRestored = objective.health === "RESTORED";

  return (
    <div className="objective-bar">
      <div className="objective-bar-identity">
        <h1 title={objective.title}>{objective.title}</h1>
        <HealthPill health={objective.health} />
      </div>

      <span className="objective-bar-rule" aria-hidden="true" />

      <dl className="objective-bar-cell">
        <dt>Workflow stage</dt>
        <dd>
          <StageChip
            stage={objective.workflow_stage}
            attemptNumber={objective.current_recovery_number}
          />
        </dd>
      </dl>

      <span className="objective-bar-rule" aria-hidden="true" />

      <dl className="objective-bar-cell">
        <dt>Protected deadline</dt>
        <dd className="mono">
          {formatDeadline(
            objective.protected_deadline,
            objective.deadline_timezone,
          )}
        </dd>
      </dl>

      <span className="objective-bar-rule" aria-hidden="true" />

      <dl className="objective-bar-cell">
        {/*
          A restored objective is not urgent. The countdown becomes a margin, and
          only when an authority supplies the number.
        */}
        <dt>{isRestored ? "Margin" : "Remaining"}</dt>
        <dd className="mono">
          {marginSeconds != null ? (
            isRestored ? (
              `Restored ${formatDuration(marginSeconds)} before deadline`
            ) : (
              formatDuration(marginSeconds)
            )
          ) : (
            <ContractGap
              field="ObjectiveContext.time_remaining_seconds"
              note="Recovery cannot show a deadline margin without an authoritative value; the client will not subtract its own clock from the deadline."
            />
          )}
        </dd>
      </dl>

      <div className="objective-bar-tail">
        <span className="revision-note">revision {objective.revision}</span>
        <span className={`provenance${provenance.live ? " is-live" : ""}`}>
          <i aria-hidden="true" />
          {provenance.live ? "Live" : provenance.label}
        </span>
      </div>
    </div>
  );
}

import type { ObjectiveContext } from "../contract/uiContract";
import type { ProvenanceInfo } from "../data/UiDataProvider";
import { formatDeadline, formatDuration } from "../semantics/format";
import { HealthPill, StageChip } from "./StatusVocabulary";

export interface ObjectiveContextBarProps {
  objective: ObjectiveContext;
  provenance: ProvenanceInfo;
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
}: ObjectiveContextBarProps) {
  const isRestored = objective.health === "RESTORED";
  const timing = isRestored
    ? objective.deadline_margin_seconds
    : objective.time_remaining_seconds;

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
          {timing != null ? (
            isRestored ? (
              `Restored ${formatDuration(timing)} before deadline`
            ) : (
              formatDuration(timing)
            )
          ) : (
            <span className="observed-absent">not supplied</span>
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

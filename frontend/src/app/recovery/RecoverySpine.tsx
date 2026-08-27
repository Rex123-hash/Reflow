import { useId } from "react";
import type { SemanticStatus } from "../contract/uiContract";
import { Icon } from "../components/Icon";
import type { SpineAttempt, SpineModel } from "../semantics/spine";
import { formatClock } from "../semantics/format";

/**
 * The signature logged-in Reflow element.
 *
 * Rendered entirely from `attempts[].stages[]`. No stage list, order, status or
 * branch is hard-coded — Recovery 03 and beyond render without a code change.
 *
 * Text density is deliberately uneven: a completed stage shows its title alone, and
 * only the selected, current and failed stages expand to their subtitle and reason.
 * The five-second scan is meant to read as "Recovery 01 acted, Verify failed —
 * Recovery 02 branched from that", not as ten paragraphs.
 */

const STATUS_MODIFIER: Record<SemanticStatus, string> = {
  COMPLETED: "is-completed",
  CURRENT: "is-current",
  FAILED: "is-failed",
  PENDING: "is-pending",
  UNAVAILABLE: "is-unavailable",
};

function StageMarker({ status }: { status: SemanticStatus }) {
  return (
    <span
      className={`spine-marker ${STATUS_MODIFIER[status]}`}
      aria-hidden="true"
    >
      {status === "COMPLETED" ? (
        <Icon name="check" size={9} strokeWidth={3.4} />
      ) : null}
      {status === "FAILED" ? (
        <Icon name="cross" size={9} strokeWidth={3.4} />
      ) : null}
    </span>
  );
}

function AttemptBlock({
  attempt,
  selectedStageId,
  onSelect,
  reducedMotion,
}: {
  attempt: SpineAttempt;
  selectedStageId: string | null;
  onSelect: (stageId: string) => void;
  reducedMotion: boolean;
}) {
  const branchId = useId();
  const hasBranch =
    attempt.branchFromAttemptNumber != null && attempt.branchReason != null;

  return (
    <section className="spine-attempt" aria-label={attempt.attempt.label}>
      {hasBranch ? (
        <div className={`spine-branch${reducedMotion ? "" : " is-animated"}`}>
          <svg
            className="spine-branch-stroke"
            width="34"
            height="62"
            viewBox="0 0 34 62"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M11 0 L11 28 Q11 41 25 41 L25 62"
              stroke="var(--failure)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              strokeLinecap="round"
            />
            <circle cx="25" cy="60" r="2.6" fill="var(--failure)" />
          </svg>
          <p className="spine-branch-reason" id={branchId}>
            <span>
              Branched from Recovery{" "}
              {String(attempt.branchFromAttemptNumber).padStart(2, "0")}
            </span>
            {attempt.branchReason}
          </p>
        </div>
      ) : null}

      <header className="spine-attempt-head">
        <h3>{attempt.attempt.label}</h3>
        <span
          className={`spine-attempt-status ${STATUS_MODIFIER[attempt.attempt.status]}`}
        >
          {attempt.attempt.status === "CURRENT"
            ? "Current"
            : attempt.attempt.status === "FAILED"
              ? "Failed"
              : attempt.attempt.status === "COMPLETED"
                ? "Complete"
                : attempt.attempt.status.toLowerCase()}
        </span>
      </header>

      <ol className="spine-stages">
        {attempt.stages.map(({ stage, isLast }) => {
          const selected = stage.stage_id === selectedStageId;
          // Expanded when the stage is the one being read, or when the backend
          // marked it as the live edge or the point of failure.
          const expanded =
            selected || stage.status === "CURRENT" || stage.status === "FAILED";
          const clock = formatClock(stage.timestamp);

          return (
            <li key={stage.stage_id}>
              <button
                type="button"
                className={`spine-stage ${STATUS_MODIFIER[stage.status]}${selected ? " is-selected" : ""}`}
                aria-current={selected ? "step" : undefined}
                onClick={() => onSelect(stage.stage_id)}
              >
                <span className="spine-gutter">
                  <StageMarker status={stage.status} />
                  {!isLast ? (
                    <span
                      className={`spine-connector ${stage.status === "COMPLETED" ? "is-completed" : ""}`}
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
                <span className="spine-body">
                  <span className="spine-title">
                    {stage.title}
                    {clock ? <em className="spine-clock">{clock}</em> : null}
                  </span>
                  {expanded ? (
                    <span className="spine-subtitle">{stage.subtitle}</span>
                  ) : null}
                  {stage.failure_reason ? (
                    <span className="spine-failure">
                      {stage.failure_reason}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function RecoverySpine({
  model,
  selectedStageId,
  onSelect,
  reducedMotion,
}: {
  model: SpineModel;
  selectedStageId: string | null;
  onSelect: (stageId: string) => void;
  reducedMotion: boolean;
}) {
  return (
    <div className="spine">
      <div className="spine-head">
        <h2 className="section-label">Recovery spine</h2>
        <span className="spine-count">
          {model.attempts.length} attempt
          {model.attempts.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="spine-scroll">
        {model.attempts.map((attempt) => (
          <AttemptBlock
            key={attempt.attempt.attempt_number}
            attempt={attempt}
            selectedStageId={selectedStageId}
            onSelect={onSelect}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { SourceMark } from "../components/SourceMark";
import { HealthPill, StageChip } from "../components/StatusVocabulary";
import { useOverview } from "../data/resources";
import {
  formatDeadline,
  formatDuration,
  formatObservedAt,
  humanizeEnum,
} from "../semantics/format";
import { eventTone } from "../semantics/executionEvents";
import "./overview.css";

/**
 * The verdict page.
 *
 * Not a counts dashboard: it answers "what is the current verdict on the protected
 * objective, and what did Reflow do while I wasn't looking". Every sentence on it is
 * a backend value — the summary line, the health, the stage, the deadline and the
 * activity are all supplied; nothing is composed into a claim Reflow did not make.
 */
export function OverviewRoute() {
  const overview = useOverview();

  if (overview.status === "loading") {
    return (
      <div className="route-pad">
        <LoadingState label="Loading overview" rows={4} />
      </div>
    );
  }

  if (overview.status === "error") {
    return (
      <div className="route-pad">
        <ErrorState error={overview.error} onRetry={overview.reload} />
      </div>
    );
  }

  const {
    current_priority: priority,
    objective_summary: counts,
    recent_activity: activity,
  } = overview.data;

  if (!priority) {
    return (
      <div className="route-pad">
        <EmptyState title="Nothing is under recovery">
          Reflow is not currently protecting an objective through an active
          incident. When a disruption threatens one, the verdict appears here.
        </EmptyState>
      </div>
    );
  }

  const isRestored = priority.objective_health === "RESTORED";
  const margin = priority.time_remaining_seconds;

  return (
    <div className="route-pad overview">
      <section className="verdict">
        <p className="field-label">Current priority</p>
        <div className="verdict-head">
          <h1>{priority.objective_title}</h1>
          <HealthPill health={priority.objective_health} />
        </div>
        <p className="verdict-summary">{priority.summary}</p>

        <dl className="verdict-facts">
          <div>
            <dt>Protected deadline</dt>
            <dd className="mono">
              {formatDeadline(
                priority.protected_deadline,
                priority.deadline_timezone,
              )}
            </dd>
          </div>
          {margin != null ? (
            <div>
              <dt>{isRestored ? "Margin" : "Remaining"}</dt>
              <dd className="mono">
                {isRestored
                  ? `Restored ${formatDuration(margin)} before deadline`
                  : formatDuration(margin)}
              </dd>
            </div>
          ) : null}
          {priority.active_workflow_stage ? (
            <div>
              <dt>Workflow stage</dt>
              <dd>
                <StageChip
                  stage={priority.active_workflow_stage}
                  attemptNumber={priority.active_recovery_number}
                />
              </dd>
            </div>
          ) : null}
        </dl>

        {priority.incident_id ? (
          <div className="verdict-actions">
            <Link
              className="btn btn-primary"
              to={`/app/recovery/${priority.incident_id}`}
            >
              Open Recovery
              <Icon name="arrow-right" size={14} />
            </Link>
            <Link
              className="link-internal"
              to={`/app/evidence/${priority.incident_id}`}
            >
              See the evidence
              <Icon name="arrow-right" size={12} />
            </Link>
          </div>
        ) : null}
      </section>

      <div className="overview-grid">
        <section className="card">
          <div className="card-head">
            <h3>What Reflow did while you were away</h3>
            <span className="card-head-note">
              {activity.length} durable events
            </span>
          </div>
          <ol className="activity-list">
            {activity.map((event) => (
              <li
                key={event.event_id}
                className={`activity-item tone-${eventTone(event)}`}
              >
                <span className="activity-dot" aria-hidden="true" />
                <div>
                  <p>{event.human_message}</p>
                  <span className="activity-meta">
                    <SourceMark source={event.source_authority} size={12} />
                    <span className="mono">
                      {humanizeEnum(event.semantic_type)}
                    </span>
                    <span>
                      Recovery {String(event.recovery_attempt).padStart(2, "0")}
                    </span>
                    <time>{formatObservedAt(event.timestamp)}</time>
                  </span>
                </div>
              </li>
            ))}
          </ol>
          {activity.length === 0 ? (
            <p className="activity-empty">
              No durable events have been recorded.
            </p>
          ) : null}
        </section>

        <section className="card overview-counts">
          <div className="card-head">
            <h3>Objectives</h3>
            <Link className="link-internal" to="/app/objectives">
              View all
              <Icon name="arrow-right" size={12} />
            </Link>
          </div>
          <dl>
            <div>
              <dt>Active</dt>
              <dd>{counts.active}</dd>
            </div>
            <div>
              <dt>Recovering</dt>
              <dd>{counts.recovering}</dd>
            </div>
            <div>
              <dt>Healthy</dt>
              <dd>{counts.healthy}</dd>
            </div>
            <div>
              <dt>Watching or needs attention</dt>
              <dd>{counts.watching_or_needs_attention}</dd>
            </div>
            <div>
              <dt>Restored</dt>
              <dd>{counts.restored}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

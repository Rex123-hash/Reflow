import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Icon, ICON_SIZE } from "../components/Icon";
import { HealthPill, StageChip } from "../components/StatusVocabulary";
import { useIncidentChoices } from "../data/useIncidentChoices";
import { formatDeadline, formatDuration } from "../semantics/format";

/**
 * The safe landing surface behind `/app/recovery` and `/app/evidence`.
 *
 * The global tabs never pick an incident. This page shows the backend's own current
 * priority with an explicit call to action, lists every objective that carries an
 * authoritative incident id, and otherwise says plainly that nothing is under
 * recovery. Array order decides nothing.
 */
export function IncidentPicker({
  surface,
}: {
  surface: "recovery" | "evidence";
}) {
  const choices = useIncidentChoices();
  const base = surface === "recovery" ? "/app/recovery" : "/app/evidence";
  const verb = surface === "recovery" ? "Open Recovery" : "Open Evidence";

  if (choices.status === "loading") {
    return (
      <div className="route-pad">
        <LoadingState label="Loading incidents" />
      </div>
    );
  }

  if (choices.status === "error") {
    return (
      <div className="route-pad">
        <ErrorState error={choices.error} />
      </div>
    );
  }

  const { priority, choices: incidents } = choices;

  if (incidents.length === 0) {
    return (
      <div className="route-pad">
        <EmptyState title="No objective is under recovery">
          Reflow has no incident to show. When a disruption threatens a
          protected objective, the recovery opens here automatically.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="route-pad picker">
      {/* The shared masthead, so this landing surface opens the same way as every
          other page rather than being the one left-aligned exception. */}
      <header className="page-head picker-head">
        <p className="field-label">
          {surface === "recovery" ? "Recovery" : "Evidence"}
        </p>
        <h1>Choose an incident</h1>
        <p className="picker-lede">
          Reflow will not pick one for you. Every incident below is identified
          by an authoritative incident id.
        </p>
      </header>

      {priority ? (
        <section className="card picker-priority">
          <div className="card-head">
            <h3>Current priority</h3>
            <HealthPill health={priority.objective_health} />
          </div>
          <div className="picker-priority-body">
            <div>
              <h2>{priority.objective_title}</h2>
              <p>{priority.summary}</p>
              <dl className="picker-facts">
                <div>
                  <dt>Protected deadline</dt>
                  <dd className="mono">
                    {formatDeadline(
                      priority.protected_deadline,
                      priority.deadline_timezone,
                    )}
                  </dd>
                </div>
                {priority.active_workflow_stage ? (
                  <div>
                    <dt>Stage</dt>
                    <dd>
                      <StageChip
                        stage={priority.active_workflow_stage}
                        attemptNumber={priority.active_recovery_number}
                        health={priority.objective_health}
                      />
                    </dd>
                  </div>
                ) : null}
                {priority.time_remaining_seconds != null ? (
                  <div>
                    <dt>
                      {priority.objective_health === "RESTORED"
                        ? "Margin"
                        : "Remaining"}
                    </dt>
                    <dd className="mono">
                      {priority.objective_health === "RESTORED"
                        ? `${formatDuration(priority.time_remaining_seconds)} before deadline`
                        : formatDuration(priority.time_remaining_seconds)}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Incident</dt>
                  <dd className="mono">{priority.incident_id}</dd>
                </div>
              </dl>
            </div>
            <Link
              className="btn btn-primary"
              to={`${base}/${priority.incident_id}`}
            >
              {verb}
              <Icon name="arrow-right" size={ICON_SIZE.row} />
            </Link>
          </div>
        </section>
      ) : null}

      {incidents.length > (priority ? 1 : 0) ? (
        <section className="card picker-list">
          <div className="card-head">
            <h3>All incidents</h3>
          </div>
          <ul>
            {incidents.map((choice) => (
              <li key={choice.incidentId}>
                <div>
                  <b>{choice.objectiveTitle}</b>
                  <span className="mono">{choice.incidentId}</span>
                </div>
                {choice.objective ? (
                  <HealthPill health={choice.objective.health} compact />
                ) : null}
                <Link
                  className="btn btn-secondary"
                  to={`${base}/${choice.incidentId}`}
                >
                  {verb}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

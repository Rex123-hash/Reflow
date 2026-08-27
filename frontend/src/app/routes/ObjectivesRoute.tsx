import { Link, useSearchParams } from "react-router-dom";
import type { ObjectiveFilter } from "../contract/uiContract";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { HealthPill, StageChip } from "../components/StatusVocabulary";
import { useObjectives } from "../data/resources";
import { formatDeadline, formatObservedAt } from "../semantics/format";
import "./objectives.css";

const FILTERS: { id: ObjectiveFilter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "restored", label: "Restored" },
  { id: "all", label: "All" },
];

const isFilter = (value: string | null): value is ObjectiveFilter =>
  value === "all" || value === "active" || value === "restored";

/**
 * The portfolio index: what outcomes Reflow is protecting.
 *
 * Health and workflow stage stay in separate columns as separate concepts. There is
 * no owner, no percent complete, no risk score and no progress bar, because the
 * contract exposes none of those and Reflow does not invent metrics.
 */
export function ObjectivesRoute() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("status");
  const filter: ObjectiveFilter = isFilter(raw) ? raw : "all";
  const objectives = useObjectives(filter);

  const setFilter = (next: ObjectiveFilter) =>
    setParams((current) => {
      const draft = new URLSearchParams(current);
      draft.set("status", next);
      return draft;
    });

  return (
    <div className="route-pad objectives">
      <header className="objectives-head">
        <div>
          <p className="field-label">Objectives</p>
          <h1>Outcomes Reflow is protecting</h1>
        </div>
        <div
          className="objectives-filters"
          role="group"
          aria-label="Filter objectives"
        >
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? "is-on" : undefined}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {objectives.status === "loading" ? (
        <LoadingState label="Loading objectives" />
      ) : null}

      {objectives.status === "error" ? (
        <ErrorState error={objectives.error} onRetry={objectives.reload} />
      ) : null}

      {objectives.status === "ready" && objectives.data.items.length === 0 ? (
        <EmptyState title="No objectives match this filter">
          Reflow protects objectives that have been declared to it. Nothing
          matches the current filter.
        </EmptyState>
      ) : null}

      {objectives.status === "ready" && objectives.data.items.length > 0 ? (
        <div className="card objectives-table-card">
          <table className="data-table objectives-table">
            <thead>
              <tr>
                <th>Objective</th>
                <th style={{ width: "16%" }}>Health</th>
                <th style={{ width: "18%" }}>Workflow stage</th>
                <th style={{ width: "20%" }}>Protected deadline</th>
                <th style={{ width: "18%" }}>Latest observed state</th>
                <th className="numeric" style={{ width: "12%" }} />
              </tr>
            </thead>
            <tbody>
              {objectives.data.items.map((item) => (
                <tr key={`${item.objective_id}:${item.objective_version}`}>
                  <td>
                    <b className="objective-title">{item.title}</b>
                    <span className="objective-id mono">
                      {item.objective_id}
                    </span>
                  </td>
                  <td>
                    <HealthPill health={item.health} compact />
                  </td>
                  <td>
                    {item.workflow_stage ? (
                      <StageChip
                        stage={item.workflow_stage}
                        attemptNumber={item.active_recovery_number}
                      />
                    ) : (
                      <span className="observed-absent">not in recovery</span>
                    )}
                  </td>
                  <td className="mono">
                    {formatDeadline(
                      item.protected_deadline,
                      item.deadline_timezone,
                    )}
                  </td>
                  <td>
                    <span className="objective-observed mono">
                      {item.latest_observed_state ?? "—"}
                    </span>
                    {item.updated_at ? (
                      <span className="objective-updated">
                        {formatObservedAt(item.updated_at)}
                      </span>
                    ) : null}
                  </td>
                  <td className="numeric">
                    {item.active_incident_id ? (
                      <Link
                        className="btn btn-secondary"
                        to={`/app/recovery/${item.active_incident_id}`}
                      >
                        Open
                        <Icon name="chevron-right" size={12} />
                      </Link>
                    ) : (
                      <span className="observed-absent">no incident</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="objectives-footnote">
        <Icon name="lock" size={13} />
        Protected commitments cannot be moved. Reflow recovers these objectives
        without changing their deadlines.
      </p>
    </div>
  );
}

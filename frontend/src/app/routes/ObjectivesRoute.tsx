import { Link, useSearchParams } from "react-router-dom";
import type { ObjectiveFilter } from "../contract/uiContract";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { HealthPill, StageChip } from "../components/StatusVocabulary";
import { useObjectives, useOverview } from "../data/resources";
import {
  formatDeadline,
  formatObservedAt,
  formatRelativeTime,
} from "../semantics/format";
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
  // Read only for its backend-owned counts; the list itself stays on its own
  // resource, so a summary failure never blocks the objectives table.
  const overview = useOverview();
  const summary =
    overview.status === "ready" ? overview.data.objective_summary : null;

  const setFilter = (next: ObjectiveFilter) =>
    setParams((current) => {
      const draft = new URLSearchParams(current);
      draft.set("status", next);
      return draft;
    });

  return (
    <div className="route-pad objectives">
      <header className="page-head objectives-head">
        <div>
          <p className="field-label">Objectives</p>
          <h1>Outcomes Reflow is protecting</h1>
        </div>
        <div
          className="page-head-aside objectives-filters"
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

      {/**
       * The objective counts are backend-owned (`OverviewView.objective_summary`)
       * and are read, never recomputed here — deriving them from the visible rows
       * would be the frontend inventing a verdict, and the filter means the rows
       * are not the whole population anyway.
       */}
      {summary ? (
        <dl className="objectives-summary" aria-label="Objective summary">
          {(
            [
              ["Active", summary.active],
              ["Recovering", summary.recovering],
              ["Healthy", summary.healthy],
              ["Watching", summary.watching_or_needs_attention],
              ["Restored", summary.restored],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className={value > 0 ? "is-present" : undefined}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

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
                {/* The identity column takes the slack on a wide desktop canvas; the
                    rest are sized to their content so no column stretches absurdly. */}
                <th style={{ width: "31%" }}>Objective</th>
                <th style={{ width: "12%" }}>Health</th>
                <th style={{ width: "17%" }}>Workflow stage</th>
                <th style={{ width: "16%" }}>Protected deadline</th>
                <th style={{ width: "16%" }}>Last observed</th>
                <th className="numeric" style={{ width: "8%" }} />
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
                    {/* The health pill two columns left already says "Restored".
                        Repeating the raw enum beside it says the same thing twice
                        in the default view, so the column leads with when the state
                        was last observed and keeps the exact enum on the element
                        for anyone who needs the literal value. */}
                    {item.updated_at ? (
                      <time
                        className="objective-updated"
                        dateTime={item.updated_at}
                        title={`${item.latest_observed_state ?? "—"} · ${
                          formatObservedAt(item.updated_at) ?? item.updated_at
                        }`}
                      >
                        {formatRelativeTime(item.updated_at) ??
                          formatObservedAt(item.updated_at)}
                      </time>
                    ) : (
                      <span className="objective-observed mono">
                        {item.latest_observed_state ?? "—"}
                      </span>
                    )}
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

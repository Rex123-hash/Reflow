import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { SourceMark } from "../components/SourceMark";
import {
  HealthPill,
  StageChip,
  VerificationPill,
} from "../components/StatusVocabulary";
import { useOperatorContext } from "../data/resources";
import { useIncidentChoices } from "../data/useIncidentChoices";
import { OperatorConversation } from "../operator/OperatorConversation";
import { formatObservedAt } from "../semantics/format";
import "./operator.css";

/** Read-only reasoning over a bounded incident; execution remains unavailable. */
export function OperatorRoute() {
  const [params] = useSearchParams();
  const choices = useIncidentChoices();
  const requestedIncident = params.get("incidentId");

  const incidentId =
    requestedIncident ??
    (choices.status === "ready"
      ? (choices.priority?.incident_id ?? null)
      : null);

  const operator = useOperatorContext(incidentId);

  if (
    choices.status === "loading" ||
    (incidentId && operator.status === "loading")
  ) {
    return (
      <div className="route-pad">
        <LoadingState label="Loading operator context" />
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

  if (!incidentId) {
    return (
      <div className="route-pad">
        <EmptyState title="No incident to inspect">
          Operator inspects a specific recovery. Choose one from Recovery, and
          Operator will follow.
          <br />
          <Link className="link-internal" to="/app/recovery">
            Go to Recovery
          </Link>
        </EmptyState>
      </div>
    );
  }

  if (operator.status === "error") {
    return (
      <div className="route-pad">
        <ErrorState error={operator.error} onRetry={operator.reload} />
      </div>
    );
  }

  if (operator.status === "loading") return null;

  const data = operator.data;

  return (
    <div className="route-pad operator">
      <header className="operator-head">
        <div>
          <p className="field-label">Operator</p>
          <h1>Ask Reflow</h1>
          <p className="operator-lede">
            Inspect evidence, explain a recovery, or explore an explicitly
            hypothetical scenario. Gemini reasons over the selected incident;
            Operator cannot execute production actions.
          </p>
        </div>
        <span className="operator-readonly">
          <Icon name="lock" size={13} />
          Read-only
        </span>
      </header>

      <OperatorConversation
        key={incidentId}
        incidentId={incidentId}
        live={operator.provenance.live}
      />

      <section className="operator-context">
        <div className="card">
          <div className="card-head">
            <h3>Objective</h3>
            <HealthPill health={data.objective.health} />
          </div>
          <div className="operator-objective">
            <h4>{data.objective.title}</h4>
            <StageChip
              stage={data.objective.workflow_stage}
              attemptNumber={data.objective.current_recovery_number}
            />
            <span className="mono operator-incident">{incidentId}</span>
          </div>
        </div>

        {data.verification ? (
          <div className="card">
            <div className="card-head">
              <h3>
                Latest verification · Recovery{" "}
                {String(data.verification.recovery_attempt).padStart(2, "0")}
              </h3>
              <VerificationPill status={data.verification.status} />
            </div>
            <ul className="operator-invariants">
              {(data.verification.invariants ?? []).map((invariant) => (
                <li key={invariant.invariant_id}>
                  <span className="mono">{invariant.invariant_id}</span>
                  <VerificationPill status={invariant.status} />
                </li>
              ))}
              {(data.verification.invariants ?? []).length === 0 ? (
                <li className="observed-absent">No invariants reported yet.</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <div className="card">
          <div className="card-head">
            <h3>Evidence in context</h3>
            <Link className="link-internal" to={`/app/evidence/${incidentId}`}>
              Full audit
              <Icon name="arrow-right" size={12} />
            </Link>
          </div>
          <ul className="operator-evidence">
            {data.evidence.map((item) => (
              <li key={item.evidence_id}>
                <SourceMark source={item.source_system} size={14} />
                <div>
                  <b>{item.title}</b>
                  <span>
                    {formatObservedAt(item.observed_at) ?? "Not yet observed"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

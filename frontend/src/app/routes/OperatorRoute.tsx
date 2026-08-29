import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";
import { Icon, ICON_SIZE } from "../components/Icon";
import { SourceMark } from "../components/SourceMark";
import {
  HealthPill,
  StageChip,
  VerificationPill,
  VerificationRing,
  verificationTone,
} from "../components/StatusVocabulary";
import { useOperatorContext } from "../data/resources";
import { useIncidentChoices } from "../data/useIncidentChoices";
import { OperatorConversation } from "../operator/OperatorConversation";
import { formatObservedAt } from "../semantics/format";
import "./operator.css";

/** Reasoning and policy-controlled action over a bounded authenticated context. */
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
      <header className="page-head operator-head">
        <div>
          <p className="field-label">Operator</p>
          <h1>Ask Reflow</h1>
          <p className="operator-lede">
            Inspect evidence, explain or simulate recovery, and request bounded
            operational changes. Gemini interprets intent; server policy,
            adapters, and independent read-back control every action.
          </p>
        </div>
        <span className="operator-readonly">
          <Icon name="lock" size={ICON_SIZE.meta} />
          Controlled
        </span>
      </header>

      <OperatorConversation
        key={incidentId}
        incidentId={incidentId}
        objectiveTitle={data.objective.title}
        live={operator.provenance.live}
      />

      <section className="operator-context">
        <div className="card">
          <div className="card-head">
            <h3>Objective</h3>
            <HealthPill health={data.objective.health} />
          </div>
          <div className="operator-objective">
            {/* The same entity mark the Objectives table uses, so the object a
                reader followed from one surface is recognisable on the next. */}
            <span className="entity-mark is-lead" aria-hidden="true">
              <Icon name="objective" size={ICON_SIZE.header} />
            </span>
            <div className="operator-objective-body">
              <h4>{data.objective.title}</h4>
              <StageChip
                stage={data.objective.workflow_stage}
                attemptNumber={data.objective.current_recovery_number}
              />
              <span className="mono operator-incident">{incidentId}</span>
            </div>
          </div>
        </div>

        {data.verification ? (
          <div className="card">
            <div className="card-head">
              <h3>
                Latest verification · Recovery{" "}
                {String(data.verification.recovery_attempt).padStart(2, "0")}
              </h3>
              {/* The card states its verdict once, in the head: the ring for the
                  shape of it, the pill for the backend's own word. The invariants
                  below then list quietly instead of repeating one pill per row. */}
              <span className="operator-verification-head">
                <VerificationRing
                  invariants={data.verification.invariants ?? []}
                />
                <VerificationPill status={data.verification.status} />
              </span>
            </div>
            <ul className="operator-invariants">
              {(data.verification.invariants ?? []).map((invariant) => (
                <li
                  key={invariant.invariant_id}
                  className={`tone-${verificationTone(invariant.status)}`}
                >
                  <span className="mono">{invariant.invariant_id}</span>
                  {/* A passed invariant needs no word: the ring above has already
                      said how many passed, and six rows repeating "PASSED" is the
                      repetition this card was carrying. Anything that did not pass
                      keeps its word, because that one is worth reading. The exact
                      state stays in the accessible text either way. */}
                  <span className="operator-invariant-state">
                    {invariant.status === "PASSED" ? (
                      <Icon name="check" size={ICON_SIZE.meta} />
                    ) : (
                      <span aria-hidden="true">
                        {invariant.status.toLowerCase()}
                      </span>
                    )}
                    <span className="visually-hidden">
                      {invariant.status.toLowerCase()}
                    </span>
                  </span>
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
              <Icon name="arrow-right" size={ICON_SIZE.meta} />
            </Link>
          </div>
          <ul className="operator-evidence">
            {data.evidence.map((item) => (
              <li key={item.evidence_id}>
                <SourceMark source={item.source_system} size={ICON_SIZE.row} />
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

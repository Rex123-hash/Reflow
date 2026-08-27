import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
} from "../components/Feedback";
import { Icon } from "../components/Icon";
import { SourceMark } from "../components/SourceMark";
import {
  HealthPill,
  StageChip,
  VerificationPill,
} from "../components/StatusVocabulary";
import { useOperatorContext, useRecoveryCase } from "../data/resources";
import { useIncidentChoices } from "../data/useIncidentChoices";
import {
  matchIntent,
  SUPPORTED_EXAMPLES,
  type IntentMatch,
} from "../operator/intents";
import { formatObservedAt } from "../semantics/format";
import "./operator.css";

/** Modes the backend does not support. Shown as unavailable rather than mocked. */
const UNSUPPORTED_MODES = [
  {
    id: "SIMULATE",
    note: "Counterfactual replanning is not exposed by the P2A contract.",
  },
  {
    id: "DIRECT",
    note: "Reflow accepts no external direction of its recovery engine.",
  },
  {
    id: "ACT",
    note: "Operator cannot cause an external effect. Only the engine acts.",
  },
];

/**
 * Operator — read-only INSPECT.
 *
 * A supported phrase is translated deterministically into an application focus and
 * the application moves there. The UI is the answer. Nothing is paraphrased, and no
 * mode Reflow cannot honour is simulated.
 */
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
  // OperatorContextView exposes only the CURRENT attempt. Intents that reference an
  // earlier recovery ("why did Recovery 1 fail") need the full attempt list, so
  // Operator reads the same public Recovery resource the Recovery Room does rather
  // than inferring earlier attempts from the context payload.
  const recovery = useRecoveryCase(incidentId);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<IntentMatch | null>(null);
  const [unmatched, setUnmatched] = useState<string | null>(null);

  const context = useMemo(() => {
    if (!incidentId) return null;
    const attempts =
      recovery.data?.attempts ??
      (operator.data?.current_recovery ? [operator.data.current_recovery] : []);
    return attempts.length ? { incidentId, attempts } : null;
  }, [recovery.data, operator.data, incidentId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!context) return;
    const match = matchIntent(query, context);
    if (match) {
      setResult(match);
      setUnmatched(null);
      if (!match.unavailableReason) navigate(match.href);
    } else {
      setResult(null);
      setUnmatched(query.trim());
    }
  };

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
          <h1>Inspect the recovery</h1>
          <p className="operator-lede">
            Ask in plain language and Reflow focuses the part of the application
            that answers it. The interface is the answer — Operator does not
            restate backend truth in its own words.
          </p>
        </div>
        <span className="operator-readonly">
          <Icon name="lock" size={13} />
          Read-only
        </span>
      </header>

      <form className="operator-form" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="operator-query">
          Ask Reflow
        </label>
        <Icon name="search" size={15} />
        <input
          id="operator-query"
          type="text"
          value={query}
          placeholder="Why did Recovery 1 fail?"
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary">
          Inspect
          <Icon name="arrow-right" size={14} />
        </button>
      </form>

      <div className="operator-examples">
        {SUPPORTED_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="quick-link"
            onClick={() => {
              setQuery(example);
              if (!context) return;
              const match = matchIntent(example, context);
              setResult(match);
              setUnmatched(match ? null : example);
              if (match && !match.unavailableReason) navigate(match.href);
            }}
          >
            {example}
          </button>
        ))}
      </div>

      {result ? (
        <section className="operator-result">
          <p className="field-label">Understood as</p>
          <h2>{result.understood}</h2>
          {result.unavailableReason ? (
            <Notice>{result.unavailableReason}</Notice>
          ) : (
            <p className="operator-focus">
              Focused <b>{result.focus}</b>
              <Link className="link-internal" to={result.href}>
                Open again
                <Icon name="arrow-right" size={12} />
              </Link>
            </p>
          )}
        </section>
      ) : null}

      {unmatched ? (
        <section className="operator-result is-unmatched">
          <p className="field-label">Not supported</p>
          <h2>Reflow will not guess what that means</h2>
          <p>
            “{unmatched}” does not match a supported inspection. Operator
            resolves a closed set of intents deterministically rather than
            interpreting free text, so it cannot answer something the backend
            has not published.
          </p>
        </section>
      ) : null}

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

      <section className="operator-modes">
        <p className="field-label">Not available in this build</p>
        <ul>
          {UNSUPPORTED_MODES.map((mode) => (
            <li key={mode.id}>
              <span className="operator-mode-id">{mode.id}</span>
              <span>{mode.note}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

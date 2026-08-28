import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import {
  formatDeadline,
  formatObservedAt,
  truncateId,
} from "../semantics/format";
import { queryOperator } from "./client";
import type { OperatorResponse } from "./operatorContract";

const EXAMPLES = [
  "Why did Recovery 1 fail?",
  "What did Reflow change in Google Calendar?",
  "What if Candidate A had passed CI?",
];

/**
 * How an authoritative intent is named in the interface.
 *
 * The value is never derived in the browser: it is `response.intent.intent_type`,
 * which the Operator contract exposes as a nullable enum, and nothing is shown when
 * the backend does not classify one. A later controlled-ACT milestone adds one
 * entry here and one modifier class; no other part of this component encodes the
 * set of intents, so the presentation does not need redesigning to absorb it.
 */
const INTENT_LABELS: Record<string, string> = {
  INSPECT: "Inspect",
  EXPLAIN: "Explain",
  SIMULATE: "Simulation",
};

/**
 * Renders a backend timestamp in the readable form the rest of the product uses,
 * keeping the exact value machine-readable and available on hover. Only ever called
 * with a structured contract field — never with a datetime found inside model prose.
 */
function Timestamp({ iso }: { iso: string }) {
  const readable = formatObservedAt(iso);
  if (!readable) return <span className="mono">{iso}</span>;
  return (
    <time dateTime={iso} title={iso}>
      {readable}
    </time>
  );
}

export function OperatorConversation({
  incidentId,
  live,
}: {
  incidentId: string;
  live: boolean;
}) {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<OperatorResponse | null>(null);
  const [submitted, setSubmitted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!live || busy || message.trim().length < 3) return;
    pending.current = new AbortController();
    setBusy(true);
    setError(null);
    setResponse(null);
    setSubmitted(message.trim());
    try {
      setResponse(
        await queryOperator(incidentId, message.trim(), pending.current.signal),
      );
    } catch (cause) {
      if (!pending.current.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "Operator unavailable.",
        );
    } finally {
      setBusy(false);
    }
  };

  const simulated = response?.provenance === "HYPOTHETICAL_NO_ACTION";
  const intentLabel = response?.intent.intent_type
    ? INTENT_LABELS[response.intent.intent_type]
    : null;

  return (
    <>
      {!live && (
        <p className="operator-note" role="status">
          <Icon name="lock" size={13} />
          Real Operator reasoning requires Google sign-in. Demo context remains
          read-only; no model request is made.
        </p>
      )}

      <form className="operator-form" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="operator-query">
          Ask Reflow
        </label>
        <Icon name="search" size={17} />
        <input
          id="operator-query"
          value={message}
          maxLength={1200}
          disabled={!live || busy}
          placeholder="Why did Recovery 1 fail?"
          autoComplete="off"
          onChange={(event) => setMessage(event.target.value)}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!live || busy || message.trim().length < 3}
        >
          {busy ? "Reasoning…" : "Ask Reflow"}
          <Icon name="arrow-right" size={14} />
        </button>
      </form>

      <div className="operator-examples">
        <span className="operator-examples-label">Try</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="operator-example"
            disabled={!live || busy}
            onClick={() => setMessage(example)}
          >
            {example}
          </button>
        ))}
      </div>

      <div aria-live="polite" aria-busy={busy}>
        {busy && (
          <p className="operator-note is-busy" role="status">
            <span className="operator-pulse" aria-hidden="true" />
            Reading incident context and reasoning with Gemini. No production
            actions are permitted.
          </p>
        )}

        {error && (
          <p className="operator-note is-error" role="alert">
            {error}
          </p>
        )}

        {response && (
          <section
            className={`operator-result${simulated ? " is-simulation" : ""}`}
          >
            <div className="operator-result-bar">
              {intentLabel && (
                <span
                  className={`operator-intent is-${response.intent.intent_type?.toLowerCase()}`}
                >
                  {intentLabel}
                </span>
              )}
              <span className="operator-provenance-state">
                {simulated
                  ? "Hypothetical · no external action"
                  : "Read only · no production action"}
              </span>
            </div>

            <div className="operator-answer-grid">
              <div className="operator-answer">
                <p className="field-label">Question</p>
                <h2>{submitted}</h2>

                <p className="field-label">Answer</p>
                <div className="operator-prose">
                  {response.answer.split("\n\n").map((text, index) => (
                    <p key={index}>{text}</p>
                  ))}
                </div>

                {response.simulation && (
                  <div className="operator-simulation">
                    {response.hypothetical_deadline && (
                      <p className="operator-hypothetical-deadline">
                        <b>Hypothetical protected deadline</b>
                        <span>
                          {formatDeadline(
                            response.hypothetical_deadline,
                            "Etc/UTC",
                          )}
                        </span>
                        <em>The real deadline is unchanged.</em>
                      </p>
                    )}

                    <h3 className="field-label">Assumptions</h3>
                    <ul className="operator-list">
                      {response.simulation.assumptions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>

                    <h3 className="field-label">Hypothetical futures</h3>
                    <div className="operator-futures">
                      {response.simulation.candidate_futures.map((future) => (
                        <article key={future.title} className="operator-future">
                          <h4>{future.title}</h4>
                          <p>{future.consequence}</p>
                          <ul className="operator-list">
                            {future.tradeoffs.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                          <p className="operator-future-verify">
                            Still needs verification:{" "}
                            {future.required_verification.join("; ")}
                          </p>
                        </article>
                      ))}
                    </div>

                    <h3 className="field-label">Risks and limits</h3>
                    <ul className="operator-list">
                      {[
                        ...response.simulation.risk_critique,
                        ...response.simulation.unsupported_assumptions,
                      ].map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>

                    <p className="operator-outlook">
                      Hypothetical outlook:{" "}
                      <b>
                        {response.simulation.likely_objective_outcome
                          .replaceAll("_", " ")
                          .toLowerCase()}
                      </b>
                      . This is not observed objective verification.
                    </p>
                  </div>
                )}
              </div>

              <aside className="operator-support">
                {response.evidence.length > 0 && (
                  <section className="operator-support-block">
                    <h3 className="field-label">Supporting evidence</h3>
                    <ul className="operator-support-evidence">
                      {response.evidence.map((item) => (
                        <li key={item.evidence_id}>
                          <Link
                            to={`/app/evidence/${encodeURIComponent(incidentId)}?evidence=${encodeURIComponent(item.evidence_id)}`}
                          >
                            <b>{item.title}</b>
                            <span>
                              {item.observed_at ? (
                                <Timestamp iso={item.observed_at} />
                              ) : (
                                "Not yet observed"
                              )}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="operator-support-block">
                  <h3 className="field-label">Provenance</h3>
                  <dl className="operator-provenance">
                    <div>
                      <dt>Revision</dt>
                      <dd className="mono">{response.revision}</dd>
                    </div>
                    <div>
                      <dt>Generated</dt>
                      <dd>
                        <Timestamp iso={response.generated_at} />
                      </dd>
                    </div>
                    <div>
                      <dt>Agents</dt>
                      <dd className="mono operator-agents">
                        {response.agents
                          .map((agent) => agent.agent_id)
                          .join(" → ")}
                      </dd>
                    </div>
                    <div>
                      <dt>Request</dt>
                      <dd className="mono" title={response.request_id}>
                        {truncateId(response.request_id, 8, 6)}
                      </dd>
                    </div>
                  </dl>
                  <p className="operator-no-action">
                    No production action occurred.
                  </p>
                </section>
              </aside>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

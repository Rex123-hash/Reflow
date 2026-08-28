import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { queryOperator } from "./client";
import type { OperatorResponse } from "./operatorContract";

const EXAMPLES = [
  "Why did Recovery 1 fail?",
  "What did Reflow change in Google Calendar?",
  "What if Candidate A had passed CI?",
];

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

  return (
    <>
      {!live && (
        <p role="status">
          Real Operator reasoning requires Google sign-in. Demo/fixture context
          remains read-only; no model request is made.
        </p>
      )}
      <form className="operator-form" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="operator-query">
          Ask Reflow
        </label>
        <Icon name="search" size={15} />
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
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="quick-link"
            disabled={!live || busy}
            onClick={() => setMessage(example)}
          >
            {example}
          </button>
        ))}
      </div>
      <div aria-live="polite" aria-busy={busy}>
        {busy && (
          <p role="status">
            Reading incident context and reasoning with Gemini. No production
            actions are permitted.
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {response && (
          <section className="operator-result">
            <p className="field-label">
              {response.provenance === "HYPOTHETICAL_NO_ACTION"
                ? "Hypothetical simulation · No external action"
                : "Read-only Operator response"}
            </p>
            <h2>{submitted}</h2>
            {response.answer.split("\n\n").map((text, index) => (
              <p key={index}>{text}</p>
            ))}
            {response.simulation && (
              <>
                {response.hypothetical_deadline && (
                  <p>
                    Hypothetical protected deadline:{" "}
                    {response.hypothetical_deadline}. The real deadline is
                    unchanged.
                  </p>
                )}
                <h3>Assumptions</h3>
                <ul>
                  {response.simulation.assumptions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <h3>Hypothetical futures</h3>
                {response.simulation.candidate_futures.map((future) => (
                  <div key={future.title}>
                    <h4>{future.title}</h4>
                    <p>{future.consequence}</p>
                    <ul>
                      {future.tradeoffs.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <p>
                      Still needs verification:{" "}
                      {future.required_verification.join("; ")}
                    </p>
                  </div>
                ))}
                <h3>Risks and limits</h3>
                <ul>
                  {[
                    ...response.simulation.risk_critique,
                    ...response.simulation.unsupported_assumptions,
                  ].map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
                <p>
                  Hypothetical outlook:{" "}
                  {response.simulation.likely_objective_outcome
                    .replaceAll("_", " ")
                    .toLowerCase()}
                  . This is not observed objective verification.
                </p>
              </>
            )}
            {response.evidence.length > 0 && (
              <>
                <h3>Supporting evidence</h3>
                <ul>
                  {response.evidence.map((item) => (
                    <li key={item.evidence_id}>
                      <Link
                        className="link-internal"
                        to={`/app/evidence/${encodeURIComponent(incidentId)}?evidence=${encodeURIComponent(item.evidence_id)}`}
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p>
              Revision {response.revision} · {response.generated_at} ·{" "}
              {response.agents.map((agent) => agent.agent_id).join(" → ")}
            </p>
            <p>No production action occurred. Request {response.request_id}.</p>
          </section>
        )}
      </div>
    </>
  );
}

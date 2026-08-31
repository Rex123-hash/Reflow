import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon, ICON_SIZE, type IconName } from "../components/Icon";
import {
  formatDeadline,
  formatObservedAt,
  truncateId,
} from "../semantics/format";
import { approveOperator, operatorRequestKey, queryOperator } from "./client";
import type { OperatorActionView, OperatorResponse } from "./operatorContract";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { VoiceComposer } from "../voice/VoiceComposer";
import { VoiceLaunchBar } from "../voice/VoiceLaunchBar";
import { ImagePlate } from "../vision/ImagePlate";
import { dragCarriesFile } from "../vision/imageAttachment";
import { DropHint, ImageAttachControl } from "../vision/ShowReflowControls";
import { useShowReflow } from "../vision/useShowReflow";
import { VisualAnswer } from "../vision/VisualAnswer";
import "../voice/voice.css";
import "../vision/vision.css";

const EXAMPLES = [
  "Why did Recovery 1 fail?",
  "What did Reflow change in Google Calendar?",
  "What if Candidate A had passed CI?",
  "Move the Operator demo coordination event by one hour.",
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
  ACT: "Act",
};

/**
 * The glyph for an authoritative intent.
 *
 * Deliberately not the ring family the workflow stages use: an intent is what
 * Reflow was asked to do, not where the recovery has got to, and the two must not
 * be confusable. SIMULATE borrows the existing branch glyph because a simulation is
 * exactly an alternative path taken from the recorded one.
 *
 * This appears in the provenance bar only. The human answer above it stays free of
 * iconography — the P2I hierarchy puts plain language first and nothing here
 * changes that.
 */
const INTENT_GLYPHS: Record<string, IconName> = {
  INSPECT: "intent-inspect",
  EXPLAIN: "intent-explain",
  SIMULATE: "branch",
  ACT: "intent-act",
};

const AGENT_LABELS: Record<string, string> = {
  conversation_understanding_agent: "Conversation understanding",
  operator_intent_interpreter: "Operator intent interpreter",
  simulation_agent: "Simulation agent",
};

function approvalHumanResponse(action: OperatorActionView) {
  if (action.lifecycle === "VERIFIED")
    return {
      human_summary:
        "Done — the action was independently read back and verified.",
      situation_type: "SUCCESS" as const,
      current_state: "The requested action is verified.",
      next_step: "Open the technical details to inspect the receipt.",
      truth_boundary:
        "The action is verified; this does not by itself prove the objective recovered.",
      suggestions: ["Show verification details"],
    };
  return {
    human_summary:
      "The approved action has not reached a verified result, so I am leaving it unconfirmed.",
    situation_type: "UNCERTAIN" as const,
    current_state: `Current action state: ${action.lifecycle.toLowerCase().replaceAll("_", " ")}.`,
    next_step: "Review the receipt before deciding what to do next.",
    truth_boundary: "No verified outcome is claimed.",
    suggestions: [],
  };
}

function operationValue(action: OperatorActionView) {
  return action.operations.map((item) => ({
    label: item.operation.replaceAll("_", " ").toLowerCase(),
    value: item.comment ?? item.value ?? "",
  }));
}

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
  objectiveTitle,
  live,
}: {
  incidentId: string;
  /** The human name of the objective; the call header uses it instead of the id. */
  objectiveTitle: string;
  live: boolean;
}) {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<OperatorResponse | null>(null);
  const [submitted, setSubmitted] = useState("");
  const [reasoning, setReasoning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const result = useRef<HTMLElement>(null);
  const idempotency = useRef<{ message: string; key: string } | null>(null);
  /** Which chip just handed its text over, and the field it handed it to. */
  const [sending, setSending] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const activation = useRef<number | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  /** A take just landed in the field and has not been edited or sent yet. */
  const [transcriptReady, setTranscriptReady] = useState(false);

  /**
   * Show Reflow.
   *
   * The third way in, on the same console. An image is mounted here exactly the way
   * a dictated take is: it lands, it waits, and the reader still presses the button.
   * Nothing about attaching an image executes anything.
   */
  const show = useShowReflow(incidentId, true);
  const imageInput = useRef<HTMLInputElement>(null);
  const visual = useRef<HTMLElement>(null);
  const [holding, setHolding] = useState(false);
  /** Nested dragenter/dragleave pairs, so the hint does not flicker over children. */
  const dragDepth = useRef(0);
  const [params] = useSearchParams();
  const [primed, setPrimed] = useState(false);
  const priming = useRef(false);
  /** Every way of being busy, so one disabled state covers text, voice and image. */
  const busy = reasoning || show.busy;

  useEffect(() => () => pending.current?.abort(), []);
  useEffect(
    () => () => {
      if (activation.current !== null) window.clearTimeout(activation.current);
    },
    [],
  );
  useEffect(() => {
    const node = result.current;
    if (!response || !node || typeof node.scrollIntoView !== "function") return;
    node.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [response?.request_id, reducedMotion]);

  // A visual reading lands the same way a typed one does: the answer is brought to
  // the top of the view rather than left below the fold on a long console.
  useEffect(() => {
    const node = visual.current;
    if (!show.response || !node || typeof node.scrollIntoView !== "function")
      return;
    node.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [show.response?.request_id, reducedMotion]);

  /**
   * Arriving from the dock's Show Reflow entry.
   *
   * The picker is not opened for the reader: a file dialog that appears after a
   * navigation is both blocked by browsers and startling. The control takes focus
   * instead and identifies itself once, so Enter opens the picker from there.
   */
  useEffect(() => {
    if (params.get("show") !== "image" || priming.current) return;
    priming.current = true;
    imageInput.current?.focus();
    setPrimed(true);
    const settle = window.setTimeout(() => setPrimed(false), 2800);
    return () => window.clearTimeout(settle);
  }, [params]);

  /**
   * A chip hands its text to the console.
   *
   * The causal chain is the point: the chip acknowledges, the text lands, the
   * field takes focus, and the perimeter runs one pass of light before settling
   * into the ordinary focused state. The chip does not stay selected — the state
   * belongs to the input from that moment on.
   */
  const useExample = (example: string) => {
    setMessage(example);
    setSending(example);
    setActivating(true);
    field.current?.focus();
    // Caret to the end, so the field reads as ready to edit rather than selected.
    window.requestAnimationFrame(() => {
      const input = field.current;
      if (input) input.setSelectionRange(example.length, example.length);
    });
    if (activation.current !== null) window.clearTimeout(activation.current);
    activation.current = window.setTimeout(() => {
      setActivating(false);
      setSending(null);
      activation.current = null;
    }, 620);
  };

  /**
   * The console's one drop target.
   *
   * The whole console takes the file, not a separate zone beside it, and the hint
   * only exists while something is genuinely being dragged over it. A drop mounts
   * the image and stops — it never submits.
   */
  const onDragEnter = (event: DragEvent) => {
    if (busy || !dragCarriesFile(event.dataTransfer)) return;
    dragDepth.current += 1;
    setHolding(true);
  };
  const onDragOver = (event: DragEvent) => {
    if (busy || !dragCarriesFile(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setHolding(false);
  };
  const onDrop = (event: DragEvent) => {
    if (busy) return;
    event.preventDefault();
    dragDepth.current = 0;
    setHolding(false);
    show.attachFrom(event.dataTransfer);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    // A mounted image is what the console is about, so the button reads it. The
    // typed question rides along when there is one, and is omitted when there is
    // not — the backend supplies its own bounded prompt rather than the browser
    // inventing an intent the reader never expressed.
    if (show.attachment) {
      setResponse(null);
      setError(null);
      await show.submit(message);
      return;
    }
    if (message.trim().length < 3) return;
    pending.current = new AbortController();
    setReasoning(true);
    setError(null);
    setResponse(null);
    const requested = message.trim();
    const previous = response
      ? {
          mode: response.conversation.mode,
          user_goal: response.conversation.user_goal,
          normalized_request: response.conversation.normalized_request,
          human_summary: response.human_response.human_summary,
          likely_provider: response.conversation.likely_provider,
          referenced_resource: response.conversation.referenced_resource,
          context_source: response.conversation.context_source,
        }
      : undefined;
    setSubmitted(requested);
    setTranscriptReady(false);
    try {
      if (idempotency.current?.message !== requested)
        idempotency.current = {
          message: requested,
          key: await operatorRequestKey(incidentId, requested),
        };
      setResponse(
        await queryOperator(
          incidentId,
          requested,
          idempotency.current.key,
          previous,
          pending.current.signal,
        ),
      );
    } catch (cause) {
      if (!pending.current.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "Operator unavailable.",
        );
    } finally {
      setReasoning(false);
    }
  };

  const approve = async () => {
    if (!response?.action || busy) return;
    pending.current = new AbortController();
    setReasoning(true);
    setError(null);
    try {
      const action = await approveOperator(
        response.action.operator_action_id,
        pending.current.signal,
      );
      setResponse({
        ...response,
        action,
        answer:
          action.lifecycle === "VERIFIED"
            ? "The approved action was independently read back and VERIFIED."
            : `Action state: ${action.lifecycle}. Not verified.`,
        human_response: approvalHumanResponse(action),
        external_effects_executed:
          Object.keys(action.execution_acknowledgement ?? {}).length > 0,
      });
    } catch (cause) {
      if (!pending.current.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "Approval unavailable.",
        );
    } finally {
      setReasoning(false);
    }
  };

  const simulated = response?.provenance === "HYPOTHETICAL_NO_ACTION";
  const acted = response?.provenance === "OPERATOR_ACTION";
  const intentLabel = response?.intent?.intent_type
    ? INTENT_LABELS[response.intent.intent_type]
    : null;
  const suggestions = response?.human_response.suggestions ?? [];

  return (
    <>
      {!live && (
        <p className="operator-note" role="status">
          <Icon name="lock" size={ICON_SIZE.meta} />
          Real Reflow reasoning is enabled in this demo workspace. External
          changes remain disabled.
        </p>
      )}

      {/* One console. Type into it, dictate into it, or show it something — and in
          all three cases the reader is the one who presses the button. */}
      <div
        className={`show-console${holding ? " is-holding" : ""}`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {holding ? <DropHint /> : null}

        {show.attachment ? (
          <ImagePlate
            attachment={show.attachment}
            phase={show.phase}
            disabled={show.busy}
            onReplace={() => imageInput.current?.click()}
            onRemove={() => {
              show.clear();
              field.current?.focus();
            }}
          />
        ) : null}

        {/* Dictation composes; it never submits. The finalized transcript is dropped
            into this same field, and the user still presses Ask Reflow. */}
        <VoiceComposer
          incidentId={incidentId}
          disabled={busy}
          onTranscript={(text) => {
            setMessage(text);
            setTranscriptReady(true);
            field.current?.focus();
          }}
        >
          {(mic, strip) => (
            <form
              className={`operator-form${activating ? " is-activating" : ""}${
                busy ? " is-reasoning" : ""
              }`}
              onSubmit={submit}
            >
              <label className="visually-hidden" htmlFor="operator-query">
                Ask Reflow
              </label>
              <Icon name="search" size={ICON_SIZE.header} />
              {strip ?? (
                <input
                  id="operator-query"
                  ref={field}
                  value={message}
                  maxLength={1200}
                  disabled={busy}
                  placeholder={
                    show.attachment
                      ? "What failed here? (optional)"
                      : "Why did Recovery 1 fail?"
                  }
                  autoComplete="off"
                  onChange={(event) => {
                    setMessage(event.target.value);
                    setTranscriptReady(false);
                  }}
                />
              )}
              {message.trim().length > 0 ? (
                <button
                  type="button"
                  className="voice-clear"
                  onClick={() => {
                    setMessage("");
                    setTranscriptReady(false);
                    field.current?.focus();
                  }}
                  aria-label="Clear request"
                  title="Clear request"
                >
                  <Icon name="cross" size={ICON_SIZE.row} />
                </button>
              ) : (
                mic
              )}
              <ImageAttachControl
                id="operator-image"
                inputRef={imageInput}
                disabled={busy}
                primed={primed}
                onFile={(file) => show.attach(file)}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  busy ||
                  strip !== null ||
                  (!show.attachment && message.trim().length < 3)
                }
              >
                {busy
                  ? show.busy
                    ? "Reading…"
                    : "Reasoning…"
                  : show.attachment
                    ? "Show Reflow"
                    : "Ask Reflow"}
                <Icon name="arrow-right" size={ICON_SIZE.row} />
              </button>
            </form>
          )}
        </VoiceComposer>
      </div>

      {transcriptReady ? (
        <p className="voice-transcript-ready" role="status">
          Transcript ready — review and send.
        </p>
      ) : null}

      {show.rejection ? (
        <p className="operator-note is-error" role="alert">
          {show.rejection.message}
          <button
            type="button"
            className="voice-dismiss"
            onClick={show.dismiss}
          >
            Dismiss
          </button>
        </p>
      ) : null}

      {/* The live call is a capability, not a suggestion: it leads the row of
          things a reader can do next, at its own weight. */}
      <VoiceLaunchBar
        incidentId={incidentId}
        objectiveTitle={objectiveTitle}
        disabled={busy}
      />

      <div className="operator-examples">
        <span className="operator-examples-label">Try</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className={`operator-example${sending === example ? " is-sending" : ""}`}
            disabled={busy}
            onClick={() => useExample(example)}
          >
            {example}
          </button>
        ))}
      </div>

      <div aria-live="polite" aria-busy={busy}>
        {busy && (
          <p className="operator-note is-busy" role="status">
            <span className="operator-pulse" aria-hidden="true" />
            {/* Two states, and the boundary between them is a real event: the
                caption changes when the bytes have actually left the browser. */}
            {show.phase === "SENDING"
              ? "Sending the image to Reflow."
              : show.phase === "ANALYZING"
                ? "Reading the image. Nothing is being executed."
                : "Interpreting the request and applying deterministic controls."}
          </p>
        )}

        {show.error && (
          <p className="operator-note is-error" role="alert">
            {show.error}
          </p>
        )}

        {error && (
          <p className="operator-note is-error" role="alert">
            {error}
          </p>
        )}

        {show.response && show.askedFor && (
          <VisualAnswer
            ref={visual}
            response={show.response}
            question={show.askedFor.question}
            filename={show.askedFor.filename}
          />
        )}

        {response && (
          <section
            ref={result}
            className={`operator-result${simulated ? " is-simulation" : ""}${acted ? " is-action" : ""}`}
          >
            <div className="operator-human-answer">
              <p className="field-label">You asked</p>
              <h2>{submitted}</h2>
              <p className="field-label">Answer</p>
              <p className="operator-human-summary">
                {response.human_response.human_summary}
              </p>

              <div className="operator-human-status" role="status">
                <strong>
                  {response.human_response.situation_type
                    .replaceAll("_", " ")
                    .toLowerCase()}
                </strong>
                <span>{response.human_response.current_state}</span>
              </div>

              {response.human_response.why && (
                <p className="operator-human-why">
                  {response.human_response.why}
                </p>
              )}
              {response.human_response.next_step && (
                <p className="operator-next-step">
                  <b>Next</b> {response.human_response.next_step}
                </p>
              )}
              <p className="operator-truth-boundary">
                {response.human_response.truth_boundary}
              </p>

              {suggestions.length > 0 && (
                <div
                  className="operator-suggestions"
                  aria-label="Suggested follow-ups"
                >
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      disabled={busy}
                      onClick={() => useExample(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="operator-result-bar">
              {intentLabel && response.intent && (
                <span
                  className={`operator-intent is-${response.intent.intent_type?.toLowerCase()}`}
                >
                  {response.intent.intent_type &&
                  INTENT_GLYPHS[response.intent.intent_type] ? (
                    <Icon
                      name={INTENT_GLYPHS[response.intent.intent_type]}
                      size={ICON_SIZE.meta}
                    />
                  ) : null}
                  {intentLabel}
                </span>
              )}
              <span className="operator-provenance-state">
                {simulated
                  ? "Hypothetical · no external action"
                  : acted
                    ? `Controlled action · ${response.action?.lifecycle.toLowerCase().replaceAll("_", " ")}`
                    : response.provenance === "CONVERSATION_ONLY"
                      ? "Conversation only · no action"
                      : "Authoritative inspection"}
              </span>
            </div>

            <details className="operator-technical">
              <summary>
                <span>Technical details</span>
                <small>
                  Authoritative inspection, evidence, request and proof
                </small>
              </summary>
              <div className="operator-answer-grid">
                <div className="operator-answer">
                  <p className="field-label">Authoritative answer</p>
                  <div className="operator-prose">
                    {response.answer.split("\n\n").map((text, index) => (
                      <p key={index}>{text}</p>
                    ))}
                  </div>

                  {response.action && (
                    <div className="operator-action-proof">
                      {response.action.adapter_proof?.assignee_account_id && (
                        <p>
                          Resolved assignee:{" "}
                          {response.action.adapter_proof.assignee_display_name}{" "}
                          ·{" "}
                          <code>
                            {response.action.adapter_proof.assignee_account_id}
                          </code>
                        </p>
                      )}
                      {response.action.external_effects_possible &&
                        response.action.lifecycle !== "VERIFIED" && (
                          <p>
                            External changes may have occurred. Review this
                            receipt; retrying the same request will not repeat
                            writes.
                          </p>
                        )}
                      <div>
                        <p className="field-label">Action</p>
                        <h3>
                          {response.action.authority.replaceAll("_", " ")} ·{" "}
                          <span className="mono">
                            {response.action.resource_identifier}
                          </span>
                        </h3>
                        {operationValue(response.action).map((item) => (
                          <p key={`${item.label}:${item.value}`}>
                            <b>{item.label}</b> → {item.value}
                          </p>
                        ))}
                      </div>
                      <dl>
                        <div>
                          <dt>Authorization</dt>
                          <dd>
                            {response.action.authorization_result
                              .replaceAll("_", " ")
                              .toLowerCase()}
                          </dd>
                        </div>
                        <div>
                          <dt>Execution</dt>
                          <dd>
                            {Object.keys(
                              response.action.execution_acknowledgement ?? {},
                            ).length
                              ? "Acknowledged"
                              : "Not executed"}
                          </dd>
                        </div>
                        <div>
                          <dt>Read-back</dt>
                          <dd>
                            {Object.entries(
                              response.action.observed_state ?? {},
                            )
                              .filter(([key]) => key !== "etag")
                              .map(
                                ([key, value]) => `${key}: ${value ?? "none"}`,
                              )
                              .join(" · ") || "Not run"}
                          </dd>
                        </div>
                        <div>
                          <dt>Result</dt>
                          <dd>
                            {response.action.lifecycle.replaceAll("_", " ")}
                          </dd>
                        </div>
                      </dl>
                      {response.action.lifecycle === "APPROVAL_REQUIRED" && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busy}
                          onClick={approve}
                        >
                          Confirm and execute
                          <Icon name="arrow-right" size={ICON_SIZE.row} />
                        </button>
                      )}
                    </div>
                  )}

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
                          <article
                            key={future.title}
                            className="operator-future"
                          >
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
                        <dd className="operator-agents">
                          {response.agents.map((agent, index) => (
                            <span key={`${agent.agent_id}:${index}`}>
                              {index > 0 ? " → " : ""}
                              {AGENT_LABELS[agent.agent_id] ?? agent.agent_id}
                              <code title="Exact agent identifier">
                                {agent.agent_id}
                              </code>
                            </span>
                          ))}
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
                      {response.action
                        ? `Action ${truncateId(response.action.operator_action_id, 8, 6)} · ${response.action.verification_result}`
                        : "No production action occurred."}
                    </p>
                  </section>
                </aside>
              </div>
            </details>
          </section>
        )}
      </div>
    </>
  );
}

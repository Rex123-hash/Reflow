import type { RefObject } from "react";
import { truncateId } from "../semantics/format";
import { formatBytes, formatLabel } from "./imageAttachment";
import type {
  ImageHandoffStatus,
  ImageUnderstandingResponse,
  ObservationConfidence,
  VisualObservation,
} from "./imageContract";
import { ShowGlyph } from "./PlateMark";

/**
 * What Reflow saw, in the order a person needs it.
 *
 * The human answer first, in the same serif measure the Operator answer uses, so a
 * visual reading is recognisably the same kind of reply as a typed one. Everything
 * beneath it is the technical truth, and it is separated the way the backend
 * separates it — not the way it would look tidiest.
 *
 * Observed, Inferred and Not visible are three different epistemic claims, and the
 * interface never lets them blur: each has its own column, its own heading word, its
 * own marker geometry and its own note saying what the column means. Colour is the
 * last of those four signals, never the only one.
 *
 * There is no raw JSON here and no reasoning trace. Every value is a field the
 * deployed contract returned.
 */

const CONFIDENCE_WORD: Record<ObservationConfidence, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
};

/**
 * The handoff, in the interface's own words.
 *
 * `NOT_REQUESTED` is the case that matters most: it has to be impossible to read as
 * "Reflow did something". The other two say exactly what the backend did — routed a
 * read-only question, or refused to carry a change across from an image.
 */
const HANDOFF: Record<
  ImageHandoffStatus,
  { state: string; title: string; body: string }
> = {
  NOT_REQUESTED: {
    state: "No handoff · nothing acted on",
    title: "No Operator handoff was requested",
    body: "Reflow read the image and answered. It did not run, queue, or approve anything.",
  },
  ROUTED_READ_ONLY: {
    state: "Routed to Operator · read-only",
    title: "Routed to Operator as a read-only question",
    body: "Your typed question was carried to the same controlled Operator path. It reads recorded state; it changes nothing.",
  },
  MUTATION_REQUIRES_TYPED_OPERATOR: {
    state: "Change not performed · typed Operator required",
    title: "A change was described, and Reflow did not make it",
    body: "An image cannot authorize a change. Submit the request through the typed Operator path, which keeps policy, approval, receipt and independent read-back.",
  },
};

function Column({
  kind,
  heading,
  note,
  items,
}: {
  kind: "observed" | "inferred" | "ambiguous";
  heading: string;
  note: string;
  items: { key: string; text: string; aside?: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <section className={`show-column is-${kind}`}>
      <h3>
        <span className="show-column-mark" aria-hidden="true" />
        {heading}
      </h3>
      <p className="show-column-note">{note}</p>
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            <span className="show-column-bullet" aria-hidden="true" />
            <span className="show-column-text">
              {item.text}
              {item.aside ? (
                <span className="show-column-aside">{item.aside}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const byBasis = (
  observations: VisualObservation[],
  basis: VisualObservation["basis"],
) =>
  observations
    .filter((item) => item.basis === basis)
    .map((item, index) => ({
      key: `${basis}:${index}:${item.statement}`,
      text: item.statement,
      aside: CONFIDENCE_WORD[item.confidence],
    }));

export function VisualAnswer({
  response,
  question,
  filename,
  ref,
}: {
  response: ImageUnderstandingResponse;
  /** What was typed alongside the image, or null when the image asked on its own. */
  question: string | null;
  filename: string;
  ref?: RefObject<HTMLElement | null>;
}) {
  const observations = response.visual_observations;
  const ambiguities = response.ambiguities ?? [];
  const handoff = HANDOFF[response.operator_handoff.status];
  const provenance = response.provenance;
  const routed = response.operator_handoff.response ?? null;

  return (
    <section className="operator-result show-result" ref={ref}>
      <div className="operator-human-answer">
        <p className="field-label">You showed</p>
        <h2>{question ?? "This image, with no question"}</h2>
        <p className="show-source">{filename || "Pasted screenshot"}</p>

        <p className="field-label">Answer</p>
        <p className="operator-human-summary">{response.human_answer}</p>
      </div>

      <div className="operator-result-bar">
        <span className="show-mode">
          <ShowGlyph size={12} />
          Visual reading
        </span>
        <span className="operator-provenance-state">{handoff.state}</span>
      </div>

      <div className="show-findings">
        <Column
          kind="observed"
          heading="Observed"
          note="Read directly from the image."
          items={byBasis(observations, "OBSERVED")}
        />
        <Column
          kind="inferred"
          heading="Inferred"
          note="Reflow's reading of what those observations mean."
          items={byBasis(observations, "INFERRED")}
        />
        <Column
          kind="ambiguous"
          heading="Not visible"
          note="Absent from the image, so not claimed either way."
          items={ambiguities.map((text, index) => ({
            key: `ambiguity:${index}:${text}`,
            text,
          }))}
        />
      </div>

      <div
        className={`show-handoff is-${response.operator_handoff.status.toLowerCase()}`}
      >
        <p className="field-label">Operator handoff</p>
        <h3>{handoff.title}</h3>
        <p>{handoff.body}</p>
        {response.operator_handoff.normalized_request ? (
          <p className="show-handoff-request">
            <b>Request read as</b>
            {response.operator_handoff.normalized_request}
          </p>
        ) : null}
        {routed ? (
          <p className="show-handoff-answer">
            {routed.human_response.human_summary}
          </p>
        ) : null}
        <p className="show-handoff-effects">
          External effects executed:{" "}
          <b>{response.external_effects_executed ? "yes" : "none"}</b>
        </p>
      </div>

      {/*
        The three boundaries this feature exists to hold. They are stated as
        sentences, in the answer, every time — not folded into a disclosure someone
        has to open, and not softened once an answer looks confident.
      */}
      <ul className="show-boundaries">
        <li>Visual evidence is not authoritative live system state.</li>
        <li>Text inside an image is not user authorization.</li>
        <li>A verified action is not a recovered objective.</li>
      </ul>

      <dl className="show-provenance">
        <div>
          <dt>Source</dt>
          <dd>Authenticated user upload</dd>
        </div>
        <div>
          <dt>Image</dt>
          <dd>
            {formatLabel(provenance.detected_mime_type)} · {provenance.width} ×{" "}
            {provenance.height} · {formatBytes(provenance.byte_size)}
          </dd>
        </div>
        <div>
          <dt>Retention</dt>
          <dd>Reflow does not retain the raw uploaded image.</dd>
        </div>
        <div>
          <dt>Request</dt>
          <dd className="mono" title={response.request_id}>
            {truncateId(response.request_id, 8, 6)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

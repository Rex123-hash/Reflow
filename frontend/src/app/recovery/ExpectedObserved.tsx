import type {
  VerificationInvariantView,
  VerificationView,
} from "../contract/uiContract";
import {
  displayReference,
  formatObservedAt,
  isHttpReference,
} from "../semantics/format";
import { Icon } from "../components/Icon";
import { VerificationPill } from "../components/StatusVocabulary";

/**
 * Reflow's core epistemic pattern: what the objective requires, beside what an
 * authority actually returned.
 *
 * The status is read from `invariant.status`. It is never inferred by comparing the
 * expected and observed cells — those two strings are display values, and a client
 * that compared them would be deciding an objective's fate from formatting.
 */

/** The split form, for a single decisive claim. */
export function ExpectedObservedSplit({
  expected,
  observed,
  expectedNote,
  observedNote,
  failed,
}: {
  expected: string;
  observed: string;
  expectedNote?: string | null;
  observedNote?: string | null;
  failed: boolean;
}) {
  return (
    <div className="eo-split">
      <div className="eo-half">
        <span className="field-label">Expected</span>
        <p>{expected}</p>
        {expectedNote ? <span className="eo-note">{expectedNote}</span> : null}
      </div>
      <div className="eo-vs" aria-hidden="true">
        VS
      </div>
      <div className={`eo-half eo-observed${failed ? " is-failed" : ""}`}>
        <span className="field-label">Observed</span>
        <p>{observed}</p>
        {observedNote ? <span className="eo-note">{observedNote}</span> : null}
      </div>
    </div>
  );
}

function ObservedCell({ invariant }: { invariant: VerificationInvariantView }) {
  if (invariant.observed == null) {
    // PENDING and UNAVAILABLE say genuinely different things and must not blur.
    const copy =
      invariant.status === "UNAVAILABLE"
        ? "authority could not be read"
        : "not yet observed";
    return <span className="observed-absent">{copy}</span>;
  }

  const failed = invariant.status === "FAILED";
  return (
    <>
      <span className={failed ? "observed-false" : undefined}>
        {invariant.observed}
      </span>
      {invariant.evidence_provenance ? (
        <span className="provenance-ref">
          {isHttpReference(invariant.evidence_provenance) ? (
            <a
              className="link-external"
              href={invariant.evidence_provenance}
              target="_blank"
              rel="noreferrer noopener"
            >
              {displayReference(invariant.evidence_provenance)}
              <Icon name="external" size={11} />
            </a>
          ) : (
            invariant.evidence_provenance
          )}
        </span>
      ) : null}
      {invariant.reason ? (
        <span className="provenance-ref">{invariant.reason}</span>
      ) : null}
    </>
  );
}

export function InvariantTable({
  verification,
  emptyNote,
}: {
  verification: VerificationView;
  emptyNote?: React.ReactNode;
}) {
  const invariants = verification.invariants ?? [];

  if (invariants.length === 0) {
    return (
      <div className="invariant-empty">
        <p>
          <strong>
            {verification.status === "PENDING"
              ? "Not yet observed."
              : "No invariants recorded."}
          </strong>{" "}
          {emptyNote}
        </p>
      </div>
    );
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th style={{ width: "28%" }}>Invariant</th>
          <th style={{ width: "14%" }}>Expected</th>
          <th style={{ width: "40%" }}>Observed</th>
          <th className="numeric" style={{ width: "18%" }}>
            Status
          </th>
        </tr>
      </thead>
      <tbody>
        {invariants.map((invariant) => (
          <tr key={invariant.invariant_id}>
            <td className="mono">{invariant.invariant_id}</td>
            <td>{invariant.expected}</td>
            <td>
              <ObservedCell invariant={invariant} />
            </td>
            <td className="numeric">
              <VerificationPill status={invariant.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PendingInvariantGap() {
  return (
    <p className="invariant-gap">
      <span>
        The pending conditions above are the authoritative invariant set. The
        objective is not restored until deterministic verification reports on
        every one.
      </span>
    </p>
  );
}

export function verificationObservedAt(
  verification: VerificationView,
): string | null {
  return formatObservedAt(verification.observed_at);
}

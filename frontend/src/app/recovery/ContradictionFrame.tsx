import type {
  ActionReceiptView,
  EvidenceView,
  VerificationView,
} from "../contract/uiContract";
import { Icon, ICON_SIZE } from "../components/Icon";
import { SourceMark } from "../components/SourceMark";
import {
  ReceiptStatusPill,
  VerificationPill,
} from "../components/StatusVocabulary";
import {
  displayReference,
  humanizeEnum,
  isHttpReference,
} from "../semantics/format";
import { ExpectedObservedSplit } from "./ExpectedObserved";

/**
 * The highest-value frame in the application.
 *
 * It puts three backend facts on screen at the same time:
 *   · the action receipts for this attempt reached VERIFIED;
 *   · a required objective invariant was observed false;
 *   · the external authority that observed it, one click away.
 *
 * Everything rendered is a supplied value. The frame teaches
 * "action verified ≠ objective recovered" by placing two disagreeing backend
 * fields beside each other, not by asserting it in copy.
 */
export function ContradictionFrame({
  verification,
  actions,
  evidence,
  onFocusEvidence,
}: {
  verification: VerificationView;
  actions: ActionReceiptView[];
  evidence: EvidenceView[];
  onFocusEvidence?: (evidenceId: string) => void;
}) {
  const failedInvariant = verification.invariants?.find(
    (item) => item.status === "FAILED",
  );
  if (!failedInvariant) return null;

  const verifiedReceipts = actions.filter(
    (action) => action.receipt_status === "VERIFIED",
  );
  const failedOutcome = actions.find(
    (action) => action.verification_state === "FAILED",
  );

  const provenance = failedInvariant.evidence_provenance ?? null;
  const provenanceEvidence = evidence.find(
    (item) => item.external_reference && item.external_reference === provenance,
  );

  return (
    <section
      className="contradiction"
      aria-label="Verified action, failed objective"
    >
      <ExpectedObservedSplit
        expected={`${failedInvariant.invariant_id} = ${failedInvariant.expected}`}
        observed={`${failedInvariant.invariant_id} = ${failedInvariant.observed ?? "not observed"}`}
        expectedNote="Required by the protected objective"
        observedNote={failedInvariant.reason ?? null}
        failed
      />

      <div className="contradiction-bridge">
        <div className="contradiction-receipts">
          <span className="field-label">
            {verifiedReceipts.length} of {actions.length} action receipts
            verified
          </span>
          <ul>
            {actions.map((action) => (
              <li key={action.action_id}>
                <SourceMark source={action.system} size={ICON_SIZE.row} />
                <span className="contradiction-action-name">
                  {humanizeEnum(action.kind)}
                </span>
                <ReceiptStatusPill status={action.receipt_status} />
                <VerificationPill status={action.verification_state} />
              </li>
            ))}
          </ul>
        </div>

        <p className="contradiction-statement">
          {failedOutcome ? (
            <>
              Reflow wrote to {failedOutcome.system_label}, read it back
              independently and matched it. The receipt is verified. The
              objective is not.
            </>
          ) : (
            <>
              Every action receipt for this attempt is verified. The objective
              invariant is not.
            </>
          )}
        </p>
      </div>

      {provenance ? (
        <footer className="contradiction-proof">
          <span className="field-label">Observed by</span>
          <span className="contradiction-proof-body">
            {provenanceEvidence ? (
              <SourceMark
                source={provenanceEvidence.source_system}
                size={ICON_SIZE.row}
              />
            ) : null}
            {isHttpReference(provenance) ? (
              <a
                className="link-external"
                href={provenance}
                target="_blank"
                rel="noreferrer noopener"
              >
                {displayReference(provenance)}
                <Icon name="external" size={ICON_SIZE.meta} />
              </a>
            ) : (
              <span className="mono">{provenance}</span>
            )}
          </span>
          {provenanceEvidence && onFocusEvidence ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onFocusEvidence(provenanceEvidence.evidence_id)}
            >
              Show the evidence
              <Icon name="arrow-right" size={ICON_SIZE.meta} />
            </button>
          ) : null}
        </footer>
      ) : null}
    </section>
  );
}

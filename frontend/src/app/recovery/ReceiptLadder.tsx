import type { ActionReceiptView } from "../contract/uiContract";
import { Icon } from "../components/Icon";
import { SourceMark } from "../components/SourceMark";
import {
  ReceiptStatusPill,
  VerificationPill,
  verificationTone,
} from "../components/StatusVocabulary";
import {
  displayReference,
  formatClock,
  humanizeEnum,
  isHttpReference,
  truncateId,
} from "../semantics/format";

/**
 * The four-rung action receipt.
 *
 * The card header carries `receipt_status` — did the action land and can Reflow
 * prove it landed. The footer carries `verification_state` — did the world end up
 * the way the objective needs. They are separate backend fields and they may
 * legitimately disagree: in Recovery 01, Candidate A is VERIFIED and FAILED at the
 * same time. A card that showed one tick would destroy the product.
 *
 * An unreached rung is dashed and present, never hidden, so the shape of the full
 * ladder is visible from the first rung.
 */

interface Rung {
  index: number;
  label: string;
  value: string | null;
  clock: string | null;
  reached: boolean;
  href?: string | null;
}

/**
 * Each rung reads exactly one authoritative field and reports it.
 *
 * Rungs 1 and 2 render the two boolean facts the backend records about the write
 * and the independent read-back. Rung 3 is not computed from them: it renders
 * `receipt_status`, which is the backend's own semantic verdict on the receipt.
 *
 * Nothing here reconstructs a verdict out of the rungs. `receipt_status` and
 * `verification_state` are read; a full ladder does not "mean" verified, and an
 * incomplete ladder does not "mean" pending. If the backend ever reported three
 * reached rungs with a PENDING receipt, this card would show exactly that.
 */
function buildRungs(action: ActionReceiptView): Rung[] {
  const reference = action.external_reference ?? null;

  const receiptRungLabel: Record<typeof action.receipt_status, string> = {
    VERIFIED: action.receipt_id
      ? truncateId(action.receipt_id, 20, 8)
      : "receipt verified",
    WRITE_ACKNOWLEDGED: "acknowledged, not yet verified",
    PENDING: "pending",
  };

  return [
    {
      index: 1,
      label: "Write acknowledged",
      value: action.write_acknowledged
        ? humanizeEnum(action.kind)
        : "not acknowledged",
      clock: formatClock(action.write_acknowledged_at),
      reached: action.write_acknowledged,
    },
    {
      index: 2,
      label: "Independently read back",
      value: action.read_back_completed
        ? reference
          ? isHttpReference(reference)
            ? displayReference(reference)
            : truncateId(reference, 26, 10)
          : "read back"
        : "not yet observed",
      clock: formatClock(action.read_back_at),
      reached: action.read_back_completed,
      href:
        action.read_back_completed && isHttpReference(reference)
          ? reference
          : null,
    },
    {
      index: 3,
      label: "Receipt verified",
      value: receiptRungLabel[action.receipt_status],
      // The contract exposes no `verified_at`. Borrowing `read_back_at` here would
      // put a time on an event the backend never timestamped, so the cell stays empty.
      clock: null,
      reached: action.receipt_status === "VERIFIED",
    },
  ];
}

export function ReceiptLadder({ action }: { action: ActionReceiptView }) {
  const rungs = buildRungs(action);
  const tone = verificationTone(action.verification_state);

  return (
    <article className="receipt">
      <header className="receipt-head">
        <SourceMark source={action.system} framed size={17} />
        <div>
          <span className="field-label">{action.system_label}</span>
          <b>{humanizeEnum(action.kind)}</b>
        </div>
        <ReceiptStatusPill status={action.receipt_status} />
      </header>

      <div className="receipt-intent">
        <span className="field-label">Intended</span>
        <p>{action.desired_state_summary}</p>
      </div>

      <ol className="receipt-rungs">
        {rungs.map((rung) => (
          <li
            key={rung.index}
            className={rung.reached ? "is-reached" : "is-open"}
          >
            <span className="receipt-rung-index" aria-hidden="true">
              {rung.reached ? (
                <Icon name="check" size={10} strokeWidth={3.2} />
              ) : (
                rung.index
              )}
            </span>
            <span className="receipt-rung-body">
              <strong>{rung.label}</strong>
              {rung.href ? (
                <a
                  className="link-external receipt-rung-value"
                  href={rung.href}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {rung.value}
                  <Icon name="external" size={11} />
                </a>
              ) : (
                <span className="receipt-rung-value">{rung.value}</span>
              )}
            </span>
            <span className="receipt-rung-clock">{rung.clock ?? "—"}</span>
          </li>
        ))}
      </ol>

      {/*
        Deliberately a separate band below the ladder, reading a different field.
        Receipt status is about Reflow's action; this is about the world.
      */}
      <footer className={`receipt-outcome tone-${tone}`}>
        <span className="field-label">Observed outcome</span>
        <VerificationPill status={action.verification_state} />
      </footer>
    </article>
  );
}

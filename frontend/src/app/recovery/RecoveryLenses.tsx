import type {
  RecoveryAttemptView,
  RecoveryCaseView,
} from "../contract/uiContract";
import { ContractGap, Notice } from "../components/Feedback";
import { Icon } from "../components/Icon";
import {
  actionsFor,
  evidenceFor,
  plansFor,
  verificationFor,
} from "../semantics/spine";
import { ContradictionFrame } from "./ContradictionFrame";
import {
  InvariantTable,
  PendingInvariantGap,
  verificationObservedAt,
} from "./ExpectedObserved";
import { PlanCard } from "./PlanCard";
import { ReceiptLadder } from "./ReceiptLadder";
import { WhatChanged } from "./WhatChanged";
import { WorldGraph } from "./WorldGraph";
import { VerificationPill } from "../components/StatusVocabulary";

export interface LensProps {
  recoveryCase: RecoveryCaseView;
  attempt: RecoveryAttemptView;
  onFocusEvidence: (evidenceId: string) => void;
  onFocusStage: (stageId: string, lens?: string) => void;
}

/* ------------------------------------------------------------------ summary --- */

/**
 * Question-shaped quick links.
 *
 * These focus existing Recovery state through the same URL parameters the spine
 * uses. They are contextual affordances, not a second navigation system: every
 * destination is reachable from the spine and the lens tabs on their own.
 */
function QuickLinks({
  recoveryCase,
  onFocusStage,
}: {
  recoveryCase: RecoveryCaseView;
  onFocusStage: LensProps["onFocusStage"];
}) {
  const links: { label: string; stageId: string; lens?: string }[] = [];

  for (const attempt of recoveryCase.attempts) {
    const failedStage = (attempt.stages ?? []).find(
      (stage) => stage.status === "FAILED",
    );
    if (failedStage) {
      links.push({
        label: `Why did ${attempt.label} fail?`,
        stageId: failedStage.stage_id,
        lens: "verify",
      });
    }
    if (attempt.branch_from_attempt != null) {
      const first = (attempt.stages ?? [])[0];
      if (first) {
        links.push({
          label: `Why does ${attempt.label} exist?`,
          stageId: first.stage_id,
          lens: "summary",
        });
      }
    }
  }

  const currentStage = recoveryCase.attempts
    .flatMap((attempt) => attempt.stages ?? [])
    .find((stage) => stage.status === "CURRENT");
  if (currentStage) {
    links.push({
      label: "What is happening now?",
      stageId: currentStage.stage_id,
    });
  }

  if (links.length === 0) return null;

  return (
    <nav className="quick-links" aria-label="Jump to">
      {links.map((link) => (
        <button
          key={link.label}
          type="button"
          className="quick-link"
          onClick={() => onFocusStage(link.stageId, link.lens)}
        >
          {link.label}
          <Icon name="arrow-right" size={12} />
        </button>
      ))}
    </nav>
  );
}

export function SummaryLens({
  recoveryCase,
  attempt,
  onFocusStage,
}: LensProps) {
  const summary = recoveryCase.summary;
  const isBranched = attempt.branch_from_attempt != null;

  return (
    <div className="lens-body">
      <h2 className="lens-verdict">{summary.what_happened}</h2>

      {isBranched && attempt.branch_reason ? (
        <div className="summary-branch">
          <Icon name="branch" size={16} />
          <div>
            <span className="field-label">Why {attempt.label} exists</span>
            <p>{attempt.branch_reason}</p>
          </div>
        </div>
      ) : null}

      {summary.why_current_recovery_exists ? (
        <p className="lens-prose">{summary.why_current_recovery_exists}</p>
      ) : null}

      <QuickLinks recoveryCase={recoveryCase} onFocusStage={onFocusStage} />

      {/*
        Recovery 02's Summary leads with the backend's own attempt comparison —
        the cheapest possible answer to "why does a second recovery exist".
      */}
      {isBranched && recoveryCase.what_changed.length > 0 ? (
        <section className="card what-changed-card">
          <div className="card-head">
            <h3>What changed between attempts</h3>
            <span className="card-head-note">Backend comparison</span>
          </div>
          <WhatChanged items={recoveryCase.what_changed} variant="band" />
          {summary.what_changed ? (
            <p className="what-changed-prose">{summary.what_changed}</p>
          ) : null}
        </section>
      ) : null}

      {!isBranched && recoveryCase.what_changed.length > 0 ? (
        <details className="compare-details">
          <summary>
            Compare attempts
            <Icon name="chevron-down" size={14} />
          </summary>
          <WhatChanged items={recoveryCase.what_changed} />
        </details>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------- world --- */

export function WorldLens({ recoveryCase }: LensProps) {
  return (
    <div className="lens-body">
      <h2 className="lens-verdict">Operational objective graph</h2>
      <p className="lens-prose">
        Deterministic blast-radius traversal. Node state, affectedness and
        critical-path membership are computed by the backend; only the layout is
        drawn here.
      </p>
      <div className="card is-flat world-card">
        <WorldGraph graph={recoveryCase.world} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- plans --- */

export function PlansLens({ recoveryCase, attempt }: LensProps) {
  const plans = plansFor(recoveryCase, attempt.attempt_number);

  return (
    <div className="lens-body">
      <h2 className="lens-verdict">
        {plans.length} candidate future{plans.length === 1 ? "" : "s"} ·{" "}
        {attempt.label}
      </h2>
      <p className="lens-prose">
        Gemini proposed. A separate risk critic evaluated. Deterministic policy
        validated, and a stable selection rule chose. The model never decided
        which plan ran.
      </p>

      <Notice>
        <strong>Proposed steps are proposals.</strong> A plan's steps describe
        intent. The presentation contract does not yet distinguish a step that
        can produce a real external effect from one that cannot{" "}
        <ContractGap
          field="RecoveryPlanView.proposed_action_summary (no executable/executed flag)"
          note="Reflow will not classify these in the client. Only the Actions lens shows effects that produced an authoritative receipt."
        />
        , so none is marked as executed here. The Actions lens is the only place
        an external effect is claimed.
      </Notice>

      <div className="plan-grid">
        {plans.map((plan) => (
          <PlanCard key={`${plan.plan_id}-${plan.revision}`} plan={plan} />
        ))}
      </div>

      {plans.length === 0 ? (
        <p className="lens-empty">
          No plans were recorded for {attempt.label}.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ actions --- */

export function ActionsLens({ recoveryCase, attempt }: LensProps) {
  const actions = actionsFor(recoveryCase, attempt.attempt_number);

  return (
    <div className="lens-body">
      <h2 className="lens-verdict">
        {actions.length} external action{actions.length === 1 ? "" : "s"} ·{" "}
        {attempt.label}
      </h2>
      <p className="lens-prose">
        Reflow wrote, then read the authority back through a separate call, then
        compared. The header of each card reports whether the action landed. The
        band beneath reports whether the world ended up the way the objective
        needs.
      </p>

      <div className="receipt-grid">
        {actions.map((action) => (
          <ReceiptLadder key={action.action_id} action={action} />
        ))}
      </div>

      {actions.length === 0 ? (
        <p className="lens-empty">
          No external actions were recorded for {attempt.label}.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- verify --- */

export function VerifyLens({
  recoveryCase,
  attempt,
  onFocusEvidence,
}: LensProps) {
  const verification = verificationFor(recoveryCase, attempt.attempt_number);
  const actions = actionsFor(recoveryCase, attempt.attempt_number);
  const evidence = evidenceFor(recoveryCase, attempt.attempt_number);

  if (!verification) {
    return (
      <div className="lens-body">
        <h2 className="lens-verdict">No verification recorded</h2>
        <p className="lens-prose">
          The presentation contract returned no verification for {attempt.label}
          . Reflow does not infer one.
        </p>
      </div>
    );
  }

  const observedAt = verificationObservedAt(verification);
  const hasFailedInvariant = (verification.invariants ?? []).some(
    (invariant) => invariant.status === "FAILED",
  );

  return (
    <div className="lens-body">
      <div className="lens-verdict-row">
        <h2 className="lens-verdict">
          Objective verification · {attempt.label}
        </h2>
        <VerificationPill status={verification.status} />
      </div>
      <p className="lens-prose">
        {observedAt
          ? `Observed ${observedAt}.`
          : "Deterministic objective verification has not produced authoritative evidence yet."}{" "}
        An action can be independently verified while the objective it served is
        still false.
      </p>

      {hasFailedInvariant ? (
        <ContradictionFrame
          verification={verification}
          actions={actions}
          evidence={evidence}
          onFocusEvidence={onFocusEvidence}
        />
      ) : null}

      <section className="card">
        <div className="card-head">
          <h3>Required conditions</h3>
          <span className="card-head-note">
            {(verification.invariants ?? []).length} invariant
            {(verification.invariants ?? []).length === 1 ? "" : "s"} reported
          </span>
        </div>
        <InvariantTable
          verification={verification}
          emptyNote={
            verification.status === "PENDING"
              ? "Deterministic objective verification is still running."
              : undefined
          }
        />
      </section>

      {verification.status === "PENDING" ? <PendingInvariantGap /> : null}
    </div>
  );
}

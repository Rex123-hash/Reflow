import type { RecoveryPlanView } from "../contract/uiContract";
import { Icon, ICON_SIZE } from "../components/Icon";
import { SourceMark } from "../components/SourceMark";
import { shortSha } from "../semantics/format";

/**
 * A candidate future, with the four things that made it win or lose kept distinct:
 * what Gemini proposed, what the risk critic said, what deterministic policy ruled,
 * and what stable selection chose.
 *
 * `selected`, `valid`, `risk_score` and every policy violation are backend truth.
 * Private chain-of-thought is not exposed because the contract does not expose it.
 */
export function PlanCard({ plan }: { plan: RecoveryPlanView }) {
  const violations = plan.policy?.violations ?? [];
  const blockingUnknowns = plan.policy?.blocking_unknowns ?? [];
  const policyValid = plan.policy?.valid ?? plan.valid ?? null;

  return (
    <article className={`plan-card${plan.selected ? " is-selected" : ""}`}>
      <header>
        <h4>{plan.title}</h4>
        <div className="plan-card-verdict">
          {plan.selected ? (
            <span className="pill tone-verified">
              <i aria-hidden="true" />
              Selected
            </span>
          ) : plan.deterministic_rejection_reason ? (
            <span className="pill tone-failed">
              <i aria-hidden="true" />
              Rejected
            </span>
          ) : (
            <span className="plan-card-notselected">Not selected</span>
          )}
          {plan.risk_score != null ? (
            <span className="plan-risk">
              Risk <b>{plan.risk_score}</b>
            </span>
          ) : null}
        </div>
      </header>

      {plan.candidate_sha ? (
        <p className="plan-candidate mono">
          <SourceMark source="github" size={ICON_SIZE.meta} />
          candidate {shortSha(plan.candidate_sha)}
        </p>
      ) : null}

      {plan.critic_summary ? (
        <p className="plan-critic">
          <span className="field-label">Risk critic</span>
          {plan.critic_summary}
        </p>
      ) : null}

      {(plan.actions ?? []).length > 0 ? (
        <div className="plan-steps">
          <span className="field-label">Action semantics</span>
          <ul>
            {(plan.actions ?? []).map((action) => (
              <li key={action.action_id} className="mono">
                {action.kind} → {action.target} ·{" "}
                {action.disposition.toLowerCase().replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(plan.assumptions_summary ?? []).length > 0 ? (
        <div className="plan-assumptions">
          <span className="field-label">Assumptions</span>
          <ul>
            {(plan.assumptions_summary ?? []).map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="plan-policy">
        <span className="plan-policy-verdict">
          <Icon
            name={policyValid ? "check" : "cross"}
            size={ICON_SIZE.meta}
            strokeWidth={2.4}
          />
          Deterministic policy
          <b>
            {policyValid == null
              ? "not evaluated"
              : policyValid
                ? "valid"
                : "invalid"}
          </b>
        </span>
        <span className="plan-policy-detail">
          {violations.length} violation{violations.length === 1 ? "" : "s"} ·{" "}
          {blockingUnknowns.length} blocking unknown
          {blockingUnknowns.length === 1 ? "" : "s"}
        </span>
      </footer>

      {violations.length > 0 ? (
        <ul className="plan-violations">
          {violations.map((violation) => (
            <li key={violation.rule_id}>
              <b className="mono">{violation.rule_id}</b>
              {violation.message}
            </li>
          ))}
        </ul>
      ) : null}

      {plan.deterministic_rejection_reason ? (
        <p className="plan-rejection">{plan.deterministic_rejection_reason}</p>
      ) : null}
    </article>
  );
}

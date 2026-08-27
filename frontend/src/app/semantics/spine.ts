import type {
  RecoveryAttemptView,
  RecoveryCaseView,
  RecoveryStageView,
} from "../contract/uiContract";

export interface SpineStage {
  stage: RecoveryStageView;
  attemptNumber: number;
  /** True for the last stage in its attempt: the connector below it is suppressed. */
  isLast: boolean;
}

export interface SpineAttempt {
  attempt: RecoveryAttemptView;
  stages: SpineStage[];
  /**
   * The stage in the *previous* attempt this attempt branches from, resolved by
   * `branch_from_attempt`. Null for the first attempt, or when the referenced
   * attempt is absent from the payload.
   */
  branchFromStage: RecoveryStageView | null;
  branchFromAttemptNumber: number | null;
  branchReason: string | null;
}

export interface SpineModel {
  attempts: SpineAttempt[];
  /** Flat stage list in spine order, for keyboard traversal and lookups. */
  order: SpineStage[];
  byStageId: Map<string, SpineStage>;
}

/**
 * Arranges `attempts[].stages[]` into the shape the spine renders.
 *
 * The stage list, its order, its statuses, the branch link and the branch reason
 * are all backend values. This function does not invent stages, reorder them, or
 * decide what failed — it resolves `branch_from_attempt` to a concrete stage so
 * the connector has something to attach to.
 */
export function buildSpine(attempts: RecoveryAttemptView[]): SpineModel {
  const byNumber = new Map(
    attempts.map((attempt) => [attempt.attempt_number, attempt]),
  );
  const order: SpineStage[] = [];
  const byStageId = new Map<string, SpineStage>();

  const built = attempts.map((attempt) => {
    const stages = (attempt.stages ?? []).map((stage, index, all) => {
      const entry: SpineStage = {
        stage,
        attemptNumber: attempt.attempt_number,
        isLast: index === all.length - 1,
      };
      order.push(entry);
      byStageId.set(stage.stage_id, entry);
      return entry;
    });

    const parentNumber = attempt.branch_from_attempt ?? null;
    const parent =
      parentNumber == null ? undefined : byNumber.get(parentNumber);
    // The branch attaches to the parent's terminal stage — the one the branch
    // reason is about. `status` is read, never computed.
    const parentStages = parent?.stages ?? [];
    const branchFromStage =
      parentStages.find((stage) => stage.status === "FAILED") ??
      parentStages[parentStages.length - 1] ??
      null;

    return {
      attempt,
      stages,
      branchFromStage,
      branchFromAttemptNumber: parentNumber,
      branchReason: attempt.branch_reason ?? null,
    } satisfies SpineAttempt;
  });

  return { attempts: built, order, byStageId };
}

/**
 * The stage a fresh visit should land on: the one the backend marked CURRENT,
 * otherwise the last stage of the last attempt.
 *
 * Deliberately no preference for a FAILED stage. Opening a restored incident on
 * Recovery 01's old failure would tell a first-time reader the wrong thing about
 * where the incident ended up; the failure stays permanently visible in the spine
 * and is one click away.
 *
 * Selection, not interpretation — both branches read a supplied `status`.
 */
export function initialStageId(model: SpineModel): string | null {
  const current = model.order.find((entry) => entry.stage.status === "CURRENT");
  if (current) return current.stage.stage_id;
  return model.order.at(-1)?.stage.stage_id ?? null;
}

/** Resolves a stage id from the URL, falling back when it names nothing real. */
export function resolveStageId(
  model: SpineModel,
  requested: string | null,
): string | null {
  if (requested && model.byStageId.has(requested)) return requested;
  return initialStageId(model);
}

export const attemptFor = (
  recoveryCase: RecoveryCaseView,
  attemptNumber: number,
): RecoveryAttemptView | undefined =>
  recoveryCase.attempts.find(
    (attempt) => attempt.attempt_number === attemptNumber,
  );

/** The verification the backend recorded for one attempt, if it recorded one. */
export const verificationFor = (
  recoveryCase: RecoveryCaseView,
  attemptNumber: number,
) =>
  recoveryCase.verifications.find(
    (verification) => verification.recovery_attempt === attemptNumber,
  );

export const actionsFor = (
  recoveryCase: RecoveryCaseView,
  attemptNumber: number,
) =>
  recoveryCase.actions.filter(
    (action) => action.recovery_attempt === attemptNumber,
  );

export const plansFor = (
  recoveryCase: RecoveryCaseView,
  attemptNumber: number,
) =>
  recoveryCase.plans.filter((plan) => plan.recovery_attempt === attemptNumber);

export const evidenceFor = (
  recoveryCase: RecoveryCaseView,
  attemptNumber: number,
) =>
  recoveryCase.evidence.filter(
    (evidence) => evidence.recovery_attempt === attemptNumber,
  );

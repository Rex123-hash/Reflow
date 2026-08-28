import type { EvidenceView, RecoveryCaseView } from "../contract/uiContract";

/**
 * Exact-identifier evidence resolution.
 *
 * docs/ui-backend-contract.md § "Recovery spine and branching" states that stage,
 * action and invariant evidence references resolve to an `EvidenceView.evidence_id`.
 * P2B guarantees that every published reference resolves exactly once. This
 * module performs only the exact lookup; it never fuzzy-matches identifiers.
 */

export interface EvidenceResolution {
  /** Cards whose ids resolved exactly. */
  resolved: EvidenceView[];
  /** Ids the payload referenced that no `evidence[]` entry declares. */
  unresolvedIds: string[];
  /** True when the reference list was non-empty but nothing resolved. */
  allUnresolved: boolean;
}

export const buildEvidenceIndex = (
  evidence: EvidenceView[],
): Map<string, EvidenceView> =>
  new Map(evidence.map((item) => [item.evidence_id, item]));

export function resolveEvidenceIds(
  index: Map<string, EvidenceView>,
  ids: readonly string[],
): EvidenceResolution {
  const resolved: EvidenceView[] = [];
  const unresolvedIds: string[] = [];

  for (const id of ids) {
    const match = index.get(id);
    if (match) resolved.push(match);
    else unresolvedIds.push(id);
  }

  return {
    resolved,
    unresolvedIds,
    allUnresolved: ids.length > 0 && resolved.length === 0,
  };
}

export type RailScope =
  | { kind: "stage"; stageTitle: string; attemptLabel: string }
  | {
      kind: "attempt";
      attemptLabel: string;
      reason: "no-anchors";
    };

export interface RailContents extends EvidenceResolution {
  cards: EvidenceView[];
  scope: RailScope;
}

/**
 * What the Evidence Rail shows for the selected stage.
 *
 * When a stage anchors evidence that resolves, the rail is stage-scoped. When it
 * anchors nothing, the rail shows attempt evidence. Published anchors are exact
 * by contract and remain stage-scoped.
 */
export function railContentsForStage(
  recoveryCase: RecoveryCaseView,
  index: Map<string, EvidenceView>,
  stageIds: readonly string[],
  attemptNumber: number,
  stageTitle: string,
): RailContents {
  const attemptLabel = `Recovery ${String(attemptNumber).padStart(2, "0")}`;
  const resolution = resolveEvidenceIds(index, stageIds);

  if (stageIds.length > 0) {
    return {
      ...resolution,
      cards: resolution.resolved,
      scope: { kind: "stage", stageTitle, attemptLabel },
    };
  }

  const attemptEvidence = recoveryCase.evidence.filter(
    (item) => item.recovery_attempt === attemptNumber,
  );

  return {
    ...resolution,
    cards: attemptEvidence,
    scope: {
      kind: "attempt",
      attemptLabel,
      reason: "no-anchors",
    },
  };
}

/** Every evidence reference the payload makes, for the contract-gap report. */
export function collectEvidenceReferences(
  recoveryCase: RecoveryCaseView,
): string[] {
  const ids: string[] = [];
  for (const attempt of recoveryCase.attempts) {
    for (const stage of attempt.stages ?? []) {
      ids.push(...(stage.related_evidence_ids ?? []));
    }
  }
  for (const action of recoveryCase.actions) {
    if (action.evidence_id) ids.push(action.evidence_id);
  }
  for (const verification of recoveryCase.verifications) {
    for (const invariant of verification.invariants ?? []) {
      if (invariant.evidence_id) ids.push(invariant.evidence_id);
    }
  }
  return ids;
}

export function unresolvedReferenceReport(
  recoveryCase: RecoveryCaseView,
): string[] {
  const index = buildEvidenceIndex(recoveryCase.evidence);
  const seen = new Set<string>();
  const unresolved: string[] = [];
  for (const id of collectEvidenceReferences(recoveryCase)) {
    if (seen.has(id) || index.has(id)) continue;
    seen.add(id);
    unresolved.push(id);
  }
  return unresolved;
}

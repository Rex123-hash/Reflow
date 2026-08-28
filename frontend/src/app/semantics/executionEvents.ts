import type { ExecutionEventView } from "../contract/uiContract";

export type ConsoleMode = "activity" | "ledger";

export interface ActivityGroup {
  key: string;
  label: string;
  recoveryAttempt: number;
  phase: ExecutionEventView["phase"];
  events: ExecutionEventView[];
}

/**
 * ACTIVITY grouping.
 *
 * Activity groups by the backend-supplied recovery attempt and authoritative
 * `phase`. It does not infer a phase from `semantic_type`.
 */
export function groupActivity(events: ExecutionEventView[]): ActivityGroup[] {
  const groups = new Map<string, ExecutionEventView[]>();
  for (const event of events) {
    const key = `${event.recovery_attempt}:${event.phase}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(event);
    else groups.set(key, [event]);
  }

  return [...groups.entries()]
    .map(([key, bucket]) => ({
      key,
      recoveryAttempt: bucket[0].recovery_attempt,
      phase: bucket[0].phase,
      firstTimestamp: bucket[0].timestamp,
      events: [...bucket].sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp),
      ),
    }))
    .sort((a, b) => a.firstTimestamp.localeCompare(b.firstTimestamp))
    .map((group) => ({
      key: `attempt-${group.recoveryAttempt}-${group.phase}`,
      label: `Recovery ${String(group.recoveryAttempt).padStart(2, "0")} · ${group.phase}`,
      recoveryAttempt: group.recoveryAttempt,
      phase: group.phase,
      events: group.events,
    }));
}

/** DURABLE LEDGER: exact persisted order, untouched. */
export const ledgerOrder = (
  events: ExecutionEventView[],
): ExecutionEventView[] => [...events].sort((a, b) => a.sequence - b.sequence);

/**
 * A small, closed set of event families used only to pick a marker colour.
 *
 * This is presentation styling over a backend-supplied `semantic_type`, not a
 * verdict: no event's meaning changes, and nothing here decides whether anything
 * passed. Unrecognised types get the neutral marker.
 */
export type EventTone = "neutral" | "verified" | "failed" | "motion";

const TONE_BY_TYPE: Record<string, EventTone> = {
  OBJECTIVE_RESTORED: "verified",
  OBJECTIVE_VERIFICATION_FAILED: "failed",
  OBJECTIVE_VERIFICATION_STARTED: "motion",
  ACTION_RECEIPT_VERIFIED: "verified",
  RELEASE_VALIDATION_SUCCEEDED: "verified",
  RELEASE_VALIDATION_FAILED: "failed",
  FULL_RELEASE_PROMOTION_VERIFIED: "verified",
  FULL_RELEASE_PROMOTION_STARTED: "motion",
  INCIDENT_REOPENED: "motion",
  REPLAN_STARTED: "motion",
  PLANNING_FAILED: "failed",
  PLAN_SELECTED: "verified",
  RECOVERY_SELECTED: "verified",
  POLICY_EVALUATED: "neutral",
};

export const eventTone = (event: ExecutionEventView): EventTone =>
  TONE_BY_TYPE[event.semantic_type] ?? "neutral";

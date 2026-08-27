import type { ExecutionEventView } from "../contract/uiContract";

export type ConsoleMode = "activity" | "ledger";

export interface ActivityGroup {
  key: string;
  label: string;
  recoveryAttempt: number;
  events: ExecutionEventView[];
}

/**
 * ACTIVITY grouping.
 *
 * The only authoritative grouping key on `ExecutionEventView` today is
 * `recovery_attempt`. Grouping any finer — by detect/plan/act/verify phase —
 * would mean mapping `semantic_type` to a workflow phase in the client, which is
 * exactly the causal interpretation the truth boundary forbids.
 *
 * So Activity groups by attempt and orders by `timestamp`. That is honest, but it
 * does not fully repair causal readability: in the canonical export
 * `INCIDENT_REOPENED` (sequence 25) carries a later timestamp than
 * `REPLAN_STARTED` (sequence 18) within the same attempt. Resolving that needs an
 * authoritative phase field on the event (known gap 5). Until then the console
 * says plainly what each mode is showing rather than implying a causal chain.
 */
export function groupActivity(events: ExecutionEventView[]): ActivityGroup[] {
  const groups = new Map<number, ExecutionEventView[]>();
  for (const event of events) {
    const bucket = groups.get(event.recovery_attempt);
    if (bucket) bucket.push(event);
    else groups.set(event.recovery_attempt, [event]);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([recoveryAttempt, bucket]) => ({
      key: `attempt-${recoveryAttempt}`,
      label: `Recovery ${String(recoveryAttempt).padStart(2, "0")}`,
      recoveryAttempt,
      events: [...bucket].sort((a, b) =>
        a.timestamp.localeCompare(b.timestamp),
      ),
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

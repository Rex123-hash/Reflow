import { describe, expect, it } from "vitest";
import type { ExecutionEventsView } from "../contract/uiContract";
import events from "../data/fixtures/events.json";
import { groupActivity, ledgerOrder } from "./executionEvents";

const all = (events as unknown as ExecutionEventsView).events;

describe("execution console modes", () => {
  it("keeps every event in Activity — grouping never filters", () => {
    const groups = groupActivity(all);
    const total = groups.reduce((sum, group) => sum + group.events.length, 0);
    expect(total).toBe(all.length);
  });

  it("groups Activity by the authoritative recovery_attempt only", () => {
    const groups = groupActivity(all);
    expect(groups.map((g) => g.recoveryAttempt)).toEqual([1, 2]);
    for (const group of groups) {
      expect(
        group.events.every((e) => e.recovery_attempt === group.recoveryAttempt),
      ).toBe(true);
    }
  });

  it("orders the durable ledger by persisted sequence, untouched", () => {
    const ledger = ledgerOrder(all);
    const sequences = ledger.map((e) => e.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(ledger).toHaveLength(all.length);
  });

  it("does not repair persistence order into causal order", () => {
    // INCIDENT_REOPENED persists later than REPLAN_STARTED in the canonical export.
    // Activity sorts by timestamp and therefore still shows it after — which is why
    // the console labels what each mode is, instead of implying a causal chain.
    const attemptTwo = groupActivity(all).find((g) => g.recoveryAttempt === 2)!;
    const replan = attemptTwo.events.findIndex(
      (e) => e.semantic_type === "REPLAN_STARTED",
    );
    const reopened = attemptTwo.events.findIndex(
      (e) => e.semantic_type === "INCIDENT_REOPENED",
    );

    expect(replan).toBeGreaterThanOrEqual(0);
    expect(reopened).toBeGreaterThan(replan);
  });
});

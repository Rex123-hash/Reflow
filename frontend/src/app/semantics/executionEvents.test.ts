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

  it("groups Activity by authoritative recovery attempt and phase", () => {
    const groups = groupActivity(all);
    expect(new Set(groups.map((g) => g.recoveryAttempt))).toEqual(
      new Set([1, 2]),
    );
    for (const group of groups) {
      expect(
        group.events.every(
          (e) =>
            e.recovery_attempt === group.recoveryAttempt &&
            e.phase === group.phase,
        ),
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
    const attemptTwo = groupActivity(all)
      .filter((g) => g.recoveryAttempt === 2)
      .flatMap((group) => group.events);
    const replan = attemptTwo.findIndex(
      (e) => e.semantic_type === "REPLAN_STARTED",
    );
    const reopened = attemptTwo.findIndex(
      (e) => e.semantic_type === "INCIDENT_REOPENED",
    );

    expect(replan).toBeGreaterThanOrEqual(0);
    expect(reopened).toBeGreaterThan(replan);
  });
});

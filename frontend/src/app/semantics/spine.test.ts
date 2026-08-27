import { describe, expect, it } from "vitest";
import type { RecoveryCaseView } from "../contract/uiContract";
import active from "../data/fixtures/recovery-active.json";
import restored from "../data/fixtures/recovery-restored.json";
import { buildSpine, initialStageId, resolveStageId } from "./spine";

const activeCase = active as unknown as RecoveryCaseView;
const restoredCase = restored as unknown as RecoveryCaseView;

describe("spine is built from the payload, not from a constant", () => {
  it("renders exactly the stages the backend supplied, in order", () => {
    const model = buildSpine(activeCase.attempts);

    expect(model.attempts.map((a) => a.attempt.label)).toEqual([
      "Recovery 01",
      "Recovery 02",
    ]);
    expect(model.attempts[0].stages.map((s) => s.stage.semantic_kind)).toEqual([
      "DETECT",
      "IMPACT",
      "PLAN",
      "ACT",
      "VERIFY",
    ]);
    // Recovery 02 has its own PLAN stage after REPLAN. A hard-coded four-stage
    // second attempt would silently drop it.
    expect(model.attempts[1].stages.map((s) => s.stage.semantic_kind)).toEqual([
      "REPLAN",
      "PLAN",
      "ACT",
      "VERIFY",
      "RESTORED",
    ]);
  });

  it("attaches the branch to the failed stage of the referenced attempt", () => {
    const model = buildSpine(activeCase.attempts);
    const second = model.attempts[1];

    expect(second.branchFromAttemptNumber).toBe(1);
    expect(second.branchFromStage?.stage_id).toBe("recovery-1-verify");
    expect(second.branchFromStage?.status).toBe("FAILED");
    expect(second.branchReason).toContain("release-validation-green");
  });

  it("marks only the final stage of each attempt as last", () => {
    const model = buildSpine(activeCase.attempts);
    for (const attempt of model.attempts) {
      const flags = attempt.stages.map((s) => s.isLast);
      expect(flags.slice(0, -1).every((f) => f === false)).toBe(true);
      expect(flags.at(-1)).toBe(true);
    }
  });

  it("supports a third attempt without code changes", () => {
    const third = {
      ...activeCase.attempts[1],
      attempt_number: 3,
      label: "Recovery 03",
      branch_from_attempt: 2,
      branch_reason: "hypothetical",
      stages: [
        { ...activeCase.attempts[1].stages![0], stage_id: "recovery-3-replan" },
      ],
    };
    const model = buildSpine([...activeCase.attempts, third]);

    expect(model.attempts).toHaveLength(3);
    expect(model.attempts[2].branchFromAttemptNumber).toBe(2);
    expect(model.byStageId.has("recovery-3-replan")).toBe(true);
  });
});

describe("initial stage selection", () => {
  it("lands on the CURRENT stage while a recovery is running", () => {
    expect(initialStageId(buildSpine(activeCase.attempts))).toBe(
      "recovery-2-verify",
    );
  });

  it("lands on the final stage once the incident is terminal", () => {
    expect(initialStageId(buildSpine(restoredCase.attempts))).toBe(
      "recovery-2-restored",
    );
  });

  it("ignores a stage id in the URL that names nothing real", () => {
    const model = buildSpine(activeCase.attempts);
    expect(resolveStageId(model, "recovery-9-nonsense")).toBe(
      "recovery-2-verify",
    );
    expect(resolveStageId(model, "recovery-1-act")).toBe("recovery-1-act");
  });
});

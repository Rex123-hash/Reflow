import { describe, expect, it } from "vitest";
import type { RecoveryCaseView } from "../contract/uiContract";
import active from "../data/fixtures/recovery-active.json";
import { matchIntent } from "./intents";

const fixture = active as unknown as RecoveryCaseView;
const context = {
  incidentId: "incident-0fc3af5b0bd1ad847aea",
  attempts: fixture.attempts,
};

describe("operator INSPECT resolves deterministically", () => {
  it("focuses the failed verification for a why-did-it-fail question", () => {
    const match = matchIntent("Why did Recovery 1 fail?", context)!;
    expect(match.intent).toBe("why-attempt-failed");
    expect(match.href).toContain("stage=recovery-1-verify");
    expect(match.href).toContain("lens=verify");
  });

  it("is stable across phrasings of the same intent", () => {
    const a = matchIntent("why did recovery #1 fail", context)!;
    const b = matchIntent("Why was the first recovery insufficient?", context)!;
    expect(a.href).toBe(b.href);
  });

  it("focuses the branch reason for why-does-it-exist", () => {
    const match = matchIntent("Why does Recovery 2 exist?", context)!;
    expect(match.intent).toBe("why-attempt-exists");
    expect(match.href).toContain("stage=recovery-2-replan");
    expect(match.href).toContain("lens=summary");
  });

  it("routes blast radius to the World lens", () => {
    const match = matchIntent("Show the blast radius", context)!;
    expect(match.intent).toBe("blast-radius");
    expect(match.href).toContain("lens=world");
  });

  it("routes proof to the Evidence page", () => {
    const match = matchIntent("Show the proof", context)!;
    expect(match.href).toBe("/app/evidence/incident-0fc3af5b0bd1ad847aea");
  });

  it("focuses the CURRENT stage for what-is-happening-now", () => {
    const match = matchIntent("What is happening now?", context)!;
    expect(match.href).toContain("stage=recovery-2-verify");
  });

  it("returns null rather than guessing at an unsupported question", () => {
    expect(matchIntent("who is the backend lead", context)).toBeNull();
    expect(
      matchIntent("reassign the migration to someone else", context),
    ).toBeNull();
    expect(matchIntent("", context)).toBeNull();
  });

  it("reports unavailability instead of inventing a target", () => {
    const noFailures = {
      incidentId: "incident-x",
      attempts: [
        {
          attempt_number: 1,
          label: "Recovery 01",
          status: "COMPLETED" as const,
          stages: [
            {
              stage_id: "s1",
              semantic_kind: "DETECT" as const,
              title: "Detect",
              subtitle: "",
              status: "COMPLETED" as const,
              related_evidence_ids: [],
            },
          ],
        },
      ],
    };
    const match = matchIntent("why did it fail", noFailures)!;
    expect(match.unavailableReason).toBeTruthy();
  });
});

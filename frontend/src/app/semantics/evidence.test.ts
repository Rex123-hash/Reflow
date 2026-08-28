import { describe, expect, it } from "vitest";
import type { EvidenceView, RecoveryCaseView } from "../contract/uiContract";
import active from "../data/fixtures/recovery-active.json";
import {
  buildEvidenceIndex,
  railContentsForStage,
  resolveEvidenceIds,
  unresolvedReferenceReport,
} from "./evidence";

const fixture = active as unknown as RecoveryCaseView;

const evidence = (id: string, attempt = 1): EvidenceView => ({
  evidence_id: id,
  recovery_attempt: attempt,
  source_system: "github_actions",
  source_label: "GitHub Actions",
  evidence_kind: "workflow_run_read_back",
  title: `Card ${id}`,
  semantic_status: "VERIFIED_HEALTHY",
  summary: "summary",
  proof_fields: {},
});

describe("exact-identifier evidence resolution", () => {
  it("resolves only ids that match exactly", () => {
    const index = buildEvidenceIndex([evidence("github-run:33074677098")]);
    const result = resolveEvidenceIds(index, ["github-run:33074677098"]);

    expect(result.resolved).toHaveLength(1);
    expect(result.unresolvedIds).toEqual([]);
  });

  it("never fuzzy-matches a receipt-scoped id onto a resource-scoped card", () => {
    // Even malformed input must never cause a fuzzy join.
    const index = buildEvidenceIndex([evidence("github-run:33074677098")]);
    const result = resolveEvidenceIds(index, [
      "github-validation:github-cd0a32978a645e079242e5af068b547409f426ec25fadd4b437751902f63b671",
    ]);

    expect(result.resolved).toEqual([]);
    expect(result.unresolvedIds).toHaveLength(1);
    expect(result.allUnresolved).toBe(true);
  });

  it("confirms every canonical evidence reference resolves", () => {
    const unresolved = unresolvedReferenceReport(fixture);
    expect(unresolved).toEqual([]);
  });
});

describe("evidence rail scoping", () => {
  const index = buildEvidenceIndex(fixture.evidence);

  it("scopes to the stage when its references resolve", () => {
    const calendarId = fixture.evidence.find((item) =>
      item.evidence_id.startsWith("calendar:"),
    )!.evidence_id;

    const contents = railContentsForStage(
      fixture,
      index,
      [calendarId],
      1,
      "Act",
    );

    expect(contents.scope.kind).toBe("stage");
    expect(contents.cards.map((c) => c.evidence_id)).toEqual([calendarId]);
  });

  it("falls back to the attempt and says why when a stage anchors nothing", () => {
    const contents = railContentsForStage(fixture, index, [], 1, "Detect");

    expect(contents.scope).toEqual({
      kind: "attempt",
      attemptLabel: "Recovery 01",
      reason: "no-anchors",
    });
    expect(contents.cards.every((card) => card.recovery_attempt === 1)).toBe(
      true,
    );
  });

  it("does not fall back or guess when malformed input has an unresolved anchor", () => {
    const contents = railContentsForStage(
      fixture,
      index,
      ["github-validation:does-not-exist"],
      2,
      "Act",
    );

    expect(contents.scope).toEqual({
      kind: "stage",
      attemptLabel: "Recovery 02",
      stageTitle: "Act",
    });
    expect(contents.cards).toEqual([]);
    expect(contents.unresolvedIds).toEqual([
      "github-validation:does-not-exist",
    ]);
  });
});

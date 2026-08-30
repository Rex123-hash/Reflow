import { describe, expect, it } from "vitest";
import { mergeTranscriptFragment } from "./transcriptFragments";

describe("mergeTranscriptFragment", () => {
  it("replaces cumulative prefix hypotheses", () => {
    let value = "";
    value = mergeTranscriptFragment(value, "create a calendar");
    value = mergeTranscriptFragment(value, "create a calendar event");
    value = mergeTranscriptFragment(value, "create a calendar event tomorrow");
    expect(value).toBe("create a calendar event tomorrow");
  });

  it("merges append-only fragments and exact overlap", () => {
    let value = mergeTranscriptFragment("create a calendar", "event tomorrow");
    value = mergeTranscriptFragment(value, "tomorrow at five");
    expect(value).toBe("create a calendar event tomorrow at five");
  });

  it("does not repeat identical or regressed fragments", () => {
    expect(mergeTranscriptFragment("ends at 6 PM", "ends at 6 PM")).toBe(
      "ends at 6 PM",
    );
    expect(mergeTranscriptFragment("ends at 6 PM", "ends at 6")).toBe(
      "ends at 6 PM",
    );
  });
});

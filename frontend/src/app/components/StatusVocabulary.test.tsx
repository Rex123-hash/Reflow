import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StageChip } from "./StatusVocabulary";

afterEach(cleanup);

describe("completed verification vocabulary", () => {
  it("renders a persisted failed verification as a completed failure", () => {
    render(
      <StageChip stage="VERIFY" attemptNumber={2} health="NEEDS_ATTENTION" />,
    );
    const chip = screen.getByText("Verification failed").closest(".stage-chip");
    expect(chip).toHaveClass("is-failed");
    expect(chip).toHaveTextContent("Recovery 02 · Verification failed");
    expect(screen.getByText("Recovery 02 ·")).toHaveClass("stage-chip-attempt");
  });

  it("keeps active verification in motion", () => {
    render(<StageChip stage="VERIFY" attemptNumber={2} health="RECOVERING" />);
    const chip = screen.getByText("Verify").closest(".stage-chip");
    expect(chip).toHaveClass("is-current");
    expect(chip).toHaveTextContent("Recovery 02 · Verify");
  });
});

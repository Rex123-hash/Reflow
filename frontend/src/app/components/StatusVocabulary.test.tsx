import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StageChip } from "./StatusVocabulary";

afterEach(cleanup);

describe("completed verification vocabulary", () => {
  it("renders a persisted failed verification as a completed failure", () => {
    render(
      <StageChip stage="VERIFY" attemptNumber={2} health="NEEDS_ATTENTION" />,
    );
    expect(screen.getByText("Recovery 02 · Verification failed")).toHaveClass(
      "is-failed",
    );
  });

  it("keeps active verification in motion", () => {
    render(<StageChip stage="VERIFY" attemptNumber={2} health="RECOVERING" />);
    expect(screen.getByText("Recovery 02 · Verify")).toHaveClass("is-current");
  });
});

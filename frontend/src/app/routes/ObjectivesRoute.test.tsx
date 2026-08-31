import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { UiDataProviderRoot } from "../data/UiDataContext";
import { FixtureUiDataProvider } from "../data/FixtureUiDataProvider";
import { ObjectivesRoute } from "./ObjectivesRoute";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Objectives route positioning", () => {
  it("starts at the document top so the sticky navigation cannot cover its heading", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    render(
      <UiDataProviderRoot provider={new FixtureUiDataProvider("restored")}>
        <MemoryRouter>
          <ObjectivesRoute />
        </MemoryRouter>
      </UiDataProviderRoot>,
    );

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    frames.shift()?.(0);
    frames.shift()?.(16);
    expect(scrollTo).toHaveBeenCalledTimes(3);
    expect(
      screen.getByRole("heading", { name: "Outcomes Reflow is protecting" }),
    ).toBeVisible();
  });
});

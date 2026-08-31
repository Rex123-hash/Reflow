import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./SiteHeader";
import { WorkspaceActions } from "./WorkspaceActions";

describe("landing workspace actions", () => {
  it("restores the single live-workspace action at the bottom", () => {
    render(
      <MemoryRouter>
        <WorkspaceActions className="hero-actions" />
      </MemoryRouter>,
    );

    const liveWorkspace = screen.getByRole("link", {
      name: /open live workspace/i,
    });
    expect(liveWorkspace).toHaveAttribute("href", "/app/overview?access=live");
    expect(liveWorkspace).toHaveClass("button-primary");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("keeps the demo and live actions in the top-right header", () => {
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /live demo/i })).toHaveAttribute(
      "href",
      "/app?demo=1",
    );
    expect(
      screen.getByRole("link", { name: /open workspace/i }),
    ).toHaveAttribute("href", "/app/overview?access=live");
  });
});

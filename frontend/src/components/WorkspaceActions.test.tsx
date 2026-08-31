import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./SiteHeader";
import { WorkspaceActions } from "./WorkspaceActions";

describe("landing workspace actions", () => {
  it("offers an explicit demo and a non-OAuth workspace route", () => {
    render(
      <MemoryRouter>
        <WorkspaceActions className="hero-actions" />
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

  it("routes the header workspace action through the same chooser", () => {
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: /open workspace/i }),
    ).toHaveAttribute("href", "/app/overview?access=live");
  });
});

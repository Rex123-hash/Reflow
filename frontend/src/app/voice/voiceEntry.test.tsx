import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { VoiceDock } from "./VoiceDock";
import { VoiceLaunchProvider } from "./VoiceLaunch";
import { VoiceLaunchBar } from "./VoiceLaunchBar";

/**
 * Discoverability, pinned.
 *
 * The live call is one of the strongest things Reflow does and it used to be a chip
 * the size of an example prompt. These hold the hierarchy that fixes that: the
 * capability is named in words on Operator, it is reachable from every other
 * authenticated route, and it never appears twice on one page.
 */

vi.mock("../data/useIncidentChoices", () => ({
  useIncidentChoices: vi.fn(),
}));
const { useIncidentChoices } = await import("../data/useIncidentChoices");
const choices = vi.mocked(useIncidentChoices);

function ready(incidentId: string | null = "incident-0fc3af5b0bd1ad847aea") {
  choices.mockReturnValue({
    status: "ready",
    priority: incidentId
      ? ({
          incident_id: incidentId,
          objective_id: "release-v2",
          objective_title: "Ship Release V2",
        } as never)
      : null,
    choices: [],
  });
}

/** Stands in for Operator, so the dock's destination can be asserted exactly. */
function Landed() {
  const location = useLocation();
  return <p data-testid="landed">{location.pathname + location.search}</p>;
}

function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <VoiceLaunchProvider>
        <Routes>
          <Route path="/app/*" element={<VoiceDock />} />
        </Routes>
      </VoiceLaunchProvider>
    </MemoryRouter>,
  );
}

describe("the Operator hero", () => {
  it("names the capability rather than labelling a chip", () => {
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <VoiceLaunchBar
            incidentId="incident-0fc3af5b0bd1ad847aea"
            objectiveTitle="Ship Release V2"
            disabled={false}
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    const launch = screen.getByRole("button", { name: /Talk to Reflow/ });
    // The words a first-time reader needs: what it is, and that it is voice.
    expect(launch).toHaveTextContent("Talk to Reflow");
    expect(launch).toHaveTextContent(/live voice conversation/i);
    expect(launch).toHaveTextContent("Live");
  });

  it("opens the call, and the call replaces the page rather than stacking on it", async () => {
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <VoiceLaunchBar
            incidentId="incident-0fc3af5b0bd1ad847aea"
            objectiveTitle="Ship Release V2"
            disabled={false}
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Talk to Reflow/ }),
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Reflow live call");
  });

  it("is closed while the workspace is read-only or Operator is busy", () => {
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <VoiceLaunchBar
            incidentId="incident-0fc3af5b0bd1ad847aea"
            objectiveTitle="Ship Release V2"
            disabled
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: /Talk to Reflow/ }),
    ).toBeDisabled();
  });
});

describe("the dock", () => {
  it("puts Reflow one control away on every other authenticated route", async () => {
    ready();
    at("/app/overview");
    const handle = screen.getByRole("button", { name: "Talk to Reflow" });
    expect(handle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(handle);
    const menu = screen.getByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    // The live call leads; the ordinary ways to reach Reflow follow.
    expect(items[0]).toHaveTextContent("Talk to Reflow");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Talk to Reflow"),
      "Ask Reflow",
      "Show Reflow",
      "Dictate a request",
      "How Reflow works",
    ]);
  });

  it("offers Show Reflow beside Ask, as one named family rather than a tool", async () => {
    ready();
    at("/app/overview");
    await userEvent.click(
      screen.getByRole("button", { name: "Talk to Reflow" }),
    );
    const menu = screen.getByRole("menu");
    // Type, talk and show are grouped and labelled together, so the newest of the
    // three reads as a capability and not as an attachment affordance.
    const group = within(menu).getByRole("group", {
      name: "Type it. Say it. Show it.",
    });
    expect(
      within(group)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Ask Reflow", "Show Reflow", "Dictate a request"]);
  });

  it("takes Show Reflow to the Operator console with the image control asked for", async () => {
    ready();
    render(
      <MemoryRouter initialEntries={["/app/overview"]}>
        <VoiceLaunchProvider>
          <Routes>
            <Route path="/app/overview" element={<VoiceDock />} />
            <Route path="/app/operator" element={<Landed />} />
          </Routes>
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Talk to Reflow" }),
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Show Reflow" }),
    );
    expect(screen.getByTestId("landed")).toHaveTextContent("?show=image");
  });

  it("does not appear on Operator, which carries its own launch control", () => {
    ready();
    at("/app/operator");
    expect(
      screen.queryByRole("button", { name: "Talk to Reflow" }),
    ).not.toBeInTheDocument();
  });

  it("disappears while a call is running rather than offering a second one", async () => {
    ready();
    at("/app/overview");
    await userEvent.click(
      screen.getByRole("button", { name: "Talk to Reflow" }),
    );
    await userEvent.click(
      within(screen.getByRole("menu")).getAllByRole("menuitem")[0],
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Talk to Reflow" }),
    ).not.toBeInTheDocument();
  });

  it("sends the reader to Operator when no incident is resolved yet", async () => {
    ready(null);
    at("/app/overview");
    await userEvent.click(
      screen.getByRole("button", { name: "Talk to Reflow" }),
    );
    await userEvent.click(
      within(screen.getByRole("menu")).getAllByRole("menuitem")[0],
    );
    // Nothing to talk about yet, so it does not invent an incident or open a call.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    ready();
    at("/app/overview");
    await userEvent.click(
      screen.getByRole("button", { name: "Talk to Reflow" }),
    );
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

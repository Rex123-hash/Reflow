import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { UiDataProviderRoot } from "../data/UiDataContext";
import {
  FixtureUiDataProvider,
  CANONICAL_INCIDENT_ID,
} from "../data/FixtureUiDataProvider";
import { RecoveryRoute } from "../routes/RecoveryRoute";

function renderRoom(search = "") {
  return render(
    <UiDataProviderRoot provider={new FixtureUiDataProvider("active")}>
      <MemoryRouter
        initialEntries={[`/app/recovery/${CANONICAL_INCIDENT_ID}${search}`]}
      >
        <Routes>
          <Route path="/app/recovery/:incidentId" element={<RecoveryRoute />} />
        </Routes>
      </MemoryRouter>
    </UiDataProviderRoot>,
  );
}

describe("Recovery Room", () => {
  it("renders both attempts and keeps the failed one visible", async () => {
    renderRoom();

    expect(
      await screen.findByRole("heading", { name: "Recovery 01" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recovery 02" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("shows the branch reason inline on the spine", async () => {
    renderRoom();

    expect(
      await screen.findByText(
        /Recovery 01 was action-verified, but release-validation-green was false/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Branched from Recovery 01/)).toBeInTheDocument();
  });

  it("opens on the stage the backend marked CURRENT", async () => {
    renderRoom();

    const current = await screen.findByRole("button", { current: "step" });
    expect(within(current).getByText("Verify")).toBeInTheDocument();
  });

  it("puts a verified receipt and a failed objective on screen together", async () => {
    renderRoom("?stage=recovery-1-verify&lens=verify");

    const frame = await screen.findByRole("region", {
      name: /verified action, failed objective/i,
    });

    // The receipt landed and can be proven to have landed...
    expect(
      within(frame).getAllByText("Receipt verified").length,
    ).toBeGreaterThan(0);
    // ...and the objective it served is still false.
    expect(
      within(frame).getByText(/release-validation-green = true/),
    ).toBeInTheDocument();
    expect(
      within(frame).getByText(/release-validation-green = false/),
    ).toBeInTheDocument();
    expect(within(frame).getAllByText("Failed").length).toBeGreaterThan(0);
  });

  it("links the failed invariant to the external authority that observed it", async () => {
    renderRoom("?stage=recovery-1-verify&lens=verify");

    const links = await screen.findAllByRole("link", {
      name: /github\.com\/Rex123-hash\/EXperiments\/actions\/runs\/33106938744/,
    });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute(
        "href",
        "https://github.com/Rex123-hash/EXperiments/actions/runs/33106938744",
      );
    }
  });

  it("selecting a stage changes the lens and the workspace", async () => {
    const user = userEvent.setup();
    renderRoom();

    const actStage = (await screen.findAllByRole("button", { name: /Act/ }))[0];
    await user.click(actStage);

    expect(
      (await screen.findAllByText(/external action/i)).length,
    ).toBeGreaterThan(0);
  });

  it("does not claim a live read for a recorded presentation", async () => {
    renderRoom();

    expect(
      await screen.findByText(/Demo workspace · Safe mode/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Live$/)).not.toBeInTheDocument();
  });

  it("renders authoritative remaining time and pending invariant set", async () => {
    renderRoom();

    expect(await screen.findByText(/^21h 51m$/)).toBeInTheDocument();
    expect(screen.queryByText("Not supplied")).not.toBeInTheDocument();
  });
});

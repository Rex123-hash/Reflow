import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CalendarProof, ExternalReality } from "./ExternalReality";
import { UiDataProviderRoot } from "../data/UiDataContext";
import {
  FixtureUiDataProvider,
  CANONICAL_INCIDENT_ID,
} from "../data/FixtureUiDataProvider";
import { ApiUiDataProvider } from "../data/ApiUiDataProvider";
import { RecoveryRoute } from "../routes/RecoveryRoute";
import { OverviewRoute } from "../routes/OverviewRoute";
import type { ExternalResourceView } from "../contract/uiContract";
import proof from "../data/fixtures/external-reality.json";

afterEach(cleanup);
const resource = proof.resources[0] as ExternalResourceView;

describe("Calendar external reality", () => {
  it("shows exact expected, observed, acknowledgement and receipt without inventing fields", () => {
    render(
      <MemoryRouter>
        <CalendarProof
          resource={resource}
          incidentId={CANONICAL_INCIDENT_ID}
          objectiveStatus="FAILED"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Intended change")).toBeInTheDocument();
    expect(
      screen.getByText("Google Calendar API acknowledged"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Original independent read-back"),
    ).toBeInTheDocument();
    expect(screen.getByText("Historical action receipt")).toBeInTheDocument();
    expect(screen.getByText("27 Aug · 19:07:44 UTC")).toBeInTheDocument();
    expect(screen.getByText("27 Aug · 19:07:45 UTC")).toBeInTheDocument();
    expect(screen.getAllByText("28 Aug · 13:00:00 UTC").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByText(/Selected recovery objective verification: Failed/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open exact Calendar evidence" }),
    ).toHaveAttribute(
      "href",
      `/app/evidence/${CANONICAL_INCIDENT_ID}?evidence=${encodeURIComponent(resource.evidence_id)}`,
    );
    expect(
      screen.queryByText(/attendees|assignees|owner/i),
    ).not.toBeInTheDocument();
  });

  it("Overview adds a compact Calendar summary and preserves the restored margin", async () => {
    render(
      <UiDataProviderRoot provider={new FixtureUiDataProvider("restored")}>
        <MemoryRouter>
          <OverviewRoute />
        </MemoryRouter>
      </UiDataProviderRoot>,
    );
    expect(
      await screen.findByText("Restored 21h 51m before deadline"),
    ).toBeInTheDocument();
    const card = await screen.findByRole("article", {
      name: "Google Calendar external reality",
    });
    expect(
      within(card).getByText("No current Calendar lookup"),
    ).toBeInTheDocument();
    expect(within(card).queryByText("Intended change")).not.toBeInTheDocument();
  });

  it("Recovery 01 keeps verified Calendar proof beside failed objective verification", async () => {
    render(
      <UiDataProviderRoot provider={new FixtureUiDataProvider("restored")}>
        <MemoryRouter
          initialEntries={[
            `/app/recovery/${CANONICAL_INCIDENT_ID}?stage=recovery-1-verify&lens=verify`,
          ]}
        >
          <Routes>
            <Route
              path="/app/recovery/:incidentId"
              element={<RecoveryRoute />}
            />
          </Routes>
        </MemoryRouter>
      </UiDataProviderRoot>,
    );
    expect(
      await screen.findByText(
        /Selected recovery objective verification: Failed/,
      ),
    ).toBeInTheDocument();
    const card = screen.getByRole("article", {
      name: "Google Calendar external reality",
    });
    expect(
      within(card).getByText("Verified", { exact: true }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/release-validation-green = false/).length,
    ).toBeGreaterThan(0);
  });

  it.each(["TIMEOUT", "NOT_FOUND", "UNAVAILABLE"] as const)(
    "does not relabel historical proof as fresh after %s",
    (fresh_read_status) => {
      render(
        <MemoryRouter>
          <CalendarProof
            resource={{ ...resource, fresh_read_status }}
            incidentId={CANONICAL_INCIDENT_ID}
          />
        </MemoryRouter>,
      );
      expect(screen.getByText(/Historical proof below/)).toBeInTheDocument();
      expect(
        screen.getByText("Persisted comparison: Passed"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Fresh independent read-back"),
      ).not.toBeInTheDocument();
    },
  );

  it("uses authenticated same-origin GET and renders the backend current verdict", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ...proof,
            resources: [
              {
                ...resource,
                fresh_read_status: "READ_BACK",
                latest_readback: {
                  ...resource.latest_readback,
                  source_freshness: "FRESH_READ",
                  verification_status: "FAILED",
                },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    const provider = new ApiUiDataProvider({ mode: "live", fetcher });
    render(
      <UiDataProviderRoot provider={provider}>
        <MemoryRouter>
          <ExternalReality incidentId={CANONICAL_INCIDENT_ID} />
        </MemoryRouter>
      </UiDataProviderRoot>,
    );
    expect(
      await screen.findByText("Current comparison: Failed"),
    ).toBeInTheDocument();
    expect(screen.getByText("Verified", { exact: true })).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      `/api/v1/ui/recoveries/${CANONICAL_INCIDENT_ID}/external-reality`,
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("handles missing authority without breaking the recovery surface", async () => {
    const provider = new FixtureUiDataProvider("restored");
    vi.spyOn(provider, "getExternalReality").mockRejectedValue(
      new Error("Unavailable"),
    );
    render(
      <UiDataProviderRoot provider={provider}>
        <MemoryRouter>
          <ExternalReality incidentId={CANONICAL_INCIDENT_ID} />
        </MemoryRouter>
      </UiDataProviderRoot>,
    );
    expect(
      await screen.findByText(
        "Calendar evidence unavailable. Recovery history is unchanged.",
      ),
    ).toBeInTheDocument();
  });
});

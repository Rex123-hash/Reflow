import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { execFileSync } from "node:child_process";
import { CalendarMiniTimeline } from "./CalendarMiniTimeline";
import { ExternalReality } from "./ExternalReality";
import { UiDataProviderRoot } from "../data/UiDataContext";
import { ApiUiDataProvider } from "../data/ApiUiDataProvider";
import type { ExternalResourceView } from "../contract/uiContract";
import proof from "../data/fixtures/external-reality.json";
import {
  calendarAxis,
  calendarInterval,
  calendarPosition,
  calendarDuration,
} from "../semantics/calendarTimeline";

afterEach(cleanup);
const recorded = proof.resources[0] as ExternalResourceView;
const live: ExternalResourceView = {
  ...recorded,
  fresh_read_status: "READ_BACK",
  latest_readback: {
    ...recorded.latest_readback!,
    source_freshness: "FRESH_READ",
  },
};
const show = (resource = live) =>
  render(
    <MemoryRouter>
      <CalendarMiniTimeline
        resource={resource}
        incidentId={proof.incident_id}
      />
    </MemoryRouter>,
  );

describe("Calendar Overview timeline", () => {
  it("derives canonical position and one-hour duration from real timestamps", () => {
    const interval = calendarInterval(live.expected)!;
    const axis = calendarAxis([interval]);
    expect(new Date(axis.start).toISOString()).toBe("2026-08-28T12:00:00.000Z");
    expect(new Date(axis.end).toISOString()).toBe("2026-08-28T15:00:00.000Z");
    expect(calendarPosition(interval, axis).top).toBeCloseTo(100 / 3);
    expect(calendarPosition(interval, axis).height).toBeCloseTo(100 / 3);
    expect(calendarDuration(interval)).toBe("1h");
    show();
    const event = screen.getByRole("img", { name: /^Observed:/ });
    expect(event.style.top).toBe("33.33333333333333%");
    expect(event.style.height).toBe("33.33333333333333%");
    expect(screen.getByText("Confirmed", { exact: true })).toBeInTheDocument();
    expect(
      screen.getByText("Fri, 28 Aug 2026", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Today/i)).not.toBeInTheDocument();
  });

  it("changes visual span when authoritative duration changes", () => {
    const state = { ...live.expected, end: "2026-08-28T15:00:00Z" };
    show({
      ...live,
      expected: state,
      latest_readback: { ...live.latest_readback!, state },
    });
    const event = screen.getByRole("img", { name: /^Observed:/ });
    expect(event.style.top).toBe("25%");
    expect(event.style.height).toBe("50%");
    expect(event).toHaveAccessibleName(/2h/);
  });

  it("uses noncanonical dates, timezone offsets and short durations", () => {
    const state = {
      start: "2026-09-03T14:30:00+05:30",
      end: "2026-09-03T15:00:00+05:30",
      status: "tentative" as const,
    };
    show({
      ...live,
      expected: state,
      latest_readback: { ...live.latest_readback!, state },
    });
    expect(
      screen.getByRole("img", { name: /^Observed:/ }),
    ).toHaveAccessibleName(
      /3 Sept? · 09:00:00 UTC to 3 Sept? · 09:30:00 UTC. 30m. tentative/,
    );
    expect(screen.getByText("Tentative", { exact: true })).toBeInTheDocument();
    expect(
      screen.queryByText("Confirmed", { exact: true }),
    ).not.toBeInTheDocument();
  });

  it("draws mismatched expected and observed positions separately and keeps the backend failure", () => {
    show({
      ...live,
      latest_readback: {
        ...live.latest_readback!,
        verification_status: "FAILED",
        state: {
          ...live.expected,
          start: "2026-08-28T13:30:00Z",
          end: "2026-08-28T14:30:00Z",
        },
      },
    });
    const expected = screen.getByRole("img", { name: /^Expected:/ });
    const observed = screen.getByRole("img", { name: /^Observed:/ });
    expect(expected).toHaveClass("is-expected");
    expect(observed).toHaveClass("is-observed");
    expect(expected.style.top).not.toBe(observed.style.top);
    expect(
      screen.getByText(/Fresh independent read-back · Failed/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/✓|· Passed/)).not.toBeInTheDocument();
  });

  it("does not turn equal visible timestamps into a passed backend comparison", () => {
    show({
      ...live,
      latest_readback: {
        ...live.latest_readback!,
        verification_status: "FAILED",
      },
    });
    expect(screen.getByRole("img", { name: /^Expected:/ })).toBeInTheDocument();
    expect(screen.getByText(/read-back · Failed/)).toBeInTheDocument();
  });

  it("keeps status-only mismatches distinct", () => {
    show({
      ...live,
      latest_readback: {
        ...live.latest_readback!,
        verification_status: "FAILED",
        state: { ...live.expected, status: "cancelled" },
      },
    });
    expect(
      screen.getByRole("img", { name: /^Expected:/ }),
    ).toHaveAccessibleName(/confirmed/);
    expect(
      screen.getByRole("img", { name: /^Observed:/ }),
    ).toHaveAccessibleName(/cancelled/);
    expect(screen.getByText("Cancelled", { exact: true })).toBeInTheDocument();
  });

  it("keeps a far-away change bounded with two explicitly dated rails", () => {
    show({
      ...live,
      latest_readback: {
        ...live.latest_readback!,
        verification_status: "FAILED",
        state: {
          ...live.expected,
          start: "2026-09-03T09:00:00Z",
          end: "2026-09-03T10:00:00Z",
        },
      },
    });
    expect(
      screen.getAllByLabelText("Commitment time axis in UTC"),
    ).toHaveLength(2);
    expect(
      screen.getByRole("img", { name: /^Observed:/ }),
    ).toHaveAccessibleName(/3 Sep/);
  });

  it("labels a cross-midnight event with its end date as well", () => {
    const state = {
      ...live.expected,
      start: "2026-08-28T23:30:00Z",
      end: "2026-08-29T00:30:00Z",
    };
    show({
      ...live,
      expected: state,
      latest_readback: { ...live.latest_readback!, state },
    });
    expect(screen.getByText(/Ends Sat, 29 Aug 2026/)).toBeInTheDocument();
  });

  it("renders guest proof as recorded, never Live or fresh", () => {
    show(recorded);
    expect(screen.getByText(/Recorded proof/)).toBeInTheDocument();
    expect(screen.getByText("No current Calendar lookup")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /^Recorded:/ })).toBeInTheDocument();
    expect(
      screen.queryByText(/Fresh|Last checked|Live/),
    ).not.toBeInTheDocument();
  });

  it.each(["NOT_FOUND", "TIMEOUT", "UNAVAILABLE"] as const)(
    "does not draw historical state as a current event after %s",
    (fresh_read_status) => {
      show({ ...recorded, fresh_read_status });
      expect(
        screen.queryByLabelText("Commitment time axis in UTC"),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(
        "No current event is shown",
      );
    },
  );

  it.each([
    null,
    { ...live.expected, start: null },
    { ...live.expected, end: "not-a-date" },
    { ...live.expected, end: live.expected.start },
    { ...live.expected, start: "2026-08-28T13:00:00" },
  ])("does not invent geometry for missing or malformed timing", (state) => {
    show({
      ...live,
      latest_readback: state ? { ...live.latest_readback!, state } : null,
    });
    expect(
      screen.queryByLabelText("Commitment time axis in UTC"),
    ).not.toBeInTheDocument();
    expect(calendarInterval(state)).toBeNull();
  });

  it("preserves Recovery 01 and the existing exact evidence link", () => {
    show();
    expect(
      screen.getByRole("link", { name: "Inspect action" }),
    ).toHaveAttribute(
      "href",
      `/app/recovery/${proof.incident_id}?stage=recovery-1-act&lens=actions`,
    );
    expect(
      screen.getByRole("link", { name: "Exact evidence" }),
    ).toHaveAttribute(
      "href",
      `/app/evidence/${proof.incident_id}?evidence=${encodeURIComponent(live.evidence_id)}`,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([false, true])(
    "keeps the existing single GET for compact=%s",
    async (compact) => {
      const fetcher = vi.fn(
        async () =>
          new Response(JSON.stringify({ ...proof, resources: [live] }), {
            status: 200,
          }),
      );
      render(
        <UiDataProviderRoot
          provider={new ApiUiDataProvider({ mode: "live", fetcher })}
        >
          <MemoryRouter>
            <ExternalReality incidentId={proof.incident_id} compact={compact} />
          </MemoryRouter>
        </UiDataProviderRoot>,
      );
      await screen.findByRole("article", {
        name: "Google Calendar external reality",
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher).toHaveBeenCalledWith(
        `/api/v1/ui/recoveries/${proof.incident_id}/external-reality`,
        expect.objectContaining({ method: "GET", credentials: "same-origin" }),
      );
    },
  );

  it("leaves the approved contract, provider and backend files unchanged", () => {
    expect(
      execFileSync(
        "git",
        [
          "diff",
          "52d654a",
          "--",
          "../docs/ui-openapi.json",
          "src/app/contract",
          "src/app/data",
          "src/app/auth",
        ],
        { encoding: "utf8" },
      ),
    ).toBe("");
  });
});

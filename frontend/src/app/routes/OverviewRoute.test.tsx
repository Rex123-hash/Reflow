import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { OverviewView, RecoveryCaseView } from "../contract/uiContract";
import { UiDataProviderRoot } from "../data/UiDataContext";
import {
  CANONICAL_INCIDENT_ID,
  FixtureUiDataProvider,
} from "../data/FixtureUiDataProvider";
import recoveryRestoredFixture from "../data/fixtures/recovery-restored.json";
import { OverviewRoute } from "./OverviewRoute";

class OverviewTestProvider extends FixtureUiDataProvider {
  recoveryCalls = 0;

  constructor(private readonly priority: OverviewView["current_priority"]) {
    super("restored");
  }

  override async getOverview(signal?: AbortSignal) {
    const result = await super.getOverview(signal);
    return {
      ...result,
      data: { ...result.data, current_priority: this.priority },
    };
  }

  override async getRecoveryCase(incidentId: string, signal?: AbortSignal) {
    this.recoveryCalls += 1;
    return super.getRecoveryCase(incidentId, signal);
  }
}

const restoredPriority: NonNullable<OverviewView["current_priority"]> = {
  active_recovery_number: 2,
  active_workflow_stage: "RESTORED",
  deadline_timezone: "Etc/UTC",
  incident_id: CANONICAL_INCIDENT_ID,
  objective_health: "RESTORED",
  objective_id: "release-v2",
  objective_title: "SHIP RELEASE V2",
  protected_deadline: "2026-08-28T17:00:00+00:00",
  summary: "SHIP RELEASE V2 was restored after Recovery 2.",
  // Deliberately inconsistent: this live countdown must never be the restored margin.
  time_remaining_seconds: 30_600,
};

function renderOverview(provider: OverviewTestProvider) {
  return render(
    <UiDataProviderRoot provider={provider}>
      <MemoryRouter>
        <OverviewRoute />
      </MemoryRouter>
    </UiDataProviderRoot>,
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Overview restoration timing", () => {
  it("renders the canonical restoration margin and keeps it fixed as the clock advances", async () => {
    const objective = (recoveryRestoredFixture as unknown as RecoveryCaseView)
      .objective;

    expect(objective.restored_at).toBe("2026-08-27T19:08:54.504926+00:00");
    expect(objective.protected_deadline).toBe("2026-08-28T17:00:00+00:00");
    expect(objective.deadline_margin_seconds).toBe(78_665);
    expect(
      Math.floor(
        (Date.parse(objective.protected_deadline) -
          Date.parse(objective.restored_at!)) /
          1_000,
      ),
    ).toBe(objective.deadline_margin_seconds);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-08-28T08:29:00+00:00");

    const first = renderOverview(new OverviewTestProvider(restoredPriority));
    expect(
      await screen.findByText("Restored 21h 51m before deadline"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Restored 8h 30m before deadline"),
    ).not.toBeInTheDocument();

    first.unmount();
    vi.setSystemTime("2026-08-28T16:59:00+00:00");

    renderOverview(new OverviewTestProvider(restoredPriority));
    expect(
      await screen.findByText("Restored 21h 51m before deadline"),
    ).toBeInTheDocument();
  });

  it("keeps active remaining-time semantics unchanged", async () => {
    const provider = new OverviewTestProvider({
      ...restoredPriority,
      active_workflow_stage: "VERIFY",
      objective_health: "RECOVERING",
      time_remaining_seconds: 5_400,
    });

    renderOverview(provider);

    expect(await screen.findByText("1h 30m")).toBeInTheDocument();
    expect(provider.recoveryCalls).toBe(0);
  });
});

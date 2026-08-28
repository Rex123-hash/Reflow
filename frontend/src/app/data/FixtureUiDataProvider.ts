import type {
  EvidencePageView,
  ExternalRealityView,
  ExecutionEventsView,
  ObjectiveFilter,
  ObjectivesView,
  OperatorContextView,
  OverviewView,
  RecoveryCaseView,
} from "../contract/uiContract";
import {
  UiDataError,
  type ProvenanceInfo,
  type Provenanced,
  type UiDataProvider,
} from "./UiDataProvider";
import { list } from "./normalize";

import overviewFixture from "./fixtures/overview.json";
import externalRealityFixture from "./fixtures/external-reality.json";
import objectivesFixture from "./fixtures/objectives.json";
import recoveryActiveFixture from "./fixtures/recovery-active.json";
import recoveryRestoredFixture from "./fixtures/recovery-restored.json";
import evidenceFixture from "./fixtures/evidence.json";
import eventsFixture from "./fixtures/events.json";
import operatorFixture from "./fixtures/operator-context.json";

/**
 * Which exported presentation of the canonical incident the Recovery Room reads.
 *
 * Only `getRecoveryCase` varies. Every other fixture was exported at the terminal
 * revision-17 state and there is no exported Overview/Objectives/Evidence at the
 * revision-16 boundary — so none is synthesized here.
 */
export type FixtureScenario = "active" | "restored";

export const CANONICAL_INCIDENT_ID = "incident-0fc3af5b0bd1ad847aea";

const FIXTURE_PROVENANCE: Record<FixtureScenario, ProvenanceInfo> = {
  active: {
    kind: "fixture",
    // Deliberately false. recovery-active.json is a historical reconstruction of
    // the canonical incident at its genuine revision-16 VERIFYING boundary. It is
    // a real export, but it is not a live read, and must never be labelled LIVE.
    live: false,
    label: "Recorded presentation · revision 16",
  },
  restored: {
    kind: "fixture",
    live: false,
    label: "Recorded presentation · revision 17",
  },
};

const TERMINAL_PROVENANCE: ProvenanceInfo = {
  kind: "fixture",
  live: false,
  label: "Recorded presentation · revision 17",
};

const delay = (signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(resolve, 0);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });

/**
 * Serves the backend-exported presentation fixtures through the production data
 * interface. Page components cannot tell this apart from the live provider.
 */
export class FixtureUiDataProvider implements UiDataProvider {
  readonly id = "fixture";

  #scenario: FixtureScenario;

  constructor(scenario: FixtureScenario = "active") {
    this.#scenario = scenario;
  }

  get scenario(): FixtureScenario {
    return this.#scenario;
  }

  async getExternalReality(
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<Provenanced<ExternalRealityView>> {
    await delay(signal);
    if (incidentId !== CANONICAL_INCIDENT_ID) {
      throw new UiDataError(
        "resource_not_found",
        "No exported Calendar proof for this incident.",
        404,
      );
    }
    return {
      data: externalRealityFixture as unknown as ExternalRealityView,
      provenance: TERMINAL_PROVENANCE,
    };
  }

  async getOverview(signal?: AbortSignal): Promise<Provenanced<OverviewView>> {
    await delay(signal);
    const data = overviewFixture as unknown as OverviewView;
    return {
      data: {
        ...data,
        active_objectives: list(data.active_objectives),
        recent_activity: list(data.recent_activity),
      },
      provenance: TERMINAL_PROVENANCE,
    };
  }

  async getObjectives(
    filter: ObjectiveFilter,
    signal?: AbortSignal,
  ): Promise<Provenanced<ObjectivesView>> {
    await delay(signal);
    const data = objectivesFixture as unknown as ObjectivesView;
    const items = list(data.items);
    // Filtering is selection, not interpretation: `health` is the backend's value.
    const filtered =
      filter === "all"
        ? items
        : filter === "restored"
          ? items.filter((item) => item.health === "RESTORED")
          : items.filter((item) => item.health !== "RESTORED");
    return {
      data: { ...data, filter, items: filtered },
      provenance: TERMINAL_PROVENANCE,
    };
  }

  async getRecoveryCase(
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<Provenanced<RecoveryCaseView>> {
    await delay(signal);
    if (incidentId !== CANONICAL_INCIDENT_ID) {
      throw new UiDataError(
        "resource_not_found",
        `No exported presentation for incident ${incidentId}.`,
        404,
      );
    }
    const source =
      this.#scenario === "active"
        ? recoveryActiveFixture
        : recoveryRestoredFixture;
    const data = source as unknown as RecoveryCaseView;
    return {
      data: {
        ...data,
        attempts: list(data.attempts).map((attempt) => ({
          ...attempt,
          stages: list(attempt.stages).map((stage) => ({
            ...stage,
            related_evidence_ids: list(stage.related_evidence_ids),
          })),
        })),
        plans: list(data.plans),
        actions: list(data.actions),
        verifications: list(data.verifications).map((verification) => ({
          ...verification,
          invariants: list(verification.invariants),
        })),
        evidence: list(data.evidence),
        what_changed: list(data.what_changed),
        world: {
          nodes: list(data.world?.nodes),
          edges: list(data.world?.edges),
        },
      },
      provenance: FIXTURE_PROVENANCE[this.#scenario],
    };
  }

  async getEvidencePage(
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<Provenanced<EvidencePageView>> {
    await delay(signal);
    if (incidentId !== CANONICAL_INCIDENT_ID) {
      throw new UiDataError(
        "resource_not_found",
        `No exported evidence for incident ${incidentId}.`,
        404,
      );
    }
    const data = evidenceFixture as unknown as EvidencePageView;
    return {
      data: {
        ...data,
        timeline: list(data.timeline),
        receipts: list(data.receipts),
        verification: list(data.verification).map((verification) => ({
          ...verification,
          invariants: list(verification.invariants),
        })),
        decisions: list(data.decisions),
        evidence: list(data.evidence),
      },
      provenance: TERMINAL_PROVENANCE,
    };
  }

  async getExecutionEvents(
    incidentId: string,
    after: number,
    limit: number,
    signal?: AbortSignal,
  ): Promise<Provenanced<ExecutionEventsView>> {
    await delay(signal);
    if (incidentId !== CANONICAL_INCIDENT_ID) {
      throw new UiDataError(
        "resource_not_found",
        `No exported events for incident ${incidentId}.`,
        404,
      );
    }
    if (!Number.isInteger(after) || after < 0 || limit < 1 || limit > 200) {
      throw new UiDataError(
        "malformed_request",
        "Cursor or limit is invalid.",
        400,
      );
    }
    const data = eventsFixture as unknown as ExecutionEventsView;
    const all = list(data.events);
    const page = all.slice(after, after + limit);
    const next = after + page.length;
    return {
      data: {
        ...data,
        events: page,
        next_cursor: String(next),
        terminal: data.terminal && next >= all.length,
      },
      provenance: TERMINAL_PROVENANCE,
    };
  }

  async getOperatorContext(
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<Provenanced<OperatorContextView>> {
    await delay(signal);
    if (incidentId !== CANONICAL_INCIDENT_ID) {
      throw new UiDataError(
        "resource_not_found",
        `No exported operator context for incident ${incidentId}.`,
        404,
      );
    }
    const data = operatorFixture as unknown as OperatorContextView;
    return {
      data: {
        ...data,
        plans: list(data.plans),
        evidence: list(data.evidence),
        events: list(data.events),
      },
      provenance: TERMINAL_PROVENANCE,
    };
  }
}

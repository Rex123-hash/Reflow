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

/**
 * Error codes the P2A contract defines. `detail.code` on a non-2xx response.
 * See docs/ui-backend-contract.md § Error semantics.
 */
export type UiErrorCode =
  | "malformed_request"
  | "resource_not_found"
  | "backend_infrastructure_unavailable"
  | "authentication_required"
  | "transport_failure";

export class UiDataError extends Error {
  readonly code: UiErrorCode;
  readonly status: number | null;

  constructor(
    code: UiErrorCode,
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.name = "UiDataError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Identifies where a presentation resource came from.
 *
 * `recovery-active.json` is a historical presentation reconstruction of the
 * canonical incident at its genuine revision-16 VERIFYING boundary — it is not a
 * live read. Surfaces that show a live indicator must consult this, never
 * `ObjectiveContext.is_live` alone.
 */
export interface ProvenanceInfo {
  kind: "fixture" | "api";
  /** True only when the underlying resource was fetched from the live backend. */
  live: boolean;
  label: string;
}

export interface Provenanced<T> {
  data: T;
  provenance: ProvenanceInfo;
}

/**
 * The complete data surface the logged-in application depends on.
 *
 * Every page composes against this interface. No page component imports a fixture
 * or constructs a URL, so swapping FixtureUiDataProvider for ApiUiDataProvider is
 * invisible above this line.
 */
export interface UiDataProvider {
  readonly id: string;

  getOverview(signal?: AbortSignal): Promise<Provenanced<OverviewView>>;

  getExternalReality(
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<Provenanced<ExternalRealityView>>;

  getObjectives(
    filter: ObjectiveFilter,
    signal?: AbortSignal,
  ): Promise<Provenanced<ObjectivesView>>;

  getRecoveryCase(
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<Provenanced<RecoveryCaseView>>;

  getEvidencePage(
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<Provenanced<EvidencePageView>>;

  getExecutionEvents(
    incidentId: string,
    after: number,
    limit: number,
    signal?: AbortSignal,
  ): Promise<Provenanced<ExecutionEventsView>>;

  getOperatorContext(
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<Provenanced<OperatorContextView>>;
}

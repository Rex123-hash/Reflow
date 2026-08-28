import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";
import openApi from "../contract/ui-openapi.json";
import type {
  EvidencePageView,
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

type PresentationResource =
  | OverviewView
  | ObjectivesView
  | RecoveryCaseView
  | EvidencePageView
  | ExecutionEventsView
  | OperatorContextView;

type ResourceName =
  | "OverviewView"
  | "ObjectivesView"
  | "RecoveryCaseView"
  | "EvidencePageView"
  | "ExecutionEventsView"
  | "OperatorContextView";

interface CachedResource {
  etag: string;
  value: PresentationResource;
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addSchema(openApi, "reflow-ui-openapi");

const validators = new Map<ResourceName, ValidateFunction>();

function validator(name: ResourceName): ValidateFunction {
  const cached = validators.get(name);
  if (cached) return cached;
  const compiled = ajv.compile({
    $ref: `reflow-ui-openapi#/components/schemas/${name}`,
  });
  validators.set(name, compiled);
  return compiled;
}

function parseError(payload: unknown, status: number): UiDataError {
  if (payload && typeof payload === "object") {
    const detail = "detail" in payload ? payload.detail : payload;
    if (detail && typeof detail === "object") {
      const code = "code" in detail ? detail.code : null;
      const message = "message" in detail ? detail.message : null;
      if (
        (code === "malformed_request" ||
          code === "resource_not_found" ||
          code === "backend_infrastructure_unavailable" ||
          code === "transport_failure") &&
        typeof message === "string"
      ) {
        return new UiDataError(code, message, status);
      }
    }
  }
  return new UiDataError(
    status === 404
      ? "resource_not_found"
      : "backend_infrastructure_unavailable",
    "The presentation resource could not be read.",
    status,
  );
}

export class ApiUiDataProvider implements UiDataProvider {
  readonly id: string;

  readonly #provenance: ProvenanceInfo;
  readonly #fetch: typeof fetch;
  readonly #cache = new Map<string, CachedResource>();

  constructor({
    mode,
    fetcher = fetch,
  }: {
    mode: "live" | "guest";
    fetcher?: typeof fetch;
  }) {
    this.id = `api:${mode}`;
    this.#fetch = fetcher;
    this.#provenance = {
      kind: "api",
      live: mode === "live",
      label: mode === "live" ? "Live workspace" : "Demo workspace · Read only",
    };
  }

  async #get<T extends PresentationResource>(
    path: string,
    schema: ResourceName,
    signal?: AbortSignal,
  ): Promise<Provenanced<T>> {
    const cached = this.#cache.get(path);
    const headers = new Headers({ Accept: "application/json" });
    if (cached) headers.set("If-None-Match", cached.etag);
    let response: Response;
    try {
      response = await this.#fetch(path, {
        method: "GET",
        credentials: "same-origin",
        headers,
        signal,
      });
    } catch (cause) {
      throw new UiDataError(
        "transport_failure",
        cause instanceof Error
          ? cause.message
          : "The request did not complete.",
      );
    }

    if (response.status === 304) {
      if (!cached) {
        throw new UiDataError(
          "transport_failure",
          "The server returned 304 without a cached representation.",
          304,
        );
      }
      return { data: cached.value as T, provenance: this.#provenance };
    }
    if (response.status === 401) {
      window.dispatchEvent(new Event("reflow:session-expired"));
      throw new UiDataError(
        "authentication_required",
        "The product session is invalid or expired.",
        401,
      );
    }
    if (!response.ok) {
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        // A non-JSON infrastructure response maps to a bounded UI error below.
      }
      throw parseError(payload, response.status);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new UiDataError(
        "backend_infrastructure_unavailable",
        "The presentation response was not valid JSON.",
        502,
      );
    }
    const validate = validator(schema);
    if (!validate(payload)) {
      throw new UiDataError(
        "backend_infrastructure_unavailable",
        `The ${schema} response failed contract validation.`,
        502,
      );
    }
    const etag = response.headers.get("ETag");
    if (etag) this.#cache.set(path, { etag, value: payload as T });
    return { data: payload as T, provenance: this.#provenance };
  }

  getOverview(signal?: AbortSignal): Promise<Provenanced<OverviewView>> {
    return this.#get("/api/v1/ui/overview", "OverviewView", signal);
  }

  getObjectives(
    filter: ObjectiveFilter,
    signal?: AbortSignal,
  ): Promise<Provenanced<ObjectivesView>> {
    return this.#get(
      `/api/v1/ui/objectives?status=${encodeURIComponent(filter)}`,
      "ObjectivesView",
      signal,
    );
  }

  getRecoveryCase(
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<Provenanced<RecoveryCaseView>> {
    return this.#get(
      `/api/v1/ui/recoveries/${encodeURIComponent(incidentId)}`,
      "RecoveryCaseView",
      signal,
    );
  }

  getEvidencePage(
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<Provenanced<EvidencePageView>> {
    return this.#get(
      `/api/v1/ui/evidence/${encodeURIComponent(incidentId)}`,
      "EvidencePageView",
      signal,
    );
  }

  getExecutionEvents(
    incidentId: string,
    after: number,
    limit: number,
    signal?: AbortSignal,
  ): Promise<Provenanced<ExecutionEventsView>> {
    const query = new URLSearchParams({
      after: String(after),
      limit: String(limit),
    });
    return this.#get(
      `/api/v1/ui/recoveries/${encodeURIComponent(incidentId)}/events?${query}`,
      "ExecutionEventsView",
      signal,
    );
  }

  getOperatorContext(
    incidentId: string,
    signal?: AbortSignal,
  ): Promise<Provenanced<OperatorContextView>> {
    return this.#get(
      `/api/v1/ui/operator/context?incident_id=${encodeURIComponent(incidentId)}`,
      "OperatorContextView",
      signal,
    );
  }
}

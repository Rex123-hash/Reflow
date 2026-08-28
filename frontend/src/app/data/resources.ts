import { useCallback } from "react";
import type { ObjectiveFilter } from "../contract/uiContract";
import { useResource, useUiData } from "./UiDataContext";

export function useOverview() {
  const { provider } = useUiData();
  return useResource(
    `overview:${provider.id}`,
    useCallback((s) => provider.getOverview(s), [provider]),
  );
}

export function useExternalReality(incidentId: string) {
  const { provider } = useUiData();
  return useResource(
    `external-reality:${provider.id}:${incidentId}`,
    useCallback(
      (s) => provider.getExternalReality(incidentId, s),
      [provider, incidentId],
    ),
  );
}

export function useObjectives(filter: ObjectiveFilter) {
  const { provider } = useUiData();
  return useResource(
    `objectives:${provider.id}:${filter}`,
    useCallback((s) => provider.getObjectives(filter, s), [provider, filter]),
  );
}

export function useRecoveryCase(incidentId: string | null) {
  const { provider, scenario } = useUiData();
  return useResource(
    `recovery:${provider.id}:${scenario}:${incidentId ?? "none"}`,
    useCallback(
      (s) => {
        if (!incidentId) return new Promise<never>(() => {});
        return provider.getRecoveryCase(incidentId, s);
      },
      [provider, incidentId],
    ),
  );
}

export function useEvidencePage(incidentId: string | null) {
  const { provider } = useUiData();
  return useResource(
    `evidence:${provider.id}:${incidentId ?? "none"}`,
    useCallback(
      (s) => {
        if (!incidentId) return new Promise<never>(() => {});
        return provider.getEvidencePage(incidentId, s);
      },
      [provider, incidentId],
    ),
  );
}

export function useExecutionEvents(incidentId: string | null, limit = 200) {
  const { provider } = useUiData();
  return useResource(
    `events:${provider.id}:${incidentId ?? "none"}:${limit}`,
    useCallback(
      (s) => {
        if (!incidentId) return new Promise<never>(() => {});
        return provider.getExecutionEvents(incidentId, 0, limit, s);
      },
      [provider, incidentId, limit],
    ),
  );
}

export function useOperatorContext(incidentId: string | null) {
  const { provider } = useUiData();
  return useResource(
    `operator:${provider.id}:${incidentId ?? "none"}`,
    useCallback(
      (s) => {
        if (!incidentId) return new Promise<never>(() => {});
        return provider.getOperatorContext(incidentId, s);
      },
      [provider, incidentId],
    ),
  );
}

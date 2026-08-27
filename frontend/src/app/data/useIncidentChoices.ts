import type { CurrentPriority, ObjectiveSummary } from "../contract/uiContract";
import { useOverview } from "./resources";
import type { UiDataError } from "./UiDataProvider";

export interface IncidentChoice {
  incidentId: string;
  objectiveId: string;
  objectiveTitle: string;
  objective: ObjectiveSummary | null;
}

export type IncidentChoices =
  | { status: "loading" }
  | { status: "error"; error: UiDataError }
  | {
      status: "ready";
      /** The backend's own current priority, when it names an incident. */
      priority: (CurrentPriority & { incident_id: string }) | null;
      /** Every objective that carries an authoritative incident id, for selection. */
      choices: IncidentChoice[];
    };

/**
 * Supplies the material a landing route needs to let someone CHOOSE an incident.
 *
 * It deliberately does not resolve one. Array order must never decide which
 * incident the global Recovery or Evidence tab opens: `/app/recovery` renders the
 * current priority with an explicit call to action, the selectable incidents, or a
 * truthful no-active-recovery state, and the person picks. Overview and Objectives
 * may deep-link straight to `/app/recovery/:incidentId` because they are acting on
 * an authoritative id the user can see.
 */
export function useIncidentChoices(): IncidentChoices {
  const overview = useOverview();

  if (overview.status === "loading") return { status: "loading" };
  if (overview.status === "error")
    return { status: "error", error: overview.error };

  const currentPriority = overview.data.current_priority ?? null;
  const priority =
    currentPriority && currentPriority.incident_id
      ? (currentPriority as CurrentPriority & { incident_id: string })
      : null;

  const choices: IncidentChoice[] = [];
  const seen = new Set<string>();

  if (priority) {
    seen.add(priority.incident_id);
    choices.push({
      incidentId: priority.incident_id,
      objectiveId: priority.objective_id,
      objectiveTitle: priority.objective_title,
      objective: null,
    });
  }

  for (const objective of overview.data.active_objectives) {
    const incidentId = objective.active_incident_id;
    if (!incidentId || seen.has(incidentId)) continue;
    seen.add(incidentId);
    choices.push({
      incidentId,
      objectiveId: objective.objective_id,
      objectiveTitle: objective.title,
      objective,
    });
  }

  return { status: "ready", priority, choices };
}

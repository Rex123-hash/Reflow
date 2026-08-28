import type { OperatorResponse } from "./operatorContract";
import { validateOperatorResponse } from "./operatorValidator";

export async function queryOperator(
  incidentId: string,
  message: string,
  signal?: AbortSignal,
): Promise<OperatorResponse> {
  const response = await fetch("/api/v1/operator/query", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ incident_id: incidentId, message }),
    signal: AbortSignal.any([
      AbortSignal.timeout(90_000),
      ...(signal ? [signal] : []),
    ]),
  });
  if (response.status === 401) {
    window.dispatchEvent(new Event("reflow:session-expired"));
    throw new Error("Your session expired. Sign in again.");
  }
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Operator is busy or its request budget is reached. Try later. No action occurred."
        : response.status === 403
          ? "Real Operator reasoning requires Google sign-in."
          : "Operator could not complete this request. No action occurred.",
    );
  const value: unknown = await response.json();
  if (!validateOperatorResponse(value))
    throw new Error("Operator response failed validation.");
  const result = value as OperatorResponse;
  if (result.incident_id !== incidentId)
    throw new Error("Operator returned a different incident.");
  return result;
}

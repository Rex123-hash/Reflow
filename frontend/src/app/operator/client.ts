import type {
  ConversationContext,
  OperatorActionView,
  OperatorResponse,
} from "./operatorContract";
import {
  validateOperatorAction,
  validateOperatorResponse,
} from "./operatorValidator";

export async function operatorRequestKey(
  incidentId: string,
  message: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify([incidentId, message])),
  );
  const name =
    "reflow:operator-retry:" +
    Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  const existing = sessionStorage.getItem(name);
  if (existing) return existing;
  const key = crypto.randomUUID();
  sessionStorage.setItem(name, key);
  return key;
}

export async function queryOperator(
  incidentId: string,
  message: string,
  idempotencyKey: string,
  conversationContext?: ConversationContext,
  signal?: AbortSignal,
): Promise<OperatorResponse> {
  const response = await fetch("/api/v1/operator/query", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      incident_id: incidentId,
      message,
      idempotency_key: idempotencyKey,
      ...(conversationContext
        ? { conversation_context: conversationContext }
        : {}),
    }),
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
        ? "Operator is busy or its request budget is reached. Retry the same request later."
        : response.status === 403
          ? "Real Operator reasoning requires Google sign-in."
          : "Operator could not confirm the result. Retry the same request safely.",
    );
  const value: unknown = await response.json();
  if (!validateOperatorResponse(value))
    throw new Error("Operator response failed validation.");
  const result = value as OperatorResponse;
  if (result.incident_id !== incidentId)
    throw new Error("Operator returned a different incident.");
  return result;
}

export async function approveOperator(
  actionId: string,
  signal?: AbortSignal,
): Promise<OperatorActionView> {
  const response = await fetch(
    `/api/v1/operator/actions/${encodeURIComponent(actionId)}/approve`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "{}",
      signal: AbortSignal.any([
        AbortSignal.timeout(60_000),
        ...(signal ? [signal] : []),
      ]),
    },
  );
  if (response.status === 401) {
    window.dispatchEvent(new Event("reflow:session-expired"));
    throw new Error("Your session expired. Sign in again.");
  }
  if (!response.ok)
    throw new Error(
      response.status === 403
        ? "This account cannot approve Operator actions."
        : "Operator could not confirm the approved action result.",
    );
  const value: unknown = await response.json();
  if (!validateOperatorAction(value))
    throw new Error("Operator approval response failed validation.");
  return value as OperatorActionView;
}

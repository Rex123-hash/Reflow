/**
 * The three same-origin voice calls, and nothing else.
 *
 * There is no direct browser call to Slack, Jira, Calendar, Gmail or GitHub here, and
 * no second action API: authoritative work goes through `handOffToOperator`, which is a
 * handoff into the existing Operator pipeline rather than a new one.
 */

import type {
  LiveVoiceSession,
  VoiceFailure,
  VoiceOperatorHandoffResult,
  VoiceTranscriptionSession,
} from "./voiceContract";
import type { ConversationContext } from "../operator/operatorContract";

export class VoiceSessionError extends Error {
  readonly code: VoiceFailure;
  constructor(code: VoiceFailure, message: string) {
    super(message);
    this.name = "VoiceSessionError";
    this.code = code;
  }
}

const UNAVAILABLE: Record<number, VoiceFailure> = {
  503: "VOICE_UNAVAILABLE",
};

async function requestSession<T>(
  path: string,
  capability: "TRANSCRIPTION" | "LIVE_CALL",
  incidentId: string,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ capability, incident_id: incidentId }),
      signal: AbortSignal.any([
        AbortSignal.timeout(20_000),
        ...(signal ? [signal] : []),
      ]),
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new VoiceSessionError(
      "SESSION_CREDENTIAL_FAILED",
      "Reflow could not reach the voice service.",
    );
  }
  if (response.status === 401) {
    window.dispatchEvent(new Event("reflow:session-expired"));
    throw new VoiceSessionError(
      "SESSION_CREDENTIAL_FAILED",
      "Your session expired. Sign in again.",
    );
  }
  if (response.status === 403) {
    throw new VoiceSessionError(
      "VOICE_UNAVAILABLE",
      "Voice requires Google sign-in. The demo workspace is read-only.",
    );
  }
  if (!response.ok) {
    // The backend returns {detail: {code, message}}; fall back to the status only.
    const detail = await response
      .json()
      .then((body: unknown) =>
        body && typeof body === "object" && "detail" in body
          ? (body as { detail: { code?: VoiceFailure; message?: string } })
              .detail
          : null,
      )
      .catch(() => null);
    throw new VoiceSessionError(
      detail?.code ??
        UNAVAILABLE[response.status] ??
        "SESSION_CREDENTIAL_FAILED",
      detail?.message ?? "Voice is unavailable right now.",
    );
  }
  return (await response.json()) as T;
}

export function createTranscriptionSession(
  incidentId: string,
  signal?: AbortSignal,
): Promise<VoiceTranscriptionSession> {
  return requestSession<VoiceTranscriptionSession>(
    "/api/v1/voice/transcription/session",
    "TRANSCRIPTION",
    incidentId,
    signal,
  );
}

export function createLiveSession(
  incidentId: string,
  signal?: AbortSignal,
): Promise<LiveVoiceSession> {
  return requestSession<LiveVoiceSession>(
    "/api/v1/voice/live/session",
    "LIVE_CALL",
    incidentId,
    signal,
  );
}

/**
 * The single bounded handoff into the existing Operator pipeline.
 *
 * The spoken request is passed through exactly as the Live model produced it. The
 * result is returned unmodified — in particular `spoken_result`, whose opening
 * sentence the backend owns so a refused or unverified outcome cannot be spoken as a
 * success.
 */
export async function handOffToOperator(
  request: {
    voice_session_id: string;
    incident_id: string;
    spoken_request: string;
    conversation_context?: ConversationContext;
    idempotency_key?: string;
  },
  signal?: AbortSignal,
): Promise<VoiceOperatorHandoffResult> {
  const response = await fetch("/api/v1/voice/operator/handoff", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.any([
      AbortSignal.timeout(90_000),
      ...(signal ? [signal] : []),
    ]),
  });
  if (response.status === 401) {
    window.dispatchEvent(new Event("reflow:session-expired"));
    throw new VoiceSessionError(
      "OPERATOR_HANDOFF_FAILED",
      "Your session expired. Sign in again.",
    );
  }
  if (!response.ok)
    throw new VoiceSessionError(
      "OPERATOR_HANDOFF_FAILED",
      "Reflow could not finish that request.",
    );
  return (await response.json()) as VoiceOperatorHandoffResult;
}

/** A stable idempotency key for one spoken request inside one call. */
export async function spokenRequestKey(
  sessionId: string,
  spoken: string,
  context?: ConversationContext,
): Promise<string> {
  const contextIdentity = context
    ? [
        context.mode,
        context.user_goal,
        context.normalized_request ?? null,
        context.human_summary,
      ]
    : null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify([sessionId, spoken, contextIdentity]),
    ),
  );
  const hex = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return `voice-${hex.slice(0, 40)}`;
}

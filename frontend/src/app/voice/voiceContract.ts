import type { ConversationContext } from "../operator/operatorContract";

/**
 * The committed backend voice contracts, mirrored for the browser.
 *
 * These types follow `objective_recovery_agent/voice_schemas.py` exactly. The browser
 * never widens them: it cannot choose a model, a tool, a configuration or a duration,
 * because none of those are fields it sends. The only credential it ever holds is the
 * short-lived `ephemeral_token` Reflow mints for one session.
 */

export type VoiceCapability = "TRANSCRIPTION" | "LIVE_CALL";

export type VoiceFailure =
  | "VOICE_UNAVAILABLE"
  | "SESSION_CREDENTIAL_FAILED"
  | "TRANSCRIPTION_SESSION_EXPIRED"
  | "LIVE_SESSION_EXPIRED"
  | "OPERATOR_HANDOFF_DENIED"
  | "OPERATOR_HANDOFF_UNSUPPORTED"
  | "OPERATOR_HANDOFF_FAILED";

export type VoiceHandoffOutcome =
  | "CONVERSATIONAL"
  | "CLARIFICATION_REQUIRED"
  | "UNSUPPORTED"
  | "DENIED"
  | "APPROVAL_REQUIRED"
  | "ACTION_VERIFIED"
  | "ACTION_UNVERIFIED"
  | "HANDOFF_FAILED";

export interface VoiceAudioFormat {
  mime_type: string;
  sample_rate_hz: number;
  channels: number;
  bits_per_sample: number;
  recommended_chunk_ms: number;
}

interface VoiceSessionGrant {
  session_id: string;
  capability: VoiceCapability;
  model: string;
  api_endpoint: string;
  api_version: string;
  ephemeral_token: string;
  expires_at: string;
  new_session_expires_at: string;
  uses: number;
  max_session_seconds: number;
  audio_input: VoiceAudioFormat;
  configuration_locked: true;
}

export interface VoiceTranscriptionSession extends VoiceSessionGrant {
  capability: "TRANSCRIPTION";
  custom_vocabulary: string[];
  automatic_language_detection: true;
}

export interface VoiceToolParameter {
  name: "spoken_request";
  type: "string";
  description: string;
  required: true;
}

export interface VoiceToolDeclaration {
  name: "submit_operator_request";
  description: string;
  parameters: VoiceToolParameter[];
  synchronous: true;
}

export interface LiveVoiceSession extends VoiceSessionGrant {
  capability: "LIVE_CALL";
  incident_id: string;
  operator_handoff_tool: VoiceToolDeclaration;
  /** Always empty. A Live session never carries a business adapter. */
  business_tools: string[];
  session_resumption_supported: boolean;
}

export interface VoiceOperatorHandoffResult {
  voice_session_id: string;
  request_id: string;
  incident_id: string;
  outcome: VoiceHandoffOutcome;
  original_request: string;
  /** Opens with the server-owned state sentence. The browser never rewrites it. */
  spoken_result: string;
  truth_boundary: string;
  action_verified: boolean;
  external_effects_executed: boolean;
  objective_recovered: boolean;
  operator_disposition:
    "SUPPORTED" | "CLARIFICATION_REQUIRED" | "UNSUPPORTED" | null;
  operator_action_lifecycle: string | null;
  approval_required_action_id: string | null;
  /** Present only while one bounded Operator clarification remains unresolved. */
  conversation_context: ConversationContext | null;
  failure: VoiceFailure | null;
}

export interface VoiceFailureDetail {
  code: VoiceFailure;
  message: string;
}

/** The one tool name a Live session may declare, pinned so drift is a type error. */
export const OPERATOR_HANDOFF_TOOL = "submit_operator_request" as const;

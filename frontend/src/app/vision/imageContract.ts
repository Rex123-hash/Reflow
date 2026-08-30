import type {
  ConversationEnvelope,
  OperatorResponse,
} from "../operator/operatorContract";

/**
 * The Show Reflow response, mirrored by hand.
 *
 * Every other backend shape in this application arrives through a generated
 * contract, and that is still the rule. The image endpoint is deliberately the one
 * exception: its Pydantic models are not part of `scripts/export_operator_contract.py`,
 * and adding them there would mean editing the backend to ship a frontend feature.
 * So these types mirror `objective_recovery_agent/image_schemas.py` field for field,
 * and `isImageUnderstandingResponse` below re-checks the fields this interface
 * actually renders before any of it reaches the screen.
 *
 * Nothing here is derived. Every value the UI shows is a field the backend sent.
 */

export type ImageMimeType = "image/png" | "image/jpeg" | "image/webp";

/** How a statement was arrived at. The backend decides; the client only renders. */
export type ObservationBasis = "OBSERVED" | "INFERRED";

export type ObservationConfidence = "LOW" | "MEDIUM" | "HIGH";

export type ImageHandoffStatus =
  "NOT_REQUESTED" | "ROUTED_READ_ONLY" | "MUTATION_REQUIRES_TYPED_OPERATOR";

export interface VisualObservation {
  statement: string;
  basis: ObservationBasis;
  confidence: ObservationConfidence;
}

export interface ImageProvenance {
  source: "AUTHENTICATED_USER_UPLOAD";
  detected_mime_type: ImageMimeType;
  byte_size: number;
  width: number;
  height: number;
  /** The backend states this; the interface repeats it rather than promising it. */
  raw_image_retained: false;
  visual_truth: "OBSERVED_OR_INFERRED_NOT_AUTHORITATIVE";
}

export interface ImageOperatorHandoff {
  status: ImageHandoffStatus;
  normalized_request?: string | null;
  response?: OperatorResponse | null;
}

export interface ImageUnderstandingResponse {
  request_id: string;
  incident_id: string;
  human_answer: string;
  classification: ConversationEnvelope;
  visual_observations: VisualObservation[];
  ambiguities?: string[];
  operator_handoff: ImageOperatorHandoff;
  provenance: ImageProvenance;
  external_effects_executed: false;
}

/** The typed error codes `image_schemas.ImageErrorCode` can return. */
export type ImageErrorCode =
  | "authentication_required"
  | "origin_rejected"
  | "multipart_required"
  | "invalid_form"
  | "image_required"
  | "unsupported_media_type"
  | "media_type_mismatch"
  | "image_too_large"
  | "invalid_image"
  | "image_dimensions_exceeded"
  | "upstream_unavailable"
  | "response_invalid";

const BASIS = new Set(["OBSERVED", "INFERRED"]);
const CONFIDENCE = new Set(["LOW", "MEDIUM", "HIGH"]);
const HANDOFF = new Set([
  "NOT_REQUESTED",
  "ROUTED_READ_ONLY",
  "MUTATION_REQUIRES_TYPED_OPERATOR",
]);
const MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/**
 * A shape guard over exactly what this feature renders.
 *
 * It is not a schema validator and does not pretend to be one — the backend
 * validated the response against the real schema before it left, and the BFF
 * validated it again. This exists so a malformed or unexpected body becomes one
 * honest error state instead of a half-drawn answer.
 */
export function isImageUnderstandingResponse(
  value: unknown,
): value is ImageUnderstandingResponse {
  if (!isRecord(value)) return false;
  if (typeof value.request_id !== "string") return false;
  if (typeof value.incident_id !== "string") return false;
  if (typeof value.human_answer !== "string" || value.human_answer.length === 0)
    return false;
  if (value.external_effects_executed !== false) return false;

  const classification = value.classification;
  if (!isRecord(classification) || typeof classification.mode !== "string")
    return false;

  const observations = value.visual_observations;
  if (!Array.isArray(observations) || observations.length === 0) return false;
  for (const item of observations) {
    if (!isRecord(item)) return false;
    if (typeof item.statement !== "string" || item.statement.length === 0)
      return false;
    if (typeof item.basis !== "string" || !BASIS.has(item.basis)) return false;
    if (typeof item.confidence !== "string" || !CONFIDENCE.has(item.confidence))
      return false;
  }

  if (value.ambiguities !== undefined && !isStringArray(value.ambiguities))
    return false;

  const handoff = value.operator_handoff;
  if (!isRecord(handoff)) return false;
  if (typeof handoff.status !== "string" || !HANDOFF.has(handoff.status))
    return false;

  const provenance = value.provenance;
  if (!isRecord(provenance)) return false;
  if (provenance.source !== "AUTHENTICATED_USER_UPLOAD") return false;
  if (
    typeof provenance.detected_mime_type !== "string" ||
    !MIME.has(provenance.detected_mime_type)
  )
    return false;
  if (typeof provenance.byte_size !== "number") return false;
  if (typeof provenance.width !== "number") return false;
  if (typeof provenance.height !== "number") return false;
  if (provenance.raw_image_retained !== false) return false;
  if (provenance.visual_truth !== "OBSERVED_OR_INFERRED_NOT_AUTHORITATIVE")
    return false;

  return true;
}

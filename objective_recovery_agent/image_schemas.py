"""Contracts for authenticated, ephemeral image understanding."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field, model_validator

from objective_recovery_agent.operator_schemas import (
    ConversationEnvelope,
    OperatorCapability,
    OperatorModel,
    OperatorResponse,
    ShortText,
)

ImageMimeType = Literal["image/png", "image/jpeg", "image/webp"]
ImageErrorCode = Literal[
    "authentication_required",
    "origin_rejected",
    "multipart_required",
    "invalid_form",
    "image_required",
    "unsupported_media_type",
    "media_type_mismatch",
    "image_too_large",
    "invalid_image",
    "image_dimensions_exceeded",
    "upstream_unavailable",
    "response_invalid",
]


class ImageRequestMetadata(OperatorModel):
    incident_id: str = Field(pattern=r"^incident-[a-zA-Z0-9-]{1,80}$")
    message: str | None = Field(default=None, min_length=3, max_length=1200)


class ImageProvenance(OperatorModel):
    source: Literal["AUTHENTICATED_USER_UPLOAD"] = "AUTHENTICATED_USER_UPLOAD"
    detected_mime_type: ImageMimeType
    byte_size: int = Field(gt=0)
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    raw_image_retained: Literal[False] = False
    visual_truth: Literal["OBSERVED_OR_INFERRED_NOT_AUTHORITATIVE"] = (
        "OBSERVED_OR_INFERRED_NOT_AUTHORITATIVE"
    )


class ImageAgentInput(OperatorModel):
    incident_id: str = Field(pattern=r"^incident-[a-zA-Z0-9-]{1,80}$")
    user_message: str = Field(min_length=3, max_length=1200)
    message_was_supplied: bool
    capabilities: tuple[OperatorCapability, ...] = Field(default=(), max_length=8)
    provenance: ImageProvenance


class VisualObservation(OperatorModel):
    statement: ShortText
    basis: Literal["OBSERVED", "INFERRED"]
    confidence: Literal["LOW", "MEDIUM", "HIGH"]


class ImageAgentHandoff(OperatorModel):
    required: bool
    normalized_request: ShortText | None = None
    visual_context: tuple[ShortText, ...] = Field(default=(), max_length=8)


class ImageAgentResult(OperatorModel):
    human_answer: str = Field(min_length=1, max_length=2000)
    classification: ConversationEnvelope
    visual_observations: tuple[VisualObservation, ...] = Field(min_length=1, max_length=12)
    ambiguities: tuple[ShortText, ...] = Field(default=(), max_length=8)
    operator_handoff: ImageAgentHandoff

    @model_validator(mode="after")
    def handoff_matches_classification(self) -> ImageAgentResult:
        is_task = self.classification.mode == "TASK"
        if self.operator_handoff.required != is_task:
            raise ValueError("Only TASK image understanding may request an Operator handoff")
        if is_task:
            if (
                self.operator_handoff.normalized_request != self.classification.normalized_request
                or not self.operator_handoff.visual_context
            ):
                raise ValueError("TASK image understanding requires one bounded handoff")
        elif (
            self.operator_handoff.normalized_request is not None
            or self.operator_handoff.visual_context
        ):
            raise ValueError("Non-task image understanding cannot create an Operator handoff")
        return self


class ImageOperatorHandoffResult(OperatorModel):
    status: Literal[
        "NOT_REQUESTED",
        "ROUTED_READ_ONLY",
        "MUTATION_REQUIRES_TYPED_OPERATOR",
    ]
    normalized_request: ShortText | None = None
    response: OperatorResponse | None = None

    @model_validator(mode="after")
    def consistent_status(self) -> ImageOperatorHandoffResult:
        if self.status == "NOT_REQUESTED" and (
            self.normalized_request is not None or self.response is not None
        ):
            raise ValueError("No handoff may not contain an Operator result")
        if self.status == "ROUTED_READ_ONLY" and (
            self.normalized_request is None or self.response is None
        ):
            raise ValueError("A routed handoff requires its validated Operator result")
        if self.status == "MUTATION_REQUIRES_TYPED_OPERATOR" and (
            self.normalized_request is None or self.response is None
        ):
            raise ValueError("A mutation image handoff requires its no-action Agent 6 result")
        return self


class ImageUnderstandingResponse(OperatorModel):
    request_id: str = Field(pattern=r"^[a-f0-9-]{36}$")
    incident_id: str = Field(pattern=r"^incident-[a-zA-Z0-9-]{1,80}$")
    human_answer: str = Field(min_length=1, max_length=4000)
    classification: ConversationEnvelope
    visual_observations: tuple[VisualObservation, ...] = Field(min_length=1, max_length=12)
    ambiguities: tuple[ShortText, ...] = Field(default=(), max_length=8)
    operator_handoff: ImageOperatorHandoffResult
    provenance: ImageProvenance
    external_effects_executed: Literal[False] = False


class ImageErrorDetail(OperatorModel):
    code: ImageErrorCode
    message: str = Field(min_length=1, max_length=200)


class ImageErrorResponse(OperatorModel):
    error: ImageErrorDetail


MUTATING_IMAGE_CAPABILITIES = frozenset(
    {
        "SLACK_POST",
        "SLACK_DM",
        "SLACK_ARBITRARY_TARGET",
        "JIRA_UPDATE",
        "CALENDAR_UPDATE",
        "CALENDAR_CREATE",
        "PROTECTED_OBJECTIVE_CHANGE",
    }
)

BoundedImageBytes = Annotated[bytes, Field(min_length=1)]


__all__ = [
    "MUTATING_IMAGE_CAPABILITIES",
    "BoundedImageBytes",
    "ImageAgentHandoff",
    "ImageAgentInput",
    "ImageAgentResult",
    "ImageErrorCode",
    "ImageErrorDetail",
    "ImageErrorResponse",
    "ImageMimeType",
    "ImageOperatorHandoffResult",
    "ImageProvenance",
    "ImageRequestMetadata",
    "ImageUnderstandingResponse",
    "VisualObservation",
]

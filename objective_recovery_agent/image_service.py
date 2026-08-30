"""Ephemeral Agent 8 image understanding with a read-only Operator handoff."""

from __future__ import annotations

from typing import Protocol

from objective_recovery_agent.image_schemas import (
    MUTATING_IMAGE_CAPABILITIES,
    ImageAgentInput,
    ImageAgentResult,
    ImageOperatorHandoffResult,
    ImageUnderstandingResponse,
)
from objective_recovery_agent.image_validation import ValidatedImageUpload
from objective_recovery_agent.operator_agents import AdkOperatorAgents, OperatorReasoningError
from objective_recovery_agent.operator_context import safe_text
from objective_recovery_agent.operator_schemas import OperatorAgentTrace, OperatorQuery
from objective_recovery_agent.operator_service import OperatorService

_IMAGE_ONLY_PROMPT = "What does this image show?"


class ImageReasoningAgent(Protocol):
    async def understand_image(
        self,
        payload: ImageAgentInput,
        image_bytes: bytes,
        mime_type: str,
        request_id: str,
    ) -> tuple[ImageAgentResult, OperatorAgentTrace]: ...


class ImageUnderstandingService:
    def __init__(
        self,
        operator: OperatorService,
        agents: ImageReasoningAgent | None = None,
    ) -> None:
        self._operator = operator
        self._agents = agents or AdkOperatorAgents()

    async def understand(
        self,
        upload: ValidatedImageUpload,
        request_id: str,
        subject_hash: str,
        role: str,
    ) -> ImageUnderstandingResponse:
        supplied_message = upload.metadata.message
        model_input = ImageAgentInput(
            incident_id=upload.metadata.incident_id,
            user_message=supplied_message or _IMAGE_ONLY_PROMPT,
            message_was_supplied=supplied_message is not None,
            capabilities=self._operator.capabilities(),
            provenance=upload.provenance,
        )
        analysis, trace = await self._agents.understand_image(
            model_input,
            upload.content,
            upload.provenance.detected_mime_type,
            request_id,
        )
        analysis = ImageAgentResult.model_validate(analysis)
        classification = analysis.classification
        if not supplied_message and classification.mode == "TASK":
            raise OperatorReasoningError("Visible image content cannot create an Operator task")

        if classification.mode != "TASK":
            handoff = ImageOperatorHandoffResult(status="NOT_REQUESTED")
            answer = analysis.human_answer
        else:
            if supplied_message is None or classification.normalized_request is None:
                raise OperatorReasoningError("Image handoff lacks an explicit user request")
            visual_context = tuple(
                safe_text(f"[UNTRUSTED VISUAL EVIDENCE] {value}", 800)
                for value in analysis.operator_handoff.visual_context
            )
            operator_response = await self._operator.query(
                OperatorQuery(
                    incident_id=upload.metadata.incident_id,
                    message=supplied_message,
                ),
                request_id,
                subject_hash,
                role,
                initial_conversation=classification,
                initial_trace=trace,
                visual_context=visual_context,
                allow_actions=False,
            )
            if operator_response.external_effects_executed or operator_response.action is not None:
                raise OperatorReasoningError("Read-only image handoff reached an action result")
            mutation = classification.requested_capability in MUTATING_IMAGE_CAPABILITIES
            handoff = ImageOperatorHandoffResult(
                status=("MUTATION_REQUIRES_TYPED_OPERATOR" if mutation else "ROUTED_READ_ONLY"),
                normalized_request=classification.normalized_request,
                response=operator_response,
            )
            answer = (
                f"{analysis.human_answer}\n\n"
                f"{operator_response.human_response.human_summary}"
                + (
                    " No action was taken. Submit the change separately through the typed "
                    "Operator path if you want Reflow to evaluate it under normal policy."
                    if mutation
                    else ""
                )
            )

        return ImageUnderstandingResponse(
            request_id=request_id,
            incident_id=upload.metadata.incident_id,
            human_answer=answer,
            classification=classification,
            visual_observations=analysis.visual_observations,
            ambiguities=analysis.ambiguities,
            operator_handoff=handoff,
            provenance=upload.provenance,
        )


__all__ = ["ImageReasoningAgent", "ImageUnderstandingService"]

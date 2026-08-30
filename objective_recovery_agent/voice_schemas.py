"""Voice session and Operator-handoff contracts.

Voice is an interface, never an authority. Nothing in this module can execute an
external effect: the only capability a voice session may ever request is one bounded
handoff into the existing authenticated Operator pipeline.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Annotated, Final, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from objective_recovery_agent.operator_schemas import ConversationContext

# Google's current Live models for these two capabilities. Both are pinned in code so
# that neither a client nor a deployment variable can select a different model.
TRANSCRIPTION_MODEL = "gemini-3.5-transcribe-live"
LIVE_CALL_MODEL = "gemini-3.1-flash-live-preview"
APPROVED_TRANSCRIPTION_MODELS = frozenset({TRANSCRIPTION_MODEL})
APPROVED_LIVE_MODELS = frozenset({LIVE_CALL_MODEL})

# Live transcription streams for up to ten minutes; a Live audio-only call for fifteen.
TRANSCRIPTION_SESSION_SECONDS = 600
LIVE_SESSION_SECONDS = 900
# The window in which the browser may *open* a session with the issued credential.
NEW_SESSION_SECONDS = 60

OPERATOR_HANDOFF_TOOL = "submit_operator_request"
LIVE_API_HOST: Final[Literal["generativelanguage.googleapis.com"]] = (
    "generativelanguage.googleapis.com"
)

VoiceCapability = Literal["TRANSCRIPTION", "LIVE_CALL"]

VoiceFailure = Literal[
    "VOICE_UNAVAILABLE",
    "SESSION_CREDENTIAL_FAILED",
    "TRANSCRIPTION_SESSION_EXPIRED",
    "LIVE_SESSION_EXPIRED",
    "OPERATOR_HANDOFF_DENIED",
    "OPERATOR_HANDOFF_UNSUPPORTED",
    "OPERATOR_HANDOFF_FAILED",
]


def _bounded_pending_clarification(context: ConversationContext | None) -> bool:
    return context is None or (
        context.mode == "CLARIFY"
        and sum(
            len(value or "")
            for value in (
                context.user_goal,
                context.normalized_request,
                context.human_summary,
            )
        )
        <= 1800
    )


VoiceHandoffOutcome = Literal[
    "CONVERSATIONAL",
    "CLARIFICATION_REQUIRED",
    "UNSUPPORTED",
    "DENIED",
    "APPROVAL_REQUIRED",
    "ACTION_VERIFIED",
    "ACTION_UNVERIFIED",
    "HANDOFF_FAILED",
]

# Every backend truth state voice may report, including the two that must stay distinct:
# an action can be VERIFIED while the objective is still NOT recovered.
VOICE_TRUTH_STATES: frozenset[str] = frozenset(
    {
        "AVAILABLE",
        "VOICE_UNAVAILABLE",
        "SESSION_CREDENTIAL_FAILED",
        "TRANSCRIPTION_SESSION_EXPIRED",
        "LIVE_SESSION_EXPIRED",
        "OPERATOR_HANDOFF_DENIED",
        "OPERATOR_HANDOFF_UNSUPPORTED",
        "OPERATOR_HANDOFF_FAILED",
        "CONVERSATIONAL",
        "CLARIFICATION_REQUIRED",
        "UNSUPPORTED",
        "DENIED",
        "APPROVAL_REQUIRED",
        "ACTION_VERIFIED",
        "ACTION_UNVERIFIED",
        "HANDOFF_FAILED",
        "OBJECTIVE_RECOVERED",
        "OBJECTIVE_NOT_RECOVERED",
    }
)

# The first sentence of every spoken result is server-owned and keyed by outcome, so the
# Live model cannot open with a completion claim the Operator result does not support.
VOICE_RESULT_LEAD: Mapping[str, str] = {
    "CONVERSATIONAL": "Here is what Reflow's authoritative context shows.",
    "CLARIFICATION_REQUIRED": "Reflow needs one clarification before it can act.",
    "UNSUPPORTED": "Reflow does not support that request, so it attempted nothing.",
    "DENIED": "Reflow policy denied that action; no external change occurred.",
    "APPROVAL_REQUIRED": "That action needs explicit approval in Reflow before it can run.",
    "ACTION_VERIFIED": "Reflow ran that action and independently verified it.",
    "ACTION_UNVERIFIED": (
        "Reflow sent that action, but read-back did not confirm it; it is not verified."
    ),
    "HANDOFF_FAILED": "Reflow could not finish that request, so I cannot report any result.",
}

# An action being verified is never, on its own, the objective being recovered.
ACTION_IS_NOT_OBJECTIVE = "A verified action is not the same as the objective being recovered."

IncidentId = Annotated[str, Field(pattern=r"^incident-[a-zA-Z0-9-]{1,80}$")]
SpokenRequest = Annotated[str, Field(min_length=3, max_length=1200)]
OpaqueSessionId = Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{16,64}$")]


class VoiceModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, revalidate_instances="always")


class VoiceSessionRequest(VoiceModel):
    """Everything a client may ask for. No model, tool, or generation field exists here."""

    capability: VoiceCapability
    incident_id: IncidentId


class VoiceAudioFormat(VoiceModel):
    mime_type: Literal["audio/pcm;rate=16000"] = "audio/pcm;rate=16000"
    sample_rate_hz: Literal[16000] = 16000
    channels: Literal[1] = 1
    bits_per_sample: Literal[16] = 16
    recommended_chunk_ms: Literal[100] = 100


class VoiceToolParameter(VoiceModel):
    name: Literal["spoken_request"]
    type: Literal["string"]
    description: str = Field(min_length=1, max_length=400)
    required: Literal[True] = True


class VoiceToolDeclaration(VoiceModel):
    """The one capability a Live session may hold. The name is closed by the type."""

    name: Literal["submit_operator_request"]
    description: str = Field(min_length=1, max_length=800)
    parameters: tuple[VoiceToolParameter, ...] = Field(min_length=1, max_length=1)
    # Gemini 3.1 Flash Live function calling is synchronous: the model stops and waits
    # for the tool result. Nothing here may advertise non-blocking behavior.
    synchronous: Literal[True] = True


class VoiceSessionGrant(VoiceModel):
    """A short-lived, single-purpose, model-and-config-locked Live credential."""

    session_id: OpaqueSessionId
    capability: VoiceCapability
    model: str = Field(min_length=1, max_length=100)
    api_endpoint: Literal["generativelanguage.googleapis.com"] = LIVE_API_HOST
    api_version: Literal["v1alpha"] = "v1alpha"
    ephemeral_token: str = Field(min_length=1, max_length=4096)
    expires_at: str
    new_session_expires_at: str
    uses: Literal[1] = 1
    max_session_seconds: int = Field(ge=1, le=LIVE_SESSION_SECONDS)
    audio_input: VoiceAudioFormat = VoiceAudioFormat()
    configuration_locked: Literal[True] = True


class VoiceTranscriptionSession(VoiceSessionGrant):
    capability: Literal["TRANSCRIPTION"] = "TRANSCRIPTION"
    custom_vocabulary: tuple[str, ...] = Field(default=(), max_length=64)
    automatic_language_detection: Literal[True] = True

    @model_validator(mode="after")
    def approved_transcription_model(self) -> VoiceTranscriptionSession:
        if self.model not in APPROVED_TRANSCRIPTION_MODELS:
            raise ValueError("Transcription sessions are pinned to the approved model")
        if self.max_session_seconds > TRANSCRIPTION_SESSION_SECONDS:
            raise ValueError("Transcription sessions cannot outlive the documented limit")
        return self


class LiveVoiceSession(VoiceSessionGrant):
    capability: Literal["LIVE_CALL"] = "LIVE_CALL"
    incident_id: IncidentId
    operator_handoff_tool: VoiceToolDeclaration
    # Proof surface: a Live session never carries a business adapter.
    business_tools: tuple[str, ...] = Field(default=(), max_length=0)
    session_resumption_supported: bool

    @model_validator(mode="after")
    def approved_live_model(self) -> LiveVoiceSession:
        if self.model not in APPROVED_LIVE_MODELS:
            raise ValueError("Live sessions are pinned to the approved model")
        if self.business_tools:
            raise ValueError("A Live session cannot hold a business tool")
        return self


class VoiceOperatorHandoff(VoiceModel):
    """The single bounded request a Live session may hand to Reflow."""

    voice_session_id: OpaqueSessionId
    incident_id: IncidentId
    spoken_request: SpokenRequest
    conversation_context: ConversationContext | None = None
    idempotency_key: str | None = Field(
        default=None, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$"
    )

    @model_validator(mode="after")
    def one_bounded_clarification(self) -> VoiceOperatorHandoff:
        if not _bounded_pending_clarification(self.conversation_context):
            raise ValueError("Voice context must be one bounded pending clarification")
        return self


class VoiceOperatorHandoffResult(VoiceModel):
    """What the Live model is permitted to say, and nothing beyond it."""

    voice_session_id: OpaqueSessionId
    request_id: str
    incident_id: IncidentId
    outcome: VoiceHandoffOutcome
    original_request: SpokenRequest
    spoken_result: str = Field(min_length=1, max_length=2400)
    truth_boundary: str = Field(min_length=1, max_length=800)
    action_verified: bool
    external_effects_executed: bool
    objective_recovered: bool
    operator_disposition: Literal["SUPPORTED", "CLARIFICATION_REQUIRED", "UNSUPPORTED"] | None = (
        None
    )
    operator_action_lifecycle: str | None = Field(default=None, max_length=40)
    approval_required_action_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    conversation_context: ConversationContext | None = None
    failure: VoiceFailure | None = None

    @model_validator(mode="after")
    def truthful_outcome(self) -> VoiceOperatorHandoffResult:
        if self.action_verified != (self.outcome == "ACTION_VERIFIED"):
            raise ValueError("Only a verified Operator action may report a verified action")
        if self.outcome in {
            "CLARIFICATION_REQUIRED",
            "UNSUPPORTED",
            "DENIED",
            "APPROVAL_REQUIRED",
            "HANDOFF_FAILED",
        } and (self.external_effects_executed or self.objective_recovered):
            raise ValueError("A request that did not run cannot report effects or recovery")
        if self.objective_recovered and self.outcome not in {"CONVERSATIONAL", "ACTION_VERIFIED"}:
            raise ValueError("Objective recovery cannot be claimed from this outcome")
        if (self.approval_required_action_id is not None) != (self.outcome == "APPROVAL_REQUIRED"):
            raise ValueError("An approval identifier belongs only to an approval-required result")
        if (self.conversation_context is not None) != (self.outcome == "CLARIFICATION_REQUIRED"):
            raise ValueError("Conversation context belongs only to a pending clarification")
        if not _bounded_pending_clarification(self.conversation_context):
            raise ValueError("Voice context must be one bounded pending clarification")
        if not self.spoken_result.startswith(VOICE_RESULT_LEAD[self.outcome]):
            raise ValueError("The spoken result must open with the server-owned state sentence")
        return self


class VoiceFailureView(VoiceModel):
    """The error body every voice endpoint returns, in the existing code/message shape."""

    code: VoiceFailure
    message: str = Field(min_length=1, max_length=400)


_CLAIM = re.compile(r"(?i)\b(done|complete|completed|succeeded|recovered|fixed)\b")


def makes_completion_claim(text: str) -> bool:
    """True when prose asserts finished work; used to police the lead-sentence table."""
    return bool(_CLAIM.search(text))

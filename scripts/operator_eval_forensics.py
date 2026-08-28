"""Opt-in, local-only observers for the existing non-mutating model evaluators.

No runtime import, model override, output replacement, retries or grading changes.
Capture only non-thought structured output, bounded/redacted, before service rejection.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from contextlib import ExitStack
from contextvars import ContextVar
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from unittest.mock import patch

from google.adk.models.llm_response import LlmResponse
from google.genai.models import AsyncModels
from objective_recovery_agent import operator_agents
from objective_recovery_agent.operator_agents import AgentName
from objective_recovery_agent.operator_context import safe_text
from objective_recovery_agent.operator_schemas import OperatorIntent, SimulationResult
from objective_recovery_agent.operator_service import OperatorService
from scripts import evaluate_operator, evaluate_operator_act
from scripts.scan_p2h_secrets import RULES

CURRENT: ContextVar[tuple[str, str]] = ContextVar("eval_forensic_request", default=("", ""))


def redact(value: Any, depth: int = 0) -> Any:
    if depth > 12:
        return "[depth limit]"
    if isinstance(value, str):
        if any(rule.search(value.encode()) for rule in RULES.values()):
            return "[redacted credential]"
        return safe_text(value, 16000)
    if isinstance(value, list | tuple):
        return [redact(item, depth + 1) for item in value[:100]]
    if isinstance(value, dict):
        return {str(redact(k)): redact(v, depth + 1) for k, v in list(value.items())[:100]}
    return value if value is None or isinstance(value, bool | int | float) else type(value).__name__


def structured_output(response: Any, fields: set[str]) -> dict[str, Any]:
    parts = response.content.parts if response.content else []
    text = "".join(part.text for part in parts or [] if part.text and not part.thought)
    if len(text) > 24000:
        return {"state": "over_capture_limit", "characters": len(text)}
    try:
        value = json.loads(text)
    except ValueError:
        return {"state": "not_json", "characters": len(text)}
    if not isinstance(value, dict):
        return {"state": "not_object"}
    return {
        "state": "json_object",
        "value": redact({key: val for key, val in value.items() if key in fields}),
        "unexpected_field_count": len(set(value) - fields),
    }


class Capture:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []
        self.stack = ExitStack()

    def event(self, stage: str, **values: Any) -> None:
        request_id, agent = CURRENT.get()
        self.events.append(
            {
                "at": datetime.now(UTC).isoformat(),
                "request_id": request_id,
                "agent": agent,
                "stage": stage,
                **redact(values),
            }
        )

    def __enter__(self) -> Capture:
        original_invoke = operator_agents.AdkOperatorAgents._invoke
        original_workflow = vars(operator_agents)["run_workflow"]
        original_query = OperatorService.query
        original_generate = AsyncModels.generate_content

        async def generate(instance: Any, **kwargs: Any) -> Any:
            self.event("provider_request_started", model=kwargs.get("model"))
            try:
                response = await original_generate(instance, **kwargs)
                model_response = LlmResponse.create(response)
                schema = (
                    OperatorIntent
                    if CURRENT.get()[1] == "operator_intent_interpreter"
                    else SimulationResult
                )
                usage = model_response.usage_metadata
                self.event(
                    "provider_response",
                    output=structured_output(model_response, set(schema.model_fields)),
                    finish_reason=str(model_response.finish_reason),
                    input_tokens=usage.prompt_token_count if usage else None,
                    output_tokens=usage.candidates_token_count if usage else None,
                    thinking_tokens=usage.thoughts_token_count if usage else None,
                )
                return response
            except BaseException as error:
                self.event("provider_request_failed", exception_type=type(error).__name__)
                raise

        async def invoke(
            instance: Any,
            factory: Any,
            payload: Any,
            schema: Any,
            name: AgentName,
            request_id: str,
            timeout_seconds: int,
        ) -> Any:
            token = CURRENT.set((request_id, name))
            self.event(
                "agent_started",
                snapshot_fingerprint=payload.snapshot.fingerprint,
                payload_sha256=hashlib.sha256(payload.model_dump_json().encode()).hexdigest(),
                instruction_sha256=hashlib.sha256(
                    (
                        operator_agents.INTENT_INSTRUCTION
                        if name == "operator_intent_interpreter"
                        else operator_agents.SIMULATION_INSTRUCTION
                    ).encode()
                ).hexdigest(),
            )
            try:
                result = await original_invoke(
                    instance, factory, payload, schema, name, request_id, timeout_seconds
                )
                self.event("agent_typed_validation_passed", trace=result[1].model_dump(mode="json"))
                return result
            except BaseException as error:
                self.event(
                    "agent_failed",
                    exception_type=type(error).__name__,
                    category=getattr(error, "category", None),
                    elapsed_ms=getattr(error, "elapsed_ms", None),
                )
                raise
            finally:
                CURRENT.reset(token)

        async def workflow(flow: Any, payload: Any) -> Any:
            self.event("workflow_attempt_started")
            try:
                result = await original_workflow(flow, payload)
                self.event("workflow_typed_validation_passed")
                if isinstance(result.output, SimulationResult):
                    allowed = {item.evidence_id for item in payload.snapshot.evidence}
                    returned = set(result.output.evidence_ids)
                    self.event(
                        "simulation_reference_check",
                        allowed_ids=sorted(allowed),
                        returned_ids=sorted(returned),
                        unknown_ids=sorted(returned - allowed),
                    )
                return result
            except BaseException as error:
                self.event("workflow_attempt_failed", exception_type=type(error).__name__)
                raise

        async def query(
            instance: Any, request: Any, request_id: str, *args: Any, **kwargs: Any
        ) -> Any:
            try:
                return await original_query(instance, request, request_id, *args, **kwargs)
            except operator_agents.OperatorReasoningError as error:
                token = CURRENT.set((request_id, "service"))
                try:
                    # Never record arbitrary exception strings, only this code-owned category.
                    category = (
                        "unknown_simulation_evidence"
                        if str(error) == "Simulation cited unavailable evidence"
                        else "other_reasoning_error"
                    )
                    self.event("service_rejected", category=category)
                finally:
                    CURRENT.reset(token)
                raise

        self.stack.enter_context(patch.object(operator_agents.AdkOperatorAgents, "_invoke", invoke))
        self.stack.enter_context(patch.object(operator_agents, "run_workflow", workflow))
        self.stack.enter_context(patch.object(OperatorService, "query", query))
        self.stack.enter_context(patch.object(AsyncModels, "generate_content", generate))
        return self

    def __exit__(self, *args: Any) -> None:
        self.stack.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", choices=("intent", "recovery"), required=True)
    parser.add_argument("--case", choices=("slack_dm", "simulate_ci"))
    parser.add_argument("--prefix", required=True)
    args = parser.parse_args()
    if not args.prefix.startswith("p2h-repair-") or not args.prefix.replace("-", "").isalnum():
        parser.error("Use a new p2h-repair-* prefix")
    if args.case and args.case != ("slack_dm" if args.suite == "intent" else "simulate_ci"):
        parser.error("Diagnostic case must match suite")
    output = Path("artifacts") / f"{args.prefix}-forensics.json"
    if list(output.parent.glob(f"{args.prefix}-*.json")):
        parser.error("Output prefix already exists; preserving all prior evidence")
    arguments = [args.suite]
    if args.case:
        arguments += ["--case", args.case]
    if args.suite == "intent":
        arguments += ["--slack", "--output-prefix", args.prefix]
        run = evaluate_operator_act.main
    else:
        arguments += [
            "--context-url",
            "https://objective-recovery-2gbnbjfvkq-uc.a.run.app",
            "--output",
            f"artifacts/{args.prefix}-evaluation.json",
            "--traces-output",
            f"artifacts/{args.prefix}-traces.json",
        ]
        run = evaluate_operator.main
    with Capture() as capture, patch.object(sys, "argv", arguments):
        try:
            asyncio.run(run())
        finally:
            output.parent.mkdir(exist_ok=True)
            output.write_text(
                json.dumps({"local_observer_only": True, "events": capture.events}, indent=2)
                + "\n",
                encoding="utf-8",
            )
            print(f"Forensic evidence: {output}")


if __name__ == "__main__":
    main()

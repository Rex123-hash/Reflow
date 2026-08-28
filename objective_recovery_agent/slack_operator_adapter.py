"""One public, unshared Slack channel behind the existing durable Operator control plane."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any, ClassVar

import requests

from objective_recovery_agent.operator_actions import AdapterExecution, OperatorAdapterError
from objective_recovery_agent.operator_context import safe_text
from objective_recovery_agent.operator_schemas import (
    Authority,
    OperatorTarget,
    RequestedOperation,
    ResourceType,
)
from objective_recovery_agent.slack_operator_policy import (
    SLACK_DEMO_RESOURCE,
    SLACK_MESSAGE_LIMIT,
    SLACK_REQUIRED_SCOPES,
    decode_slack_text,
    encode_slack_text,
    slack_message_denial,
)


class SlackOperatorAdapter:
    authority: Authority = "SLACK"
    resource_type: ResourceType = "CHANNEL"
    operations = frozenset({"SLACK_INSPECT_CHANNEL", "SLACK_POST_MESSAGE"})
    resource_identifiers: tuple[str, ...] = (SLACK_DEMO_RESOURCE,)
    _CHANNEL = re.compile(r"C[A-Z0-9]{8,20}")
    _TEAM = re.compile(r"T[A-Z0-9]{8,20}")
    _TS = re.compile(r"[0-9]{10,16}\.[0-9]{6}")
    _ERROR_CATEGORIES: ClassVar[dict[str, str]] = {
        **dict.fromkeys(
            ("invalid_auth", "not_authed", "token_revoked", "token_expired", "account_inactive"),
            "slack_authentication",
        ),
        **dict.fromkeys(
            ("missing_scope", "no_permission", "access_denied", "not_allowed_token_type"),
            "slack_permission",
        ),
        **dict.fromkeys(("channel_not_found", "team_not_found"), "slack_not_found"),
        **dict.fromkeys(("ratelimited", "rate_limited"), "slack_rate_limit"),
        **dict.fromkeys(("internal_error", "fatal_error", "service_unavailable"), "slack_server"),
        **dict.fromkeys(
            ("not_in_channel", "is_archived", "restricted_action", "ekm_access_denied"),
            "slack_channel_unavailable",
        ),
        **dict.fromkeys(("no_text", "msg_too_long", "invalid_arguments"), "slack_invalid_request"),
    }
    _UNCERTAIN = frozenset(
        {
            "slack_timeout",
            "slack_transport",
            "slack_server",
            "slack_provider_error",
            "slack_malformed_response",
            "slack_invalid_acknowledgement",
        }
    )

    def __init__(
        self,
        *,
        bot_token: str,
        demo_channel_id: str,
        team_id: str,
        timeout: float = 4,
        session: Any | None = None,
    ) -> None:
        if (
            not self._CHANNEL.fullmatch(demo_channel_id)
            or not self._TEAM.fullmatch(team_id)
            or not bot_token.startswith("xoxb-")
            or any(c.isspace() for c in bot_token)
        ):
            raise ValueError("Complete bounded Slack bot/channel/team configuration is required")
        self._channel_id = demo_channel_id
        self._team_id = team_id
        self._token = bot_token
        self._timeout = timeout
        self._session = session or requests.Session()
        self._session.trust_env = False
        self._session.headers.update(
            {
                "Authorization": f"Bearer {bot_token}",
                "Accept": "application/json",
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "Reflow-Operator/1",
            }
        )

    def permits_target(self, target: OperatorTarget) -> bool:
        return (
            target.authority == self.authority
            and target.resource_type == self.resource_type
            and target.resource_identifier == SLACK_DEMO_RESOURCE
        )

    def _require_target(self, target: OperatorTarget) -> None:
        if not self.permits_target(target):
            raise OperatorAdapterError("slack_target_not_permitted")

    def _request(self, method: str, **parameters: Any) -> dict[str, Any]:
        if method not in {
            "auth.test",
            "conversations.info",
            "conversations.history",
            "chat.postMessage",
        }:
            raise OperatorAdapterError("slack_method_not_permitted")
        if method != "auth.test" and parameters.get("channel") != self._channel_id:
            raise OperatorAdapterError("slack_target_not_permitted")
        diagnostics = {"slack_channel_id": self._channel_id, "slack_operation": method}
        json_method = method in {"auth.test", "chat.postMessage"}
        try:
            response = self._session.request(
                "POST" if json_method else "GET",
                f"https://slack.com/api/{method}",
                json=parameters if json_method else None,
                params=None if json_method else parameters,
                timeout=self._timeout,
                allow_redirects=False,
            )
        except requests.Timeout:
            raise OperatorAdapterError("slack_timeout", diagnostics) from None
        except requests.RequestException:
            raise OperatorAdapterError("slack_transport", diagnostics) from None
        diagnostics["slack_http_status"] = str(response.status_code)
        correlation = response.headers.get("x-slack-req-id", "")
        if (
            isinstance(correlation, str)
            and re.fullmatch(r"[a-fA-F0-9-]{8,80}", correlation)
            and self._token not in correlation
        ):
            diagnostics["slack_request_id"] = correlation
        retry_after = response.headers.get("Retry-After", "")
        if isinstance(retry_after, str) and re.fullmatch(r"[0-9]{1,6}", retry_after):
            diagnostics["slack_retry_after_seconds"] = retry_after
        try:
            payload = response.json()
        except ValueError:
            payload = None
        if isinstance(payload, dict) and isinstance(payload.get("ok"), bool):
            diagnostics["slack_ok"] = str(payload["ok"]).lower()
        code = payload.get("error") if isinstance(payload, dict) else None
        # Never persist an arbitrary provider string, even in the error-code field.
        if isinstance(code, str) and code in self._ERROR_CATEGORIES:
            diagnostics["slack_error_code"] = code
        category = {
            401: "slack_authentication",
            403: "slack_permission",
            404: "slack_not_found",
            429: "slack_rate_limit",
        }.get(response.status_code)
        if response.status_code >= 500:
            category = "slack_server"
        elif category is None and response.status_code != 200:
            category = "slack_provider_error"
        if category:
            raise OperatorAdapterError(category, diagnostics)
        if not isinstance(payload, dict) or not isinstance(payload.get("ok"), bool):
            raise OperatorAdapterError("slack_malformed_response", diagnostics)
        if payload["ok"] is not True:
            category = (
                self._ERROR_CATEGORIES.get(code, "slack_provider_error")
                if isinstance(code, str)
                else "slack_provider_error"
            )
            raise OperatorAdapterError(category, diagnostics)
        if method == "auth.test":
            scopes = response.headers.get("x-oauth-scopes", "")
            granted = set(scopes.replace(",", " ").split()) if isinstance(scopes, str) else set()
            if not granted >= SLACK_REQUIRED_SCOPES:
                raise OperatorAdapterError("slack_required_scopes_unconfirmed", diagnostics)
        return payload

    def _history(self, **bounds: Any) -> list[dict[str, Any]]:
        payload = self._request("conversations.history", channel=self._channel_id, **bounds)
        messages = payload.get("messages")
        if (
            not isinstance(messages, list)
            or len(messages) > bounds["limit"]
            or any(not isinstance(item, dict) for item in messages)
        ):
            raise OperatorAdapterError("slack_malformed_response")
        # No pagination, conversations.list, search, replies, member lookup or unrelated history.
        return messages

    def _observed_text(self, value: Any) -> str | None:
        if not isinstance(value, str) or len(value) > SLACK_MESSAGE_LIMIT * 6:
            return None
        decoded = decode_slack_text(value)
        if len(decoded) > SLACK_MESSAGE_LIMIT or self._token in decoded:
            return None
        # Preserve exact text; redacted/truncated/stripped text must never verify as equal.
        if safe_text(decoded, SLACK_MESSAGE_LIMIT) != decoded.strip():
            return None
        return decoded

    def inspect(self, target: OperatorTarget) -> dict[str, str | None]:
        self._require_target(target)
        identity = self._request("auth.test")
        user_id, bot_id = identity.get("user_id"), identity.get("bot_id")
        if (
            identity.get("team_id") != self._team_id
            or not isinstance(user_id, str)
            or not re.fullmatch(r"[UW][A-Z0-9]{8,20}", user_id)
            or not isinstance(bot_id, str)
            or not re.fullmatch(r"B[A-Z0-9]{8,20}", bot_id)
        ):
            raise OperatorAdapterError("slack_identity_mismatch")
        channel = self._request("conversations.info", channel=self._channel_id).get("channel")
        if not isinstance(channel, dict):
            raise OperatorAdapterError("slack_malformed_response")
        if (
            channel.get("id") != self._channel_id
            or channel.get("is_channel") is not True
            or channel.get("is_private") is not False
            or channel.get("is_member") is not True
            or channel.get("is_archived") is not False
            or channel.get("is_shared") is not False
            or any(
                channel.get(key, False) is not False
                for key in (
                    "is_im",
                    "is_mpim",
                    "is_group",
                    "is_ext_shared",
                    "is_org_shared",
                    "is_pending_ext_shared",
                    "is_read_only",
                    "is_thread_only",
                    "is_frozen",
                )
            )
        ):
            raise OperatorAdapterError("slack_channel_not_permitted")
        name = channel.get("name")
        if (
            not isinstance(name, str)
            or not re.fullmatch(r"[a-z0-9_-]{1,80}", name)
            or self._token in name
            or safe_text(name, 80) != name
        ):
            raise OperatorAdapterError("slack_malformed_response")
        latest: dict[str, Any] = {}
        for message in self._history(limit=15):
            if (
                message.get("type") == "message"
                and message.get("user") == user_id
                and message.get("bot_id") == bot_id
            ):
                latest = message
                break
        latest_ts = latest.get("ts")
        return {
            "channel_id": self._channel_id,
            "channel_name": name,
            "team_id": self._team_id,
            "bot_user_id": user_id,
            "bot_id": bot_id,
            "channel_kind": "public_unshared",
            "is_member": "true",
            "latest_reflow_message_ts": latest_ts
            if isinstance(latest_ts, str) and self._TS.fullmatch(latest_ts)
            else None,
            "latest_reflow_message_text": self._observed_text(latest.get("text")),
        }

    def propose(
        self,
        target: OperatorTarget,
        operations: tuple[RequestedOperation, ...],
        current: dict[str, str | None],
    ) -> dict[str, str]:
        self._require_target(target)
        if len(operations) != 1 or operations[0].operation != "SLACK_POST_MESSAGE":
            raise OperatorAdapterError("unsupported_slack_mutation")
        reason = slack_message_denial(operations[0].value)
        if reason:
            raise OperatorAdapterError(reason)
        if (
            current.get("channel_id") != self._channel_id
            or current.get("team_id") != self._team_id
            or current.get("is_member") != "true"
        ):
            raise OperatorAdapterError("slack_target_not_permitted")
        return {
            "slack_channel_id": self._channel_id,
            "slack_team_id": self._team_id,
            "slack_format": "plain_text",
        }

    def execute(
        self,
        action_id: str,
        target: OperatorTarget,
        operations: tuple[RequestedOperation, ...],
        current: dict[str, str | None],
        proposal: dict[str, str],
    ) -> AdapterExecution:
        resolved = self.propose(target, operations, current)
        if any(proposal.get(k) != v for k, v in resolved.items()):
            raise OperatorAdapterError("slack_proposal_mismatch")
        text = operations[0].value or ""
        started = f"{datetime.now(UTC).timestamp():.6f}"
        try:
            result = self._request(
                "chat.postMessage",
                channel=self._channel_id,
                text=encode_slack_text(text),
                mrkdwn=False,
                parse="none",
                link_names=False,
                unfurl_links=False,
                unfurl_media=False,
            )
            ts = result.get("ts")
            if (
                result.get("channel") != self._channel_id
                or not isinstance(ts, str)
                or not self._TS.fullmatch(ts)
            ):
                raise OperatorAdapterError("slack_invalid_acknowledgement")
        except OperatorAdapterError as error:
            if error.category not in self._UNCERTAIN:
                raise
            diagnostics = {**error.diagnostics, "slack_write_outcome": "uncertain"}
            try:
                candidates = self._history(limit=15, oldest=started, inclusive=True)
                count = sum(
                    item.get("type") == "message"
                    and item.get("user") == current.get("bot_user_id")
                    and item.get("bot_id") == current.get("bot_id")
                    and self._observed_text(item.get("text")) == text
                    for item in candidates
                )
                diagnostics.update(
                    {
                        "slack_reconciliation": "bounded_candidates_not_attributable",
                        "slack_candidate_count_in_window": str(count),
                    }
                )
            except OperatorAdapterError:
                diagnostics["slack_reconciliation"] = "read_unavailable"
            # Text alone cannot attribute a candidate to this action. Do not manufacture
            # an ACK, VERIFIED receipt, or second POST. The durable FAILED record replays.
            raise OperatorAdapterError(error.category, diagnostics) from None
        return AdapterExecution(
            expected_state={
                "channel_id": self._channel_id,
                "message_ts": ts,
                "text": text,
                "bot_user_id": current.get("bot_user_id"),
                "bot_id": current.get("bot_id"),
            },
            acknowledgement={"channel_id": self._channel_id, "message_ts": ts, "slack_ok": "true"},
        )

    def read_back(
        self,
        target: OperatorTarget,
        acknowledgement: dict[str, str],
    ) -> dict[str, str | None]:
        self._require_target(target)
        ts = acknowledgement.get("message_ts", "")
        if acknowledgement.get("channel_id") != self._channel_id or not self._TS.fullmatch(ts):
            raise OperatorAdapterError("slack_invalid_acknowledgement")
        messages = self._history(limit=1, oldest=ts, latest=ts, inclusive=True)
        message = messages[0] if messages else {}
        return {
            "channel_id": self._channel_id,
            "message_ts": ts
            if message.get("ts") == ts and message.get("type") == "message"
            else None,
            "text": self._observed_text(message.get("text")),
            "bot_user_id": self._safe_id(message.get("user"), r"[UW][A-Z0-9]{8,20}"),
            "bot_id": self._safe_id(message.get("bot_id"), r"B[A-Z0-9]{8,20}"),
        }

    @staticmethod
    def _safe_id(value: Any, pattern: str) -> str | None:
        return value if isinstance(value, str) and re.fullmatch(pattern, value) else None

    def verify(
        self,
        expected: dict[str, str | None],
        observed: dict[str, str | None],
    ) -> tuple[bool, dict[str, str]]:
        required = {"channel_id", "message_ts", "text", "bot_user_id", "bot_id"}
        passed = (
            set(expected) == required
            and expected.get("channel_id") == self._channel_id
            and all(
                expected.get(key) is not None and expected[key] == observed.get(key)
                for key in required
            )
        )
        return passed, {
            "slack_verifier": "independent_history_exact_match",
            "slack_exact_match": str(passed).lower(),
        }

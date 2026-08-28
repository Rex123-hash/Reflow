"""Bounded server-side Jira Cloud REST adapter for Operator actions."""

from __future__ import annotations

import base64
import re
from datetime import date
from typing import Any, ClassVar
from urllib.parse import urlsplit

import requests
from requests import Response

from objective_recovery_agent.operator_actions import AdapterExecution, OperatorAdapterError
from objective_recovery_agent.operator_context import safe_text
from objective_recovery_agent.operator_schemas import (
    Authority,
    OperatorTarget,
    RequestedOperation,
    ResourceType,
)


class JiraOperatorAdapter:
    authority: Authority = "JIRA"
    resource_type: ResourceType = "ISSUE"
    operations = frozenset(
        {
            "JIRA_TRANSITION",
            "JIRA_SET_PRIORITY",
            "JIRA_ASSIGN",
            "JIRA_SET_DUE_DATE",
            "JIRA_ADD_COMMENT",
        }
    )
    _ISSUE = re.compile(r"^[A-Z][A-Z0-9]{0,19}-[1-9][0-9]{0,9}$")
    _PRIORITIES: ClassVar[set[str]] = {"highest", "high", "medium", "low", "lowest"}

    def __init__(
        self,
        *,
        base_url: str,
        email: str,
        api_token: str,
        demo_issue_key: str,
        allowed_account_ids: frozenset[str] = frozenset(),
        timeout: float = 15,
        session: Any | None = None,
    ) -> None:
        parsed = urlsplit(base_url)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or not parsed.hostname.endswith(".atlassian.net")
            or parsed.username
            or parsed.password
            or parsed.port not in {None, 443}
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("Jira base URL must be one configured HTTPS origin")
        if not email or not api_token or not self._ISSUE.fullmatch(demo_issue_key):
            raise ValueError("Complete Jira Cloud demo configuration is required")
        self._base_url = base_url.rstrip("/")
        self._demo_issue_key = demo_issue_key
        self.resource_identifiers: tuple[str, ...] = (demo_issue_key,)
        self._project_key = demo_issue_key.split("-", 1)[0]
        self._allowed_account_ids = allowed_account_ids
        if not allowed_account_ids:
            self.operations = self.operations - {"JIRA_ASSIGN"}
        self._timeout = timeout
        basic_credential = base64.b64encode(f"{email}:{api_token}".encode()).decode()
        self._diagnostic_secrets = (api_token, basic_credential)
        self._session = session or requests.Session()
        self._session.auth = (email, api_token)
        self._session.headers.update(
            {"Accept": "application/json", "User-Agent": "Reflow-Operator/1"}
        )

    def permits_target(self, target: OperatorTarget) -> bool:
        return (
            target.authority == "JIRA"
            and target.resource_type == "ISSUE"
            and target.resource_identifier == self._demo_issue_key
        )

    def _safe_error_text(self, value: Any, limit: int = 240) -> str | None:
        if not isinstance(value, str):
            return None
        text = value
        for secret in self._diagnostic_secrets:
            text = text.replace(secret, "[redacted]")
        if any(marker in text.casefold() for marker in ("authorization", "cookie", "basic ")):
            text = "[redacted]"
        cleaned = safe_text(text, limit)
        return None if cleaned == "Unavailable" else cleaned

    def _error_diagnostics(
        self,
        response: Response,
        category: str,
        *,
        operation_type: str | None,
        target_issue_key: str | None,
    ) -> dict[str, str]:
        diagnostics = {
            "jira_http_status": str(response.status_code),
            "jira_error_category": category,
        }
        if operation_type:
            diagnostics["jira_operation_type"] = operation_type[:80]
        if target_issue_key and self._ISSUE.fullmatch(target_issue_key):
            diagnostics["jira_target_issue_key"] = target_issue_key
        headers = getattr(response, "headers", {})
        if hasattr(headers, "get"):
            for name in ("atl-traceid", "x-arequestid", "x-request-id", "x-trace-id"):
                correlation = headers.get(name)
                if isinstance(correlation, str) and re.fullmatch(
                    r"[A-Za-z0-9._:-]{1,128}", correlation
                ):
                    diagnostics["jira_request_correlation_id"] = correlation
                    break
        try:
            payload = response.json()
        except ValueError:
            return diagnostics
        if not isinstance(payload, dict):
            return diagnostics
        messages = payload.get("errorMessages")
        if isinstance(messages, list):
            safe_messages = [
                text
                for text in (self._safe_error_text(item) for item in messages[:3])
                if text is not None
            ]
            if safe_messages:
                diagnostics["jira_error_messages"] = " | ".join(safe_messages)[:720]
        field_errors = payload.get("errors")
        if isinstance(field_errors, dict):
            safe_fields: list[str] = []
            for key in sorted(field_errors, key=str)[:5]:
                safe_key = self._safe_error_text(str(key), 80)
                safe_value = self._safe_error_text(field_errors[key], 240)
                if safe_key and safe_value:
                    safe_fields.append(f"{safe_key}: {safe_value}")
            if safe_fields:
                diagnostics["jira_field_errors"] = " | ".join(safe_fields)[:1000]
        return diagnostics

    def _request(
        self,
        method: str,
        path: str,
        *,
        operation_type: str | None = None,
        target_issue_key: str | None = None,
        **kwargs: Any,
    ) -> Response:
        if not path.startswith("/rest/api/3/") or "://" in path:
            raise OperatorAdapterError("jira_target_rejected")
        if "json" in kwargs:
            kwargs["headers"] = {
                **kwargs.get("headers", {}),
                "Content-Type": "application/json",
            }
        try:
            response = self._session.request(
                method,
                f"{self._base_url}{path}",
                timeout=self._timeout,
                allow_redirects=False,
                **kwargs,
            )
        except requests.Timeout as error:
            raise OperatorAdapterError("jira_timeout") from error
        except requests.RequestException as error:
            raise OperatorAdapterError("jira_transport") from error
        category = None
        if response.status_code == 401:
            category = "jira_authentication"
        elif response.status_code == 403:
            category = "jira_permission"
        elif response.status_code == 404:
            category = "jira_not_found"
        elif response.status_code == 429:
            category = "jira_rate_limit"
        elif response.status_code >= 500:
            category = "jira_server"
        elif not 200 <= response.status_code < 300:
            category = "jira_invalid_request"
        if category:
            raise OperatorAdapterError(
                category,
                self._error_diagnostics(
                    response,
                    category,
                    operation_type=operation_type,
                    target_issue_key=target_issue_key,
                ),
            )
        return response

    @staticmethod
    def _json(response: Response) -> dict[str, Any]:
        try:
            value = response.json()
        except ValueError as error:
            raise OperatorAdapterError("jira_invalid_response") from error
        if not isinstance(value, dict):
            raise OperatorAdapterError("jira_invalid_response")
        return value

    @classmethod
    def _plain_text(cls, value: Any) -> str:
        chunks: list[str] = []

        def visit(node: Any) -> None:
            if isinstance(node, dict):
                if node.get("type") == "text" and isinstance(node.get("text"), str):
                    chunks.append(node["text"])
                for child in (
                    node.get("content", ()) if isinstance(node.get("content"), list) else ()
                ):
                    visit(child)
            elif isinstance(node, list):
                for child in node:
                    visit(child)
            elif isinstance(node, str):
                chunks.append(node)

        visit(value)
        return safe_text(" ".join(chunks), 800)

    def inspect(self, target: OperatorTarget) -> dict[str, str | None]:
        if not self.permits_target(target):
            raise OperatorAdapterError("jira_target_not_permitted")
        fields = "summary,status,priority,assignee,duedate,description"
        response = self._request(
            "GET", f"/rest/api/3/issue/{target.resource_identifier}", params={"fields": fields}
        )
        payload = self._json(response)
        data = payload.get("fields")
        if not isinstance(data, dict) or payload.get("key") != target.resource_identifier:
            raise OperatorAdapterError("jira_invalid_response")

        def nested_name(key: str) -> str | None:
            item = data.get(key)
            return str(item.get("name")) if isinstance(item, dict) and item.get("name") else None

        assignee = data.get("assignee")
        return {
            "issue_key": target.resource_identifier,
            "summary": safe_text(str(data.get("summary") or "Unavailable"), 800),
            "status": nested_name("status"),
            "priority": nested_name("priority"),
            "assignee_account_id": (
                str(assignee.get("accountId"))
                if isinstance(assignee, dict) and assignee.get("accountId")
                else None
            ),
            "assignee_display_name": (
                safe_text(str(assignee.get("displayName")), 200)
                if isinstance(assignee, dict) and assignee.get("displayName")
                else None
            ),
            "due_date": str(data.get("duedate")) if data.get("duedate") else None,
            "description": self._plain_text(data.get("description")),
        }

    def _resolve_transition(self, issue_key: str, requested: str) -> tuple[str, str]:
        payload = self._json(self._request("GET", f"/rest/api/3/issue/{issue_key}/transitions"))
        items = payload.get("transitions")
        if not isinstance(items, list):
            raise OperatorAdapterError("jira_invalid_response")
        matches = []
        for item in items:
            if not isinstance(item, dict):
                continue
            destination = item.get("to")
            names = {str(item.get("name", "")).casefold()}
            if isinstance(destination, dict):
                names.add(str(destination.get("name", "")).casefold())
            if requested.casefold() in names and item.get("id") is not None:
                matches.append(
                    (
                        str(item["id"]),
                        str(destination.get("name", requested))
                        if isinstance(destination, dict)
                        else requested,
                    )
                )
        if len(matches) != 1:
            raise OperatorAdapterError(
                "jira_transition_unavailable" if not matches else "jira_transition_ambiguous"
            )
        return matches[0]

    def _resolve_assignee(self, query: str) -> tuple[str, str]:
        if not self._allowed_account_ids:
            raise OperatorAdapterError("jira_assignment_not_configured")
        response = self._request(
            "GET",
            "/rest/api/3/user/assignable/search",
            params={"issueKey": self._demo_issue_key, "query": query, "maxResults": 21},
        )
        try:
            values = response.json()
        except ValueError as error:
            raise OperatorAdapterError("jira_invalid_response") from error
        if not isinstance(values, list):
            raise OperatorAdapterError("jira_invalid_response")
        if len(values) >= 21:
            raise OperatorAdapterError("jira_assignee_ambiguous")
        candidates = [
            item
            for item in values
            if isinstance(item, dict)
            and item.get("active", True)
            and isinstance(item.get("accountId"), str)
            and item["accountId"] in self._allowed_account_ids
        ]
        exact = [
            item
            for item in candidates
            if query.casefold()
            in {
                str(item.get("displayName", "")).casefold(),
                str(item.get("emailAddress", "")).casefold(),
            }
        ]
        selected = exact if exact else candidates
        if len(selected) != 1:
            raise OperatorAdapterError(
                "jira_assignee_not_found" if not selected else "jira_assignee_ambiguous"
            )
        return str(selected[0]["accountId"]), safe_text(
            str(selected[0].get("displayName") or query), 200
        )

    @staticmethod
    def _comment_document(text: str) -> dict[str, Any]:
        if (
            not isinstance(text, str)
            or not text.strip()
            or len(text) > 1000
            or any(ord(character) < 32 and character not in "\n\t" for character in text)
        ):
            raise OperatorAdapterError("jira_comment_invalid")
        return {
            "type": "doc",
            "version": 1,
            "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}],
        }

    def propose(
        self,
        target: OperatorTarget,
        operations: tuple[RequestedOperation, ...],
        current: dict[str, str | None],
    ) -> dict[str, str]:
        del current
        if not self.permits_target(target):
            raise OperatorAdapterError("jira_target_not_permitted")
        proposal: dict[str, str] = {}
        for item in operations:
            if item.operation not in self.operations:
                raise OperatorAdapterError("jira_operation_not_supported")
            value = item.value or ""
            if item.operation == "JIRA_TRANSITION":
                transition_id, destination = self._resolve_transition(
                    target.resource_identifier, value
                )
                proposal["transition_id"] = transition_id
                proposal["transition_destination"] = destination
            elif item.operation == "JIRA_ASSIGN":
                account_id, display_name = self._resolve_assignee(value)
                proposal["assignee_account_id"] = account_id
                proposal["assignee_display_name"] = display_name
            elif item.operation == "JIRA_SET_PRIORITY" and value.casefold() not in self._PRIORITIES:
                raise OperatorAdapterError("jira_priority_not_allowed")
            elif item.operation == "JIRA_SET_DUE_DATE":
                try:
                    due = date.fromisoformat(value)
                except ValueError as error:
                    raise OperatorAdapterError("jira_due_date_invalid") from error
                if abs((due - date.today()).days) > 365:
                    raise OperatorAdapterError("jira_due_date_out_of_bounds")
        return proposal

    def execute(
        self,
        action_id: str,
        target: OperatorTarget,
        operations: tuple[RequestedOperation, ...],
        current: dict[str, str | None],
        proposal: dict[str, str],
    ) -> AdapterExecution:
        if not self.permits_target(target):
            raise OperatorAdapterError("jira_target_not_permitted")
        expected: dict[str, str | None] = {}
        ack: dict[str, str] = {"issue_key": target.resource_identifier}
        for item in operations:
            value = item.value or ""
            if item.operation == "JIRA_TRANSITION":
                transition_id = proposal.get("transition_id")
                destination = proposal.get("transition_destination")
                if not transition_id or not destination:
                    raise OperatorAdapterError("jira_transition_not_resolved")
                self._request(
                    "POST",
                    f"/rest/api/3/issue/{target.resource_identifier}/transitions",
                    operation_type=item.operation,
                    target_issue_key=target.resource_identifier,
                    json={"transition": {"id": transition_id}},
                )
                expected["status"] = destination
                ack["transition"] = "accepted"
            elif item.operation == "JIRA_SET_PRIORITY":
                self._request(
                    "PUT",
                    f"/rest/api/3/issue/{target.resource_identifier}",
                    operation_type=item.operation,
                    target_issue_key=target.resource_identifier,
                    json={"fields": {"priority": {"name": value}}},
                )
                expected["priority"] = value
                ack["priority"] = "accepted"
            elif item.operation == "JIRA_ASSIGN":
                account_id = proposal.get("assignee_account_id")
                display_name = proposal.get("assignee_display_name")
                if not account_id or not display_name:
                    raise OperatorAdapterError("jira_assignee_not_resolved")
                self._request(
                    "PUT",
                    f"/rest/api/3/issue/{target.resource_identifier}/assignee",
                    operation_type=item.operation,
                    target_issue_key=target.resource_identifier,
                    json={"accountId": account_id},
                )
                expected["assignee_account_id"] = account_id
                expected["assignee_display_name"] = display_name
                ack["assignee"] = "accepted"
            elif item.operation == "JIRA_SET_DUE_DATE":
                self._request(
                    "PUT",
                    f"/rest/api/3/issue/{target.resource_identifier}",
                    operation_type=item.operation,
                    target_issue_key=target.resource_identifier,
                    json={"fields": {"duedate": value}},
                )
                expected["due_date"] = value
                ack["due_date"] = "accepted"
            elif item.operation == "JIRA_ADD_COMMENT":
                comment = item.comment or ""
                response = self._request(
                    "POST",
                    f"/rest/api/3/issue/{target.resource_identifier}/comment",
                    operation_type=item.operation,
                    target_issue_key=target.resource_identifier,
                    json={
                        "body": self._comment_document(comment),
                        "properties": [
                            {
                                "key": "reflow.operator_action_id",
                                "value": {"operator_action_id": action_id},
                            }
                        ],
                    },
                )
                payload = self._json(response)
                comment_id = payload.get("id")
                if not isinstance(comment_id, str) or not re.fullmatch(r"[0-9]{1,30}", comment_id):
                    raise OperatorAdapterError("jira_comment_ack_invalid")
                expected[f"comment:{comment_id}"] = comment
                ack["comment_id"] = comment_id
            else:
                raise OperatorAdapterError("jira_operation_not_supported")
        return AdapterExecution(expected, ack)

    def read_back(
        self, target: OperatorTarget, acknowledgement: dict[str, str]
    ) -> dict[str, str | None]:
        observed = self.inspect(target)
        comment_id = acknowledgement.get("comment_id")
        if comment_id:
            if not re.fullmatch(r"[0-9]{1,30}", comment_id):
                raise OperatorAdapterError("jira_comment_ack_invalid")
            payload = self._json(
                self._request(
                    "GET",
                    f"/rest/api/3/issue/{target.resource_identifier}/comment/{comment_id}",
                )
            )
            if payload.get("id") != comment_id:
                raise OperatorAdapterError("jira_comment_readback_id_mismatch")
            # Verify the exact ADF document sent, not a lossy/sanitized preview.
            observed[f"comment:{comment_id}"] = self._comment_text(payload.get("body"))
        return observed

    def verify(
        self, expected: dict[str, str | None], observed: dict[str, str | None]
    ) -> tuple[bool, dict[str, str]]:
        differences = [key for key, value in expected.items() if observed.get(key) != value]
        return not differences, {
            "comparison": "PASSED" if not differences else "FAILED",
            "difference_count": str(len(differences)),
        }

    @staticmethod
    def _comment_text(body: Any) -> str | None:
        if not isinstance(body, dict):
            return None
        content = body.get("content")
        if not isinstance(content, list) or len(content) != 1:
            return None
        paragraph = content[0]
        if not isinstance(paragraph, dict) or paragraph.get("type") != "paragraph":
            return None
        nodes = paragraph.get("content")
        if not isinstance(nodes, list) or any(
            not isinstance(n, dict) or n.get("type") != "text" for n in nodes
        ):
            return None
        return "".join(str(n.get("text", "")) for n in nodes)

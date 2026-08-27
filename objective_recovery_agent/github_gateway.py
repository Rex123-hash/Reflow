"""Small GitHub REST adapter for the P1C release-validation boundary."""

from __future__ import annotations

import time
from collections.abc import Callable
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Protocol

import requests

from objective_recovery_agent.github_contract import (
    GitHubJob,
    GitHubRelease,
    GitHubReleaseIntent,
    GitHubRun,
    GitHubStep,
)


class GitHubErrorCategory(StrEnum):
    AUTHENTICATION = "authentication"
    PERMISSION = "permission"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    RATE_LIMIT = "rate_limit"
    SERVER = "server"
    TRANSPORT = "transport"
    MALFORMED = "malformed"


class GitHubAdapterError(RuntimeError):
    def __init__(
        self,
        category: GitHubErrorCategory,
        *,
        retryable: bool,
        status_code: int | None = None,
        retry_after: float | None = None,
    ) -> None:
        super().__init__(category.value)
        self.category = category
        self.retryable = retryable
        self.status_code = status_code
        self.retry_after = retry_after


class GitHubGateway(Protocol):
    def create_release(self, intent: GitHubReleaseIntent) -> GitHubRelease: ...
    def get_release(self, intent: GitHubReleaseIntent) -> GitHubRelease | None: ...
    def get_tag_sha(self, intent: GitHubReleaseIntent) -> str: ...
    def list_workflow_runs(self, intent: GitHubReleaseIntent) -> tuple[GitHubRun, ...]: ...
    def get_run_attempt(
        self, intent: GitHubReleaseIntent, run_id: int, attempt: int
    ) -> GitHubRun: ...
    def get_jobs(
        self, intent: GitHubReleaseIntent, run_id: int, attempt: int
    ) -> tuple[GitHubJob, ...]: ...


class GitHubPromotionGateway(GitHubGateway, Protocol):
    def get_release_by_id(self, intent: GitHubReleaseIntent, release_id: int) -> GitHubRelease: ...
    def get_latest_release(self, intent: GitHubReleaseIntent) -> GitHubRelease: ...
    def promote_release(self, intent: GitHubReleaseIntent, release_id: int) -> GitHubRelease: ...


def _timestamp(value: Any) -> datetime:
    if not isinstance(value, str):
        raise GitHubAdapterError(GitHubErrorCategory.MALFORMED, retryable=False)
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise GitHubAdapterError(GitHubErrorCategory.MALFORMED, retryable=False)
    return parsed.astimezone(UTC)


def _optional_timestamp(value: Any) -> datetime | None:
    return None if value is None else _timestamp(value)


class RequestsGitHubGateway:
    def __init__(
        self,
        token: str,
        *,
        timeout_seconds: float = 10.0,
        max_attempts: int = 4,
        sleep: Callable[[float], None] = time.sleep,
        session: requests.Session | None = None,
    ) -> None:
        if not token:
            raise ValueError("GitHub token is required")
        self._session = session or requests.Session()
        self._headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "Reflow-P1C",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        self._timeout = timeout_seconds
        self._max_attempts = max_attempts
        self._sleep = sleep

    @staticmethod
    def _base(intent: GitHubReleaseIntent) -> str:
        return f"https://api.github.com/repos/{intent.repository}"

    def _request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        for attempt in range(1, self._max_attempts + 1):
            try:
                response = self._session.request(
                    method, url, headers=self._headers, timeout=self._timeout, **kwargs
                )
            except requests.RequestException as error:
                if attempt == self._max_attempts:
                    raise GitHubAdapterError(
                        GitHubErrorCategory.TRANSPORT, retryable=True
                    ) from error
                self._sleep(2 ** (attempt - 1))
                continue
            if response.status_code not in {429, 502, 503, 504}:
                return response
            retry_after = response.headers.get("Retry-After")
            delay = float(retry_after) if retry_after else float(2 ** (attempt - 1))
            if attempt == self._max_attempts:
                category = (
                    GitHubErrorCategory.RATE_LIMIT
                    if response.status_code == 429
                    else GitHubErrorCategory.SERVER
                )
                raise GitHubAdapterError(
                    category,
                    retryable=True,
                    status_code=response.status_code,
                    retry_after=delay,
                )
            self._sleep(delay)
        raise AssertionError("unreachable")

    @staticmethod
    def _json(response: requests.Response) -> dict[str, Any]:
        try:
            data = response.json()
        except ValueError as error:
            raise GitHubAdapterError(GitHubErrorCategory.MALFORMED, retryable=False) from error
        if not isinstance(data, dict):
            raise GitHubAdapterError(GitHubErrorCategory.MALFORMED, retryable=False)
        return data

    @staticmethod
    def _raise(response: requests.Response, *, conflict: bool = False) -> None:
        status = response.status_code
        if status in {200, 201}:
            return
        if status == 401:
            category, retryable = GitHubErrorCategory.AUTHENTICATION, False
        elif status == 403:
            category, retryable = GitHubErrorCategory.PERMISSION, False
        elif status == 404:
            category, retryable = GitHubErrorCategory.NOT_FOUND, False
        elif status == 422 and conflict:
            category, retryable = GitHubErrorCategory.CONFLICT, False
        elif status >= 500:
            category, retryable = GitHubErrorCategory.SERVER, True
        else:
            category, retryable = GitHubErrorCategory.MALFORMED, False
        raise GitHubAdapterError(category, retryable=retryable, status_code=status)

    @staticmethod
    def _release(data: dict[str, Any]) -> GitHubRelease:
        return GitHubRelease(
            release_id=int(data["id"]),
            tag=str(data["tag_name"]),
            target_commitish=str(data["target_commitish"]),
            url=str(data["html_url"]),
            published_at=_timestamp(data["published_at"]),
            draft=bool(data["draft"]),
            prerelease=bool(data["prerelease"]),
        )

    @staticmethod
    def _run(data: dict[str, Any]) -> GitHubRun:
        return GitHubRun(
            run_id=int(data["id"]),
            run_number=int(data["run_number"]),
            run_attempt=int(data["run_attempt"]),
            workflow_id=int(data["workflow_id"]),
            workflow_path=str(data["path"]),
            event=str(data["event"]),
            display_title=str(data["display_title"]),
            head_branch=str(data["head_branch"]),
            head_sha=str(data["head_sha"]),
            status=str(data["status"]),
            conclusion=None if data.get("conclusion") is None else str(data["conclusion"]),
            created_at=_timestamp(data["created_at"]),
            started_at=_optional_timestamp(data.get("run_started_at")),
            completed_at=_optional_timestamp(data.get("updated_at")),
            url=str(data["html_url"]),
        )

    def create_release(self, intent: GitHubReleaseIntent) -> GitHubRelease:
        response = self._request(
            "POST",
            f"{self._base(intent)}/releases",
            json={
                "tag_name": intent.tag,
                "target_commitish": intent.candidate_sha,
                "name": intent.tag,
                "draft": False,
                "prerelease": True,
                "make_latest": "false",
            },
        )
        self._raise(response, conflict=True)
        return self._release(self._json(response))

    def get_release(self, intent: GitHubReleaseIntent) -> GitHubRelease | None:
        response = self._request("GET", f"{self._base(intent)}/releases/tags/{intent.tag}")
        if response.status_code == 404:
            return None
        self._raise(response)
        return self._release(self._json(response))

    def get_release_by_id(self, intent: GitHubReleaseIntent, release_id: int) -> GitHubRelease:
        response = self._request("GET", f"{self._base(intent)}/releases/{release_id}")
        self._raise(response)
        return self._release(self._json(response))

    def get_latest_release(self, intent: GitHubReleaseIntent) -> GitHubRelease:
        response = self._request("GET", f"{self._base(intent)}/releases/latest")
        self._raise(response)
        return self._release(self._json(response))

    def promote_release(self, intent: GitHubReleaseIntent, release_id: int) -> GitHubRelease:
        response = self._request(
            "PATCH",
            f"{self._base(intent)}/releases/{release_id}",
            json={"draft": False, "prerelease": False, "make_latest": "true"},
        )
        self._raise(response)
        return self._release(self._json(response))

    def get_tag_sha(self, intent: GitHubReleaseIntent) -> str:
        response = self._request("GET", f"{self._base(intent)}/git/ref/tags/{intent.tag}")
        self._raise(response)
        data = self._json(response).get("object")
        if not isinstance(data, dict) or data.get("type") != "commit":
            raise GitHubAdapterError(GitHubErrorCategory.MALFORMED, retryable=False)
        return str(data["sha"])

    def list_workflow_runs(self, intent: GitHubReleaseIntent) -> tuple[GitHubRun, ...]:
        response = self._request(
            "GET",
            f"{self._base(intent)}/actions/workflows/{intent.workflow_id}/runs",
            params={"event": "release", "branch": intent.tag, "per_page": 100},
        )
        self._raise(response)
        values = self._json(response).get("workflow_runs")
        if not isinstance(values, list):
            raise GitHubAdapterError(GitHubErrorCategory.MALFORMED, retryable=False)
        return tuple(self._run(item) for item in values if isinstance(item, dict))

    def get_run_attempt(self, intent: GitHubReleaseIntent, run_id: int, attempt: int) -> GitHubRun:
        response = self._request(
            "GET", f"{self._base(intent)}/actions/runs/{run_id}/attempts/{attempt}"
        )
        self._raise(response)
        return self._run(self._json(response))

    def get_jobs(
        self, intent: GitHubReleaseIntent, run_id: int, attempt: int
    ) -> tuple[GitHubJob, ...]:
        response = self._request(
            "GET", f"{self._base(intent)}/actions/runs/{run_id}/attempts/{attempt}/jobs"
        )
        self._raise(response)
        values = self._json(response).get("jobs")
        if not isinstance(values, list):
            raise GitHubAdapterError(GitHubErrorCategory.MALFORMED, retryable=False)
        jobs: list[GitHubJob] = []
        for item in values:
            if not isinstance(item, dict):
                raise GitHubAdapterError(GitHubErrorCategory.MALFORMED, retryable=False)
            steps = item.get("steps", [])
            if not isinstance(steps, list):
                raise GitHubAdapterError(GitHubErrorCategory.MALFORMED, retryable=False)
            jobs.append(
                GitHubJob(
                    job_id=int(item["id"]),
                    name=str(item["name"]),
                    head_sha=str(item["head_sha"]),
                    status=str(item["status"]),
                    conclusion=(
                        None if item.get("conclusion") is None else str(item["conclusion"])
                    ),
                    started_at=_optional_timestamp(item.get("started_at")),
                    completed_at=_optional_timestamp(item.get("completed_at")),
                    url=str(item["html_url"]),
                    failing_steps=tuple(
                        str(step["name"])
                        for step in steps
                        if isinstance(step, dict) and step.get("conclusion") == "failure"
                    ),
                    steps=tuple(
                        GitHubStep(
                            name=str(step.get("name", "")),
                            status=str(step.get("status", "")),
                            conclusion=(
                                None if step.get("conclusion") is None else str(step["conclusion"])
                            ),
                            number=int(step.get("number", 0)),
                        )
                        for step in steps
                        if isinstance(step, dict)
                    ),
                )
            )
        return tuple(jobs)

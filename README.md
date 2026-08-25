# Autonomous Objective Recovery Engine

This repository is a brand-new Taskmaster submission foundation for Google's All Things Agentic Hackathon 2026. It protects endangered operational objectives through deterministic impact mapping, policy-gated recovery plans, real-action contracts, independent verification, and reopen/replan behavior.

No final product name has been selected.

## Current scope

Implemented now:

- framework-independent typed domain contracts;
- deterministic operational graph and blast-radius traversal;
- deterministic hard-policy evaluation and stable plan selection;
- incident lifecycle with verifier-only resolution;
- stable action idempotency and receipt contracts;
- deterministic invariant verification that rejects missing, stale, or emulated proof;
- explicitly emulated in-memory action adapter for tests;
- unit tests, linting, formatting, and strict static typing configuration.

Not implemented or claimed yet: Gemini/ADK calls, Cloud Run, Pub/Sub, Firestore, Gmail, Calendar, GitHub, deployment, or UI. See [the compliance matrix](docs/hackathon-compliance.md).

## Local setup

Prerequisite: Python 3.12+ and [uv](https://docs.astral.sh/uv/).

```bash
uv sync --dev
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run mypy src tests
```

The package uses a `src/` layout. No credentials are required for the P0 foundation.

## Design documents

- [Research audit](docs/research-audit.md)
- [Product specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Hackathon compliance](docs/hackathon-compliance.md)
- [Pre-existing work disclosure](PREEXISTING_WORK_DISCLOSURE.md)

## Truthfulness boundary

In-memory adapters produce `EMULATED` receipts and can never satisfy external-proof invariants. A successful write receipt is not objective verification, and model output will never be authorized to resolve an incident.

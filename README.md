# Autonomous Objective Recovery Engine

This repository is a brand-new Taskmaster submission for Google's All Things Agentic Hackathon 2026. It protects endangered operational objectives through deterministic impact mapping and policy-gated recovery planning.

No final product name has been selected.

## Current scope

P1A implemented now:

- framework-independent typed domain contracts;
- deterministic operational graph and blast-radius traversal;
- deterministic hard-policy evaluation and stable plan selection;
- incident lifecycle with verifier-only resolution;
- stable action idempotency and receipt contracts;
- deterministic invariant verification that rejects missing, stale, or emulated proof;
- explicitly emulated in-memory action adapter for tests;
- unit tests, linting, formatting, and strict static typing configuration.
- authenticated Pub/Sub push delivery to a private Cloud Run service;
- Firestore-authoritative incident checkpoints, transactional event claims, and deduplication;
- a real Google ADK 2.7.1 structured workflow on Vertex AI `gemini-3.7-flash`;
- three typed deadline/risk/resource recovery alternatives and a separate risk critic;
- deterministic policy validation, stable selection, and structured workflow events;
- measured real-cloud planning, end-to-end, and duplicate-delivery behavior.

Intentionally not implemented: Gmail, Calendar, GitHub, authentication, UI, external actions, or incident resolution. P1A stops at `PLAN_SELECTED`. See [the live proof](docs/p1a-live-proof.md) and [compliance matrix](docs/hackathon-compliance.md).

## Local setup

Prerequisite: Python 3.12+ and [uv](https://docs.astral.sh/uv/).

```bash
uv sync --dev
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run mypy src objective_recovery_agent tests scripts
```

The package uses a `src/` layout. No credentials are required for the P0 foundation.

## Design documents

- [Research audit](docs/research-audit.md)
- [Product specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Hackathon compliance](docs/hackathon-compliance.md)
- [P1A planner experiment](docs/p1a-planner-experiment.md)
- [P1A real-cloud proof](docs/p1a-live-proof.md)
- [Pre-existing work disclosure](PREEXISTING_WORK_DISCLOSURE.md)

## Truthfulness boundary

In-memory adapters produce `EMULATED` receipts and can never satisfy external-proof invariants. Model output is schema-validated and policy-checked but can never resolve an incident. The deployed P1A service exposes no external action endpoint.

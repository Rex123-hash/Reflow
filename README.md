# Autonomous Objective Recovery Engine

This repository is a brand-new Taskmaster submission for Google's All Things Agentic Hackathon 2026. It protects endangered operational objectives through deterministic impact mapping and policy-gated recovery planning.

No final product name has been selected.

## Current scope

Frozen P1A plus the P1B Calendar execution boundary:

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
- measured real-cloud planning, end-to-end, and duplicate-delivery behavior;
- a code-derived, typed, low-risk release coordination block authorized only for one dedicated
  demo calendar;
- caller-supplied deterministic Calendar event identity and Firestore action claims/receipts;
- durable `PENDING -> WRITE_ACKNOWLEDGED -> VERIFIED|VERIFICATION_FAILED` receipt progression;
- a separate Calendar `GET` and deterministic expected-versus-observed comparison;
- bounded retry/error classification and tested write-before-receipt/restart recovery.

Intentionally not implemented: Gmail, GitHub, product authentication, UI, failure/replanning,
objective restoration, or incident resolution. P1B stops in `VERIFYING`; a verified Calendar
receipt proves only the scoped action, not the objective. See [the P1A live proof](docs/p1a-live-proof.md),
[P1B design/proof record](docs/p1b-calendar-proof.md), and [compliance matrix](docs/hackathon-compliance.md).

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
- [P1B Calendar design and proof](docs/p1b-calendar-proof.md)
- [Pre-existing work disclosure](PREEXISTING_WORK_DISCLOSURE.md)

## Truthfulness boundary

In-memory adapters produce `EMULATED` receipts and can never satisfy external-proof invariants.
Model output is schema-validated and policy-checked but cannot directly reach Calendar or resolve
an incident. The P1B adapter accepts only a deterministic code-derived intent for the configured
dedicated calendar, and its insert response is never used as verification proof.

# Product specification

Working descriptor: **Autonomous Objective Recovery Engine**. No final brand name has been selected.

## Problem

Operational tools track tasks and incidents, but an unexpected event can endanger a business outcome across multiple dependencies. Humans then reconstruct impact, compare recovery options, check policy, coordinate tools, and decide when the outcome is genuinely safe. Existing automation often stops at notification, recommendation, reassignment, or a successful API response.

## Target user and wedge

The initial user is a delivery lead at a small, fast-moving software/product team. The engine preserves an explicit outcome rather than merely managing work. Its differentiated unit of completion is a verified objective, not a closed ticket or successful tool call.

## Canonical objective and world

Objective: **SHIP RELEASE V2 BY FRIDAY AT 5:00 PM.**

The reproducible demo world contains approximately six people, 10–15 work items, explicit dependency edges, skills, availability and workload, commitments, protected deadlines, selected Calendar state, selected GitHub state, policies, and objective invariants.

Initial invariants include:

1. Required release work is complete or has feasible owners and completion windows before the protected deadline.
2. Required code review and QA approval remain scheduled and staffed.
3. The release branch's required CI check is passing.
4. No selected recovery action violates protected commitments, permission boundaries, required skills, or workload ceilings.

## Canonical event

A dedicated Gmail account receives a genuine message indicating that the lead backend engineer is unavailable. Gmail watch emits a mailbox-change notification to Pub/Sub. A Cloud Run endpoint retrieves Gmail history and message evidence; the user does not type the disruption into the product.

## Closed-loop workflow

```text
external event
  -> interpret typed disruption
  -> create/deduplicate incident
  -> deterministic blast-radius traversal
  -> identify threatened objective and failed invariants
  -> generate 2–3 materially different recovery futures
  -> adversarial critique
  -> deterministic policy/unknown validation
  -> stable best-valid-plan selection
  -> real side effects with stable idempotency keys
  -> durable receipts
  -> independent external read-back
  -> deterministic objective verification
      -> pass: RESOLVED
      -> fail: VERIFICATION_FAILED -> REPLANNING -> new/compensating actions -> verify again
```

The second disruption will be genuine: a reproducible GitHub required-check/CI failure or real access-state change. A hard-coded failure flag cannot be presented as that evidence.

## Authority boundary

- Gemini interprets ambiguous evidence, proposes different futures, critiques risk, and produces concise explanations.
- Deterministic code owns graph traversal, arithmetic, hard policies, unknown handling, idempotency, legal state transitions, plan selection, and invariants.
- Adapters alone mutate external systems.
- An independent verifier reads external state and decides whether evidence satisfies invariants.
- A model response and a write API success can never resolve an incident.

## Functional requirements

### P0 foundation

- Generic typed operational primitives, not GitHub-shaped core entities.
- A directed acyclic operational objective graph and deterministic reverse impact traversal.
- Hard policy evaluation with explicit violations and blocking unknowns.
- Stable selection among valid plans.
- Explicit incident lifecycle with verifier-only resolution.
- Stable idempotency keys, action receipts, and truthfully labelled emulated adapters.
- Tests for graph, policy, selection, lifecycle, idempotency, and verification behavior.

### P1A event and planning spine

- Real Pub/Sub delivery to Cloud Run and durable Firestore incident state.
- ADK/Gemini diverse-alternative planner and risk critic using typed output.
- Deterministic impact mapping, hard-policy validation, and stable plan selection.
- Durable trace events and safe at-least-once deduplication.
- Stop at `PLAN_SELECTED`; no external side effects or resolution.

### Later judged vertical slice work (not P1A)

- At least one real Calendar mutation plus read-back.
- Genuine GitHub CI/external-state failure, reopening, revised action, read-back, and restored invariants.
- Structured logs that correlate event, incident, plan, action, receipt, and verification IDs.

## Non-goals

- A complete project-management platform, generic chatbot, task board, or incident-summary product.
- Multiple industries in the demo.
- Decorative multi-agent count, generic RAG, custom predictive ML, billing, subscriptions, or 20 integrations.
- Unnecessary multimedia/Google services or a polished UI before the vertical slice works.
- Claims of universality, production deployment, external action, or impact without evidence.

## Measurable success criteria

1. Duplicate delivery of the same event produces one incident and no duplicate action.
2. Impact traversal returns the same ordered result for the same graph and rejects invalid/cyclic dependency edges.
3. At least two candidate plans differ materially; invalid plans show deterministic rejection reasons.
4. Every consequential mutation has one stable idempotency key and a durable receipt.
5. Verification uses a fresh external read and cannot pass on an emulated receipt or model assertion.
6. A real second disruption moves `VERIFYING -> VERIFICATION_FAILED -> REPLANNING` and produces revised actions.
7. `RESOLVED` is reachable only when every required invariant has fresh sufficient evidence.
8. The complete proof path and Google Cloud evidence fit into a four-minute demo.

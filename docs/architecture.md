# Architecture

## Architectural stance

The domain core is framework-independent. Google ADK orchestrates bounded reasoning in P1, while Firestore and deterministic services remain authoritative. GitHub, Gmail, and Calendar are adapters to generic operational contracts.

## System context

```mermaid
flowchart LR
    Gmail[Gmail mailbox] -->|watch notification| PubSub[Cloud Pub/Sub]
    GitHub[GitHub webhook / CI] -->|signed webhook| Ingress[Cloud Run ingress]
    PubSub -->|authenticated push| Ingress
    Ingress --> Ledger[(Firestore workflow ledger)]
    Ingress --> Orchestrator[Recovery orchestrator]

    Orchestrator --> Graph[Operational graph service]
    Orchestrator --> Agents[ADK 2 workflows]
    Agents -->|structured calls| Gemini[Vertex AI\nGemini 3.7 Flash]
    Orchestrator --> Policy[Deterministic policy engine]
    Orchestrator --> Selector[Deterministic plan selector]
    Orchestrator --> Router[Action router]

    Router --> Calendar[Google Calendar adapter]
    Router --> GitHub
    Router --> Gmail
    Router --> Receipts[(Action receipts)]

    Verifier[Objective verifier] -->|independent reads| Calendar
    Verifier -->|independent reads| GitHub
    Verifier --> Ledger
    Verifier --> Orchestrator

    Ledger --> Events[Workflow event stream]
    Events --> UI[Later: recovery command center]
```

## Boundaries

| Boundary | Owns | Must not own |
|---|---|---|
| Domain | Objective graph, policies, invariants, lifecycle, action/receipt semantics | SDKs, HTTP, database clients, prompts |
| Application | Use-case coordination, ports, stable selection | External implementation details |
| Reasoning/ADK | Typed event interpretation, candidate futures, risk critique, explanations | Hard policy decisions, lifecycle truth, resolution |
| Adapters | Gmail/GitHub/Calendar/Firestore/API mechanics | Business policy or objective truth |
| Verifier | Fresh evidence reads and deterministic invariant evaluation | Reuse of write responses as proof |

## Agent roles

1. **Event Interpreter** — maps unstructured evidence to a typed disruption with evidence references and unknowns.
2. **Recovery Planner** — two or three parallel, strategy-constrained instances return schema-valid and materially different futures.
3. **Risk Critic** — identifies contradictions, assumptions, missing evidence, and failure modes. It cannot approve a plan.

More agents require evaluation evidence or a distinct context/tool/security boundary.

## Deterministic services

- Operational Graph Service: accepted structured edges and reverse blast-radius traversal.
- Policy Engine: workload, skills, protected deadlines, permissions, and blocking unknowns.
- Plan Selector: stable ordering over valid candidates.
- Workflow Ledger: incidents, transitions, attempts, event deduplication, leases/checkpoints.
- Action Router: adapter selection and stable idempotency contract.
- Objective Verifier: evidence freshness, required checks, and invariant aggregation.

## State ownership

Firestore is the authoritative durable store for incidents, accepted graph versions, candidates, policy decisions, selected plans, action intentions, receipts, verification results, and transition history. ADK session/events are reasoning artifacts and correlation evidence, not the workflow ledger.

Writes that claim a new action intention or consume an event use a Firestore transaction. A stable key is derived from incident, plan revision, logical action, target, and intended state. Duplicate delivery returns the existing intention/receipt.

## Event flow and reliability

1. Authenticate Pub/Sub push or verify GitHub signature.
2. Parse the transport envelope and derive a source event identity.
3. Transactionally claim/deduplicate the event before acknowledgement.
4. For Gmail, call `history.list` from the persisted cursor and fetch selected message evidence.
5. Interpret evidence, persist the typed disruption, and traverse the accepted graph deterministically.
6. Generate/critique candidate plans; validate and select in code.
7. Persist action intention before dispatch; adapter writes once per stable key where the external API permits.
8. Persist receipt separately from verification.
9. Verifier performs fresh reads and evaluates objective invariants.
10. Failed verification reopens the incident and creates a new plan revision.

Retries use bounded exponential backoff with jitter at adapter boundaries. Poison events move to a dead-letter path with an explicit incident error rather than silent loss. Gmail history synchronization runs periodically because notifications can be delayed or dropped.

## Incident lifecycle

```mermaid
stateDiagram-v2
    [*] --> DETECTED
    DETECTED --> INTERPRETING
    INTERPRETING --> IMPACT_MAPPED
    IMPACT_MAPPED --> PLANNING
    PLANNING --> VALIDATING
    VALIDATING --> EXECUTING
    VALIDATING --> REPLANNING: no valid plan / new evidence
    EXECUTING --> VERIFYING
    EXECUTING --> PARTIAL_FAILURE
    PARTIAL_FAILURE --> COMPENSATING
    PARTIAL_FAILURE --> REPLANNING
    COMPENSATING --> REPLANNING
    VERIFYING --> VERIFICATION_FAILED: invariant/evidence failure
    VERIFICATION_FAILED --> REPLANNING
    REPLANNING --> VALIDATING
    VERIFYING --> RESOLVED: verifier passes every required invariant
    RESOLVED --> [*]
```

## Trust and authority rules

- Model output is untrusted typed input until schema and policy validation pass.
- Prompt-injected email text cannot alter policies or tool permissions.
- OAuth scopes and service accounts are adapter-specific and least-privilege.
- Secrets belong in Secret Manager or local ignored environment files, never Git.
- External write success is a receipt, not proof of final state.
- Emulated adapters produce `EMULATED` receipts, which objective verification rejects as external proof.
- Product surfaces show evidence and concise decision summaries, never hidden chain-of-thought.

## P0 versus planned components

P0 implements the domain/application contracts and emulated in-memory adapters only. Cloud services, credentials, ADK agents, HTTP endpoints, and UI remain planned until the owner approves cloud/account actions.

# P2C agent boundaries

P2C is a behavior-preserving backend refactor. It introduces five stable, medium-grained
reasoning identities while leaving every authorization and truth decision in deterministic code.
It does not change the frontend, external permissions, adapters, transports, or production data.

## Pre-refactor invocation audit

The default runtime had no direct `google.genai` call outside ADK. Every Gemini invocation ran
through an ADK `Agent`/`Workflow`/`Runner` boundary using `gemini-3.7-flash`.

| Pre-P2C invocation | When | Input | Output | Semantic work | Deterministic boundary after output |
|---|---|---|---|---|---|
| `gmail_disruption_interpreter` | Gmail message | normalized message plus known-node catalog | `GmailInterpretation` | classification, fact extraction, and candidate node mapping were combined | excerpt validation, known-node validation, graph traversal, protected-objective check |
| `diverse_bundle_planner` | initial recovery | `PlanningInput` | `CandidateSet` | three counterfactual recovery futures | schema/diversity validation, policy, stable selection |
| `risk_critic` | initial recovery | `CandidateSet` | `CritiqueBundle` | structured risk attack | critique-ID validation, policy, stable selection |
| `recovery_replanner` | failed recovery | `ReplanningInput` | `CandidateSet` | failure context interpretation and revised planning were combined | schema validation, failed-repeat policy, stable selection |
| `recovery_risk_critic` | failed recovery | `ReplanCriticInput` | `CritiqueBundle` | revised-plan risk attack | critique-ID validation, policy, stable selection |

Two retained experiment-only architectures are not default runtime identities:

- architecture A invokes three perspective planners in parallel and then one critic;
- architecture C invokes one strategy seeder and one plan expander.

They remain planner experiments, not additional claimed P2C core agents.

## Core reasoning agents

| Agent | Question answered | Bounded inputs | Typed outputs | Authority explicitly denied |
|---|---|---|---|---|
| Disruption Interpreter (`disruption_interpreter`) | “What happened?” | normalized Gmail evidence, without graph nodes | `DisruptionFacts` | graph mapping, blast radius, policy, planning, execution, closure |
| Impact Analyst (`impact_analyst`) | “What might this threaten?” | `DisruptionFacts` plus known-node catalog, without the raw email | `GmailInterpretation` candidate impact | graph truth, authorization, selection, execution, closure |
| Recovery Planner (`recovery_planner`) | “What recovery futures could protect the objective?” | initial `PlanningInput` or typed `RecoveryPlanningInput` | `CandidateSet` | policy authorization, final selection, execution, closure |
| Risk Critic (`risk_critic`) | “What is wrong or risky?” | candidates, plus failed-recovery context for revision 2 | `CritiqueBundle` | approval, selection, execution, closure |
| Recovery Analyst (`recovery_analyst`) | “Why did recovery fail, and what must change?” | minimized `RecoveryAnalysisInput` derived from authoritative evidence | `RecoveryAnalysis` | proposing the final plan, policy changes, selection, execution, closure |

The interpreter runs first. A non-real/irrelevant classification ends without an Impact Analyst
call. A real disruption proceeds to the Impact Analyst, then deterministic validation rejects
unknown nodes, changed excerpts, non-threatening nodes, or any mismatch with the structured facts.

For a new failed-recovery revision, P1D durably checkpoints validated `RecoveryAnalysis` before it
can invoke the Recovery Planner. A legacy revision that already contains a planner checkpoint is
replayed without creating a new analysis call. This protects the frozen historical incident.

## Deterministic authority

The following remain services/modules and are not called agents:

- dependency graph and authoritative blast-radius traversal;
- policy engine, failed-repeat policy, and protected-deadline rules;
- stable plan selector and incident state machine;
- action routing, allow-lists, idempotency keys, durable claims, and checkpoints;
- Calendar/GitHub receipt validation and independent objective verifier;
- Gmail, Calendar, and GitHub adapters; Pub/Sub transport; Firestore persistence.

Model output is untrusted until its Pydantic contract and boundary-specific grounding checks pass.
Policy and selection receive only validated structures. A verified action receipt still does not
mean the objective is restored; only the deterministic objective verifier can close the incident.

## Model-call accounting

Counts exclude retries and experiment-only architectures.

| Flow | Before P2C | After P2C | Reason for change |
|---|---:|---:|---|
| irrelevant/unsupported Gmail | 1 | 1 | impact analysis is bypassed |
| canonical real Gmail through initial selection | 3 | 4 | one candidate-impact call separates node grounding from raw evidence interpretation |
| initial orchestration from an already canonical `DisruptionEvent` | 2 | 2 | planner and critic are unchanged |
| failed recovery through revised selection | 2 | 3 | one failure-analysis call creates grounded typed replan context before planning |
| canonical Gmail plus one failed-recovery cycle | 5 | 7 | the two real boundaries above, one in each phase |

The added calls are not used for graph traversal, policy, selection, verification, or API access.
They represent reasoning that was previously co-located inside broader prompts. Their output-token
ceilings are 2,048 for impact analysis and 4,096 for recovery analysis. Interpreter context is
narrower because it no longer receives graph nodes; impact analysis receives no raw email; and
recovery analysis omits the objective graph, resources, raw external-evidence envelope, and
execution configuration. The revision-2 planner receives the existing authoritative context plus
the validated analysis, so that path has one extra serial call and additional typed context.

## Traceability and failure ownership

Every default P2C invocation emits metadata-only start/completion/failure events with:

`agent_id`, `agent_version`, `model`, `phase`, `incident_id` when available,
`recovery_attempt`, source event ID when available, input/output SHA-256 fingerprints, status,
latency, and error type. Prompts, raw outputs, email bodies, secrets, and chain-of-thought are not
logged. Revision-2 recovery analysis is also a durable, immutable phase checkpoint containing its
typed output and token/latency totals.

ADK retains the existing two-attempt model retry setting and the 45-second agent timeout. A
timeout, runner failure, JSON/schema failure, grounding mismatch, or missing failed invariant:

1. emits a failed invocation event;
2. raises a categorized boundary error;
3. cannot create a downstream planning/action checkpoint;
4. releases the durable phase claim where applicable; and
5. cannot advance state or execute an external effect.

## Scope and deployment

P2C adds no Operator Intent Interpreter, simulation agent, BFF/auth layer, assignment adapter, or
external integration. `frontend/` is untouched. No production deployment is part of this proof;
the frozen P1E/P2B authority remains read-only and unchanged.

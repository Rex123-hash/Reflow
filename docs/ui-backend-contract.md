# Reflow logged-in UI backend contract — P2A

Version: `v1`. This is the compatibility boundary for Overview, Objectives, Recovery, Evidence,
and read-only Operator context. Presentation resources are derived by the backend from durable
Reflow state. The frontend must not query Firestore or infer business truth from internal stages,
receipts, checkpoints, or collection layouts.

## Access and transport

All endpoints inherit the existing private Cloud Run posture. They do not make the service public
and do not introduce an account/IAM platform. A deployed logged-in frontend must call them through
an authenticated server/BFF or another approved path able to present a Cloud Run identity token.
For local development, use an authenticated proxy or a developer identity with `run.invoker`; do
not embed a service-account credential in browser code.

Responses are JSON. Presentation GETs include `ETag: W/"<revision>"` and
`Cache-Control: private, no-cache`. Sending the same value in `If-None-Match` returns `304` with no
body. FastAPI OpenAPI is available at protected `GET /openapi.json` and preserved in
[`ui-openapi.json`](ui-openapi.json).

## Endpoints

| Method and path | Response | Purpose |
|---|---|---|
| `GET /api/v1/ui/overview` | `OverviewView` | Current priority, objective counts, active objectives, recent activity |
| `GET /api/v1/ui/objectives?status=all\|active\|restored` | `ObjectivesView` | Small objective list with semantic filtering |
| `GET /api/v1/ui/recoveries/{incident_id}` | `RecoveryCaseView` | Coherent Recovery Room resource and evidence rail |
| `GET /api/v1/ui/evidence/{incident_id}` | `EvidencePageView` | Timeline, Receipts, Verification, Decisions tabs |
| `GET /api/v1/ui/recoveries/{incident_id}/events?after=0&limit=100` | `ExecutionEventsView` | Incremental durable execution events |
| `GET /api/v1/ui/operator/context?incident_id={incident_id}` | `OperatorContextView` | Read-only context; never executes commands |

`limit` must be 1–200. `after` is the last consumed zero-based item count; start at `0`, then send
the returned `next_cursor` as the next `after` integer.

## Enums

```text
ObjectiveHealth       HEALTHY | WATCHING | RECOVERING | NEEDS_ATTENTION | RESTORED
WorkflowStage         DETECT | IMPACT | PLAN | ACT | VERIFY | REPLAN | RESTORED
SemanticStatus        PENDING | CURRENT | COMPLETED | FAILED | UNAVAILABLE
ReceiptStatusView     PENDING | WRITE_ACKNOWLEDGED | VERIFIED
VerificationStatus    PASSED | FAILED | PENDING | UNAVAILABLE
EvidenceSemanticStatus
                      PENDING | WRITE_ACKNOWLEDGED | VERIFIED_HEALTHY |
                      VERIFIED_UNHEALTHY | UNAVAILABLE
ObjectiveFilter       all | active | restored
```

`VERIFIED_UNHEALTHY` is intentional: an action can be independently read back and therefore have
a `VERIFIED` receipt while its observed objective invariant is false. `UNAVAILABLE` means the
authority could not be read; it is never equivalent to a verified failure.

## Semantic mappings

### Objective health

| Internal persisted state | Presentation health |
|---|---|
| `RESOLVED / objective_restored` | `RESTORED` |
| Active detect/impact/plan/act/verify/replan state | `RECOVERING` |
| `VERIFICATION_FAILED`, `NO_VALID_PLAN`, `PLANNING_FAILED`, `PARTIAL_FAILURE` | `NEEDS_ATTENTION` |
| Explicit persisted healthy state | `HEALTHY` |
| Objective authority exists without a stronger observed state | `WATCHING` |

### Workflow stage

| Internal stage | UI stage |
|---|---|
| `EVENT_RECEIVED`, `EVENT_INTERPRETED` | `DETECT` |
| `IMPACT_MAPPED` | `IMPACT` |
| generation/critique/policy/selection stages, `VALIDATING`, `PLANNING_FAILED` | `PLAN` |
| `EXECUTING`, `PARTIAL_FAILURE` | `ACT` |
| `VERIFYING`, `VERIFICATION_FAILED` | `VERIFY` |
| `REPLANNING`, `NO_VALID_PLAN` | `REPLAN` |
| `RESOLVED` | `RESTORED` |

The frontend must use these returned semantic values; it must not recreate these tables.

## Exact models and nullability

Fields marked `?` are nullable. Arrays are always present and may be empty. No public model accepts
undeclared fields.

```text
ObjectiveSummary {
  objective_id, objective_version, title, health, protected_deadline,
  deadline_timezone, active_incident_id?, active_recovery_number?, workflow_stage?,
  latest_observed_state?, updated_at?
}

CurrentPriority {
  objective_id, objective_title, objective_health, active_recovery_number?,
  active_workflow_stage?, protected_deadline, deadline_timezone,
  time_remaining_seconds?, summary, incident_id?
}

ObjectiveCounts {
  active, recovering, healthy, watching_or_needs_attention, restored
}

OverviewView {
  revision, current_priority?, objective_summary, active_objectives[], recent_activity[]
}

ObjectivesView { revision, filter, items: ObjectiveSummary[] }

ObjectiveContext {
  objective_id, objective_version, title, health, protected_deadline, deadline_timezone,
  current_recovery_number, workflow_stage, incident_stage, incident_status,
  revision, is_live
}

RecoveryStageView {
  stage_id, semantic_kind, title, subtitle, status, timestamp?,
  related_evidence_ids[], failure_reason?
}

RecoveryAttemptView {
  attempt_number, label, status, branch_from_attempt?, branch_reason?, candidate_sha?,
  selected_plan_id?, stages: RecoveryStageView[]
}

RecoverySummary { what_happened, why_current_recovery_exists?, what_changed? }

GraphNodeView { node_id, label, kind, state, affected, critical_path }
GraphEdgeView { source, target, relation }
OperationalGraphView { nodes: GraphNodeView[], edges: GraphEdgeView[] }

PolicyViolationView { rule_id, message }
PolicyDecisionView { plan_id, valid, blocking_unknowns[], violations[] }

RecoveryPlanView {
  plan_id, title, revision, recovery_attempt, candidate_sha?, risk_score?, selected,
  valid?, deterministic_rejection_reason?, policy?, assumptions_summary[],
  proposed_action_summary[], critic_summary?
}

ActionReceiptView {
  action_id, receipt_id?, recovery_attempt, kind, system, desired_state_summary,
  receipt_status, write_acknowledged, write_acknowledged_at?,
  read_back_completed, read_back_at?, external_reference?, verification_state,
  evidence_id?
}

VerificationInvariantView {
  invariant_id, expected, observed?, status, evidence_provenance?, evidence_id?, reason?
}

VerificationView {
  verification_id, recovery_attempt, objective_id, status, observed_at?, invariants[]
}

EvidenceView {
  evidence_id, recovery_attempt, source_system, evidence_kind, title,
  semantic_status, external_reference?, observed_at?, summary, proof_fields{}
}

AttemptComparisonItem { field, recovery_1?, recovery_2? }

RecoveryCaseView {
  revision, objective, attempts[], summary, world, plans[], actions[],
  verifications[], what_changed[], evidence[]
}

ExecutionEventView {
  event_id, sequence, cursor, timestamp, recovery_attempt, semantic_type,
  human_message, technical_summary, source_authority, related_resource_ids[]
}

EvidencePageView {
  incident_id, revision, timeline[], receipts[], verification[], decisions[], evidence[]
}

ExecutionEventsView { incident_id, revision, events[], next_cursor, terminal }

OperatorContextView {
  revision, read_only=true, objective, current_recovery, plans[], evidence[],
  verification?, events[]
}
```

## Recovery spine and branching

Attempts are explicit resources; the frontend does not infer boundaries from timestamps.
Recovery 02 includes `branch_from_attempt: 1` and a backend-generated `branch_reason` tied to the
failed Recovery 01 invariant. Every spine stage has a semantic kind and a
`PENDING | CURRENT | COMPLETED | FAILED | UNAVAILABLE` status. Related evidence IDs link stages to
the right-rail cards without leaking persistence IDs beyond stable receipt/evidence identifiers.

The canonical restored fixture exposes:

```json
{
  "attempt_number": 2,
  "label": "Recovery 02",
  "status": "COMPLETED",
  "branch_from_attempt": 1,
  "branch_reason": "Recovery 01 was action-verified, but release-validation-green was false.",
  "candidate_sha": "7b7881ed1785cc37e038c44193ff2373badf54e7",
  "selected_plan_id": "plan-resource-balance-first"
}
```

## Plans and decisions

Planner outputs are reduced to typed candidate summaries. Critic verdict summaries and numeric
risk scores are exposed; private chain-of-thought, thought signatures, prompts, token streams, and
internal model messages are not. Deterministic policy violations and blocking unknown IDs are
explicit. `selected` and `valid` are backend truth.

Recovery 01 and Recovery 02 plans remain distinct through `revision` and `recovery_attempt`.
Candidate A exact-repeat rejection is represented through rule
`failed_recovery_exact_repeat` where that candidate was evaluated; the live fresh planner proposed
only B futures, so its live decisions are valid rather than a fabricated rejection event.

## Actions, receipts, and outcome truth

The action model directly presents this progression:

```text
intended                    desired_state_summary
write acknowledged         write_acknowledged + write_acknowledged_at
independently read back     read_back_completed + read_back_at + external_reference
receipt verified           receipt_status = VERIFIED
observed semantic outcome  verification_state = PASSED | FAILED | PENDING | UNAVAILABLE
```

For the real fresh P1D incident, Candidate A has `receipt_status: VERIFIED` and
`verification_state: FAILED`; Candidate B and promotion have both `VERIFIED` and `PASSED`.

## Verification and Expected vs Observed

Every invariant directly contains `expected`, nullable `observed`, semantic `status`, provenance,
and timestamp through its parent verification. Missing external evidence is `UNAVAILABLE`;
nonterminal authoritative work is `PENDING`; an observed false invariant is `FAILED`.

The final canonical verification contains exactly six passed invariants. Recovery 01 retains its
failed `release-validation-green` observation.

## Evidence modes

One `EvidenceView` supports both frontend modes:

- **SUMMARY:** render `title`, `semantic_status`, `summary`, `source_system`, and `observed_at`.
- **PROOF:** additionally render `external_reference`, `evidence_kind`, and `proof_fields`.

The backend emits contextual cards for Calendar read-back, exact GitHub Actions runs, full-release
promotion/latest read-back, and deterministic objective verification. Evidence does not include
credentials, raw prompts, or low-level log lines.

## Execution event cursor and polling

Events are meaningful durable workflow events sorted chronologically. `sequence` and `cursor` are
presentation values; Firestore document names are not the cursor contract. Poll active recovery
every 1–3 seconds using `If-None-Match`, then request events with the last `next_cursor`. Back off to
10–30 seconds for passive monitoring and stop routine polling when `terminal: true` or objective
health is `RESTORED`. No WebSocket, SSE, or new streaming infrastructure is required.

## Error semantics

| HTTP | `detail.code` | Meaning |
|---|---|---|
| `400` | `malformed_request` | Cursor/limit or semantic request is invalid |
| `404` | `resource_not_found` | Objective or incident does not exist |
| `422` | FastAPI validation detail | Path/query type or enum is malformed |
| `503` | `backend_infrastructure_unavailable` | Firestore/backend authority is temporarily unavailable |

Evidence pending, evidence unavailable, verified unhealthy, and terminal restored are payload
states, not transport errors. GitHub/Calendar unavailability must never be rendered as CI failure.

## Real sanitized fixtures

Fixtures were exported through the presentation models from canonical incident
`incident-938b303718a6abe41244`:

- [`overview.json`](ui-fixtures/overview.json)
- [`objectives.json`](ui-fixtures/objectives.json)
- [`recovery-restored.json`](ui-fixtures/recovery-restored.json)
- [`evidence.json`](ui-fixtures/evidence.json)
- [`events.json`](ui-fixtures/events.json)
- [`operator-context.json`](ui-fixtures/operator-context.json)

They contain real P1D proof identifiers and external references but no secrets. Contract tests also
exercise an active `EXECUTING` representation without claiming restoration.

## Known unsupported claims and controls

- `required_work_assigned` is deliberately absent. Selected plans contain assignment proposals,
  but no authoritative assignment adapter proves execution. The frozen story label must be
  corrected or backed by future real evidence.
- There is no objective percentage, owner, progress score, vanity metric, or invented analytics.
- Operator is read-only. Natural-language commands, replan/execution commands, Gemini control
  tools, and all external mutation are unsupported in P2A.
- The public contract does not expose Firestore collection names, raw documents, phase leases,
  revision subcollection layout, or private action-claim internals.
- P1E/Gmail and frontend implementation remain out of scope.

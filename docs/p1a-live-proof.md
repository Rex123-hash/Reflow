# P1A real-cloud proof

Verified 25 August 2026 in Google Cloud project `project-f334c42b-7a03-4194-932`.
The canonical event was a backend-lead-unavailable `DisruptionEvent` published to
`objective-recovery-disruptions`. Pub/Sub delivered it with an OIDC token to the private
`objective-recovery` Cloud Run service, which persisted the authoritative workflow in the
delete-protected Firestore `(default)` database.

## Persisted result

| Evidence | Observed value |
|---|---|
| Incident | `incident-59e1f99fdcaf3dbfb2af` |
| Terminal P1A stage | `PLAN_SELECTED` (not resolved) |
| Selected plan | `plan-risk-minimization-first` |
| Planner / critic / end-to-end | 9,522 ms / 5,723 ms / 18,447 ms |
| Tokens | 3,695 input / 1,800 output / 5,495 total |
| Candidate strategies | deadline-first, risk-minimization-first, resource-balance-first |
| Pairwise action diversity | 0.333, 0.333, 0.667 |
| Policy outcome | all three valid; no violations or blocking unknowns |
| Workflow events | 11 durable events, including 3 `PLAN_CREATED`, 3 critiques, and 1 selection |

The selected risk-minimization plan reassigns migration, QA tests, and release notes to the
backup engineer, QA engineer, and product generalist. The deadline-first candidate proposes
migration plus release-note reassignment; the resource-balance candidate proposes migration
plus test reassignment. These produce the persisted non-zero pairwise diversity values above.

## At-least-once and duplicate proof

The successful canonical message ID was `21158234855805396`. After completion, the exact same
event was published as message `21158294920638602`. Cloud Run returned 200 in 171 ms; the
Firestore claim remained `completed` with `attempts: 1`, the incident revision remained 7, and
the workflow-event count remained 11. No second incident or model run was created.

The initial rollout also exposed an actual client dependency incompatibility: `google-api-core`
2.35.0 encoded Firestore's `(default)` database ID and the service safely returned retryable 503
without creating partial state. Production is pinned to 2.34.0, the corrected immutable `p1a-r2`
image was deployed, and the retained event was processed successfully.

## Evaluation and scope boundary

The agents-cli behavioral evaluation ran one real Vertex inference and scored 1.0: exactly one
typed plan per required strategy. The real Firestore integration test passed. No Gmail,
Calendar, GitHub, authentication, UI, external mutation, or resolution path exists in P1A.

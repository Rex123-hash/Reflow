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

## P1A hardening evidence

Verified later on 25 August 2026. The original measurements above are retained as the first
live Pub/Sub-to-Firestore run and are not replaced by the characterization below.

### Immutable deployment

The hardening code required one new image build. Cloud Build
`bacd473d-c28d-47ed-98b5-476dbff5f259` produced:

`us-central1-docker.pkg.dev/project-f334c42b-7a03-4194-932/objective-recovery/app@sha256:e9a304e3ca8a29e249d125e142aebfaf3aaf6f27ec97ae4058a0a80a7e44b4f6`

Terraform changed only the existing `objective-recovery` Cloud Run container image: zero
resources added, one in-place update, zero destroyed. Revision `objective-recovery-00003-j6h`
became ready with 100% traffic. The service and Artifact Registry both report the exact digest
above. The post-apply state contains 28 managed addresses and the refreshed plan reports no
changes.

### Controlled real-Vertex characterization

The production `RecoveryOrchestrator` plus selected architecture-B `AdkPlanningService` ran
sequentially against the same canonical world, `gemini-3.7-flash`, Vertex AI global, and the
same deterministic policies. Every real attempt is included; the exercise stopped at three
because schema, grounding, strategy-set, policy, and terminal-state behavior were consistent.

| Trial | Planner | Critic | P1A E2E | Schema / grounding | Pairwise action diversity | Selection | Tokens (in / out / total) |
|---|---:|---:|---:|---|---|---|---:|
| 1 | 11,314 ms | 13,767 ms | 25,093 ms | pass / pass | 0.500, 0.500, 0.667 | risk-minimization-first | 3,403 / 1,700 / 5,103 |
| 2 | 11,515 ms | 6,778 ms | 18,297 ms | pass / pass | 0.333, 0.667, 0.333 | resource-balance-first | 3,613 / 1,700 / 5,313 |
| 3 | 10,553 ms | 11,358 ms | 21,915 ms | pass / pass | 0.333, 0.667, 0.333 | risk-minimization-first | 3,626 / 1,689 / 5,315 |

All trials returned exactly three candidates and exactly the deadline-first,
risk-minimization-first, and resource-balance-first strategy types. Every entity reference was
in the allowed world; invalid-reference count was zero. Deterministic policy evaluation found
all three candidates valid in every trial, with no violations or blocking unknowns. Every run
ended at `PLAN_SELECTED`.

Aggregate engineering characterization (three runs, not a statistically significant sample):

- schema success: 3/3 (100%); grounding/reference validity: 3/3 (100%);
- median/max planner latency: 11,314 / 11,515 ms;
- median critic latency: 11,358 ms; median P1A end-to-end latency: 21,915 ms;
- mean/minimum pairwise diversity across all pairs: 0.481 / 0.333;
- selected strategies: risk-minimization-first 2, resource-balance-first 1,
  deadline-first 0.

Before these real runs, an initial three-attempt harness batch produced no Vertex invocation and
no usable trial result because the backend selection was not explicit and stdout was not durably
captured. Cloud Monitoring showed zero Vertex invocations for that interval. Those attempts are
recorded here but are not misreported as real planner trials. The harness now explicitly selects
Vertex and checkpoints every attempted result to `artifacts/p1a-hardening-trials.json` before
printing it. The final required three real trials are the complete table above; no fourth or
fifth trial was run.

The post-change agents-cli behavioral evaluation was separate from characterization. Its one
real inference again scored `custom_response_quality = 1.0` for exactly one typed plan per
required strategy.

### Restart, idempotency, and observable failure evidence

The planner and critic now have separate typed durable checkpoints. Candidate generation is
persisted immediately after the planner and before the critic, so a critic retry reuses the exact
candidate set. A persisted full planning run resumes policy evaluation without calling either
model again. Tests cover:

- a duplicate arriving before completion (no second planner/critic call and an HTTP 503 keeps
  Pub/Sub retryable while the active lease exists);
- an exact duplicate after `PLAN_SELECTED` (no second incident/model run);
- restart from a persisted planning result (no repeated planner or critic);
- planner failure then retry (planner reruns once, then completes);
- critic failure then retry (persisted candidates reused; planner does not rerun);
- same idempotency key plus same intent, and the same key plus different intent (both collision
  paths reject the second action claim).

After deploying revision `objective-recovery-00003-j6h`, canonical duplicate Pub/Sub message
`21213926160055298` exercised the private OIDC route. The structured application event reported
`DUPLICATE_EVENT_SUPPRESSED` in 443 ms. Firestore remained `PLAN_SELECTED`, incident revision 7,
11 workflow events, one claim attempt, and claim state `completed`; no model call occurred. The
Cloud Run request took 17.1 seconds overall because this smoke caused a cold start, which is a
known demo-environment latency limitation rather than duplicate-processing work.

Operational JSON now distinguishes decode, claim/checkpoint/impact, planner, critic, policy, and
resume outcomes. Correlation fields include the applicable event, incident, planning-run,
attempt, stage, model, strategy, latency, and safe error category/type. Raw model output,
credentials, tokens, secrets, and hidden reasoning are not logged. Durable workflow events add
`WORKFLOW_RESUMED`, `ALL_PLANS_INVALID`, and `BLOCKING_UNKNOWN` without changing the terminal
authority boundary.

### Terraform state decision and remaining limits

Remote Terraform backend deferred to post-hackathon production hardening. The intact local state
is acceptable for the current single-builder hackathon workflow, and no immediate collaboration,
state-loss, deployment, or demo blocker justified a risky migration during this timebox.

Remaining limits are intentional or non-blocking: three trials characterize engineering
behavior but are not statistically significant; model-generated candidates and critic scores can
change which policy-valid strategy wins; cold-start request latency remains visible; Terraform
state is local; and P1A deliberately has no external action, independent read-back, verification,
resolution, authentication, or UI path. The service remains private and terminal authority
remains `PLAN_SELECTED`. `google-api-core` remains pinned at 2.34.0.

### Verification commands

```powershell
uv run pytest -q
$env:GOOGLE_CLOUD_PROJECT='project-f334c42b-7a03-4194-932'
$env:RUN_GCP_INTEGRATION='1'
uv run pytest tests/integration/test_firestore_live.py -q -o addopts=''
uv run ruff check .
uv run ruff format --check .
uv run mypy --strict src objective_recovery_agent tests scripts
uv run agents-cli eval generate --dataset tests/eval/datasets/basic-dataset.json --output artifacts/traces/p1a_hardening_eval.json
uv run agents-cli eval grade --traces artifacts/traces/p1a_hardening_eval.json --config tests/eval/eval_config.yaml --output artifacts/grade_results
terraform -chdir=deployment/terraform/single-project fmt -check -recursive
terraform -chdir=deployment/terraform/single-project validate
terraform -chdir=deployment/terraform/single-project plan -detailed-exitcode -var-file vars/env.tfvars
git diff --check
```

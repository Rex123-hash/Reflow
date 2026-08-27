# P2C production qualification

Date: 2026-08-28 IST  
Verdict: **P2C PRODUCTION QUALIFICATION GO**

## Authority and scope

P2C implementation authority remains commit
`016009bb076c4f581aaccced92ba131ee5996b7e`. Qualification hardening and the
non-destructive live harness were frozen separately in commit
`017d20005fad820d3b6fc4fda9319b8fb42d4aa4`.

This milestone qualified and deployed exactly five genuine reasoning agents:

1. `disruption_interpreter`
2. `impact_analyst`
3. `recovery_planner`
4. `risk_critic`
5. `recovery_analyst`

The final architecture target remains **a minimum of seven agents**. Agents 6
(`Operator Intent Interpreter`) and 7 (`Simulation Agent`) were not implemented
or claimed here. No frontend, BFF/auth, or Google-login work was performed.

## Live Vertex / Gemini / ADK qualification

The harness `scripts/run_p2c_live_qualification.py` ran twice against project
`project-f334c42b-7a03-4194-932`, Vertex location `global`, Google ADK `2.7.1`,
and model `gemini-3.7-flash`. It invoked the real ADK workflows directly and
stopped before every external executor, publisher, checkpoint, or workflow
write. `external_effects_executed` was false.

The second run, `p2c-live-20260827T231917Z`, is the authoritative detailed
observation:

- Irrelevant input: Interpreter returned `NO_RELEVANT_OBJECTIVE_IMPACT`; Impact
  Analyst call count was zero.
- Sanitized canonical disruption: Interpreter returned `REAL_DISRUPTION` with
  event type `personnel_unavailability_and_delivery_delay`, three mentioned
  entities, and two grounded excerpts. The Impact Analyst returned the grounded
  candidates `release-v2`, `commit-release`, `work-api-migration`, and
  `person-backend-lead`. Deterministic graph validation remained downstream and
  authoritative.
- Initial recovery: Recovery Planner emitted exactly three strategy families:
  `deadline-first`, `resource-balance-first`, and `risk-minimization-first`.
  Risk Critic returned typed critiques; all three were policy-valid. The stable
  deterministic selector chose the resource-balance plan.
- Failed recovery: Recovery Analyst consumed the frozen Recovery 01 evidence,
  including failed invariant `release-validation-green`, five evidence
  references, and the exact failed-effect fingerprint. It returned two material
  changes and four next-plan constraints. Recovery Planner and Risk Critic then
  produced a valid revised future; deterministic selection chose
  `plan-risk-minimization-first`.
- Candidate B SHA `7b7881ed1785cc37e038c44193ff2373badf54e7`
  emerged from the live planner output. The exact SHA and artifact name are
  absent from all five workflow definitions/prompts and from the P2C
  implementation diff. The SHA necessarily remains in the pre-existing
  deterministic ObjectiveStore as the immutable, available historical artifact
  supplied to planning; neither policy nor selection logic was changed to force
  the result.

Every agent emitted metadata-only `AGENT_INVOCATION_STARTED` and
`AGENT_INVOCATION_COMPLETED` events with agent ID/version, model, phase,
correlation fields, attempt where relevant, timestamps, latency, safe input and
output fingerprints, and status. Raw prompts, model output, Gmail content,
credentials, OAuth material, hidden reasoning, and token counts were not logged.
Token usage below was retained only in the ignored local qualification artifact.

## Latency and token observations

Detailed timings and runtime-reported token metadata from the authoritative run:

| Evaluation / agent | Latency | Input | Output | Total |
|---|---:|---:|---:|---:|
| Irrelevant / Disruption Interpreter | 5,715 ms | 554 | 119 | 673 |
| Canonical / Disruption Interpreter | 4,256 ms | 562 | 134 | 696 |
| Canonical / Impact Analyst | 3,937 ms | 809 | 157 | 966 |
| Initial / Recovery Planner | 10,212 ms | 1,796 | 1,294 | 3,090 |
| Initial / Risk Critic | 7,727 ms | 1,887 | 470 | 2,357 |
| Failed / Recovery Analyst | 10,580 ms | 2,224 | 812 | 3,036 |
| Failed / Recovery Planner | 10,272 ms | 11,534 | 1,477 | 13,011 |
| Failed / Risk Critic | 5,666 ms | 10,388 | 308 | 10,696 |

Two raw runs, intentionally reported without statistical claims, observed:

| Aggregate | Observation 1 | Observation 2 |
|---|---:|---:|
| Interpreter + Impact Analyst | 8,128 ms | 8,193 ms |
| Initial Planner + Critic | 16,980 ms | 17,939 ms |
| Recovery Analyst + replanning + critique | 23,075 ms | 26,518 ms |

The documented pre-P2C P1A planner/critic median was 21,915 ms. The documented
P1D slow-path replanner/critic observation was 27,190 ms and 27,078 total tokens.
The second P2C failed-path observation was 26,518 ms and 26,743 total tokens,
including the new Recovery Analyst. These small samples show no unacceptable
latency or reliability regression. A separately comparable pre-P2C Gmail
Interpreter token/latency observation was not recorded, so no estimate is
invented for that comparison.

## Failure containment

The live qualification exposed one trace-ordering gap: typed output could be
reported as completed before the boundary schema was validated. `run_workflow`
now validates its declared Pydantic output schema inside the traced failure
boundary.

Focused tests inject invalid outputs at both Impact Analyst and Recovery Analyst
boundaries. Each case raises `ValidationError`, emits `started` then `failed`,
emits no output fingerprint, and never enters a store, checkpoint, publisher,
or Calendar/GitHub adapter. Retry policy is asserted as bounded to two attempts.
No fake successful result can be persisted by these isolated failures.

## Deterministic authority and compatibility

Agents supply typed reasoning only. Graph authority, blast-radius validation,
policy, stable selection, state transitions, execution routing, Calendar and
GitHub adapters, durable claims/idempotency, receipts and read-back, objective
verification, Firestore persistence, and Pub/Sub transport remain deterministic
code. None became a Gemini call.

The canonical P1E incident `incident-0fc3af5b0bd1ad847aea` remained revision 16,
`RESOLVED` / `objective_restored`, with active plan revision 2, historical
selected plan `plan-resource-balance-first`, and six passed final checks. Its
document fingerprint before qualification, after qualification, and after final
deployment was identical:
`4a1c93385b5b24060c31e995c521455622f1582967c615a2a7a7021e7f13fa8c`.
The real-Gmail through Recovery 01 failure, reopen, Recovery 02 Candidate B,
successful CI/full release, and objective-restored history was not mutated.

P2B presentation compatibility passed: exact fixture tests, exact OpenAPI
comparison against `docs/ui-openapi.json` (14 paths), exact evidence joins,
pending invariant semantics, action truth states, timing/deadline fields, event
phases, Detect/Replan context, and normalized source authorities. Frontend files
changed: **NONE**.

## Quality gates

- Focused P2C boundary suite: 12 passed.
- Full pytest: 167 passed, 1 skipped.
- Coverage: 99.01%.
- Configured strict mypy: success across 30 source files.
- Ruff lint: passed.
- Ruff format check: 95 files already formatted.
- `git diff --check`: passed.
- P2B fixture and exact OpenAPI checks: passed.
- Truth-boundary and secret-shaped-value scans: passed.
- Five-agent workflow/prompt scan and the P2C implementation-diff scan found no
  Candidate B SHA or hardcoded artifact name. The expected pre-existing
  ObjectiveStore authority contains the immutable artifact exactly once.

## Deployment

The final accepted Cloud Build was
`cd2650cf-34d4-4564-b26e-8f057e802dc4`. Its source upload was a strict
backend-only allowlist: 102 files, 1.7 MiB, with `.env`, UI assets, tests,
documents, artifacts, and caches excluded. An earlier broad-context build was
rejected from the qualification result and superseded; its Dockerfile had copied
only backend paths, but the final allowlist now prevents unrelated local files
from entering future Cloud Build source archives.

Terraform applied exactly one in-place Cloud Run image change each time and no
destructive infrastructure action: `0 add, 1 change, 0 destroy`. The final
post-apply refresh plan reports no changes. No `allUsers` invoker exists; the
existing Gmail scheduler, Gmail push, and Pub/Sub service-account invokers are
preserved.

- Service: private `objective-recovery`, `us-central1`
- Final revision: `objective-recovery-00021-gxq`
- Traffic: 100%
- Immutable image:
  `us-central1-docker.pkg.dev/project-f334c42b-7a03-4194-932/objective-recovery/app@sha256:0785ae26839937416a5f2fa6d3b3ce7ad1cfab037cbd85891a4a5a1b02f861d7`
- Runtime service account:
  `objective-recovery-app@project-f334c42b-7a03-4194-932.iam.gserviceaccount.com`

## Final read-only production proof

Against revision `objective-recovery-00021-gxq`:

- Anonymous `GET /`: 403.
- Authenticated health: 200.
- Authenticated Overview, Objectives, Recovery, Evidence, Events, and Operator
  context: all 200.
- Recovery ETag `W/"16"` replay: 304.
- Seven unique evidence cards resolved all 22 public Detect, Replan, stage,
  action, invariant, and plan-action references exactly once.
- Final verification: `PASSED`; all six invariants passed.
- OpenAPI: 14 paths; Gmail source, P1C, P1D, and all P2B UI routes present.
- Canonical incident fingerprint and revision remained unchanged.
- Logs inspected: 30 entries, zero `ERROR` or higher. The single warning was the
  intentional anonymous 403 request.
- No Calendar or GitHub action was invoked during qualification or proof.

The deployed system can now truthfully state: **Reflow currently has five
deployed core reasoning agents.**

## Remaining technical debt

- The sample count is two; collect a larger live latency/reliability series before
  treating these observations as a statistical baseline.
- Gmail Interpreter-only pre-P2C token metadata is unavailable for an exact
  before/after token comparison.
- The configured strict mypy scope (`src` and `tests`) is green. An explicitly
  wider, out-of-config scan of `objective_recovery_agent` plus `src` reports 11
  existing errors across Gmail normalization/gateway/ingestion and one
  orchestrator dictionary-variance site; this remains final-hardening debt.
- Firestore client calls used by the read-only qualification emit upstream
  positional-filter deprecation warnings; migrate them to keyword `filter=` in a
  separate maintenance change.
- The final required agent count is a minimum of seven. The next planned genuine
  agents are Operator Intent Interpreter and Simulation Agent.

**P2C PRODUCTION QUALIFICATION GO**

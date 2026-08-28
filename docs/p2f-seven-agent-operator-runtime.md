# P2F — Seven-agent Operator runtime production qualification

Date: 2026-08-28 IST  
Verdict: **SEVEN-AGENT OPERATOR RUNTIME GO**

## A–H. Agents 6 and 7

**A. Agent 6 architecture.** `operator_intent_interpreter` is a real Google ADK
single-turn workflow backed by Vertex Gemini. It receives a bounded
`IntentInput` containing the authenticated request and an immutable presentation
snapshot. It has no tools or sub-agents. Deterministic code validates incident,
recovery, fact, and hypothetical references after the model boundary.

**B. Agent 6 schema.** `OperatorIntent` is strict and extra-forbid. It returns a
`SUPPORTED`, `CLARIFICATION_REQUIRED`, or `UNSUPPORTED` disposition; an optional
`INSPECT`, `EXPLAIN`, or `SIMULATE` intent; subject; incident/recovery scope;
explicit hypothetical changes; constraints; exact fact IDs; and bounded
clarification. Unsupported or ambiguous results cannot carry an executable
intent or hypothetical change.

**C. Agent 6 runtime proof.** Local Vertex evaluation invoked the genuine ADK
Runner for all eight cases. Production Cloud Logging on revision
`objective-recovery-00023-d5j` records metadata-only start/completion events for
`operator_intent_interpreter`, model `gemini-3.7-flash`, validated output, token
usage, latency, attempt, and request ID. After the browser hotfix, authenticated
BFF request `61e00d13-70e9-4f6a-9ff5-cae1be1d331e` completed validation at
2026-08-28T13:20:51Z; the corresponding BFF POST returned HTTP 200. Final
signed-in UI proof used request `8a85c496-3c4e-4baf-8976-59cb1cbaf200`: Agent 6
completed validation in 7,832 ms with 6,875 total tokens, and the BFF returned
HTTP 200 in 15.945 seconds.

**D. Agent 7 architecture.** `simulation_agent` is a separate genuine Google ADK
single-turn workflow. It receives only the frozen `SimulationInput` value object:
snapshot, validated intent, explicit hypothetical provenance, and optional
hypothetical deadline. It receives no service, gateway, ledger, reader, callback,
executor, claim, publisher, or persistence capability.

**E. Agent 7 schema.** `SimulationResult` requires
`HYPOTHETICAL_NO_ACTION`, scenario summary, assumptions, threatened invariants,
one to three candidate futures with required verification, trade-offs, risk
critique, outcome class, unsupported assumptions, exact evidence IDs, and
`external_effects_executed=false`. Pydantic enforces the false-only invariant
without emitting a Vertex-incompatible boolean enum.

**F. Agent 7 runtime proof.** Both local counterfactuals invoked Agent 7 through
the real ADK Runner. The deployed Candidate A simulation produced a validated
Agent 7 trace on revision `00023-d5j`, request
`3cdf877c-e9f8-4643-b512-31b521787102`, using `gemini-3.7-flash`, with 6,826 input,
859 output, and 7,685 total tokens. Its response carried hypothetical provenance
and zero external effects.

**G. Simulation isolation.** The simulation module's transitive project imports
are tested to reject Calendar/GitHub/Gmail gateways, execution services, ledgers,
orchestrators, claims, state machines, APIs, and stores. Runtime tests inject
value-only fakes and prove zero writes. Invalid provenance, evidence references,
or an effects=true result fail before response construction.

**H. Planner/Critic reuse.** No existing Planner or Critic was invoked from the
simulation pathway. This avoids importing their production planning context into
the zero-effect boundary. Agent 7 reuses only the established ADK workflow runner,
model identifier, and trace conventions; no deterministic fake Planner/Critic was
created.

## I–Q. Operator product path

**I. API contract.** `POST /api/v1/operator/query` accepts only
`{incident_id,message}` and returns the typed `OperatorResponse` defined in
`docs/operator-openapi.json`. Browser and BFF both validate the contract. The BFF
has one fixed backend POST path; callers cannot choose a URL, credential, or
execution endpoint.

**J. Authentication path.** Authenticated browser → same-origin Firebase Hosting
rewrite → public BFF → Firebase application-session verification and allowed
origin check → BFF-minted subject hash/request ID and server identity token →
private Cloud Run backend → Agent 6 → optional Agent 7. Anonymous Hosting and BFF
POSTs return 401; anonymous private-backend POST returns 403. The private backend
has no `allUsers` binding. Browser code receives no Gemini, Google service-account,
Calendar, or audience credential.

The signed-in browser path returned HTTP 200 through BFF at 13:20:37Z after the
validator hotfix, and the correlated private runtime emitted the validated Agent 6
trace above. Earlier signed-in requests also returned 200; they exposed a client
AJV CommonJS/ESM interop error after the response arrived. Hosting hotfix
`f67f147` inlined the Unicode code-point length helper. The deployed route chunk
now returns HTTP 200, contains the inline helper, and contains no AJV runtime
`ucs2length` import.

The final signed-in UI visibly rendered a read-only Calendar answer for request
`8a85c496-3c4e-4baf-8976-59cb1cbaf200`, including the verified historical action,
a fresh 13:00–14:00 Calendar read-back with comparison PASSED, supporting evidence,
revision 16, Agent 6 identity, and explicit “No production action occurred.”

**K. INSPECT.** Agent 6 selects exact authoritative facts. Calendar inspection
also performs the already-approved fresh external-reality read and labels absent
freshness rather than inventing an event.

**L. EXPLAIN.** Recovery 1 explanation selects the verified Calendar action as
successful contrast, the failed GitHub validation action, failed objective
verification, and the failed `release-validation-green` invariant. Returned prose
is composed only from selected authoritative fact text; hidden reasoning is not
returned.

**M. SIMULATE.** Only an explicit what-if may route to Agent 7. Real incident state
is frozen, protected-deadline changes remain hypothetical, every future names
independent verification still required, and no outcome becomes observed truth.

**N. Mutation rejection.** Calendar rescheduling, shipping a release, execution,
approval, retry, or mixed inspect-and-mutate requests are unsupported. They never
invoke Agent 7 or an adapter and always return no-action language.

**O. Guest behavior.** Guest/fixture Operator reasoning is disabled. The form and
examples are disabled and no request is sent, avoiding private-data and unbounded
model-cost exposure. Guest presentation context remains available read-only.

**P. Request/cost bounds.** 8 KiB JSON body; 1,200-character message; strict schema;
6 requests per subject per minute; 120 requests per project per UTC day; failed
requests consume quota; two concurrent reasoning slots per backend replica; one
Vertex transport attempt per invocation; at most two validation attempts; 25/27s
agent bounds; 70s service, 85s BFF upstream, and 90s browser bounds; 2,048 Agent 6
and 4,096 Agent 7 output-token ceilings. Only hashed subjects and counters are
stored for quota.

**Q. Safe tracing.** Allowed metadata is agent name, model, correlation ID,
latency, input/output/total token counts, validation, attempt, and operational
event. Operator-scoped logging filters prevent prompt, response, request text,
system instruction, credentials, private secrets, and chain-of-thought capture.

## R–T. Seven deployed reasoning agents and evaluation

**R/S. DEPLOYED GENUINE REASONING AGENTS: 7.** All use
`gemini-3.7-flash` through Google ADK 2.7.1. None may directly mutate an external
system; deterministic controls remain authoritative downstream.

| # | Agent | Input | Typed output | External mutation |
|---:|---|---|---|---|
| 1 | `disruption_interpreter` | normalized Gmail evidence | disruption facts | No |
| 2 | `impact_analyst` | disruption facts + objective graph context | impact analysis | No |
| 3 | `recovery_planner` | bounded planning/replanning input | plan candidates | No |
| 4 | `risk_critic` | candidates + objective constraints | typed critiques | No |
| 5 | `recovery_analyst` | failed recovery evidence | recovery analysis/constraints | No |
| 6 | `operator_intent_interpreter` | Operator request + frozen snapshot | `OperatorIntent` | No |
| 7 | `simulation_agent` | validated hypothetical + frozen snapshot | `SimulationResult` | No |

The existing five retain their authoritative P2C live Vertex traces, latency,
token, and validation evidence in `docs/p2c-production-qualification.md`. P2F's
frozen-file regression proves their workflow/schema/runtime files are byte-identical
to the qualified deployment; the same unchanged files are present in the P2F
backend image. Production logs additionally contain live
`disruption_interpreter` invocations and the new Agent 6/7 invocations.

**T. Evaluation.** The eight-case real Vertex suite passed 8/8: failure explanation,
Calendar inspection, reopen/replan explanation, Candidate A CI simulation,
two-hour deadline simulation, Calendar mutation rejection, release mutation
rejection, and bounded ambiguity. `agents-cli eval grade` loaded eight cases and
reported mean behavioral score 1.0000 with zero errors. The deployed mandatory
subset passed 4/4 (EXPLAIN, INSPECT, SIMULATE, rejected mutation), and its separate
`agents-cli` grade was also 1.0000 with zero errors.

## U–AH. Regression, deployment, and verdict

**U/V. Canonical incident before/after.** Incident
`incident-0fc3af5b0bd1ad847aea` was and remains revision 16 with 28 durable events,
`RESOLVED / objective_restored`, active plan revision 2, and six passed final
checks. Before and after SHA-256:
`4a1c93385b5b24060c31e995c521455622f1582967c615a2a7a7021e7f13fa8c`.

**W. Calendar regression.** Frozen Calendar runtime/presentation/schema/UI files
are unchanged. Production external reality remains revision 16,
`READ_BACK / FRESH_READ / PASSED`. No Calendar write was invoked by qualification.

**X. Security.** Private IAM remains service-account-only with no `allUsers`.
Application auth, origin validation, Firebase/backend identity separation,
same-origin credentials, fixed backend path, no redirects, strict request/response
validation, no-store responses, safe error mapping, and Guest model disablement all
passed. Anonymous status proof: Hosting/BFF 401, private backend 403. The new
backend/BFF revisions had zero ERROR-or-higher log entries during qualification.

**Y. Focused tests.** 45 Operator runtime/API tests passed. They cover genuine ADK
Runner invocation, strict schemas, ambiguity and mutation rejection, bounded
retry/failure, safe metadata, snapshot bounds/redaction, fresh Calendar grounding,
Agent 7 routing and isolation, quota/body/auth/origin/Guest boundaries, fixed BFF
identity/path, correlation, upstream failures, and frozen semantics. Three frontend
conversation tests cover POST/render/evidence, Guest no-request, and safe failure.

**Z. Full gates.** Backend: 252 passed, 1 skipped, 97.95% coverage. Frontend after
the browser hotfix: 85/85 passed. Production build, TypeScript, contract/fixture/
mark/poster checks, frontend lint, configured strict mypy (42 files), additional
changed-module strict mypy (13 files), Ruff, format, and `git diff --check` passed.
A broader out-of-config mypy/Ruff scan still
finds pre-existing Gmail typing and frozen Blender experiment formatting/dependency
debt; those files were not changed.

**AA. Backend deployment.** Revision `objective-recovery-00023-d5j`, 100% traffic,
image `app@sha256:ffe74a9589faca7bdc252de7e48fef6b8b7b95e3d2ede916373b85932f5af3cd`,
service account `objective-recovery-app@project-f334c42b-7a03-4194-932.iam.gserviceaccount.com`.

**AB. BFF deployment.** Revision `reflow-web-bff-00005-njf`, 100% traffic, image
`reflow-web-bff@sha256:bb5fb9bac65f32ced63c12d8591d344c1f82b5ad1f0704518cbab6a024a06401`.

**AC. Hosting.** Final release
`sites/reflow-objective-recovery/channels/live/releases/1787923175280000`, version
`sites/reflow-objective-recovery/versions/f0c660c0d1b17dd8`, finalized and released
2026-08-28T13:19:35Z.

**AD. Files changed.** Operator schemas/agents/context/service/API/quota/privacy;
private app router registration; BFF fixed Operator route/gateway registration;
separate Operator OpenAPI export; eight-case evaluator and agents-cli metric;
Operator client/conversation/generated contract/validator/minimal route styling;
focused backend/frontend tests; and this proof. The exact 29-file source list is
recorded by commit `0f68a73`; hotfix `f67f147` changes only the validator generator
and generated validator.

**AE. Existing-agent/recovery semantic files changed.** None. Existing five-agent
workflows, recovery policy, selection, invariants, state transitions, receipts,
Calendar/GitHub/Gmail semantics, Firebase auth, presentation contract, and marketing
are unchanged. Only additive application/BFF registration seams changed.

**AF. Source commits.** Backend/BFF/operator source: `0f68a733747ef6db17c27b4b06dcf16c01fbc067`.
Browser validator hotfix/Hosting source: `f67f147`. Both are local commits authored
as Amaan Khan `<amaank2405@gmail.com>` and were not pushed.

**AG. Remaining debt.** No conversation-memory platform or admin quota UI exists by
design. Collect a larger reliability/latency sample before statistical claims.
The Codex in-app browser's Google popup can still report its known
`auth/network-request-failed`; production signed-in BFF 200 logs and the user's
signed-in page are independent of that browser transport issue. Broad Operator UI
polish and multimodality remain intentionally deferred.

**AH. Explicit verdict: SEVEN-AGENT OPERATOR RUNTIME GO.**

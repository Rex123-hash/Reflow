# P2G final live qualification — NO-GO

Evidence window: 28 August 2026 UTC (completed after midnight on 29 August IST).
Deployed source: `4182d52d01b54dbdad824d3035eae193158aeb87`.

**CONTROLLED OPERATOR ACT LIVE NO-GO.** The real Jira transition and dedicated
Calendar move passed. Jira comment creation failed with `jira_invalid_request`;
independent comment listing returned zero comments before and after same-key replay.
The post-live real-model regression also failed its CI simulation case on the
existing 25-second Agent 7 workflow timeout. Neither failure is hidden by passing
unit tests or earlier evaluation results. No Git push was performed.

## Evidence and actual external effects

[Final independent reads and durable receipts](proofs/p2g-live-qualification-2026-08-28.json)
were collected at `2026-08-28T18:29:47.559456+00:00`.
[Model-gate metadata](proofs/p2g-model-gates-2026-08-28.json) preserves both the
pre-deployment passes and the post-live failure. These files contain no credential
values, HTTP authorization headers, or hidden reasoning.

| Confirmed operation | Observed outcome |
|---|---|
| SCRUM-6: To Do → Blocked | VERIFIED; real transition ID 41; separate GET confirmed Blocked |
| SCRUM-6: add exactly `Backend engineer unavailable.` | FAILED; one attempted operation; no acknowledgement; external comment count 0 |
| Replay identical comment request/key | Same failed action and unchanged timestamps; no Agent 6 invocation; comment count still 0 |
| Dedicated event, 29 August, 15:00–16:00 → 16:00–17:00 IST | VERIFIED; conditional PATCH followed by independent GET |

Only two of the three confirmed writes succeeded. No new comment key or bypass
write was attempted. The earlier dedicated-event bootstrap was performed under
the previous explicit bootstrap authorization, before this three-write phase.
Assignment, other Jira issues, canonical Calendar, protected deadline, IAM, and
deployment configuration were not changed during this final phase.

## A–AZ. Qualification report

| ID | Required item | Evidence / result |
|---|---|---|
| A | Starting repository HEAD | Full qualification began at `3443d29f211d89004ee2e0b62c838a68485ef063`; confirmed-write phase began at `4182d52d01b54dbdad824d3035eae193158aeb87`. |
| B | Worktree safety | Clean at both starting checkpoints. Only scoped source/config changes were committed earlier; final changes are this report and two proof JSON files. |
| C | P2G commits present | `71f9709d62a1f193453d20e4064871857d3320a0` and `3443d29f211d89004ee2e0b62c838a68485ef063` were present and preserved. |
| D | Jira Secret Manager existence | `projects/680305457743/secrets/jira-api-token/versions/1`, enabled. |
| E | Backend secret access | Successful access using impersonated backend service-account credentials; value used only in memory. Cloud Run also started successfully with the secret reference. |
| F | Jira backend configuration | Tenant `https://reflow-operator-demo.atlassian.net`; email `amaank2405@gmail.com`; issue `SCRUM-6`; `JIRA_API_TOKEN` references `jira-api-token:1`. No Jira credential on BFF. |
| G | Real Jira GET | HTTP 200 preflight; independent reads after transition and replay succeeded. |
| H | Observed summary | Exact returned string: `Summary: Validate release coordination`. |
| I | Observed status | Before: To Do. After: Blocked. |
| J | Observed priority | Medium, unchanged. |
| K | Available transitions | Preflight: 11 To Do; 21 In Progress; 31 In Review; 41 Blocked; 51 Done. |
| L | Selected transition | Real adapter resolved Blocked to 41; recorded in durable `adapter_proof`. |
| M | Agent 6 Jira ACT | Browser request `8285f084-c482-4036-b766-ab941325ac74`; ACT / `JIRA_TRANSITION` / SCRUM-6 / Blocked. |
| N | Deterministic authorization | AUTO_EXECUTABLE; reason `bounded_demo_issue_change`; approved subject hash matched. |
| O | Real Jira acknowledgement | `transition: accepted`; one attempted operation; acknowledged at `18:23:04.139936Z`. |
| P | Independent Jira read-back | Receipt read-back `18:23:04.694184Z`: Blocked; separate audit GET also Blocked. |
| Q | Jira verification | PASSED / VERIFIED at `18:23:04.864263Z`; zero differences. |
| R | Comment creation | FAILED, not qualified. Browser request `dab0d9fb-c66e-4179-904d-08fa0a1cb62d`; operation text exact; error `jira_invalid_request`; acknowledgement empty. |
| S | Comment independent read-back | Comment-list GET HTTP 200, total 0, all pages covered (0 returned of 0), exact-text matches 0. |
| T | Idempotency replay | Browser replay request `17e0f9e0-ede2-4f2c-af71-cbd98156668f` reused the unchanged command/key and returned the same action `d24818fa4b13ad8bd1195ecac9fd253d76b854047e67b0b65882ba8029d11b1d`. No model invocation; receipt retained original failure timestamp and attempted count 1. This proves failed-request replay safety, NOT successful comment deduplication. |
| U | Duplicate-comment result | Zero comments before creation, after failure, after replay, and at final audit. Successful create-then-deduplicate proof remains missing. |
| V | Assignment | Disabled; no allowed account IDs configured; assignee remains null. No assignment search or write performed. |
| W | Calendar IAM binding | Target-SA policy directly grants Token Creator to `user:aamaank2405@gmail.com` and the backend SA itself. The earlier project-wide Token Creator grant to that user is absent; filtered project binding is Owner only. No IAM writes by this qualification. |
| X | Impersonated token proof | Short-lived Calendar-scoped impersonation succeeded locally; deployed backend successfully read and patched the dedicated Calendar event. Tokens never emitted. |
| Y | Calendar access | Fresh event-list accessRole `writer`; dedicated and canonical event GETs succeeded. IAM Credentials and Calendar APIs enabled. |
| Z | Dedicated bootstrap | Earlier safe bootstrap CREATED and independently verified `Reflow Operator Demo — Coordination`; no duplicate bootstrap. |
| AA | Verified Operator event ID | `p2goperator20260828`, configured on backend. |
| AB | Private marker | GET verified `extendedProperties.private.reflow_resource=operator_demo`; no attendees or recurrence. Marker retained after PATCH. |
| AC | Calendar Agent 6 ACT | Browser request `dcc6f5d5-bc79-4e7a-b6d2-1a3acc27233f`; ACT / `CALENDAR_RESCHEDULE` / configured demo event / 60 minutes. |
| AD | Calendar authorization | AUTO_EXECUTABLE; reason `bounded_operator_demo_event_change`. |
| AE | PATCH acknowledgement | `write: acknowledged`; event ID exact; new ETag `"3575883038489950"`; one attempted operation. |
| AF | Independent Calendar GET | Receipt GET at `18:25:19.739642Z`, then separate audit GET: start `2026-08-29T16:00:00+05:30`, end `2026-08-29T17:00:00+05:30`. |
| AG | Calendar verification | PASSED / VERIFIED at `18:25:19.899221Z`; zero differences. |
| AH | ETag / stale-write protection | Receipt baseline ETag `"3575880174509918"`; deployed gateway requires ETag and sends it as If-Match. HTTP-412 regression test exercises the real gateway method with a stub transport and proves FAILED, no acknowledgement/PASSED. No additional live stale-write probe was authorized or sent. |
| AI | Firebase UID SHA-256 | Approved UID recomputation matched `399fbbd1cdc158f928c8ac1f29ac0160665580bc8db38fc24de5a53ddcead1d7`; Firebase account exists and is enabled. |
| AJ | BFF approved subject | Exactly that hash configured. Role derived server-side from verified Firebase UID, not browser-supplied role/email. |
| AK | Backend approved subject | Exactly the same hash configured; actual action receipts contain it. |
| AL | Viewer behavior | Deterministic API/coordinator tests pass: ACT denied, zero adapter execution; server-derived role/approval controls covered. No second live Viewer account was used. |
| AM | Guest behavior | Fresh unsigned backend 403; unsigned BFF and Hosting Operator POSTs 401. Tests additionally prove signed-in anonymous Guest 403 and zero backend/model calls. |
| AN | Approved Operator | Real signed-in browser → BFF → private backend path works; exact approved hash in all four durable action records. Two writes VERIFIED, one failed, protected action denied. |
| AO | Approval path | Tests pass for required approval, ownership, Viewer rejection, expiry, stale proposals and single-use replay. No live approval/assignment action was performed. |
| AP | Ambiguity | `Update that task.` requested clarification, no action receipt. Fresh post-action browser request `0e64b10e-7215-4b73-bf9d-4b1ba2df8cf5`; no external effect; deterministic and model eval checks also pass. |
| AQ | Protected deadline denial | Initial real Agent 6 request `56baa3a1-d603-4fa8-b9e0-c329e9eb3744` produced DENIED / `protected_objective_deadline`, empty acknowledgement/read-back and `external_effects_possible=false`. Post-action replay `23eb70a7-60e2-4ff4-8df3-5f167d27a7d1` returned the same denial. |
| AR | Canonical before | Incident `incident-0fc3af5b0bd1ad847aea`: revision 16, objective_restored, active plan revision 2; baseline `17:53:56.338068Z`. |
| AS | Canonical after | Same incident and document fingerprint; revision 16 at final independent audit. |
| AT | Canonical event count | 28 before / 28 after. Operator records live in separate `operator_actions`; final count 4 (two verified, one failed, one denied). |
| AU | Canonical fingerprint | Before and after: `4a1c93385b5b24060c31e995c521455622f1582967c615a2a7a7021e7f13fa8c`. SHA-256 of stable sorted serialized incident document, including unchanged receipt/evidence state. |
| AV | Canonical Calendar regression | Canonical `p1b9899dba7a849a328a49dbd134ac2b35d440284b687f39ca2a349599ad675604c` remains 28 August 18:30–19:30 IST, confirmed; ETag `"3575715330720542"` and private recovery markers unchanged. No PATCH to this event. |
| AW | Genuine reasoning agents | Exactly 7, unique identities: disruption_interpreter, impact_analyst, recovery_planner, risk_critic, recovery_analyst, operator_intent_interpreter, simulation_agent. Model remains gemini-3.7-flash; ADK 2.7.1. Recovery workflow files and Agent 7 instruction unchanged. Frozen recovery workflows were not rerun against production. |
| AX | Real-model evaluations | Pre-deploy ACT 10/10; pre-deploy regression 8/8. Post-live regression 7/8: simulate_ci failed; Agent 7 workflow timed out after 25.0s, request `ed5079c2-751e-4fa1-ab18-07d3dc9b8f65`. Other seven cases passed. No thresholds, timeouts or model changed. |
| AY | Focused P2G tests | 89 passed. |
| AZ | Full backend tests | 296 passed, 1 skipped; rerun after confirmed operations. |

## BA–CI. Release checks and handoff

| ID | Required item | Evidence / result |
|---|---|---|
| BA | Backend coverage | 96.01%, above configured 95% threshold; measured configured `src/objective_recovery` scope, not every agent module. |
| BB | mypy | Default 44 files pass; extended Operator/adapter scope 28 files passes. |
| BC | Ruff | Check passes; 94 files already formatted. |
| BD | Terraform/config | fmt check and validate pass. Existing services updated narrowly earlier; no broad Terraform apply or IAM change. Optional Jira env/secret-reference and approved-hash inputs added to Terraform source. |
| BE | Frontend tests | 86 passed, 13 files. |
| BF | Frontend typecheck | Pass. |
| BG | Frontend lint/format | Both pass. |
| BH | Production build | Pass, including contracts, fixtures, integration marks and poster checks. Existing large Three.js bundle warning remains. |
| BI | Security audit | Private backend IAM preserved; BFF derives role/hash; backend independently allowlists; target registry and private event marker enforced; origin/body/quota/approval/replay controls tested. Only Jira credential reference on backend. No extra agent, assignment capability, canonical edit, or IAM broadening. |
| BJ | Secret-leak scan | Exact Jira secret and Basic-auth encoding scans passed across tracked/untracked deliverables, frontend build, P2G artifacts and source diff. Final proof files were included in the pre-commit rescan. No token/header/private-key/secret value was written into these proofs. |
| BK | Backend revision | `objective-recovery-00024-24q`, ready, 100% traffic. |
| BL | Backend digest | `sha256:f7e495f5398a983ac89c7063fe51aa3d0262528b7e2444e1cac9f9781b423d09`. |
| BM | BFF revision | `reflow-web-bff-00006-xpk`, ready, 100% traffic. Existing bounded flow now has 100s Cloud Run timeout instead of 30s; no IAM change. |
| BN | BFF digest | `sha256:d33458691d0b0c9f20fb0b652d2f23d0eff6566399b10b8e8e47fd98cc104f1d`. |
| BO | Hosting release | `projects/project-f334c42b-7a03-4194-932/sites/reflow-objective-recovery/channels/live/releases/1787940973592000`, released `18:16:13.592Z`. |
| BP | Hosting version | `projects/project-f334c42b-7a03-4194-932/sites/reflow-objective-recovery/versions/c57a554489ad940a`, FINALIZED. |
| BQ | Browser Jira INSPECT | Request `01faa49f-8f1e-463c-b8c6-1c688d9f1293`, after deployment: real summary, To Do, Medium; no action. |
| BR | Browser Jira ACT | ACT / AUTO_EXECUTABLE / Acknowledged / Blocked read-back / VERIFIED rendered for request in M. |
| BS | Browser Jira comment | Exact text interpreted, but FAILED rendered. Same-key replay returned same failed action with empty agent list; no false VERIFIED claim. |
| BT | Browser Calendar INSPECT | Request `69fff617-dec8-41be-868f-c1597199ede5`: dedicated title and 29 August 15:00–16:00 IST; not canonical 28 August state. |
| BU | Browser Calendar ACT | Dedicated event ID and expected 29 August 16:00–17:00 IST rendered with VERIFIED; request in AC. |
| BV | Browser ambiguity | Fresh post-action request in AP rendered clarification and “No production action occurred.” |
| BW | Browser denial | Post-action replay in AQ rendered DENIED / Not executed / Not run; durable original denial unchanged. |
| BX | Files changed | Twelve scoped source/config/test files in source commit, plus this report and two proof JSON files; list below. No source edits during confirmed-write phase. |
| BY | Recovery-semantic files changed | NONE. Frozen recovery runtime/planning/orchestrator/Calendar gateway/external-reality files unchanged; canonical inspection branch preserved. |
| BZ | Marketing source changed | NONE; frontend source unchanged in this qualification. |
| CA | Source commit | `4182d52d01b54dbdad824d3035eae193158aeb87` — dedicated Calendar routing, regression tests, bounded eval pacing and scoped deployment configuration. |
| CB | Proof/docs commit | This report and two proof JSON files are the final local docs-only commit; SHA supplied in the final handoff. No product changes to hide the failures. |
| CC | Git remote status | Not inspected or contacted; the latest instruction leaves the push to a separate step. |
| CD | Remote main before SHA | Not fetched / not determined. |
| CE | Push result | NOT ATTEMPTED. |
| CF | Remote main after SHA | Not fetched / not determined; no remote update by this task. |
| CG | Remaining limitations/debt | Jira comment rejection must be diagnosed and corrected under new authorization, then successful create/read-back/same-key deduplication requalified. The adapter records only `jira_invalid_request`, not the exact HTTP status/error body, so this run cannot establish its underlying Jira rejection reason. Post-live CI simulation timeout is unresolved. Trace export omits failed cases; raw case totals must remain authoritative. Viewer/approval/stale-write tests are deterministic, not additional live writes. |
| CH | Exact safe product claim | An approved human successfully requested a real SCRUM-6 status transition and an isolated Calendar move through Reflow; both were independently read back before VERIFIED. Full controlled Operator ACT qualification has NOT passed because comment creation and a post-live model case failed. |
| CI | FINAL VERDICT | **CONTROLLED OPERATOR ACT LIVE NO-GO**. |

### Evaluation interpretation

| Run | Raw suite outcome | Formal grading |
|---|---:|---|
| Final pre-deployment ACT | 10/10 | 10 valid, mean 1.0000, stdev 0.0000 |
| Final pre-deployment regression | 8/8 | 8 valid, mean 1.0000, stdev 0.0000 |
| Post-live regression | **7/8** | Export contains only 7 completed responses: 7 valid, mean 1.0000. The omitted timed-out case makes the full run FAIL. |

The failing post-live run exited 1. Its simulation workflow started at
`18:27:04.371808Z` and emitted `NodeTimeoutError` / failed validation at
`18:27:29.425414Z`. The deadline-simulation case subsequently passed. Earlier
development also encountered model rate limits and classification failures;
those prompted scoped instruction fixes and serial harness pacing before the
all-green deployment gate. They do not excuse the final post-live failure.

Raw local artifacts remain under `artifacts/p2g-*`. Formal final pre-deployment
grades are `p2g-live-final-act-grades/results_20260828_233646.json` and
`p2g-live-final-regression-grades/results_20260828_234345.json`; post-live grading is
`p2g-post-live-regression-grades/results_20260828_235911.json`.

### Files and continuation boundaries

Source commit files:

- `.gcloudignore`
- `deployment/p2g/cloudbuild.yaml`
- `deployment/terraform/single-project/main.tf`
- `deployment/terraform/single-project/variables.tf`
- `objective_recovery_agent/calendar_operator_adapter.py`
- `objective_recovery_agent/operator_agents.py`
- `objective_recovery_agent/operator_schemas.py`
- `objective_recovery_agent/operator_service.py`
- `scripts/evaluate_operator.py`
- `scripts/evaluate_operator_act.py`
- `scripts/export_operator_contract.py`
- `tests/test_operator_actions.py`

Final local proof commit adds this report and the two linked proof JSON files.
The Browser skill supplied the authenticated UI proof and action-time confirmation
boundary; the ADK evaluation workflow kept code-test passes separate from actual
model and external-system outcomes.

Do not blindly repeat the successful Calendar command: the event is already at
16:00–17:00 IST. Do not create a new Jira comment idempotency key merely to bypass
the durable failure. No additional write, IAM correction, redeployment, or push
was authorized or performed after the three-operation phase began.

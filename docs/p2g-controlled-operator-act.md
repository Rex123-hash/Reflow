# P2G — Controlled Operator ACT qualification

Date: 2026-08-28. Implementation source: `71f9709d62a1f193453d20e4064871857d3320a0`.

**CONTROLLED OPERATOR ACT + JIRA NO-GO.** The local implementation and automated gates pass. No P2G deployment or real Jira/Calendar Operator mutation was completed. Jira configuration is absent; the Calendar demo bootstrap failed its first GET with an explicit service-account impersonation permission denial. No IAM changes, alternate-credential retries, role grants, or external mutations were made. Existing deployed recovery services remain unchanged.

## A–AW report

| Item | Result |
|---|---|
| A. Repository safety | Pre-edit status, last ten commits, diff names and diff stat were inspected. The worktree was clean at `28dd57c` (“Raise the application shell to the product's quality level”). No uncommitted tooling files were present or staged. Built on that local history; no push. |
| B. Agent 6 ACT | Extended only the intent interpreter prompt and typed routing. The model interprets; it has no execution tools and cannot grant authorization. Gemini `gemini-3.7-flash` and ADK `2.7.1` remain unchanged. |
| C. ACT schema | Strict, extra-forbidden authority/resource/operation enums; one target, up to five operations. Comments max 1,000 characters; field values max 800. No free-form HTTP operations. Duplicate operations are denied before adapter calls. ACT and SIMULATE remain separate. |
| D. Capability registry | Server-owned adapter registry supplies configured identifiers and typed capabilities to Agent 6. Missing configuration does not register an adapter. Protected-deadline intent is recognized solely for downstream hard denial. |
| E. Authorization | Firebase session → BFF → private backend. Both BFF and backend independently require `OPERATOR_ALLOWED_SUBJECT_HASHES`, containing SHA-256 hashes of approved Firebase UIDs. Missing membership defaults to VIEWER; a forged role header does not elevate a subject. No production identities were granted a role. |
| F. AUTO_EXECUTABLE | Only configured demo targets: allowed/discovered Jira transitions, five conventional priority names, due dates within ±365 days, comments; dedicated Calendar title/description changes and nonzero relative shifts up to 120 minutes. |
| G. APPROVAL_REQUIRED | Jira assignment, relative Calendar shifts over 120 through 480 minutes, and bounded absolute reschedules. Absolute times require a date and timezone. Assignment remains disabled unless an explicit permitted-account list exists. |
| H. DENIED | VIEWER mutations, protected objective deadline changes, unsupported operations/targets, duplicate operations, zero or over-eight-hour relative Calendar shifts. No delete/admin/credentials/production deployment operations exist in the enum. Unsupported requests never become an unrestricted executor. |
| I. Lifecycle | Separate `operator_actions` records: REQUESTED → AUTHORIZED or APPROVAL_REQUIRED → APPROVED → EXECUTING → EXECUTED → READ_BACK → VERIFIED/VERIFICATION_FAILED; DENIED and FAILED are explicit alternatives. Each write is checkpointed and independently read back before the next operation. No recovery incident or autonomous receipt is created. |
| J. Idempotency | Action ID is SHA-256(subject hash + browser key). Firestore transactional claim and guarded transitions prevent duplicate ownership. The original incident/message fingerprint binds retries before model reinterpretation. A replay retrieves the durable action without another model call. Keys survive reload in the same browser tab via sessionStorage. A crash/lost ACK never triggers automatic re-execution. |
| K. Audit/logging | Request/action IDs, subject hash, authority, operation, target, policy, lifecycle, elapsed time, read-back/verification status, and safe error category. Durable receipt contains timestamps, expected/observed state, acknowledgements, resolved proposal and proof. Logs do not include token values, raw response bodies, system prompts or hidden reasoning. |
| L. Adapter interface | Generic `permits_target`, `inspect`, `propose`, `execute`, `read_back`, `verify`, plus typed capability declarations. The coordinator dispatches through the registry. No Slack or voice implementation. |
| M. Jira authentication/config | Server-only Jira Cloud REST v3, configured HTTPS `*.atlassian.net` origin, email + API-token Basic authentication, no redirects. Local/Cloud Run/Secret Manager preflight found no Jira configuration. Token must be supplied through Secret Manager, never browser/chat. |
| N. Jira operations | Inspect summary/status/priority/assignee/due-date/safe description; transition discovery; priority, assignee, due-date, comment writes. Exactly one configured demo issue. No issue creation, deletion, admin, custom-field or tenant-wide JQL support. |
| O. Jira inspect proof | Adapter contract tests pass. Real Gemini classifies the configured fixture issue correctly. **No real Jira GET proof:** credentials/site/demo issue missing. |
| P. Jira mutation proof | HTTP-adapter and coordinator tests pass. **No real Jira mutation proof.** Test doubles are not represented as connected-tool success. |
| Q. Jira read-back proof | Separate issue GET and comment-ID GET; exact comment/account comparison, no lossy case folding. Model-level VERIFIED requires authorization, acknowledgement, expected and observed state, and a passed verification. **No live Jira read-back proof.** |
| R. Jira idempotency proof | Duplicate and concurrent requests, process-object restart, partial-write failure and raw-request replay tests pass. Firestore store claim/decode/transition tests use a controlled client double. No live Firestore action-write or real duplicate-comment qualification was performed. |
| S. Jira failures | Safe categories for timeout, transport, 401, 403, 404, 429, server/invalid response, unavailable transition and bad payload. A partial/lost write retains previous acknowledgements and `external_effects_possible`; it never reports VERIFIED or asserts nothing happened. |
| T. Assignee resolution | Issue-scoped assignable-user lookup, max 21 results, configured account allowlist, exact identity preference, ambiguity/zero-match failure. A full result window is treated as ambiguous. Human names are never sent as account IDs. No real permitted identity has been qualified; assignment is not currently claimed live. |
| U. Calendar demo resource | Bootstrap script targets proposed ID `p2goperator20260828`, label “Reflow Operator Demo — Coordination”, private marker `reflow_resource=operator_demo`. The first GET failed with `iam.serviceAccounts.getAccessToken` permission denied; no event was created. |
| V. Calendar ACT proof | Real Agent 6 interprets the one-hour demo request as typed ACT; adapter/coordinator contract tests pass. **No live human-directed Calendar mutation proof.** |
| W. Calendar read-back proof | Source implementation uses PATCH with mandatory If-Match ETag, then a separate GET; times compare by instant. Requires isolated, confirmed, non-recurring, attendee-free, marker-bearing demo event. Recovery `p1b` IDs are rejected. **Live Operator read-back remains unqualified.** |
| X. Canonical Calendar | Existing deployed read-only external-reality endpoint returned fresh authoritative Calendar state: 2026-08-28 13:00–14:00 UTC, confirmed, comparison PASSED. Frozen Calendar gateway and visualization sources remain unchanged. |
| Y. Canonical incident before/after | `incident-0fc3af5b0bd1ad847aea`: revision **16 → 16**, durable workflow events **28 → 28**, status objective_restored. Both checks used real Firestore reads. |
| Z. Fingerprint before/after | **Identical:** `4a1c93385b5b24060c31e995c521455622f1582967c615a2a7a7021e7f13fa8c`. No canonical evidence writes. |
| AA. Viewer | INSPECT/EXPLAIN/SIMULATE remain usable; ACT is denied by code before an adapter is called. Tested, including backend role downgrade. |
| AB. Operator | Allowed actions execute only after target resolution, deterministic policy and proposal validation. Tests pass; no deployed OPERATOR role has been configured. |
| AC. Guest | BFF rejects real query/approval for demo/guest sessions. Anonymous callers require authentication. Existing Firebase identity separation and auth implementation are unchanged. |
| AD. Approval | Separate fixed-path POST, authenticated original subject only, OPERATOR required at both boundaries, 15-minute expiry, policy recheck, baseline and identity/transition re-resolution check, transactional single-use transition. Replays never repeat execution. |
| AE. Hard denial | Real Gemini emits protected-deadline ACT; deterministic tests prove DENIED and zero adapter calls. Destructive/admin capabilities remain unsupported. This is not a deployed P2G scenario claim. |
| AF. Ambiguity | Real Gemini returns CLARIFICATION_REQUIRED for “Update that task.” No external mutation occurs. Unavailable/ambiguous Jira identity or transition is clarified before writes. |
| AG. Browser security | Fixed BFF paths, origin check, authenticated session, server-derived subject/role, no proxy URL, bounded streaming request bodies, no credentials in client schema. UI renders receipt/read-back, never optimistic success. Existing quotas retained; approvals also consume quota. Synchronous execution concurrency bound survives HTTP-wait cancellation. |
| AH. Seven agents | Existing five reasoning agents and Agent 7 simulation prompt/construction are unchanged; regression tests preserve the genuine seven-agent architecture. No executor was renamed as an eighth agent. |
| AI. INSPECT | Real ADK regression passed, including fresh canonical Calendar read-back. Jira inspect interpretation passed with fixture capability values, not a live Jira source. |
| AJ. EXPLAIN | Real ADK recovery-failure and reopen/replan scenarios passed with authoritative facts. |
| AK. SIMULATE | Both real Agent 7 CI/deadline counterfactual scenarios passed; no external effects, hypothetical provenance, independent verification requirements retained. |
| AL. Focused tests | `test_operator_actions.py`, `test_operator_api.py`, `test_operator_runtime.py`: **75 passed**. Includes partial writes, concurrency, stale approval, raw-request replay, exact long comments, marker protection and forged receipt rejection. |
| AM. Full backend gates | **282 passed, 1 skipped; 96.01% configured coverage**. Mypy: 44 source files clean. Ruff check/format for backend/source/tests/new scripts clean; git diff check and Terraform fmt check pass. Coverage is the existing `objective_recovery` domain/BFF target, not a claim of 96% coverage over every new agent module. Repository-wide Ruff still has pre-existing frozen Blender/marketing experiment-script violations; those were not edited. |
| AN. Frontend gates | **86 tests passed across 13 files**. Lint, format, generated contracts, fixture checks, typecheck and production build pass. Existing >500 kB Three.js bundle warning remains. No global visual redesign, Calendar visualization change or marketing asset changes. |
| AO. Backend revision/digest | Unchanged live `objective-recovery-00023-d5j`, 100% traffic. Digest `sha256:ffe74a9589faca7bdc252de7e48fef6b8b7b95e3d2ede916373b85932f5af3cd`. Read from Cloud Run during this turn; **not a P2G deployment**. |
| AP. BFF revision/digest | Unchanged live `reflow-web-bff-00005-njf`, 100% traffic. Digest `sha256:bb5fb9bac65f32ced63c12d8591d344c1f82b5ad1f0704518cbab6a024a06401`. **Not a P2G deployment**. |
| AQ. Hosting release/version | No deployment. Current Hosting release lookup returned HTTP 403, so current release/version cannot be attested. Historical P2F record only: release `1787923175280000`, version `f0c660c0d1b17dd8`; do not treat these as freshly verified. |
| AR. Files changed | 28 implementation files in the source commit, listed below; this report is an additional documentation file. Generated OpenAPI/TypeScript/AJV account for most diff volume. |
| AS. Recovery-semantic files | **None.** Domain policy/state machine, existing five agents, planning/execution/runtime, canonical Calendar gateway/external-reality implementation, Firebase auth and CalendarMiniTimeline are byte-identical to the starting commit. Only Agent 6's prompt changed inside the shared operator-agents file; Agent 7 did not. |
| AT. Source commit | `71f9709d62a1f193453d20e4064871857d3320a0`, local working branch. Not pushed. |
| AU. Jira setup debt | Site, service-account email, secure API-token secret reference, dedicated demo issue and available transition; optional approved account IDs only after real resolution is proven. Exact setup below. |
| AV. Remaining product debt | Live Jira and Calendar mutation/read-back/idempotency qualification, approved operator identities, Firestore action persistence qualification under deployed identity, deployment and authenticated end-to-end UI smoke. Unknown-outcome crash receipts require human reconciliation; no automatic replay/recovery or rollback. Browser retry retention is tab-session scoped; intentionally repeating an identical command needs a new explicitly chosen key. Multi-resource actions remain unsupported. |
| AW. Verdict | **CONTROLLED OPERATOR ACT + JIRA NO-GO** until real authorized Jira and dedicated Calendar mutations are independently verified. Local tests or model interpretation alone do not meet the product stop condition. |

## Real-model evaluation evidence

The ADK workflow/evaluation skills kept the frozen model and seven-agent design intact and required genuine inference plus formal grading, separate from deterministic mocked adapter tests. Both suites were rerun against the final Agent 6 prompt. No live executors were attached to the ACT interpretation harness.

| Local custom metric over real ADK traces | Total | Valid | Errors | Mean | Standard deviation |
|---|---:|---:|---:|---:|---:|
| p2g_act_behavior | 8 | 8 | 0 | 1.0000 | 0.0000 |
| p2f_operator_behavior | 8 | 8 | 0 | 1.0000 | 0.0000 |

Local evidence (ignored generated artifacts, retained in the workspace):

- `artifacts/p2g-act-evaluation.json` and `artifacts/p2g-act-traces.json`.
- `artifacts/p2g-regression-evaluation.json` and `artifacts/p2g-regression-traces.json`.
- `artifacts/p2g-act-final-grades/results_20260828_221053.json` and corresponding HTML.
- `artifacts/p2g-regression-final-grades/results_20260828_221112.json` and corresponding HTML.

Reproduce from the repository root:

```powershell
uv run python -m scripts.evaluate_operator_act
uv run python scripts/evaluate_operator.py --context-url https://objective-recovery-2gbnbjfvkq-uc.a.run.app --output artifacts/p2g-regression-evaluation.json --traces-output artifacts/p2g-regression-traces.json
uv run agents-cli eval grade --traces artifacts/p2g-act-traces.json --config tests/eval/operator_act_eval_config.yaml --output artifacts/p2g-act-final-grades
uv run agents-cli eval grade --traces artifacts/p2g-regression-traces.json --config tests/eval/operator_eval_config.yaml --output artifacts/p2g-regression-final-grades
```

## Minimal setup needed to continue

1. An authorized owner provides the Jira Cloud origin (`https://<site>.atlassian.net`), a dedicated demo project/issue key, and the integration account email. The account needs only the demo issue permissions required for inspection, editing, transitions and comments. No admin APIs are implemented.
2. That owner stores a compatible account API token in Google Secret Manager and supplies its **secret resource/version reference**, not its value. Mount it as backend-only `JIRA_API_TOKEN`; set backend-only `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_DEMO_ISSUE_KEY`. This implementation uses direct tenant REST v3 with Basic auth, not OAuth/scoped-token gateway routing. Basic auth is an internal demo choice; a distributable integration should adopt supported OAuth rather than collect customer tokens. [Atlassian authentication guidance](https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/).
3. If assignment is desired, provide explicitly permitted `JIRA_ALLOWED_ACCOUNT_IDS`; independently verify one unique assignable person in the demo issue before advertising assignment. Otherwise leave assignment disabled.
4. An authorized Calendar owner must create the isolated marker-bearing event through the supplied bootstrap in an already-authorized environment, or explicitly resolve the reported service-account permission issue. Do not relabel/reuse the canonical `p1b...` event. Set `OPERATOR_DEMO_CALENDAR_EVENT_ID` only after creation is verified. The existing configured Calendar and service account can be reused without changing P2E logic. The bootstrap's attempted ID is not proof that the event exists.
5. The application owner explicitly approves Firebase UID(s). Configure their SHA-256 hashes as `OPERATOR_ALLOWED_SUBJECT_HASHES` on **both** BFF and backend. No email-derived implicit elevation or browser override. No identity was selected on the user's behalf.
6. Deploy only backend, BFF and the application frontend through the existing release path, with the above gates satisfied; verify private IAM, all existing regressions, canonical incident/fingerprint, real Jira transition+comment retry, optional assignment, and real dedicated Calendar ACT+GET. Record new revision/digests and Hosting version with authorized metadata access. Keep P2G NO-GO until those proofs exist.

Calendar conditional writes deliberately use ETags/If-Match to reject intervening edits instead of silently applying a stale approval. [Google Calendar conditional modification](https://developers.google.com/workspace/calendar/api/guides/version-resources).

## Implementation file inventory

```text
.env.example
deployment/terraform/single-project/main.tf
deployment/terraform/single-project/variables.tf
docs/operator-openapi.json
frontend/scripts/generate-operator-contract.mjs
frontend/src/app/operator/OperatorConversation.test.tsx
frontend/src/app/operator/OperatorConversation.tsx
frontend/src/app/operator/client.ts
frontend/src/app/operator/operatorContract.ts
frontend/src/app/operator/operatorValidator.ts
frontend/src/app/routes/OperatorRoute.tsx
frontend/src/app/routes/operator.css
objective_recovery_agent/calendar_operator_adapter.py
objective_recovery_agent/jira_operator_adapter.py
objective_recovery_agent/operator_actions.py
objective_recovery_agent/operator_agents.py
objective_recovery_agent/operator_api.py
objective_recovery_agent/operator_schemas.py
objective_recovery_agent/operator_service.py
scripts/bootstrap_operator_demo.py
scripts/evaluate_operator_act.py
scripts/export_operator_contract.py
src/objective_recovery/web_bff/backend.py
src/objective_recovery/web_bff/operator.py
tests/eval/operator_act_eval_config.yaml
tests/eval/operator_act_metric.py
tests/test_operator_actions.py
tests/test_operator_api.py
```

No Slack, Live Call, image multimodality, autonomous recovery redesign, or marketing redeployment was undertaken.

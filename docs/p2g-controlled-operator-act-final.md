# P2G Controlled Operator ACT — final closure record

## 1. Executive verdict

**CONTROLLED OPERATOR ACT LIVE NO-GO.** The Jira comment serialization defect and
Agent 7 timeout defect are repaired, locally qualified, committed, and deployed. The
single corrected Jira comment write was deliberately not attempted because the mandatory
pre-live Calendar check found the dedicated Operator event at 17:00–18:00 IST instead of
the required preserved 16:00–17:00 IST. Correcting that external state requires a new
Calendar write, which this mission explicitly forbids. A final provenance audit also found
that the deployed revision's `COMMIT_SHA` environment label contains a non-resolving full
SHA even though its seven-character prefix matches the repair commit; this run did not
create another revision to correct the label.

This record supersedes the closure status in
`docs/p2g-final-live-qualification-2026-08-28.md` without erasing that historical NO-GO
evidence.

## 2. Product capability and architecture

The implemented control plane is:

browser → Firebase Hosting → authenticated BFF → private Cloud Run backend → Agent 6
typed intent → deterministic authorization → bounded adapter → durable receipt →
independent read-back → deterministic verification.

Adapters, policy, receipt storage, and verifiers are deterministic code, not reasoning
agents. The architecture still contains exactly seven genuine Google ADK 2.7.1 /
`gemini-3.7-flash` reasoning agents:

| # | Agent | Role | External write capability |
|---|---|---|---|
| 1 | `disruption_interpreter` | Interpret disruption evidence | None |
| 2 | `impact_analyst` | Analyze objective impact | None |
| 3 | `recovery_planner` | Generate recovery plans | None |
| 4 | `risk_critic` | Critique plans | None |
| 5 | `recovery_analyst` | Analyze failed recovery | None |
| 6 | `operator_intent_interpreter` | Produce typed INSPECT/EXPLAIN/SIMULATE/ACT intent | None |
| 7 | `simulation_agent` | Produce isolated hypothetical results | None |

No eighth executor agent was added. Agent 7 retains no tools, no persistence, typed
`HYPOTHETICAL_NO_ACTION` provenance, and `external_effects_executed=false`.

## 3. ACT intent, authorization, registry, and approval model

Agent 6 can select only server-supplied authority/resource/operation enums. Deterministic
code then validates the exact configured target, role, operation set, current external
state, and proposal. Jira transition, priority, due date, and comment operations on the
configured demo issue may be auto-executable. Assignment remains approval-required when
configured and is disabled in this deployment. The protected objective deadline is always
denied. Calendar operations are restricted to the separately marked Operator demo event;
absolute or large changes require approval and out-of-bound changes are denied.

The durable lifecycle remains REQUESTED → AUTHORIZED/APPROVAL_REQUIRED → EXECUTING →
EXECUTED → READ_BACK → VERIFIED/VERIFICATION_FAILED. Uncertain writes preserve
`external_effects_possible`; failures never claim VERIFIED. Idempotency binds the
authenticated subject, browser key, target, and typed operation fingerprint. A same-key
replay returns the existing receipt and does not re-execute the adapter.

## 4. Jira integration and comment root cause

The Jira Cloud v3 comment operation is `POST
/rest/api/3/issue/{issueIdOrKey}/comment` with `Content-Type: application/json`. Reflow
keeps comments as bounded plain text and serializes them to the minimal Atlassian Document
Format document required by v3.

The historical request body already used valid minimal ADF. The actual defect was its Jira
entity property:

```json
{"key":"reflow.operator_action_id","value":"<action-id>"}
```

Atlassian requires an entity-property value to be a JSON object. The repaired adapter sends:

```json
{"key":"reflow.operator_action_id","value":{"operator_action_id":"<action-id>"}}
```

Evidence:

- Atlassian's Add Comment contract documents the v3 endpoint, JSON body, ADF `body`,
  optional `properties`, and HTTP 201 success:
  https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/
- Jira REST v3 documents ADF use for comment bodies:
  https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro
- Jira entity properties require a valid JSON object value (maximum 32 KB):
  https://developer.atlassian.com/cloud/jira/platform/jira-entity-properties/

The adapter rejects empty, whitespace-only, malformed-control-character, and over-1000
character comments before HTTP. Unicode and punctuation are preserved exactly. A 201
acknowledgement must contain a bounded numeric comment ID; the adapter then performs an
independent comment GET and exact ADF-to-plain-text comparison.

## 5. Safe Jira diagnostics and failure containment

Jira failures now retain only allowlisted metadata: HTTP status, stable category, up to
three bounded `errorMessages`, up to five bounded field errors, an allowlisted request
correlation ID, operation type, and configured issue key. Full responses, arbitrary
fields, Authorization/Cookie content, API tokens, and Basic-auth encodings are excluded or
redacted. Diagnostics are stored in the failed receipt's `adapter_proof`, while the public
error category stays stable.

Tests inject the API token, Basic credential, Authorization text, Cookie text, and arbitrary
response fields into simulated Jira validation errors and prove none can reach retained
diagnostics.

## 6. Historical and current Jira proof

The historical failed comment receipt remains immutable:

- action `d24818fa4b13ad8bd1195ecac9fd253d76b854047e67b0b65882ba8029d11b1d`
- target `SCRUM-6`
- exact comment `Backend engineer unavailable.`
- lifecycle `FAILED`
- category `jira_invalid_request`
- verification `NOT_RUN`
- no acknowledgement and zero comments in the historical independent listing

The previously qualified status action also remains:

- action `0d25dfd97c7bff80e10ef4a0becc96724ae9e96a92b197ce102e6a91937d5e42`
- `SCRUM-6` → Blocked
- lifecycle `VERIFIED`
- verification `PASSED`

The repaired authenticated browser INSPECT on the deployed revision freshly returned
`SCRUM-6` status `Blocked` at 2026-08-28T20:03:24Z. No new Jira action record was created
in this closure run. Because the pre-live Calendar gate failed, the newly authorized
corrected Jira comment create, same-key replay, and final independent exact-count audit were
not performed. Therefore successful comment/dedup proof remains unqualified.

## 7. Calendar integration and blocker

The canonical recovery Calendar resource remains unchanged. A fresh read at
2026-08-29T01:35:11+05:30 returned the expected 18:30–19:30 IST confirmed event and
matched its persisted VERIFIED receipt.

The separate Operator event is `p2goperator20260828`, marked
`reflow_resource=operator_demo`, confirmed, and non-recurring. Receipt history proves two
distinct verified actions:

| Action | Created (UTC) | Requested shift | Observed result |
|---|---|---|---|
| `5e305e82756408744817f2ed4967407ccb06ca28dd7760dc82165651205c0df3` | 2026-08-28T18:25:17Z | +60 minutes | 16:00–17:00 IST, VERIFIED |
| `c69b8fb9a0650fc2fcdc79d81964c6f81ee978b1567e42c8adee8aa82ab13ef1` | 2026-08-28T19:06:54Z | +60 minutes | 17:00–18:00 IST, VERIFIED |

The second record is a fresh-key action, not a replay of the first. The deployed browser
INSPECT freshly returned 17:00–18:00 IST at 2026-08-28T20:03:43Z. This violates the final
GO bar's required 16:00–17:00 state. This run made no Calendar write and did not alter IAM.

## 8. Agent 7 timeout diagnosis and repair

Safe qualified traces show successful Agent 7 latency from 7,644 ms through 11,200 ms,
with approximately 6,812–6,857 input tokens and 536–859 output tokens. The post-live
`simulate_ci` failure began at 18:27:04.371808Z and emitted `NodeTimeoutError` at
18:27:29.425414Z: 25,053 ms at the exact old 25-second workflow bound. The failed call did
not complete, so input/output usage is unavailable and is not fabricated.

The smallest defensible operational adjustment is Agent 7 only: 25s → 30s. Agent 6 stays
25s. Model, instructions, LOW thinking, 4,096 output-token bound, isolation, provenance,
and retry behavior are unchanged. The outer Agent 7 wrapper is 32s. Remaining margins are
53s under the 85s BFF upstream read timeout, 58s under the 90s browser timeout, 68s under
the BFF Cloud Run 100s request timeout, and 268s under the backend Cloud Run 300s request
timeout.

The formal repaired run completed `simulate_ci` in 8,469 ms and
`simulate_deadline` in 8,024 ms, each in one attempt with validation PASSED.

## 9. Evaluation trace completeness

Failed cases now remain in exported traces with an empty `responses` array plus safe
`failureMetadata`: case ID, agent name, request correlation ID, elapsed milliseconds,
timeout category, and `completed=false`. No response is fabricated. Raw suite totals remain
authoritative.

An initial closure invocation produced 0/8 because all cases timed out before Agent 6 while
the local harness attempted a direct Firestore context read. That failure artifact is
preserved. The single allowed corrected invocation used the deployed read-only context
endpoint while executing the repaired local agents.

## 10. Model and deterministic qualification

- Repaired pre-live raw real-model regression: **8/8**.
- Formal `agents-cli` grading: 8 total, 8 valid, 0 errors, mean 1.0000.
- Agent 7 `simulate_ci`: 8,469 ms, 6,812 input, 537 output, 7,349 total tokens, PASSED.
- Agent 7 `simulate_deadline`: 8,024 ms, 6,843 input, 538 output, 7,381 total tokens,
  PASSED.
- Focused Operator/Jira tests: 85 passed; the focused-only process exited solely because
  repository-wide coverage cannot be measured from a subset.
- Full backend: 310 passed, 1 skipped, 96.01% coverage against 95% required.
- Scoped Ruff and formatting: passed.
- Strict mypy on all changed source/harness modules: passed.
- Generated Operator contract check: passed and unchanged.
- Staged secret-pattern scan: passed.
- Repository-wide Ruff additionally reports 295 pre-existing errors under Claude's locked
  `frontend/orb-authored-experiment`; those files were not edited or staged.

## 11. Deployment provenance

- Starting HEAD: `af0eac51d56b4c7f5caea556c0746bb8c5da6763`.
- Repair commit: `7d6721ceae80eed9c38d615309c826266e23cedf`.
- Cloud Build: `e3825acc-21a2-4456-a79a-c5a8c07fdaba`, SUCCESS.
- Backend revision: `objective-recovery-00025-jg5`, ready, 100% traffic.
- Backend image digest:
  `sha256:d99fbd9307d80d99a9a0a9e2387950e8cfc1010e694d10bb87a3b65338ddd14d`.
- Backend health: `status=ready`.
- Backend request timeout: 300s.
- BFF unchanged: `reflow-web-bff-00006-xpk`, 100% traffic, 100s request timeout.
- Firebase Hosting unchanged.
- IAM unchanged.

The deployed revision's `COMMIT_SHA` environment value is
`7d6721cb7a3438b5400030ca22942adfac9e1d6e`. That value does not resolve as a Git commit in
this repository; the actual repair commit is the SHA recorded above. Build ID, immutable
image digest, revision name, and observed runtime behavior remain independently recorded,
but the incorrect full-SHA label is a deployment-provenance defect that must be corrected
before FINAL GO.

The build used the repository's backend-only `.gcloudignore` allowlist. Claude's frontend
working files, credentials, artifacts, and caches were excluded from the source archive.

## 12. Canonical immutability

Before and after deployment/browser inspection:

| Invariant | Required | Observed |
|---|---:|---:|
| incident | `incident-0fc3af5b0bd1ad847aea` | exact |
| revision | 16 | 16 |
| durable workflow events | 28 | 28 |
| status | `objective_restored` | exact |
| active plan revision | 2 | 2 |
| document fingerprint | `4a1c93385b5b24060c31e995c521455622f1582967c615a2a7a7021e7f13fa8c` | exact |

Operator records remain in `operator_actions`; no canonical recovery record, GitHub
evidence, recovery receipt, objective deadline, or canonical Calendar state changed.

## 13. Security and authorization boundary

The approved Operator subject remained authenticated through Firebase and BFF into the
private backend. Jira and Calendar credentials remain backend-only Secret Manager/runtime
material. Attempts to access the Jira secret directly as the human account and via
unauthorized service-account impersonation failed closed; no IAM was broadened. Existing
deterministic tests continue to prove Viewer denial, guest read-only behavior, forged role
non-elevation, BFF role enforcement, backend role enforcement, approval ownership,
idempotency conflicts, stale proposals, partial-write containment, target isolation, and
protected-deadline denial.

The browser Jira INSPECT and Calendar INSPECT were read-only and explicitly displayed “No
production action occurred.” The corrected Jira ACT was not submitted after the Calendar
precondition failure.

## 14. Claim-to-proof table

| Claim | Proof | Status |
|---|---|---|
| Typed Jira status ACT can be verified | SCRUM-6 transition receipt + independent GET | Proven |
| Typed Calendar ACT can be verified | First dedicated event receipt + conditional write/read-back | Proven historically |
| Jira comment adapter matches current contract | Official contract comparison + payload tests | Proven locally/deployed |
| Corrected live Jira comment works and deduplicates | Requires one create/read-back/replay/count | **Not run** |
| Agent 7 bounded reliability repair | 30s bound + raw 8/8 + formal 1.0000 | Proven |
| Canonical recovery remains immutable | exact revision/count/status/plan/fingerprint before/after | Proven |
| Dedicated demo Calendar remains at required time | Fresh GET returned 17:00–18:00, not 16:00–17:00 | **Failed** |
| Deployed provenance is internally consistent | build/revision/digest/traffic checks; `COMMIT_SHA` label audit | **Failed: full-SHA label mismatch** |

## 15. Supported and unsupported scope

Supported configured operations remain bounded Jira inspection, transition, priority, due
date, comment, and separately configured Calendar inspection/reschedule/title/description
updates, subject to deterministic policy and verification. Assignment is disabled in the
current deployment.

Unsupported claims remain arbitrary browser/website control, arbitrary Jira tenant control,
unrestricted Calendar control, unrestricted production autonomy, Slack, voice, image
understanding, and any eighth reasoning agent.

## 16. Remaining debt and exact unblock

Critical blockers:

1. A human must explicitly authorize one conditional Calendar correction of only
   `p2goperator20260828` from 17:00–18:00 IST back to the required 16:00–17:00 IST. It must
   use the current ETag and an independent GET. This mission did not authorize that write.
2. After the Calendar pre-live state passes, run the already authorized new Jira comment
   create, exact read-back, same-key replay, and independent exact-text count.
3. In a newly authorized backend revision, set `COMMIT_SHA` to the actual repair commit
   `7d6721ceae80eed9c38d615309c826266e23cedf`, then revalidate revision, digest, traffic, and
   health. No corrective deployment was performed in this run.
4. Run the final post-deploy 8/8 regression, browser ambiguity/denial checks, final canonical
   audit, and final gates against the resulting external state.

No Git push was performed because public synchronization is allowed only for a FINAL GO.

## 17. Safe public claim

The requested full live claim is withheld while this verdict is NO-GO. If the critical
items above pass, the intended bounded claim remains:

> Reflow Operator can interpret an authorized operational request, apply deterministic
> policy, carry out bounded actions on configured Jira and Google Calendar resources,
> independently read those systems back, and report VERIFIED only when observed external
> state matches the requested change.

The architecture claim is already supported by code and deterministic proof:

> Reflow's typed adapter control plane allows additional authorized tools to be added
> without redesigning its core Operator reasoning and verification loop.

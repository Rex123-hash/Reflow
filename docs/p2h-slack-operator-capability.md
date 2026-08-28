# P2H — bounded Slack Operator capability

## Current checkpoint — model qualification repair, 29 August 2026

**P2H MODEL QUALIFICATION READY.** The one authorized final expanded run passed **24/24 raw**;
the one authorized frozen recovery run passed **8/8 raw**. Both unchanged formal graders report
all cases valid, zero errors and mean **1.0**. Exactly seven agents and all reliability bounds
remain unchanged. No external write, Slack API call, secret-version creation/access, build,
deployment or push was performed by this repair. Slack setup and authorized live proof remain
separate work; a final audit observed an externally added secret version, left untouched (§17.7).

Section 17 records the repair and its evidence limits. **Sections 1–16 below are the preserved
implementation checkpoint**, including its genuine 23/24 and 7/8 failures and then-current NO-GO.
Their historical verdicts and incomplete diagnostic conclusions are not the current model verdict.
The original DM timeout's underlying provider/ADK cause remains unproven; it is not retroactively
declared fixed by a successful run. This qualification is not a live Slack GO claim.

## 1. Verdict and boundaries

**P2H SLACK OPERATOR CAPABILITY NO-GO.** Source implementation and deterministic qualification
are complete, but the final real-model gates are not green: expanded intent 23/24, unchanged
recovery/simulation 7/8. Therefore neither GO nor IMPLEMENTATION READY is claimed. Human Slack
setup and explicit live-message permission are also absent. No Slack API request or message was
made in this implementation session. No P2H image was built or deployed.

The stopping boundary is the missing Slack workspace authorization plus the explicit freeze on
the P2G/Agent 7 reasoning layer. Further reliability work in that frozen layer needs user direction;
the failed full runs cannot be replaced by isolated successes or hidden by lowering thresholds.

Starting HEAD: `5b9a766961b9377f45c0b1cae873b23fe39f8cc9` (`codex/ui-m2-orb-anchor-spike`). The only pre-existing change was untracked
`frontend/op-input.mjs`, preserved untouched. No previous history, authorship, Jira/Calendar
adapter, canonical recovery behavior, or marketing/story source was rewritten. PUSH = NOT ATTEMPTED.

## 2. User capability and supported scope

The implemented capability interprets a request such as “Tell the release channel that SCRUM-6 is
blocked,” resolves one configured public Slack channel, authorizes deterministically, posts one
plain-text message, reads it back independently, and verifies exact text and identifiers.

Supported: read-only metadata and latest Reflow-bot message within a 15-message window; one
top-level plain-text post to one public, unshared, active, joined demo channel. The “latest” result
is explicitly limited to that window; absence does not claim there are no older Reflow messages.

Unsupported: arbitrary channel IDs/names, discovery, private channels, Slack Connect/shared
channels, DMs, member lookup, workspace administration, token management, historical edits/deletes,
threads, mass notifications, Block Kit/attachments, arbitrary search or history ingestion.

## 3. Architecture and seven agents

Browser → authenticated/origin-checked BFF → private backend → Agent 6 typed intent → existing
capability registry → deterministic policy → existing durable coordinator → Slack adapter →
independent verifier → generic Operator proof.

Slack is an adapter, not an eighth reasoning agent. The seven remain:
`disruption_interpreter`, `impact_analyst`, `recovery_planner`, `risk_critic`, `recovery_analyst`,
`operator_intent_interpreter`, `simulation_agent`.

Agent 6 has value-only capability data and no Slack token/client/tool. Its added instruction is
explicitly Slack-only. The model, Agent 7 prompt, provider/node timeouts, retry ceilings, and
five-agent core are unchanged. Gemini reasons. Code enforces. Adapters act. Verifier proves.

## 4. Official Slack contract verified — 29 August 2026

The chosen app is an internal, workspace-installed Slack app with a granular bot identity, not a
classic app, user-impersonation token, incoming webhook, or app-level/socket token. OAuth v2
installation grants the bot token; no hosted multi-workspace OAuth flow is needed here.
See [Slack app authentication](https://api.slack.com/authentication/quickstart) and
[OAuth v2 installation](https://api.slack.com/authentication/oauth-v2).

| Purpose | API / permission |
|---|---|
| Authenticate bot/team | `auth.test`; no additional scope |
| Inspect public channel | `conversations.info`; `channels:read` |
| Post | `chat.postMessage`; `chat:write` |
| Independent message lookup | `conversations.history`; `channels:history` |

Exactly those three bot scopes are in `deployment/slack-app-manifest.yaml`. No user, admin,
`chat:write.public`, `chat:write.customize`, DM or private-history scope is requested. Bot membership
is necessary for this access model and is checked before writing. Slack scopes themselves are not
one-channel credentials: Reflow's server registry enforces the narrower target. Invite the bot only
to the intended demo channel. See [channel read scope](https://api.slack.com/scopes/channels%3Aread),
[public history scope](https://api.slack.com/scopes/channels%3Ahistory),
[bot identity test](https://docs.slack.dev/reference/methods/auth.test/), and
[conversation flags](https://docs.slack.dev/reference/objects/conversation-object/).

`POST https://slack.com/api/chat.postMessage` accepts JSON and a bearer header. The safe ACK fields
are `ok`, `channel`, and string `ts`; the returned message object is not verification evidence.
Slack may transform text. The timestamp is preserved as a string, never converted to a float.
The current method reference mentions `client_msg_id` in errors but does not specify a reliable
deduplication window or expose it in the documented request arguments. It is therefore not used
as an idempotency guarantee. See [post contract](https://docs.slack.dev/reference/methods/chat.postMessage/)
and [current SDK argument contract](https://docs.slack.dev/tools/node-slack-sdk/reference/web-api/type-aliases/ChatPostMessageArguments/).

Independent lookup uses `GET conversations.history` with the exact channel, `oldest=ts`,
`latest=ts`, `inclusive=true`, `limit=1`. A `ts` identifies a message within a conversation, not
globally. This is a top-level-message path, not a thread-replies API. Internal customer-built apps
currently retain Tier 3 history limits; the 1-request/minute restriction is for commercially
distributed non-Marketplace apps. See [history contract](https://docs.slack.dev/reference/methods/conversations.history/).

All responses require an actual boolean `ok`; HTTP 200 alone is insufficient. Stable allowlisted
error codes are retained, not arbitrary bodies. HTTP 429 carries `Retry-After`; the adapter records
it and fails safely without retrying a write. Posting is generally limited to one message/second
per channel. See [Web API response contract](https://docs.slack.dev/apis/web-api/) and
[rate limits](https://docs.slack.dev/apis/web-api/rate-limits/).

## 5. Credential and target design

Secret Manager secret: `objective-recovery-slack-bot-token`, following the existing project-prefix
convention. Terraform created the empty secret and exactly one secret-level
`roles/secretmanager.secretAccessor` binding for
`objective-recovery-app@project-f334c42b-7a03-4194-932.iam.gserviceaccount.com`.
No version/value was created or accessed. No project-wide IAM role was added.

Optional Terraform `operator_slack = { channel_id, team_id, secret_version }` references a pinned
numeric secret version. Null disables Slack. Private backend only:

- `SLACK_BOT_TOKEN` ← Secret Manager runtime reference, never a build argument.
- `SLACK_DEMO_CHANNEL_ID` ← one server-owned `C…` identifier.
- `SLACK_TEAM_ID` ← one server-owned `T…` identifier.

The model/browser can select only `configured-release-channel`; raw channel IDs are rejected,
including the configured ID itself when supplied as a model-selected resource identifier.
`auth.test` must match the configured team and return bot/user identifiers; required scopes must
be confirmed. Channel metadata must confirm public, unshared, active membership. No fallback to
another channel exists. Missing configuration means no Slack adapter in the registry.

## 6. Typed intent and deterministic policy

New authority/resource: `SLACK` / `CHANNEL`. Operations: `SLACK_INSPECT_CHANNEL` and
`SLACK_POST_MESSAGE`. INSPECT is the existing read-only intent route: target plus empty
`requested_operations`, not an ACT request. Attempting the inspect operation as a mutation is denied.

ACT has exactly one `SLACK_POST_MESSAGE`; message text is `value`, `comment` is null. Example typed
target: `{authority: SLACK, resource_type: CHANNEL, resource_identifier: configured-release-channel}`.
Agent 6 clarifies missing target/message and rejects unsupported channels/DMs/admin/history edits.
Mass-mention text is preserved in typed intent so code, not Gemini, denies it.

Only authenticated `OPERATOR` may ACT. Exactly one configured target and one operation are required.
Text is capped at 500 Unicode code points. Empty/whitespace and invalid controls are rejected;
over-limit text, `@channel`, `@here`, `@everyone` (case-insensitive), Slack mention/link control
syntax starting `< !`, `<@`, or `<#` (including whitespace after `<`), and format-control characters
are denied. Credential-shaped Slack text cannot enter a typed post receipt.

No model-supplied Block Kit, metadata, URL, API method, thread, channel, username or icon payload is
accepted. The fixed request uses `mrkdwn=false`, `parse=none`, `link_names=false`, unfurls disabled.
Only `&`, `<`, `>` are escaped on send and decoded once on read-back, per
[Slack text escaping](https://docs.slack.dev/messaging/formatting-message-text/).
There is no trimming, case folding, fuzzy comparison, URL normalization or emoji substitution in
verification. Provider transformations outside those three escapes fail exact verification safely.

## 7. Adapter flow and verification

`permits_target` validates the semantic resource. `inspect` authenticates, checks metadata, and
reads at most 15 recent messages; only safe bounded text from the authenticated bot is surfaced.
Unrelated messages, provider response bodies, user profiles, tokens and headers are discarded.
The resulting history is never fed back to Gemini. Channel names and observed text are checked for
credential reflection before becoming proof. `propose` repeats target/text bounds.

The existing coordinator stores REQUESTED/AUTHORIZED and a baseline, re-inspects to reject stale
proposals, persists EXECUTING plus `external_effects_possible=true`, and calls one POST. The adapter
retains channel/string timestamp ACK identifiers; the coordinator durably stores EXECUTED before
read-back. A separate history call supplies observed message text, timestamp, and bot identity.

`verify` requires equality of channel-scoped lookup, timestamp, exact semantic text, bot user and
bot ID. Missing/changed observations become VERIFICATION_FAILED. A failed read becomes FAILED,
retaining its durable ACK and uncertainty. Only successful independent comparison becomes VERIFIED.
The generic UI already displays authority, operation, target, ACK, read-back and verification;
only generated isolated Operator types/validators and a rendering test changed, not visual source.

## 8. Durable idempotency and uncertain writes

Reuses `operator_actions`, its transactional claim/advance semantics, subject+key action ID,
request fingerprint, and service-level replay-before-Agent-6. Same key/request returns the same
durable action/receipt without an agent call or another Slack call. Changed request under the same
key conflicts. Restarting the coordinator with the same store does not execute again. No new
Slack retry subsystem or provider deduplication assumption exists.

Lost ACK, transport/timeout, malformed ACK, and ambiguous provider failures trigger at most one
bounded history reconciliation (15 messages since attempted send). It records candidate count,
not unrelated content. Matching text alone cannot uniquely attribute a message to this action;
the receipt remains FAILED/uncertain with no fabricated ACK or VERIFIED status. A failed
reconciliation also remains uncertain. Neither path POSTs again. Process-loss EXECUTING records
remain governed by the existing durable replay rule. Do not use a fresh key to retry an uncertain
post without an independent human audit.

## 9. Safe diagnostics and security

Diagnostics allow only HTTP status, boolean `ok`, known error code, constrained correlation ID,
numeric Retry-After, configured channel ID, method, and bounded reconciliation outcome/count.
Tokens, authorization, cookies, arbitrary errors/bodies and unrelated channel content are excluded.
Transport exceptions suppress their unsafe chained diagnostic. Tests exercise token reflection in
error, header, channel name and observed text, and inspect logs/receipts for leaks.

BFF authentication/origin/role code is unchanged. Viewer can INSPECT but cannot ACT; Guest cannot
invoke the live Operator endpoint. Forged browser subject/role is overwritten, then backend policy
independently validates the server-owned subject allowlist. Slack adds no product identities.

## 10. Qualification and model regression

| Deterministic gate | Final result |
|---|---|
| Focused Slack | 77 passed |
| Focused Slack + Operator actions/runtime/API | 183 passed |
| Full backend | 391 passed, 1 existing cloud test skipped |
| Unchanged configured coverage gate | 96.01% (`objective_recovery`; required 95%) |
| Additional Slack adapter + policy coverage | 100%, 187 statements; required 95% |
| Strict mypy | 46 configured files + 5 new/changed explicitly checked files passed |
| Ruff / formatting | Configured src/tests plus changed adapter/service/scripts: 57 files passed |
| Frontend | 87 tests / 13 files, typecheck and production build passed |
| Generated contracts and existing fixtures/marks/poster checks | Passed; no visual/story source edits |
| Terraform fmt / validate | Passed |
| Git whitespace / credential scan | Passed; exact final scan is in proof artifacts |

The frozen `operator_agents.py` contains a pre-existing RUF001 en-dash diagnostic and a
pre-existing retry-budget line-wrap formatting difference. Baseline checking confirmed that debt;
it was not silently fixed in this Slack milestone. Ruff on that file passes with only the existing
RUF001 excluded. An AST comparison proves every node outside Agent 6's `INTENT_INSTRUCTION` is
identical to starting HEAD. Full-repository lint/format cleanliness is not claimed. The frontend
build retains its existing >500 kB bundle warning; no bundle redesign was attempted.

| Genuine model run | Passed / total | Failure / interpretation |
|---|---|---|
| Initial expanded intent | 22/24 | `protected_deadline`, `slack_empty`: provider deadline |
| Confirmation, original Slack appendix | 21/24 | `protected_deadline`, `slack_unknown_channel`, `slack_mass_mention_policy`: deadline |
| Original P2G prompt diagnostic | 2/2 | Protected deadline and missing Slack text; diagnostic only |
| Scoped Slack appendix diagnostic | 2/2 | Same two cases; no timeout/model/threshold change |
| **Final expanded intent** | **23/24** | `slack_dm`: 14-second provider deadline |
| Earlier unchanged recovery suite | 8/8 | Before final appendix refinement |
| **Final unchanged recovery suite** | **7/8** | `simulate_ci`: service rejected after Agent 7 schema-valid completion |
| CI diagnostic, final source | 1/1 | Existing bounded retry used; 24,152 ms / 2 attempts; zero unknown references on this probe |

All inference ran real local Vertex/ADK against the frozen fixture or read-only deployed context;
no Slack executor was available. The initial, confirmation, final and diagnostic records are all
preserved under `artifacts/p2h-*`, including failures. This is not a successful final model gate.

`agents-cli eval grade` was run on the generated traces with unchanged metrics. The final intent
grader reports 23 valid / mean 1.0; final recovery grader reports 7 valid / mean 1.0. It omits
no-response failures from its aggregate. The harness denominators (24 and 8) remain authoritative.
Do not present those grader means as full-suite passes.

The initial expanded real Gemini run was **22/24**: `protected_deadline` and `slack_empty` timed out.
The confirmation reproduced `protected_deadline` timeout and two other timeout cases. These artifacts are preserved; a grader
mean of 1.0 over completed cases alone must not be misreported as full-suite success.
The original P2G prompt passed the isolated protected-deadline/missing-message probe. The Slack
appendix was then shortened and explicitly scoped to Slack so it cannot change other authority
mappings; both isolated cases passed. This is a bounded prompt repair, not proof of a provider-wide
latency root cause. No timeout/model/threshold was changed. The final full suites did not pass.
Agent 6's existing 25-second total budget cannot fit another complete 14-second provider attempt
after a deadline; the frozen code therefore safely returns an error. Agent 7's 30-second budget
can fit its existing second attempt, as the diagnostic demonstrated. Neither was altered.

The final CI failure happened after Agent 7 completed in 7,971 ms. The existing harness records
only a safe exception class, not the rejected result or exact service exception text. Its precise
cause is therefore not conclusively established; an unavailable-evidence check is one possible
rejection point. A bounded diagnostic instrumented reference validation without changing product
source and passed with zero unknown references after the existing retry. This intermittent result
does not erase the full-run failure and is not evidence that the Slack adapter caused it.

The unchanged eight-case recovery/simulation suite passed 8/8 before that final prompt refinement;
Agent 7 CI/deadline responses were 6,555 / 10,358 ms, one attempt each. The final deadline case
passed in 8,055 ms, one attempt; final CI did not pass service validation. No model evaluation used
a Slack executor or performed an external mutation.

## 11. Canonical regression

Read directly from live Firestore with the original compact sorted JSON/default-str fingerprint:

| Invariant | Observed |
|---|---|
| Incident | `incident-0fc3af5b0bd1ad847aea` |
| Revision / durable workflow events | `16` / `28` |
| Status / stage | `objective_restored` / `RESOLVED` |
| Active plan revision | `2` |
| Document SHA-256 | `4a1c93385b5b24060c31e995c521455622f1582967c615a2a7a7021e7f13fa8c` |

Slack actions use their separate existing Operator collection. No recovery document was written.
`scripts/audit_p2h_readonly.py` reproduces the audit without accessing secret payloads.

## 12. Deployment and truthful provenance

No P2H Cloud Build/deployment or traffic mutation occurred. Only the reviewed Terraform plan with
2 additions / 0 changes / 0 destroys (secret and its accessor) was applied. The rest of the
Terraform configuration was deliberately not applied because it contains historical runtime
defaults. This targeted bootstrap does not assert that the entire pre-existing state is drift-free.

Live backend remains `objective-recovery-00026-n6c`, ready, 100% traffic,
`sha256:d99fbd9307d80d99a9a0a9e2387950e8cfc1010e694d10bb87a3b65338ddd14d`.
Its configured COMMIT_SHA is `7d6721ceae80eed9c38d615309c826266e23cedf`, verified to exist in Git;
it is not a P2H source claim. Health was HTTP 200/ready.
BFF remains `reflow-web-bff-00006-xpk`, ready, 100% traffic,
`sha256:d33458691d0b0c9f20fb0b652d2f23d0eff6566399b10b8e8e47fd98cc104f1d`.
There is no explicit COMMIT_SHA override in its service metadata; the baked image value was not
inspected. Its five configured environment names contain no Slack value and it has no secret refs.

Only after model qualification is green and setup is complete: build reviewed source with
`deployment/p2h/cloudbuild.yaml`, using the exact existing
source commit (`git rev-parse <source-commit>` and `git cat-file -e <sha>^{commit}`), never a hand-typed
unverified SHA. Record Cloud Build ID and digests. Deploy immutable backend and BFF images while
preserving existing env/IAM/traffic settings; inject Slack secret only on backend, pinned to the
human-created numeric version. Set COMMIT_SHA truthfully. BFF rebuild is needed for the expanded
response enums. The browser's isolated generated Operator validator also needs the normal app
asset publication before real end-to-end use; marketing/story source does not change. Do not
claim new Slack responses work through an old deployed validator.

## 13. HUMAN SLACK SETUP REQUIRED

1. Open [Slack apps](https://api.slack.com/apps), choose Create New App → From a manifest, and select
   the intended demo workspace. Use `deployment/slack-app-manifest.yaml`.
2. Review OAuth & Permissions → Bot Token Scopes: only `chat:write`, `channels:read`,
   `channels:history`. Install to the workspace and approve these permissions. Do not add user,
   admin, public-posting, customization, DM, private-history, events or Socket Mode permissions.
3. Create/select one non-shared public demo/release channel and invite `@Reflow Operator` using
   Slack's channel integration UI or `/invite @Reflow Operator`.
4. Copy the channel ID from channel details and the workspace/team ID from its Slack client URL.
   These IDs are safe configuration values, not credentials.
5. In the app's OAuth & Permissions page obtain the Bot User OAuth Token. Do not paste it into
   ChatGPT/Claude/Codex, a shell command, repository, screenshot or a proof file.
6. Open the existing [Secret Manager secret](https://console.cloud.google.com/security/secret-manager/secret/objective-recovery-slack-bot-token/versions?project=project-f334c42b-7a03-4194-932)
   and add a new version directly in Google Cloud Console. Paste the token only there. The secret
   and least-privilege backend access already exist.
7. Return only the secret name, numeric version, channel ID, team ID, and explicit authorization
   for the exact live qualification message. Suggested text (not yet authorized or sent):
   `Backend engineer unavailable. SCRUM-6 is blocked.`

After that boundary, deploy and verify auth/scopes/member/channel, approved product identity,
Viewer/Guest/forged-role denial, unchanged canonical state, and healthy truthful revisions before
posting. Execute one authorized request; replay that exact request/key once; audit its exact
timestamp/text and bounded matching count read-only. Never generate a fresh key to test replay.

## 14. Live/replay proof and safe claim

Live Slack action ID, ACK, independent live message read-back, replay/dedup count: NOT PERFORMED.
They require setup and explicit live-write authorization. There is no P2H GO claim.

Safe claim now:
"Reflow has a bounded Slack adapter implemented behind its existing Operator control plane.
Deterministic tests pass; model qualification and authorized live Slack proof remain incomplete."

The requested cross-system and Slack-specific live product claims remain withheld until actual
live GO. Code/test evidence supports the architecture statement: Slack uses the same typed intent,
deterministic policy, durable receipt, idempotency, and independent verification control plane.

## 15. Remaining debt and local commits

Required: resolve the failing model gate without weakening thresholds or silently unfreezing Agent 7;
human Slack installation/secret version/channel/team; explicit exact-message permission;
backend/BFF/app-contract publication with provenance; real INSPECT/ACT/read-back/replay and final
canonical/security audit. No arbitrary Slack capability is implied.

Deliberate limits: exact-text provider transformations may fail verification; latest-message
inspection is a fixed window; lost ACK cannot be safely attributed by text alone and remains
uncertain; token rotation is manual via Secret Manager (no token-management feature is built).

Source commit: `ac57ab3d3614f6baadeb65e70a49465b86c86277`. This is an implementation commit,
**not a qualified-for-deployment commit**. Proof/docs are in the immediately following local commit
(its hash is reported in the handoff; a commit cannot contain its own final hash). No push is authorized.

## 16. Final A–AM report index

| Requested item | Result |
|---|---|
| A — Starting HEAD | `5b9a766961b9377f45c0b1cae873b23fe39f8cc9` |
| B — Official contracts | Verified auth, scopes, info, post, history, timestamps, rate limits, error contract; links in §4 |
| C — App/auth | Internal workspace-installed granular bot; OAuth v2, `xoxb` token; no user impersonation |
| D — Scopes | `chat:write`, `channels:read`, `channels:history` only |
| E — Secret | Existing empty `objective-recovery-slack-bot-token`; pinned runtime version; backend SA secret-level accessor |
| F — Target | Server-owned channel/team IDs; model selects only `configured-release-channel` |
| G — Vocabulary | `SLACK` / `CHANNEL`; `SLACK_INSPECT_CHANNEL`, `SLACK_POST_MESSAGE` |
| H — Agent 6 | Slack-only typed-intent appendix; no tools, token, model or reliability changes |
| I — Policy | Operator-only ACT, single configured channel/post, 500-code-point plain text; unsafe mentions/targets/text denied |
| J — Adapter | Existing registry and coordinator protocol; no parallel engine |
| K — Inspect | Auth/team/scopes/public membership checks; safe latest own-bot message within 15-message window |
| L — Post | Exactly one fixed-origin plain-text `chat.postMessage` request |
| M — Read-back | Separate exact-timestamp channel history lookup, limit 1 |
| N — Verify | Exact semantic text, channel-scoped timestamp, bot user and bot ID; ACK alone never verifies |
| O — Replay | Existing durable action/subject/key fingerprint; same-key service replay bypasses Agent 6 and Slack |
| P — Uncertain write | One bounded reconciliation; no attribution from text alone, fabricated ACK, automatic repost or VERIFIED |
| Q — Diagnostics | Allowlisted categories/HTTP/ok/safe correlation; credentials and arbitrary bodies excluded |
| R — Focused tests | Slack 77; combined Operator subset 183, all passed |
| S — Backend | 391 passed / 1 existing cloud skip |
| T — Coverage | Configured 96.01%; Slack modules 100%; thresholds unchanged |
| U — Model/eval | **Final expanded 23/24; final recovery 7/8 — NOT GREEN**; all runs preserved, §10 |
| V — Agent count | Exactly 7; AST freeze comparison and tests pass |
| W — Authorization/security | Viewer ACT denied, Guest stopped, forged role cannot elevate; mocks/BFF integration pass; no live Slack proof |
| X — Canonical | Revision 16 / 28 events / `objective_restored` / plan 2 / `RESOLVED` |
| Y — Fingerprint | `4a1c93385b5b24060c31e995c521455622f1582967c615a2a7a7021e7f13fa8c`, unchanged |
| Z — Changed source files | Exact 22-file inventory below |
| AA — Source commit | `ac57ab3d3614f6baadeb65e70a49465b86c86277` |
| AB — Deployment | No P2H build ID/revision/digest. Existing healthy backend/BFF provenance in §12 |
| AC — Human setup | App install/channel/team/token version unavailable; secret currently has zero versions; §13 |
| AD — Live action ID | Not performed / none |
| AE — Live ACK | Not performed / none |
| AF — Independent live read-back | Not performed / none |
| AG — Live replay/dedup | Not performed; deterministic adapter/service/restart tests only |
| AH — Secret scan | Zero findings; no historical Slack signature candidate; exact scan artifact committed |
| AI — Documentation | This document plus preserved generated evaluation/audit artifacts |
| AJ — Proof/docs commit | Immediately follows source commit; hash in final handoff |
| AK — Push | **NOT PUSHED / NOT ATTEMPTED** |
| AL — Safe claim | Exact implementation-only statement in §14; no live product claim |
| AM — Debt | Model qualification; permission to investigate/repair frozen reasoning if needed; Slack setup, explicit message authorization, deployment, live/replay proof |

Source/config/test inventory (`git show --name-only ac57ab3`):

```text
.env.example
deployment/p2h/cloudbuild.yaml
deployment/slack-app-manifest.yaml
deployment/terraform/single-project/main.tf
deployment/terraform/single-project/variables.tf
docs/operator-openapi.json
frontend/src/app/operator/OperatorConversation.test.tsx
frontend/src/app/operator/operatorContract.ts
frontend/src/app/operator/operatorValidator.ts
objective_recovery_agent/operator_actions.py
objective_recovery_agent/operator_agents.py
objective_recovery_agent/operator_api.py
objective_recovery_agent/operator_context.py
objective_recovery_agent/operator_schemas.py
objective_recovery_agent/operator_service.py
objective_recovery_agent/slack_operator_adapter.py
objective_recovery_agent/slack_operator_policy.py
scripts/audit_p2h_readonly.py
scripts/evaluate_operator_act.py
scripts/scan_p2h_secrets.py
tests/eval/slack-cases.json
tests/test_slack_operator.py
```

Representative reproducible commands (no Slack credentials or writes):

```text
uv run pytest -q
uv run pytest tests/test_slack_operator.py -o addopts="--strict-config --strict-markers" --cov=objective_recovery_agent.slack_operator_adapter --cov=objective_recovery_agent.slack_operator_policy --cov-report=term-missing --cov-fail-under=95 -q
uv run mypy
uv run python -m scripts.evaluate_operator_act --slack --case-delay 2 --output-prefix p2h-act-final
uv run python -m scripts.evaluate_operator --context-url https://objective-recovery-2gbnbjfvkq-uc.a.run.app --output artifacts/p2h-operator-final-evaluation.json --traces-output artifacts/p2h-operator-final-traces.json
uv run agents-cli eval grade --traces artifacts/p2h-act-final-traces.json --config tests/eval/operator_act_eval_config.yaml --output artifacts/p2h-act-final-grades
uv run agents-cli eval grade --traces artifacts/p2h-operator-final-traces.json --config tests/eval/operator_eval_config.yaml --output artifacts/p2h-operator-final-grades
uv run python scripts/audit_p2h_readonly.py --project project-f334c42b-7a03-4194-932
uv run python scripts/scan_p2h_secrets.py
```

For a future run, choose new evaluation output names; do not overwrite these preserved failures.

## 17. Authorized model qualification repair — 29 August 2026

### 17.1 Scope, history and freeze

Started at `b2ee95f4e7c87bdb6fb0b086bed49824617336af`, following source
`ac57ab3d3614f6baadeb65e70a49465b86c86277`. Repository status/history/diff were inspected first.
The pre-existing untracked `frontend/op-input.mjs` is untouched and excluded from both commits.
No push occurred. The user explicitly authorized small semantics-preserving model/eval repairs,
not new capabilities, weaker criteria, more time or retries, or external writes.

Only two runtime instruction strings changed: Agent 6's Slack appendix and Agent 7's existing
evidence-citation invariant. An AST comparison against `b2ee95f` is identical after excluding
those two assignments. No runtime schema, validator, model, tool, agent factory, retry policy,
authorization, ACT lifecycle, adapter, Jira/Calendar behavior or canonical transition changed.
Agent 7 remains hypothetical-only, no tools/persistence, `external_effects_executed=false`,
`gemini-3.7-flash`, ADK 2.7.1. Bounds remain 14 seconds per attempt, Agent 6 25-second node / 27-second
outer allowance, Agent 7 30-second node / 32-second outer allowance, existing retry ceiling and
70-second service bound. The five recovery agents are unchanged; the total remains exactly seven.

The ADK workflow/code/eval skills guided minimal changes, explicit reference-validation tests,
preservation of every diagnostic, unchanged formal grading and baseline/candidate comparison.

### 17.2 DM timeout: observed layer versus unknown underlying cause

Preserved failure: `artifacts/p2h-act-final-evaluation.json`, request
`4dcd1d23-f8e5-4f92-afb6-f350cc1e51e1`, `slack_dm`, **14,008 ms**, timeout, no completed response.
The elapsed time and frozen code identify the **application's 14-second `asyncio.wait_for`
around `run_workflow`**, not the 25-second node, 27-second outer allowance, service deadline or
grader. The final `_invoke` schema validation following that await was not reached.

The original artifact does not retain absolute start/end timestamps, SDK request/response
events, attempts or token usage for this failure. Targeted inspection of the retained operational
tool output found no additional DM-stage evidence. Thus whether the SDK returned anything or
internal ADK validation began before cancellation is **unknown**. It cannot be established
whether the underlying delay was provider/network, ADK processing, or another stage inside that
await. No incorrect DM classification was captured. A provider stall, instruction-complexity
root cause, schema stall, prompt ambiguity, harness defect or deterministic post-processing
defect is **not proven**. The wrapper timeout is concrete; its deeper cause is unresolved.

Successful comparisons from the same preserved 23/24 run (all one attempt, typed validation passed):

| Case | Agent 6 ms | Input / output tokens |
|---|---:|---:|
| Configured channel inspect | 4,811 | 8,062 / 161 |
| Configured channel post | 6,556 | 8,067 / 533 |
| Missing-message clarification | 4,444 | 8,063 / 141 |
| Other-channel refusal | 5,022 | 8,071 / 167 |
| Mass mention typed ACT → deterministic denial | 4,840 | 8,070 / 210 |
| Unsupported admin | 8,494 | 8,066 / 435 |
| Unsupported history edit | 4,216 | 8,068 / 141 |
| Exact qualification text | 12,118 | 8,073 / 430 |

The DM also passed in prior initial/confirmation runs (5,675 / 5,753 ms). Those successes do not
erase the timeout or prove a causal latency repair. With 25 seconds total, a timed-out 14-second
attempt cannot fit another full 14-second attempt plus the existing margin; this policy is unchanged.

### 17.3 Prompt comparison and narrow repair

| Agent 6 instruction | Characters | Whitespace words | Provider input-token impact |
|---|---:|---:|---|
| Pre-P2H | 4,526 | 576 | Baseline |
| Committed P2H at repair start | 5,677 | 734 | +269 tokens in preserved same-case prompt probes |
| Repaired | 5,327 | 679 | −91 tokens versus committed P2H on the same DM input: 8,068 → 7,977 |

Thus the repair removes 350 characters / 55 words; +178 tokens versus pre-P2H is a derived
difference, not an independent new inference run. Counts above concern instructions or total
provider input as labeled, not interchangeable tokenization estimates.

The original appendix repeated its Slack-only scope, included adapter read-window behavior
irrelevant to classification, and used case-specific examples. No contradictory instruction was
demonstrated. It was shortened into general mappings: explicit DM/member or other channel is
UNSUPPORTED before considering missing parameters; ambiguous recipient or missing message
clarifies; configured inspect/post remains supported; quoted mass mentions remain in typed ACT
for deterministic policy to deny. The general supplied-message-clause rule replaces an exact
evaluation-message example. No keyword classifier, hardcoded result, permission judgment, new
authority or broader Slack action was added. This is the user-authorized precision/redundancy
cleanup, **not a claimed proven cure for provider stalls**.

### 17.4 Every targeted diagnostic

Exactly **three** DM diagnostics were used. No fourth DM diagnostic or additional full-suite
attempt was made. Three separate non-mutating CI diagnostics investigated the service rejection;
CI-3 reproduced it before the instruction repair. Every request, including the failure, is retained.
Tokens below are existing agent-trace input/output counts; trace output includes thinking-token
counts when provided, but **no thought content is persisted** by the observer.

| Artifact prefix (`artifacts/`) | Prompt | Request ID | Result | Relevant agent ms / attempts | Input / output |
|---|---|---|---|---|---|
| `p2h-repair-dm-1` | Original | `b1f3fa08-e664-474c-8f0b-567bc33e2135` | PASS | A6 6,235 / 1 | 8,068 / 380 |
| `p2h-repair-dm-2` | Original | `962e9913-50a8-4fd2-8c9a-b06b896ba0f0` | PASS | A6 5,856 / 1 | 8,068 / 419 |
| `p2h-repair-dm-3` | Repaired | `f9621966-e69d-4fbc-9d6a-f5b1064a89bc` | PASS | A6 6,038 / 1 | 7,977 / 412 |
| `p2h-repair-ci-1` | Original | `71447f67-4bd2-4455-bd36-01387cc227dd` | PASS | A7 9,686 / 1 | 6,828 / 784 |
| `p2h-repair-ci-2` | Original | `93a34a29-7c9e-4e8f-a3fe-91a707050630` | PASS | A7 5,951 / 1 | 6,841 / 384 |
| `p2h-repair-ci-3` | Original | `99941892-dbcc-4ccf-8582-624e5a4d2db5` | FAIL | A7 13,405 / 1 | 6,855 / 706 |

Each prefix has `-evaluation.json`, `-traces.json`, `-forensics.json` and a formal grade JSON in
its `-grades` directory. Each passing diagnostic grades 1/1 valid, mean 1.0. CI-3 grades no
completed response: the authoritative raw result remains **0/1**, not a successful empty grade.

SDK/validation timestamps from the corrected observer, all **UTC on 2026-08-28**:

| Probe | SDK start | SDK response | Typed validation |
|---|---|---|---|
| DM-2 | 22:18:45.115038 | 22:18:50.846597 | 22:18:50.848598 |
| DM-3 | 22:21:41.623804 | 22:21:47.542394 | 22:21:47.544400 |
| CI-3 Agent 7 | 22:19:43.810119 | 22:19:57.139812 | 22:19:57.141811 |

The first observer used ADK node callbacks that were not invoked through the compiled workflow.
DM-1/CI-1 retain agent metadata/reference checks but **lack SDK-stage capture**; this is not zero
provider calls. It was corrected to observe `AsyncModels.generate_content` directly before DM-2/
CI-2 and both final suites. The local-only wrapper delegates the original evaluators and SDK,
never replaces responses, and adds no retries, timeouts, schema/metric changes or agent tools.
It records only allowlisted bounded/redacted non-thought JSON, usage, safe exception categories
and exact reference comparisons. Tests confirm cancellation and validation errors propagate and
patches are restored. Historical missing output cannot be reconstructed by this later observer.

### 17.5 CI service-validation cause and exact reproduced references

Original failed full-regression request: `c3f88453-4692-46a4-9b5e-39ddee4248a8`, total **15,060 ms**.
Retained operational output gives Agent 6 start `2026-08-28T22:03:00.467995+00:00`, completion
`22:03:07.556356+00:00` (7,089 ms, one attempt, 7,883/208 input/output); Agent 7 started at that
completion and finished `22:03:15.527676+00:00` (7,971 ms, one attempt, 6,812/612), typed validation
**PASSED**. The safe harness error is `OperatorReasoningError`.

In the unchanged service, after schema-valid Agent 7 completion, the explicit reasoning rejection
checks `SimulationResult.evidence_ids` is a subset of `snapshot.evidence[].evidence_id`. It raises
`Simulation cited unavailable evidence`. Wrong provenance/effect flags or malformed structured
output would fail typed validation earlier. This narrows the original rejection to reference
validation, **not a model timeout or malformed hypothetical schema**. The original raw result and
exact rejected IDs were not retained; their values must not be retroactively invented.

CI-3 then reproduced that precise service category and captured the wrong field and values:

```text
SimulationResult.evidence_ids:
  action:calendar-9899dba7a849a328a49d
  action:validate-release-v2
```

Both are **context fact IDs**, not evidence IDs. The same returned array also contained valid
`github-run:33106938744`, `gmail-message:1a0449e8567caa43` and `objective-verification:1`.
The snapshot's allowed evidence IDs were:

```text
calendar:receipt-9899dba7a849a328a49dbd134ac2b35d440284b687f39ca2a349599ad675604c
github-promotion:378060699
github-run:33106938744
github-run:33106995963
gmail-message:1a0449e8567caa43
objective-verification:1
objective-verification:2
```

The model selected the wrong identifier namespace; the validator was correct and remains strict.
Nothing was silently dropped, mapped, accepted, or overwritten. The IDs above belong to the
**reproduction**, not an asserted reconstruction of the original failed output.

Compared with the qualified `artifacts/p2g-closure-operator-evaluation.json` (8/8), the read-only
context URL is still `https://objective-recovery-2gbnbjfvkq-uc.a.run.app`, snapshot fingerprint
`912ae928d64e99212cb03f10e4be21db1e08a73fde442fc3bb2d9aa257937402`, 61 facts / 7 evidence items,
no dangling fact-to-evidence references. The eight-case evaluator, fixtures, expectations and
grading function are unchanged. P2H added Slack vocabulary to the shared intent schema but did
not alter simulation invariants/validators. Agent 7's instruction was unchanged until this repair.
The first meaningful behavioral difference is the generated reference selection, not context drift,
missing expected evidence, stale deployment, wrong endpoint or looser grading. P2H's Agent 6
input grew (same explain case 7,585 → 7,882 tokens); this is observed size growth, not proof that
Slack caused the stochastic Agent 7 error.

Repair: clarify the existing instruction to cite **only exact `snapshot.evidence[].evidence_id`
values**, also linked through `facts[].evidence_ids`; `facts[].fact_id` is a row identifier, never
a citation. This restores the already-enforced invariant without changing simulation semantics.
Agent 7 instruction changed from 1,219 to 1,342 characters. No hypothetical conclusion, evidence
requirement, provenance or effect flag changed. Tests reproduce both exact invalid fact IDs and
an invented ID, assert rejection, and verify valid references retain hypothetical/no-effect output.

### 17.6 Single final model gates and formal comparisons

After focused deterministic checks, **one full expanded run**, then its formal grade, then
**one full frozen recovery run**, then its formal grade. No full run was repeated on this repair.

| Gate | Raw | Formal metric | Valid / total / errors | Mean / stdev |
|---|---|---|---|---|
| Expanded P2H | **24/24** | `p2g_act_behavior` | **24 / 24 / 0** | **1.0 / 0.0** |
| Frozen recovery | **8/8** | `p2f_operator_behavior` | **8 / 8 / 0** | **1.0 / 0.0** |

Authoritative evidence:

- `artifacts/p2h-repair-final-intent-evaluation.json`, `-traces.json`, `-forensics.json`;
  formal `artifacts/p2h-repair-final-intent-grades/results_20260829_035516.json`.
- `artifacts/p2h-repair-final-recovery-evaluation.json`, `-traces.json`, `-forensics.json`;
  formal `artifacts/p2h-repair-final-recovery-grades/results_20260829_040002.json`.

Expanded: 24 observed SDK calls, one attempt each, no provider failure. Final DM request
`02d74eeb-c1fe-46e9-a6ea-82d9d5b7f557`, **4,418 ms**, 7,977 input / 149 trace-output tokens,
UNSUPPORTED. Recovery: eight Agent 6 calls plus two Agent 7 calls, all one attempt, zero unknown
simulation references. Final CI request `be3c7617-9749-4732-9149-652fea7d0a54`: Agent 6 4,294 ms;
Agent 7 **8,417 ms**, 6,843 input / 391 output, service accepted. Deadline simulation Agent 7
8,224 ms. No external effects or executor calls occurred.

`agents-cli eval compare` was run against the preserved failed final grades. Completed valid cases
increased **23 → 24** and **7 → 8**, with unchanged mean 1.0. Earlier means omit no-response
failures; only the new full raw denominators establish the restored gates. No cases, expected
results, pass thresholds, fixture references or custom graders were edited.

### 17.7 Deterministic, canonical and security gates

| Gate | Repair result |
|---|---|
| Slack | **77 passed**, adapter/policy coverage **100%**, 187 statements |
| Combined Slack + Operator actions/runtime/API + new forensic tests | **190 passed** |
| New forensic tests | **7 passed**, including exact invalid references and cancellation |
| Full backend, exact final source | **398 passed, 1 existing cloud test skipped** |
| Configured core coverage | **96.01%**, unchanged 95% threshold |
| Strict mypy | **47 configured files** + explicit forensic script passed |
| Ruff / format | `src tests scripts/operator_eval_forensics.py` passed; **49 formatted files** |
| Frozen agent lint debt | Existing RUF001 / line-wrap debt retained as documented in §10; no new finding |
| Generated Operator contract consistency | Passed; no shared contract change in this repair |
| Terraform fmt / validate | Passed; no Terraform change or apply |
| Frontend | Not rerun: no shared contract/frontend changes; prior 87 tests/typecheck/build remain historical evidence |
| Git whitespace / secret scan | Passed; scan evidence `artifacts/p2h-repair-secret-scan.json` |

`artifacts/p2h-repair-readonly-audit.json` and the post-qualification
`artifacts/p2h-repair-final-readonly-audit.json` preserve read-only observations. Canonical incident
`incident-0fc3af5b0bd1ad847aea` remains revision **16**, **28** durable events,
**objective_restored / RESOLVED**, active plan **2**, document fingerprint
**`4a1c93385b5b24060c31e995c521455622f1582967c615a2a7a7021e7f13fa8c`**. Exactly **7** agents.
Backend/BFF revisions, traffic, IAM and environment are unchanged. The first audit saw **zero
Slack secret versions**; the final audit observed **one version**. This is an external-state change
outside this repair: no version was created or accessed by this workflow, and the actor/content
was not investigated. The version is left untouched. The same backend-only secret accessor and
no BFF Slack secret reference remain. No secret payload access, token-version creation, Slack
request, external write, build, deployment or push was performed by this repair. Qualification
did not consume or require a Slack token.

### 17.8 Final A–Z repair report and commits

| Item | Result |
|---|---|
| A — DM root cause | 14-second workflow-attempt timeout established; underlying provider/ADK cause not recoverable from original telemetry, §17.2 |
| B — DM stage/latency | Original 14,008 ms; original absolute timestamps/SDK response/attempts/tokens unavailable; corrected probes give exact SDK/typed stages, §17.4 |
| C — Prompt impact | Original P2H +269 measured input tokens; repair −91, 8,068 → 7,977 on DM; −350 characters / 55 words |
| D — Diagnostics | Exactly 3 DM, 3 CI; every artifact retained, including CI-3 failure |
| E — Slack repair | Shorter Slack-only mappings; explicit unsupported target precedence; authorization remains deterministic |
| F — CI cause | Schema-valid output rejected by strict service evidence-subset validation |
| G — Invalid references | Reproduction used `action:calendar-9899dba7a849a328a49d` and `action:validate-release-v2` in `SimulationResult.evidence_ids`; original exact IDs unavailable |
| H — P2G/P2H difference | Same snapshot/URL/evaluator/criteria; observed wrong generated identifier namespace, not proven Agent 7 code regression |
| I — Recovery repair | Clarify evidence IDs versus fact IDs; no simulation semantics/validator/reliability change |
| J — Focused tests | 77 Slack; 190 combined; 7 new forensic tests |
| K — Expanded raw | **24/24**, one full run |
| L — Expanded formal | **24 valid, 0 errors, mean 1.0** |
| M — Frozen raw | **8/8**, one full run |
| N — Frozen formal | **8 valid, 0 errors, mean 1.0** |
| O — Agents | Exactly **7** |
| P — Backend | **398 passed, 1 skipped** |
| Q — Coverage | **96.01% core; 100% Slack** |
| R — Frontend | No contract/frontend changes; not rerun; contract consistency passed |
| S — Canonical | Revision **16**, **28** events, **objective_restored**, plan **2** |
| T — Fingerprint | `4a1c93385b5b24060c31e995c521455622f1582967c615a2a7a7021e7f13fa8c` |
| U — Security | Zero scan findings; no external writes, Slack calls or secret-version creation/access by this repair; audit observed an external version-count change 0 → 1, left untouched; backend-only accessor unchanged |
| V — Files | Three repair source/test files below; this document and new `p2h-repair-*` proof JSON; original failure artifacts unchanged |
| W — Repair commit | `113a307a7867e29751137b1fef0b61be50c4a562` |
| X — Proof/docs commit | Immediately following local commit; exact hash in handoff (cannot self-embed final hash) |
| Y — Push | **NOT PUSHED** |
| Z — Debt | Historical DM deep cause unresolved; no guarantee of future zero timeouts; separate human Slack setup, authorized deployment/live/read-back/replay proof; prior lint/bundle debt |

Repair source/test inventory:

```text
objective_recovery_agent/operator_agents.py
scripts/operator_eval_forensics.py
tests/test_operator_eval_forensics.py
```

Qualification commands already executed (record only, not an instruction to rerun):

```text
uv run python -m scripts.operator_eval_forensics --suite intent --prefix p2h-repair-final-intent
uv run agents-cli eval grade --traces artifacts/p2h-repair-final-intent-traces.json --config tests/eval/operator_act_eval_config.yaml --output artifacts/p2h-repair-final-intent-grades
uv run python -m scripts.operator_eval_forensics --suite recovery --prefix p2h-repair-final-recovery
uv run agents-cli eval grade --traces artifacts/p2h-repair-final-recovery-traces.json --config tests/eval/operator_eval_config.yaml --output artifacts/p2h-repair-final-recovery-grades
```

Safe current claim: “The bounded Slack Operator implementation is model-qualified locally with
24/24 expanded and 8/8 frozen regression cases under unchanged criteria. Authorized live Slack
proof and deployment have not occurred.” Human Slack setup was **not** required for this model
qualification. **FINAL VERDICT: P2H MODEL QUALIFICATION READY. STOP.**

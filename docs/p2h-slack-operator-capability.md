# P2H — bounded Slack Operator capability

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

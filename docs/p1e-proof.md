# P1E Gmail Ingestion Live Proof Record

Status: **P1E GO**. A real Gmail event traversed the private production path and drove the
existing P1A-P1D recovery chain to `RESOLVED / objective_restored` before the protected deadline.

All timestamps below are UTC unless an offset is shown. Identifiers and hashes are retained for
correlation; OAuth material, raw message bodies, prompts, and hidden model reasoning are excluded.

## Setup / operator actions

These actions occurred before the canonical disruption email and were connector activation, not
recovery assistance:

1. The product owner designated `aamaank2405@gmail.com` as the dedicated watched mailbox.
2. A Desktop OAuth client named `Reflow Gmail P1E Desktop` was created in
   `project-f334c42b-7a03-4194-932`. Its client ID is
   `680305457743-tab718cuh9tktl4k8cl0dglc7cansnmn.apps.googleusercontent.com`.
3. The owner completed browser consent for only
   `https://www.googleapis.com/auth/gmail.readonly`; the bootstrap verified the profile identity
   and wrote the authorized-user credential directly to Secret Manager. The downloaded client
   file used for bootstrap was deleted afterward.
4. Terraform enabled the existing mailbox-conditioned Cloud Run configuration, daily watch
   renewal, and 15-minute reconciliation jobs. The activation apply was two additions, one
   in-place change, and zero destroys.
5. The authenticated watch-initialization path was invoked. Two genuine Gmail API compatibility
   defects exposed by activation were fixed, regression-tested, rebuilt, and redeployed:
   `users.getProfile`'s standard `threadsTotal` field is now accepted, and numeric JSON
   `historyId` values in real push data are normalized to the contract's canonical decimal string.
6. A harmless irrelevant email was sent before the canonical event to prove the negative path.
7. The separate sender `amaank220504@gmail.com` then sent the controlled canonical disruption
   email. From its delivery onward, no human invoked a notification, recovery endpoint, planner,
   action, continuation, state mutation, candidate selection, SHA injection, or resolution.

After successful resolution, the authenticated renewal and reconciliation maintenance endpoints
were each invoked once. The task explicitly allows these connector-maintenance checks; neither
can initiate or assist recovery for the already-terminal incident.

## OAuth, private deployment, and watch activation

- OAuth publishing state: External / Testing; `aamaank2405@gmail.com` is the sole test user.
  Branding remains incomplete. Testing-mode refresh tokens for this restricted scope have a
  seven-day lifetime, so this proof deployment requires reauthorization or a suitable production
  publishing configuration for longer unattended operation.
- Secret: `objective-recovery-gmail-oauth-user`, exactly one enabled version. Its payload was never
  printed, stored in Terraform, placed in an environment file, or committed.
- Cloud Run is private: anonymous root returned HTTP 403 and an authenticated root request returned
  HTTP 200. Invoker IAM contains service-account principals only.
- Active revision: `objective-recovery-00018-v5t`, 100% traffic.
- Immutable image digest:
  `sha256:5c972a51d1b1fa08f0c58abc684f3b58090cc4209a8537fa9422085827b95cb8`.
- Maintenance jobs are enabled:
  - `objective-recovery-gmail-watch-renewal`: `0 4 * * *` UTC, authenticated POST to
    `/internal/gmail/watch/renew`.
  - `objective-recovery-gmail-reconciliation`: `*/15 * * * *` UTC, authenticated POST to
    `/internal/gmail/reconcile`.
- Initial `users.watch` succeeded for the exact mailbox with history floor `28238` and expiration
  `1788461112678`. Durable mailbox state was created as `ACTIVE` with both initial floor and
  committed cursor persisted.
- The real immediate Gmail notification was Pub/Sub message `21584082976409976`, mailbox
  `aamaank2405@gmail.com`, notified history `28238`, received
  `2026-08-27T18:53:45.536140Z`. Synchronization committed through `28262` with zero historical
  Gmail claims; incident/event counts remained 8/8. The notification was therefore treated as a
  high-watermark hint, not evidence that a Gmail message existed.

## Real external evidence

### Irrelevant-email negative path

- Sender: `amaan khan <amaank220504@gmail.com>`; watched mailbox:
  `aamaank2405@gmail.com`; subject: `Lunch confirmation`.
- Gmail internal date: `2026-08-27T19:04:33Z`; message/thread ID:
  `1a0449c41d2e2810`; content SHA-256:
  `7193c09a3550da82ba95b045836f23ac10d9d7ece244d8c5af59bc1d15d2aafb`.
- Gmail push message `21585021837462470` notified history `28663`. History discovery committed
  through `28669` and found the exact message.
- Deterministic source claim:
  `b2fa1bb5e82e15e1c281c2b9540538595230d599249a2952b5c4f5d1d6bd200d`, one attempt, terminal
  state `NO_RELEVANT_OBJECTIVE_IMPACT`.
- Logs correlate notification at `19:04:48.142`, history synchronization at `19:04:48.677`, exact
  message read-back at `19:04:49.367`, interpretation at `19:04:52.067`, and cursor commit at
  `19:04:52.252`.
- Incident and downstream event counts remained 8/8. No recovery event, P1A plan, Calendar action,
  or GitHub action was created.

Two earlier self-sent harmless messages also ended in `NO_RELEVANT_OBJECTIVE_IMPACT`, but they are
not used as the required separate-sender proof.

### Canonical disruption and Gmail correlation

- Before delivery, Objective `release-v2` version 1 remained unchanged, protected, and due
  `2026-08-28T17:00:00Z` (`Etc/UTC`). Approximately 21.91 hours remained, so no replacement
  objective or deadline mutation was needed.
- Sender: `amaan khan <amaank220504@gmail.com>`; watched mailbox:
  `aamaank2405@gmail.com`; subject:
  `Operational disruption: backend lead unavailable for Release V2`.
- Gmail internal date: `2026-08-27T19:07:03Z`; exact message/thread ID:
  `1a0449e8567caa43`; bounded normalized content SHA-256:
  `4b8f4e932f682feb43171d14024bd88d61759b97a1d620340758d9c967065825`.
  The full message body is intentionally omitted.
- Gmail push message `21585407239686764` notified history `28734`; the exact
  `messagesAdded` entry was discovered from history and the durable cursor committed at `28734`.
- Deterministic Gmail claim:
  `afead0040fd186930e8929daa7d778fb73ce9712faba1b725e9b50fbf1e60076`.
  Exact `messages.get` completed at `2026-08-27T19:07:17.455998Z`; the claim reached
  `HANDOFF_PUBLISHED`.
- Canonical recovery event ID:
  `gmail:afead0040fd186930e8929daa7d778fb73ce9712faba1b725e9b50fbf1e60076` with evidence
  references to the exact Gmail message and content hash.
- Disruption Pub/Sub message: `21583191978566927`; publication was logged at
  `2026-08-27T19:07:21.686335Z`. The downstream event/incident counts automatically advanced
  from 8/8 to 9/9.

### P1A and P1B

- Frozen recovery ingestion completed the event claim and created incident
  `incident-0fc3af5b0bd1ad847aea`. P1A received the event at `19:07:25.744`, interpreted it at
  `19:07:25.934`, and mapped impact at `19:07:26.175` to `commit-release`,
  `milestone-backend`, `person-backend-lead`, `release-v2`, and `work-api-migration`.
- Planning run `104ab4a8-801c-4de5-8493-462e8f36118c` produced three policy-valid proposals.
  Critic-adjusted risks were deadline-first 80, risk-minimization-first 60, and
  resource-balance-first 55. Deterministic policy selected `plan-resource-balance-first`.
- Only the plan's authorized Calendar coordination action executed. Assignment text remained a
  proposal; no assignment adapter was claimed.
- Calendar action idempotency key
  `9899dba7a849a328a49dbd134ac2b35d440284b687f39ca2a349599ad675604c` produced verified receipt
  `receipt-9899dba7a849a328a49dbd134ac2b35d440284b687f39ca2a349599ad675604c` and event
  `p1b9899dba7a849a328a49dbd134ac2b35d440284b687f39ca2a349599ad675604c`. Write began at
  `19:07:44.825`, was
  acknowledged at `19:07:45.593`, and runtime read-back verified the receipt by `19:07:45.898`.
  A later fresh P1D Calendar read at `2026-08-28T00:38:54.31187+05:30` confirmed the expected
  event, `18:30`-`19:30 +05:30`, with no differences.

### Automatic P1B to P1C continuation

- Deterministic outbox/handoff:
  `149aa27ab4a3610383594042351038989365a399247be8c6f5b87ebd0a0532a2`, event
  `P1C_RECOVERY_CONTINUATION_NEEDED`, source revision 8, created `19:07:45.898924`, published
  `19:07:46.332575`, Pub/Sub message `21581835560357660`.
- P1C returned one transient HTTP 503 after partial progress at `19:07:50.007`; Pub/Sub retried the
  same durable handoff automatically and received HTTP 200 at `19:08:04.780`. Existing claims
  resumed without duplicate effects.

### P1C Candidate A and automatic P1D continuation

- Candidate A release ID `378059416`; tag
  `reflow-p1c-95c383af3ed956f2d851544c2457-5353cf7c664f`; SHA
  `5353cf7c664f384d6642b5348c7f190187b06b4c`.
- GitHub Actions run `33106938744`, attempt 1, run number 8, job `98639173560` failed at exact
  step `Validate release compatibility`. Receipt
  `github-95c383af3ed956f2d851544c245736a33979d528e74b2e267e2b31b28e1d9632` was verified, but
  external verification was false for invariant `release-validation-green`. Failure fingerprint:
  `946c736c190e9b5bf1c13245edef2b62795ff29f70013d79fa751d29cb3ac8f4`.
- Independent public GitHub read-back confirmed release/tag/SHA, non-draft prerelease state, run
  failure, and the exact failed step.
- Existing P1C→P1D outbox
  `799d3ad2567198e85e64947ca9f0ccf04aed4bb77d18f9608b85875d420754a0` carried
  `OBJECTIVE_RECOVERY_NEEDED` at source incident revision 10 / plan revision 2. It was created at
  `19:08:06.420090`, published at `19:08:06.733896` as Pub/Sub message
  `21586822110139471`, and consumed automatically at `19:08:10.700555`.
- P1D likewise returned one transient 503 after partial progress at `19:08:10.508`; automatic
  Pub/Sub retry returned 200 at `19:08:49.771` without duplicate actions.

### P1D Recovery #2 and final verification

- Recovery #2 reopened the incident at `19:08:10.869`; `REPLAN_STARTED` persisted at
  `19:08:11.324`. It branched from failed Recovery #1 because execution completed while
  `release-validation-green` remained false.
- Replanning fingerprint:
  `4db0b43b10886033ea6a3da6b921b45ec29fecda455d94e51d7bfb6dd6f2e4fb`; failed-effect
  fingerprint: `ab217ef748b10404828630a26f2633f9e51dc801451d3698ab12a64a064398b2`.
- Candidate B artifact `release-v2-candidate-b` used SHA
  `7b7881ed1785cc37e038c44193ff2373badf54e7`, whose parent is Candidate A. The persisted
  artifact described the bounded API fallback and retained the protected proof hashes.
- Replanning run `47a41e43-339e-450c-8f94-9001a743b735` produced the Candidate B
  `plan-risk-minimization-first` proposal. Policy `p1d-executable-v2` hard-rejected an exact repeat
  of Candidate A by failed-effect fingerprint and selected Candidate B. Only its authorized GitHub
  validation/promotion effects executed; assignment text remained proposal-only.
- Candidate B validation key:
  `56a4daae83fa8f95bafc916bb01760675ebd9e8c814a73fab9a0cb85d6bfb5ff`; release ID
  `378060699`; tag `reflow-p1d-56a4daae83fa8f95bafc916bb017-7b7881ed1785`; run
  `33106995963`, attempt 1, run number 9, job `98639374652`. Every workflow step, including
  `Validate release compatibility`, succeeded. Receipt
  `github-56a4daae83fa8f95bafc916bb01760675ebd9e8c814a73fab9a0cb85d6bfb5ff` verified.
- Full-release promotion key:
  `64f1b1432d79406060fe6483bf92f10525283b4c329231b54163c7d4c36422f0`; receipt
  `github-64f1b1432d79406060fe6483bf92f10525283b4c329231b54163c7d4c36422f0` verified.
  Independent GitHub read-back confirmed release `378060699` as
  the latest non-draft, non-prerelease release and the tag at Candidate B SHA.
- Final objective verification passed all six invariants:
  `active-release-candidate-revised`, `coordination-action-preserved`,
  `external-correlation-fresh`, `protected-release-deadline-satisfied`,
  `release-validation-green`, and `shipped-full-release`.
- The incident reached revision 16, stage `RESOLVED`, status `objective_restored`, active
  Candidate B SHA, at `2026-08-27T19:08:54.504926Z`. Canonical email internal date to resolution
  was about 111.5 seconds; push receipt to resolution was about 98.0 seconds.

## Gemini output

For the harmless email, Gemini returned `NO_RELEVANT_OBJECTIVE_IMPACT`, event type
`lunch_confirmation`, no candidate graph nodes, a bounded verbatim evidence excerpt, and no
unknowns.

For the canonical email, Gemini returned `REAL_DISRUPTION`, event type
`personnel_unavailability`, candidate nodes `person-backend-lead`, `work-api-migration`, and
`release-v2`, plus a grounded summary that the backend lead's unavailability blocked API Migration
and the staging/QA handoff. It identified the coverage assignee as unknown.

The P1A and P1D planner/critic records described above are also model proposals. They did not
authorize tools, mutate the graph, select themselves, or declare objective restoration.

## Deterministic authority

Code, not the model, validated mailbox identity, cursor ordering, durable source claims, exact
message identity, content hash, bounded evidence grounding, known graph-node IDs, blast radius,
canonical event identity, policy eligibility, failed-effect exclusion, action idempotency,
external receipts/read-backs, continuation identities, objective invariants, and terminal state.

The separation of authority is material: Gmail and GitHub/Calendar read-backs establish external
facts; Gemini proposes structured interpretations and plans; deterministic policy selects valid
effects; verified receipts and invariant evaluation permit state transitions.

## Replay, renewal, and reconciliation

- Natural Pub/Sub redelivery exercised both continuation paths after partial progress. The same
  handoff identities resumed and produced no duplicate release, workflow run, action, promotion,
  or terminal revision.
- Before maintenance: four Gmail claims; cursor/max notification `28734`; event/incident counts
  9/9; incident revision 16; 28 workflow events; four receipt IDs; two continuation outboxes in
  `PUBLISHED` and `CONSUMED` states.
- Authenticated renewal returned HTTP 200. It synchronized before the new watch, preserved cursor
  `28734`, received watch history `28734` and expiration `1788462765564`, advanced watch generation
  3 to 4, synchronized again, and remained `ACTIVE`.
- Authenticated reconciliation returned HTTP 200 at `2026-08-27T19:13:37.164066Z`, synchronized
  from and through `28734`, and persisted the reconciliation timestamp.
- After both maintenance calls, all counts, receipt identities, outbox identities, incident
  revision, and workflow-event count were unchanged. Public GitHub read-back still found exactly
  one Candidate A run (`33106938744`) and one Candidate B run (`33106995963`).

## Security and truth-boundary audit

- No access token, refresh token, OAuth client secret, Authorization header, raw credential JSON,
  full message body, private prompt, or chain-of-thought is included in this document or intended
  application logs.
- Operational rejection logging records only a bounded rejection category; it does not log the
  Pub/Sub envelope or decoded email payload.
- Gmail persistence is bounded to identities, timestamps, labels/snippet, content hash, evidence
  excerpt, typed interpretation, and processing state. Raw MIME and unlimited bodies are excluded.
- Terraform owns only the Secret Manager container/IAM and Cloud Run secret reference, not the
  authorized-user secret version or payload.
- The one downloaded correct Desktop OAuth client file was removed after bootstrap. An unrelated
  pre-existing Web client file from another project was not used or modified.
- The frozen P2A presentation API exposes no Gmail message content.

## Activation changes and evidence boundary

- Cloud Build `82feb62d-e034-41ad-98f7-019437e7fa86` produced the profile-compatibility build.
- Cloud Build `c4e88552-6a73-47db-b292-f9ba6bc58ff3` produced the final numeric-history envelope
  fix and immutable digest recorded above.
- The only implementation changes are the two compatibility fixes, safe metadata-only rejection
  categorization, and their deterministic regression coverage. No recovery, graph, planner, P2A,
  Operator, or frontend semantics changed.
- A supplemental local Calendar impersonation read was denied by
  `iam.serviceAccounts.getAccessToken`. IAM was not broadened. The persisted runtime read-back and
  later fresh P1D Calendar verification are the authoritative Calendar evidence.

## Known limitations

- The OAuth app remains in Testing with incomplete branding and the associated seven-day
  refresh-token limitation for this restricted scope.
- This is one explicitly designated mailbox, INBOX-only, text-content ingestion. Attachments,
  multiple mailboxes, and Gmail sending remain outside P1E.
- Deleted messages in a stale-history gap cannot be reconstructed. The connector records degraded
  truth (`PRE_BASELINE_IGNORED` / `GAP_UNCERTAIN`) instead of claiming completeness.
- The Calendar proof relies on the production runtime's authorized read-backs because local
  service-account impersonation was intentionally not granted.

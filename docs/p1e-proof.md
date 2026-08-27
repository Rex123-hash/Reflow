# P1E Gmail Ingestion Proof Record

Status: implementation verification in progress; no real Gmail proof has been claimed.

## Authority boundaries

### Real external facts

Only evidence obtained from Gmail delivery, a Gmail-originated Pub/Sub notification,
`users.history.list`, exact `users.messages.get`, Calendar read-back, and GitHub read-backs may be
described as external fact. Pub/Sub transport IDs are not Gmail message identities.

### Model output

Gemini performs one typed, tool-free classification/extraction over bounded normalized message
text. Its summary, candidate graph-node IDs, excerpts, and unknowns are proposals. Email content is
untrusted data and cannot invoke tools, select a plan, change policy, or declare resolution.

### Deterministic authority

Code validates mailbox identity, cursor ordering, source claims, known graph-node IDs, verbatim
evidence grounding, objective blast radius, canonical event identity, policy, action claims,
external receipt verification, state transitions, and continuation outboxes.

## Watch and OAuth boundary

- One explicitly designated normal Gmail/test mailbox.
- Scope: `https://www.googleapis.com/auth/gmail.readonly` only.
- One-time Desktop OAuth loopback authorization with offline access and profile identity check.
- Authorized-user material is written directly to Secret Manager secret
  `objective-recovery-gmail-oauth-user`.
- Terraform creates the secret container and IAM only; it never owns a secret version.
- INBOX-only watch on `objective-recovery-gmail`.
- Immediate watch notification is retained only as a high-watermark hint after the initial cursor
  baseline is durable.
- Daily renewal preserves the committed ingestion cursor; 15-minute reconciliation uses the same
  history algorithm as push handling.

## Cursor and claim semantics

The committed history cursor means all history through that ID has been durably discovered as
Gmail source claims. Claims are keyed by SHA-256 of normalized mailbox identity plus exact Gmail
message ID. Claims are written before cursor advancement, and message processing retries
independently after the cursor commits.

A `history.list` 404 marks the connector `RECOVERY_REQUIRED`; a capped INBOX listing and exact
message read-backs classify messages older than the persisted first-watch timestamp as
`PRE_BASELINE_IGNORED` and all other unprovable interval messages as `GAP_UNCERTAIN`. Neither state
can publish an incident. After those claims are durable, the cursor adopts the current profile
history ID and immediately performs an ordinary claims-before-cursor sync from that baseline.

The source snapshot is limited to message/thread identity, sender, subject, timestamps, labels,
snippet, SHA-256 content hash, a bounded evidence excerpt, structured interpretation, and state.
Raw MIME, unlimited message bodies, access tokens, refresh tokens, client secrets, prompts, and
chain-of-thought are excluded.

## Irrelevant-email proof

Not yet executed in real Gmail. Required evidence is:

1. Real delivery and Gmail notification.
2. Exact history discovery and message read-back.
3. Durable source claim ending in `NO_RELEVANT_OBJECTIVE_IMPACT`.
4. Zero recovery event claim, incident, planner call, Calendar action, or GitHub action.

## Canonical disruption proof

Not yet executed in real Gmail. The controlled non-sensitive message describes the backend lead
being unavailable and API Migration being blocked for Release V2. Required correlation includes
Gmail message/thread IDs, internal date, content hash, notification transport ID, history IDs,
source claim, interpreter checkpoint, canonical `DisruptionEvent`, downstream event claim,
incident, graph impact, and every external receipt actually reached.

## P1B→P1C continuation

The new handoff carries only `incident_id`. In the same authoritative transaction that persists a
verified P1B Calendar terminal checkpoint, the workflow ledger creates/adopts a deterministic
`P1C_RECOVERY_CONTINUATION_NEEDED` outbox. The handoff identity is derived from incident identity
and the verified Calendar-effect fingerprint. P1C reloads the incident and retains its frozen
authorization and GitHub idempotency logic.

Publish-before-marker crashes may republish the same logical handoff. Existing P1C action claims
and external identities suppress duplicate releases/runs. Existing P1C→P1D continuation remains
unchanged.

## Known limitations

- A real mailbox, OAuth consent, watch activation, and real emails require owner-controlled steps.
- Gmail stale-history gaps containing already-deleted messages cannot be reconstructed; the
  integration records degraded truth instead of claiming completeness.
- Attachments and multiple mailboxes are outside P1E.
- No Gmail content is exposed through the frozen P2A presentation API.
- Objective v1 deadline remains `2026-08-28T17:00:00Z`; no replacement objective may be created
  without separate authority.

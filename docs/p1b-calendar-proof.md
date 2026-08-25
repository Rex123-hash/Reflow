# P1B Calendar action: design and proof record

## Safety boundary

P1B preserves frozen P1A and adds only one real Google Calendar mutation, its durable receipt,
and an independent read-back. It does not add Gmail, GitHub, UI, product authentication,
objective restoration, compensation execution, or failure-triggered replanning. The incident
stops in `VERIFYING`, even when its action receipt is `VERIFIED`.

## Authentication and calendar isolation

The calendar owner must create a dedicated secondary demo calendar and share only that calendar
with `objective-recovery-app@project-f334c42b-7a03-4194-932.iam.gserviceaccount.com` as
`writer`. The Cloud Run service identity self-impersonates through IAM Service Account
Credentials to obtain a 15-minute token with exactly
`https://www.googleapis.com/auth/calendar.events`. This needs no user refresh token, OAuth client
secret, domain-wide delegation, or Secret Manager secret. The service account must never own the
calendar and receives no access to the owner's primary calendar.

## Authorized action

Code projects one `calendar.create_recovery_coordination_block` only when the selected plan
coordinates at least two distinct workstreams and assignees. The block is one hour, ends before
the protected Friday deadline, has no attendees or recurrence, sends no updates, is private,
and records a future `events.delete` compensation target without executing it.

## External idempotency and crash recovery

The event ID is `p1b` followed by the action's stable 64-character SHA-256 idempotency key. Those
characters satisfy Calendar's caller-supplied event-ID alphabet. Every execution preflights that
ID. If Calendar already contains it—whether from a normal retry, an insert conflict, or a process
death after write and before Firestore acknowledgement—the service adopts the same object,
persists the acknowledgement, and does not insert again. A changed intent under the same key is
a collision error.

## Receipt and independent verification

Firestore stores `action_claims/{idempotency_key}` and
`action_receipts/{receipt_id}`. The monotonic receipt flow is:

```text
PENDING -> WRITE_ACKNOWLEDGED -> VERIFIED | VERIFICATION_FAILED
                             \-> FAILED (non-retryable adapter error)
```

After `events.insert`, the service persists the acknowledgement and external ID/ETag. It then
issues a new `events.get`, normalizes the calendar/event IDs, summary, description, start/end,
status, visibility, transparency, and private recovery metadata, and compares them in
deterministic code. Volatile server fields are excluded.

## Deterministic test proof

- 44 frozen P1A tests remain.
- 18 P1B tests cover typed mapping, unsupported actions, stable identity, collisions,
  acknowledgement order, separate read-back, mismatch, retry classes, permission failure,
  write-before-receipt crash recovery, no-op replay, acknowledgement restart, overlapping
  Pub/Sub delivery, Firestore-safe serialization, timezone-equivalent read-back, and the
  no-`RESOLVED` boundary.

## Dedicated calendar setup

On 25 August 2026 the owner account `amaank220504@gmail.com` created
`Objective Recovery P1B Demo`, calendar ID
`57d10b3bec7fb1eda42a6f76ce0913a8cb35bda3406dcf8579e6ca75195bfb1d@group.calendar.google.com`.
Public access remained off. Only the owner and the Objective Recovery runtime service account
are listed; the service account has **Make changes and see all event details** (`writer`), not
owner/manage-sharing access. The primary calendar was not modified.

## Real action proof

The controlled Pub/Sub event `p1b-live-backend-lead-unavailable-20260825` produced incident
`incident-a1864f07664e057ef422`. The three valid candidate strategies were deadline-first,
risk-minimization-first, and resource-balance-first. Policy selected
`plan-resource-balance-first`, which coordinates migration implementation, API test ownership,
and release-note handoff across three assignees.

Cloud Run inserted exactly one private event into the dedicated calendar:

- action receipt: `receipt-018d1bed8c964f7163f686cc4a824189e1af6d14b36bdefd8f08dba3a6d857ac`
- idempotency key: `018d1bed8c964f7163f686cc4a824189e1af6d14b36bdefd8f08dba3a6d857ac`
- external event ID: `p1b018d1bed8c964f7163f686cc4a824189e1af6d14b36bdefd8f08dba3a6d857ac`
- external ETag: `"3575357586566526"`
- write acknowledged: `2026-08-25T17:26:31.966284Z`
- independent read-back verified: `2026-08-25T17:42:56.231290Z`
- observed window: `2026-08-28T13:00:00Z` to `2026-08-28T14:00:00Z`
- final receipt: `VERIFIED`, external evidence, zero differences

The first read-back exposed two production serialization defects and one semantic-normalization
defect: Firestore rejected tuple-pair arrays for action parameters and observed state, then
Calendar returned the same instants with `+05:30` offsets rather than UTC. Regression tests were
added before each corrected revision. After a controlled internal claim resume, revision
`objective-recovery-00007-r9q` logged `ACTION_RESUMED`, then
`CALENDAR_READBACK_STARTED`, then `ACTION_RECEIPT_VERIFIED` with `difference_count=0`; it logged
no `CALENDAR_WRITE_STARTED`. The original write acknowledgement and ETag remained unchanged.

An exact Pub/Sub replay was then suppressed as `DUPLICATE_EVENT_SUPPRESSED`. Firestore remained
at incident stage `VERIFYING`, status `action_receipt_verified`, and receipt `VERIFIED`; the
read-back and write-acknowledgement timestamps did not change. No `RESOLVED` transition or P1C
work occurred. A final type-only cleanup was rebuilt and deployed as
`objective-recovery-00008-l2j` at 100% traffic, pinned to
`sha256:61a73df37294970d27de078b13a709ae13f22da75bcb38c5223c7b53f852635a`; Terraform then
reported zero drift.

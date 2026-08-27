# P2B UI presentation contract hardening

Status: implemented against frozen P0–P1E recovery authority. This milestone changes only the
read-only presentation schemas, mappings, export tooling, fixtures, tests, and documentation.
It does not change Gmail ingestion, planning, policy, external execution, verification, incident
transitions, browser authentication, Operator mutations, or frontend code.

## Canonical authority

The fixture family is exported from real Gmail-originated incident
`incident-0fc3af5b0bd1ad847aea`. The final Firestore incident is revision 16,
`RESOLVED / objective_restored`, restored at `2026-08-27T19:08:54.504926+00:00`. The protected
deadline remains Objective v1's `2026-08-28T17:00:00+00:00`; the authoritative positive deadline
margin is 78,665 seconds.

The active fixture is a read-only historical view of revision 15 at
`OBJECTIVE_VERIFICATION_STARTED`: `VERIFYING / verifying`, Recovery 02, Candidate B validation and
promotion evidence already persisted, and final objective verification still pending. The export
keeps revision-2 planning, validation, promotion, Calendar closure, receipts, and events through
verification start. It excludes `closure_result`, incident `final_verification`, `resolved_at`,
`active_candidate_sha`, and `OBJECTIVE_RESTORED`. Its clock is fixed to the checkpoint timestamp,
so time remaining is historical truth rather than export-time wall clock.

## Exact evidence joins

`RecoveryStageView.related_evidence_ids`, `ActionReceiptView.evidence_id`,
`VerificationInvariantView.evidence_id`, typed plan-action execution evidence, Detect source
evidence, and Replan failed evidence all use exact `EvidenceView.evidence_id` values. Candidate
actions link to `github-run:<run_id>`, promotion links to `github-promotion:<release_id>`, Calendar
links to `calendar:<receipt_id>`, and verification rows link to
`objective-verification:<attempt>`.

`RecoveryCaseView`, `EvidencePageView`, and `OperatorContextView` validate evidence ID uniqueness
and every embedded evidence reference. A missing or duplicate target raises model validation and
stops fixture export.

## Pending verification

When Recovery 02 has no final observation, the expected invariant IDs come from persisted
`replanning_input.context.objective_invariants`, which is the deterministic P1D verifier input.
All six rows remain present with expected `true`, observed `null`, status `PENDING`, and bounded
provenance explaining that objective verification has not completed. The restored view uses the
six real final observations.

## Plan-action truth

`PlanActionDisposition` is `PROPOSAL_ONLY`, `EXECUTABLE`, or `EXECUTED`.

- Assignment/reassignment is always `PROPOSAL_ONLY`; `required_work_assigned` remains unsupported.
- A selected, policy-valid supported external action is `EXECUTABLE` before a write acknowledgement.
- It becomes `EXECUTED` only with durable execution authority and may link to exact evidence.
- Unselected or unsupported actions never become executed merely because a planner emitted them.

The legacy `proposed_action_summary` remains for additive compatibility; typed `actions` is the
new semantic authority.

## Timing, activity, Detect, and Replan

`ObjectiveContext` adds `deadline_at`, nullable `time_remaining_seconds`, nullable `restored_at`,
and nullable `deadline_margin_seconds`. Restored margin uses the actual restoration timestamp and
never the viewing clock.

`ExecutionEventView.phase` provides `DETECT`, `IMPACT`, `PLAN`, `ACT`, `VERIFY`, `REPLAN`,
`RESTORED`, or `SYSTEM` grouping. It does not alter timestamp, semantic type, sequence, cursor, or
persisted chronological order.

`DetectContextView` exposes normalized source authority, bounded disruption summary/type,
occurrence timestamp, affected node IDs, and exact source evidence. `ReplanContextView` exposes
the prior attempt, failed invariant/evidence, bounded change summary, and presentation-safe input
and failed-effect fingerprints.

## Gmail presentation boundary

The P1E fixture exposes normalized `gmail` authority, Gmail message provenance ID, content hash,
received/occurred timestamp, bounded semantic summary, disruption type, and affected-resource
count. It excludes sender addresses, recipients, subject, full body, MIME, raw Gmail payloads,
headers, OAuth credentials/tokens, Secret Manager references, private prompts, chain-of-thought,
and thought signatures.

Other stable machine authorities are `google_calendar`, `github`, `github_actions`,
`reflow_verifier`, `reflow_policy`, `reflow_engine`, `reflow_graph`, and `unknown`. Human labels are
separate fields.

## Compatibility and limitations

Endpoints and ETag behavior are unchanged. Existing fields are retained; semantic fields are
additive except that source/system fields now use normalized enum values instead of display prose.
Frontend generated types must be regenerated before removing its bounded ContractGap states.

Known limitations remain: Operator is read-only; there is no browser BFF/auth milestone here; no
assignment adapter exists; no objective percentage or invented progress metric is exposed; and
active historical fixtures are explicit exported checkpoints, not writable incident versions.

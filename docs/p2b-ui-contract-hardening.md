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

## Deployment and live read-only proof

Cloud Build `b769642c-d28d-4d2f-9202-a1cf314c602d` built source commit `e5ffcfe` from a bounded
1.7 MiB backend-only context. The immutable image is
`us-central1-docker.pkg.dev/project-f334c42b-7a03-4194-932/objective-recovery/app@sha256:68f25d34c90ee71361209f73c90f7d48bf4b7c528297f41dcd4c06ab6590c4e7`.
Terraform showed `0 add, 1 in-place Cloud Run image change, 0 destroy` and deployed private
revision `objective-recovery-00019-8vh` at 100% traffic. Cloud Run reported the revision ready and
container healthy.

Authenticated live GET proof against revision 00019 returned HTTP 200 for health, Overview,
Objectives, canonical Recovery, Evidence, Events, and read-only Operator context. Recovery ETag
`W/"16"` returned HTTP 304 on replay. All 22 public evidence references resolved exactly against
seven evidence cards; ten assignment/reassignment actions remained `PROPOSAL_ONLY`; one selected
GitHub validation action was `EXECUTED` with exact run evidence; the deadline margin was 78,665
seconds; 28 durable events remained chronological across seven semantic phases; Gmail source was
`gmail`; final verification was `PASSED` with six observations; and the live presentation payload
had zero forbidden-boundary scan hits.

Authenticated OpenAPI retained all UI routes plus Gmail push/maintenance, P1B-to-P1C continuation,
and P1C-to-P1D continuation routes. No external Calendar or GitHub recovery action was replayed.

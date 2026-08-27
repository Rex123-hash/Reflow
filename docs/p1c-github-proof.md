# P1C real GitHub objective-verification proof

P1C stops at `VERIFICATION_FAILED / recovery_incomplete`. It does not implement P1D.

## Authorities

- Code commits: `6d869fc` (implementation), `8157841` (terminal replay authorization).
- Cloud Build: `35f37a6a-b408-4a36-a57a-09ded91d9e00`.
- Cloud Run revision: `objective-recovery-00010-bk5`.
- Image digest: `sha256:7071227ad157ffe8014d53fcc735049108b644a74dbe4ca09d0941f9becfb89f`.
- GCP project: `project-f334c42b-7a03-4194-932`.
- Canonical incident: `incident-a1864f07664e057ef422`.
- Selected P1B plan: `plan-resource-balance-first`.
- Existing Calendar receipt: `receipt-018d1bed8c964f7163f686cc4a824189e1af6d14b36bdefd8f08dba3a6d857ac`, `VERIFIED`.

## GitHub proof

- Repository: `Rex123-hash/EXperiments`.
- Immutable candidate: `5353cf7c664f384d6642b5348c7f190187b06b4c`.
- Deterministic action key: `6c7be89f495917536b63abae5cf1df8ec225bde9fdb743c30f34e97ea038e469`.
- Release ID: `377697408`.
- Tag: `reflow-p1c-6c7be89f495917536b63abae5cf1-5353cf7c664f`.
- Release published: `2026-08-27T09:17:56Z`.
- Workflow ID/path: `343576501` / `.github/workflows/release-validation.yml`.
- Run ID/number/attempt: `33057922582` / `3` / `1`.
- Run created/started/completed: `09:17:58Z` / `09:17:58Z` / `09:18:10Z`.
- Run status/conclusion: `completed / failure`.
- Job ID: `98469248659`, `release-validation`, `failure`.
- Failing step: `Validate release compatibility`.
- Independent read-back: `2026-08-27T09:18:11.502435Z`.

Independent API reads proved that the release target, Git tag object, workflow head SHA, and job
head SHA all equal the immutable candidate. Correlation used exact repository, workflow ID, exact
workflow-path equality, `release` event, candidate SHA, deterministic tag/display identity, and
run creation after release publication. Checks API was not used.

## Durable semantics and outcome

The existing `action_claims` and `action_receipts` collections hold P1C state. The GitHub receipt
progressed `PENDING -> WRITE_ACKNOWLEDGED -> VERIFIED`; timestamps were
`2026-08-27T09:17:55.051464Z` and `2026-08-27T09:18:11.502435Z`. The pinned run ID and attempt were
persisted before terminal verification. CI failure did not fail the action receipt.

Normalized external evidence produced `release-validation-green=false`. The existing deterministic
objective verifier returned `VerificationResult.passed=false`, and the existing legal
`Incident.apply_verification` transition produced:

- incident stage: `VERIFICATION_FAILED`;
- incident status: `recovery_incomplete`;
- Firestore revision: `44`.

No model decided CI truth and no model or direct mutation resolved the incident.

## Retry and replay proof

The first Cloud Run delivery created/adopted the release, persisted write acknowledgement, and
returned HTTP 503 while the workflow was not yet visible. Pub/Sub redelivery pinned run
`33057922582:1`, performed independent release/tag/run/jobs reads, and returned HTTP 200.

After deploying the replay-safe revision, the exact continuation was published again. Before and
after replay:

- release ID remained `377697408` and the deterministic-tag release count remained one;
- run ID remained `33057922582` and the matching workflow-run count remained one;
- Firestore revision remained `44`;
- stage/status remained `VERIFICATION_FAILED / recovery_incomplete`;
- the replay returned HTTP 200 without GitHub calls, mutation, replanning, resolution, or model use.

## Quality gates

- Pytest: `89 passed, 1 skipped`.
- Coverage: `98.96%` (required: 95%).
- Strict mypy: passed.
- Ruff lint and formatting: passed.
- Terraform format and validate: passed.
- Pre-deploy plan: three P1C resources added, one Cloud Run update, zero destroys.
- Replay-fix plan: one Cloud Run image update, zero adds/destroys.

## Security and limitations

The exposed spike token was revoked and independently confirmed invalid. The production credential
is restricted to the single proof repository with Contents write, Actions read, and automatic
Metadata read; no Checks permission exists. Its payload is Secret Manager version 1 and is absent
from source, logs, and Terraform state. The credential expires on 2026-09-26 and requires rotation
for later demos. The repository's broad `.gcloudignore` makes build upload larger than necessary.
P1C intentionally does not resolve a green CI result and implements no P1D transition.

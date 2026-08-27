# P1D autonomous recovery proof

Proof date: 2026-08-27. Project: `project-f334c42b-7a03-4194-932`. Repository:
`Rex123-hash/EXperiments`. No credentials or secret values are included here.

## Deployed implementation

- Implementation commits: `db35ad8` (P1D), `a9815fa` (executable/proposal boundary),
  `c0fc4e1` (historical-checkpoint compatibility).
- Cloud Build: `deb6dd95-4ebb-4912-b97e-f09065c81f2b` (`SUCCESS`).
- Image: `us-central1-docker.pkg.dev/project-f334c42b-7a03-4194-932/objective-recovery/app@sha256:304fac90e3ec5ccc5d434971396dee502c28128b9e07d7643f3550674782edf9`.
- Cloud Run: `objective-recovery-00013-w4w`, 100% traffic, health `ready`, scope `P1D`.
- Dedicated transport: topic `objective-recovery-p1d`, authenticated push subscription
  `objective-recovery-p1d-push`, endpoint
  `/apps/objective_recovery_agent/trigger/p1d/pubsub`. Only the runtime service account has
  topic-publisher authority.

The implementation adds the transactional P1C terminal outbox, deterministic handoff publisher,
revision-2 reopen/checkpoints, planner and critic reuse, failed-effect policy, separately receipted
Candidate B validation and full-release promotion, fresh Calendar closure read-back, deterministic
six-invariant verification, terminal resolution, and post-resolution no-op behavior. The primary
implementation is in `objective_recovery_agent/p1d.py`, `p1d_store.py`, `recovery_outbox.py`, and
`objective_store.py`; contracts/gateways/ledger/API/Terraform were extended, and focused tests and
bootstrap/inspection scripts were added. No frontend or P1E file was changed by P1D.

## Step-0 promotion spike

Release `377746440`, tag `reflow-p1d-promotion-spike-20260827-01`, and Candidate A SHA
`5353cf7c664f384d6642b5348c7f190187b06b4c` were held constant while the published prerelease was
PATCHed with `draft:false`, `prerelease:false`, and `make_latest:"true"`. The same release became
full/latest. The tag has exactly one release-event run, `33064645686` attempt 1 (the prerelease
validation run); promotion created no second workflow run. Later P1D releases superseded it as
latest, as expected.

## Canonical authority and Candidate B

Firestore `objectives/release-v2` stores label `SHIP RELEASE V2`, `deadline_local` =
`2026-08-28 17:00:00`, `deadline_timezone` = `Etc/UTC`, `deadline_at_utc` =
`2026-08-28T17:00:00+00:00`, `objective_version` = 1, and `protected_commitment` = true. Both live
incidents pin objective version 1; P1D reads this document for closure.

Candidate B is the AVAILABLE immutable artifact
`7b7881ed1785cc37e038c44193ff2373badf54e7`, one commit after Candidate A. GitHub compare reports
one changed file, `src/release_v2/customer_api.py`, with the sole production change:

```diff
-    return payload.get("accountId")
+    return payload.get("accountId") or payload.get("customerId")
```

Persisted unchanged blob hashes are:

- `tests/test_release_compatibility.py`: `58f295e1bf4b4fa7eb8c10e894d1ce0be3e0408c`
- `release/compatibility.json`: `e0404b6821167471f074c127847dbfad095fa497`
- `.github/workflows/release-validation.yml`: `1a4b72799ca92038ee4b1a626a047c4bd175eb1c`

## Historical revision-44 migration

Incident `incident-a1864f07664e057ef422` entered from the immutable P1C evidence at revision 44:
Candidate A release `377697408`, run `33057922582` attempt 1, failed step `Validate release
compatibility`, verified action receipt, and objective verification false. Bootstrap created/adopted
handoff `66bb160bcb55ca316d3ebaac4680f46b31b3d84c506c294995fd837427cf9d91` from durable facts only.

Revision `0002` input fingerprint was
`5bcb353cecb1b95a75d939f8d078cd399901af04ddc14cf1e0765e549ac208eb`. Planner run
`4381ce8a-9f86-4eb1-b074-41b33e17ad82` persisted two candidates before the critic (11,602 ms,
11,816 tokens); the critic persisted next (4,357 ms, 10,647 tokens). Both futures used Candidate B.

The first deterministic selection checkpoint truthfully remains `NO_VALID_PLAN`: the original
policy mistakenly treated proposal-only assignment actions as executable and applied authoritative
assignment skills to proposals. No GitHub mutation occurred. After the boundary repair, immutable
planner/critic output was reassessed once under `p1d-executable-v2`—without another Gemini call.
Both plans were valid and normal stable selection chose `plan-risk-minimization-first`; proposals
were retained for audit but only its one `github_release_validation` action was authorized.

- Validation action key:
  `1b911f6332f51b2dc52a75c42b58c81c41c796f2e2dc38b114aeeec68c1240b2`.
- Candidate B release: `377823763`, tag
  `reflow-p1d-1b911f6332f51b2dc52a75c42b58-7b7881ed1785`.
- Validation: run `33074343469` attempt 1, job `98524509064`, conclusion `success`; required step
  `Validate release compatibility` completed successfully.
- Validation receipt:
  `github-1b911f6332f51b2dc52a75c42b58c81c41c796f2e2dc38b114aeeec68c1240b2`, `verified`.
- Promotion receipt:
  `github-76a0ebddbd73883596e7cb4d5a8c80e15360dfe146574ebf40f378d5e401222a`, `verified`.
- Independent release reads proved ID `377823763`, same tag, tag SHA B, `draft:false`,
  `prerelease:false`, and (at closure) `/releases/latest` equality.
- Fresh Calendar read proved event
  `p1b018d1bed8c964f7163f686cc4a824189e1af6d14b36bdefd8f08dba3a6d857ac` remained confirmed,
  with no normalized differences.
- All six invariants passed. Final state: `RESOLVED / objective_restored`, revision 51, active SHA B,
  resolved at `2026-08-27T12:58:04.874993+00:00`.
- Resolved replay: Firestore revision 51→51, release ID unchanged, exact-tag run count 1→1 with only
  run `33074343469`.

## Fresh automatic P1C-to-P1D loop

Event `p1d-fresh-autonomous-20260827-01` produced incident
`incident-938b303718a6abe41244`. P1A had one transient planning failure and durably resumed on attempt
2, selected `plan-risk-minimization-first`, and P1B independently verified Calendar receipt
`receipt-9bb0de0227d16b3713afc124a7f61c717d148e12321fc459357ab9e9a52441f6`.

P1C created Candidate A release `377826344`; exact run `33074677098` attempt 1 failed at the
unchanged `Validate release compatibility` step. Its verified action receipt and false objective
verification were persisted at revision 11. In the same terminal transaction P1C created exactly
one fact-only outbox record:

- handoff: `b865dc601a0c56227b869890a3722251f116c97b9da31d8a91e922ce350cbfd0`
- failed-verification fingerprint:
  `b071cefba684ef986c41af8105f2886b4f7a6e04ce7f674724311a819d71d4b2`
- source revision: 11; created `13:01:21.024802Z`; automatically published `13:01:21.447248Z` as
  Pub/Sub message `21582307859028767`; consumed by P1D `13:01:24.957599Z`.

There was no manual P1D publish, runtime SHA, plan choice, or stage instruction. The observed legal
path was `VERIFICATION_FAILED → REPLANNING → VALIDATING → PLAN_SELECTED → EXECUTING → VERIFYING →
RESOLVED` with durable semantic events/checkpoints.

Revision `0002` input fingerprint
`d3a01695d22004c820ea771cf40080fc4992df8ec0f035ffada9e04657f421e4` includes exact A
release/run/job/step evidence, failed-effect fingerprint
`ab217ef748b10404828630a26f2633f9e51dc801451d3698ab12a64a064398b2`, canonical objective v1,
previous plan/policy/receipts, graph/resources, and AVAILABLE B artifact. Planner run
`12f8c8e2-ac51-4b13-bae7-14ccce5d6e69` persisted three materially revised B futures before the
critic (20,265 ms, 14,202 tokens); the context-aware critic persisted scores 4, 5, and 3 (6,925 ms,
12,876 tokens). `p1d-executable-v2` found all three valid; normal risk/action-count/stable tie-break
selection chose `plan-resource-balance-first`, not an injected artifact.

`FailedRecoveryRepeatPolicy` compares repository/SHA/workflow effect fingerprints, so an A repeat is
hard-rejected as `failed_recovery_exact_repeat`; the final selector defensively asserts no failed
fingerprint survived. Regression tests prove lower-risk A loses, B is not preferred over a better
valid C, invalid B is rejected, absent executable B yields `NO_VALID_PLAN` without mutation, and two
B plans use normal stable selection. The live planner proposed B rather than an A repeat.

- Selected semantic fingerprint:
  `8794296ddfefbd82f38e6adb93e44adea929b76e861cf3a7f516b933398f501c`.
- Validation action/key: `p1d-github_release_validation-9c613523dd025de0` /
  `9c613523dd025de0cb3370cba8c58917ea534156f537cfc58ddf40ddd1cd91c1`.
- Candidate B release: `377826902`, tag
  `reflow-p1d-9c613523dd025de0cb3370cba8c5-7b7881ed1785`.
- Exact validation: run `33074746109` attempt 1, job `98525898891`, completed `success`; required
  step 6 `Validate release compatibility` completed `success`.
- Validation receipt:
  `github-9c613523dd025de0cb3370cba8c58917ea534156f537cfc58ddf40ddd1cd91c1`, `verified`.
- Promotion action key:
  `608c9646e22ca5e80636c4741c0503054d2978f165b84e18b78918fc76985c66`; promotion receipt
  `github-608c9646e22ca5e80636c4741c0503054d2978f165b84e18b78918fc76985c66`, `verified`.
- Independent reads proved the same release ID/tag, `draft:false`, `prerelease:false`, tag SHA B,
  and `/releases/latest` ID `377826902`.
- Fresh Calendar GET proved event
  `p1b9bb0de0227d16b3713afc124a7f61c717d148e12321fc459357ab9e9a52441f6` confirmed with no
  normalized differences.
- All six invariants—`coordination-action-preserved`, `active-release-candidate-revised`,
  `release-validation-green`, `shipped-full-release`, `external-correlation-fresh`, and
  `protected-release-deadline-satisfied`—passed from external evidence.
- Final state: `RESOLVED / objective_restored`, revision 17, active SHA B, resolved at
  `2026-08-27T13:02:27.241001+00:00`.
- Resolved replay left revision 17→17, workflow-event count 30→30, exact-tag release ID unchanged,
  and its sole run remained `33074746109`.

## Quality and infrastructure

- Full suite: 103 passed, 1 skipped; required domain coverage 99.01% (threshold 95%).
- Strict mypy: clean across 48 source files. Scoped Ruff format/lint: clean. Terraform fmt/validate:
  clean. `git diff --check`: clean for P1D files.
- Agents CLI eval: 1/1 valid, `custom_response_quality` mean 1.0000;
  `artifacts/grade_results/results_20260827_183807.json`.
- Terraform deployment updated Cloud Run in place with no destroys. Final drift check is recorded in
  the completion response.

## Known limitations

- Assignment actions in selected plans are proposals only; P1D neither executes them nor claims they
  happened. The frozen frontend label “Required work assigned” must later be corrected or backed by
  a real assignment adapter.
- The historical immutable false-start is retained for audit and followed by a versioned,
  deterministic reassessment of the same planner/critic output.
- The repository-scoped GitHub credential currently expires on 2026-09-26 and requires normal
  credential rotation before then.
- P1E, Gmail triggers, dashboard/Recovery Room, and all frontend work remain deliberately out of
  scope.

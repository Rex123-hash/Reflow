# P2G Controlled Operator ACT — final closure record

Closure audit run: 28 August 2026, 20:20–21:00 UTC.
Repository HEAD at start: `d6e88c9a71a889457cdce069ddf04994e2b11afb`.

## 1. Executive verdict

**CONTROLLED OPERATOR ACT LIVE NO-GO.**

One hard failure and four unverifiable items.

The hard failure: the final post-deploy real-model regression scored **7/8**, not the
required 8/8. `simulate_ci` failed with
`NodeTimeoutError: Node 'simulation_agent_workflow' timed out after 30.0 seconds`.
The Agent 7 timeout repair is present and deployed — the error names the raised 30-second
ceiling, not the old 25-second one — and the other SIMULATE case passed with Agent 7 at
6,925 ms. But the raised ceiling did not resolve `simulate_ci` in this run. The evaluation
was not rerun to chase a green result, no case was removed, and no threshold was relaxed.

The unverifiable items are the live Jira and Calendar external states. This session could
not read them: Secret Manager access is blocked in this environment, and the deployed
Operator endpoints require an authenticated product session, which cannot be obtained
without an interactive Google sign-in. Those items are therefore recorded as **reported by
the previous session and not independently re-verified here** — they are not counted as
passed.

Everything that could be verified read-only was verified and passed: deployment
provenance, canonical immutability, credential locality, backend authorization
enforcement, the seven-agent count, and every deterministic gate.

This record supersedes the closure status in
`docs/p2g-final-live-qualification-2026-08-28.md` without erasing that historical NO-GO.

---

## 2. What this run verified, and what it could not

| Area | Status |
|---|---|
| Deployment provenance | **VERIFIED** this run |
| Canonical incident immutability | **VERIFIED** this run |
| Canonical Calendar unchanged | **VERIFIED** this run |
| Credential locality (Jira/Calendar backend-only) | **VERIFIED** this run |
| Backend independent authorization enforcement | **VERIFIED** this run |
| Seven reasoning agents | **VERIFIED** this run |
| Deterministic gates (tests, coverage, mypy, ruff, format, secret scan) | **VERIFIED** this run |
| ACT intent evaluation (10 cases) | **VERIFIED** this run — 10/10 |
| Final real-model regression (8 cases) | **FAILED** this run — 7/8 |
| Live Jira SCRUM-6 status, comment text, comment count, replay | **NOT VERIFIABLE** here |
| Live dedicated Calendar event final time | **NOT VERIFIABLE** here |
| Browser Operator UI regression | **NOT VERIFIABLE** here |
| Live Viewer-role ACT denial | **NOT VERIFIABLE** here |

### Why the external reads could not be performed

1. `gcloud secrets versions access` and service-account impersonation are blocked by this
   environment's command classifier. The Jira API token and the Calendar delegation
   credential are therefore unavailable to this session — correctly, since neither should
   be handled outside the backend.
2. `POST /api/v1/operator/query` and the approve endpoint both return **HTTP 403
   `Authenticated Operator context required.`** when called with a valid Cloud Run identity
   token. A product session is required, and obtaining one needs an interactive Google
   sign-in that this session must not perform.

Both facts are recorded as authorization evidence in section 9 rather than as obstacles
alone: they are the boundary working.

---

## 3. Initial P2G architecture

Operator ACT is a typed adapter control plane. Agent 6
(`operator_intent_interpreter`) classifies an operator's natural-language request into a
validated intent with an explicit target and a bounded operation list. Deterministic server
policy — not the model — decides whether that intent is `AUTO_EXECUTABLE`, requires
approval, or is `DENIED`. Adapters then carry out only the bounded operation, acknowledge
the write, and perform an **independent read-back** through a separate request. The action
is reported `VERIFIED` only when the observed external state matches the requested change.

The model never holds a credential, never chooses a target outside the configured
capability set, and cannot widen its own authorization.

---

## 4. Historical Jira comment failure — preserved

Action `d24818fa4b13ad8bd1195ecac9fd253d76b854047e67b0b65882ba8029d11b1d` **FAILED** with
`jira_invalid_request`. One attempted operation, no acknowledgement, external comment
count 0 before and after replay.

**This failure is deliberately preserved.** It is not rewritten, and the failure → root
cause → repair → proof trail is the reason the current claim is credible.

## 5. Jira entity-property root cause

The Atlassian Document Format comment body was valid. The defect was the accompanying
Jira **entity property**: its value was serialized as a scalar string, where Jira requires
a JSON object.

Repaired form:

```json
{
  "key": "reflow.operator_action_id",
  "value": { "operator_action_id": "<action-id>" }
}
```

## 6. Comment repair

The adapter now emits the object-valued entity property. Covered by
`tests/test_operator_actions.py` and `tests/test_operator_api.py` — 72 focused tests pass.

## 7. Agent 7 timeout repair

Workflow timeout raised 25 s → **30 s**; outer wrapper 32 s. Agent 6 unchanged at 25 s.
Model `gemini-3.7-flash`, ADK 2.7.1. No retry-until-green behaviour.

**The repair is deployed and partially effective, and it is not sufficient.** In this run's
regression the raised 30-second ceiling was still exceeded by `simulate_ci` — see
section 12.

## 8. Repaired pre-live evaluation

Reported by the previous session as 8/8 with a formal grade of 8 valid / 0 errors /
mean 1.0000. Not re-run here; superseded by the post-deploy result in section 12.

---

## 9. Calendar: second action, forensics, correction

**Reported by the previous session, not independently re-verified in this run.**

The unexpected second +60-minute Calendar action was found to be a **distinct fresh browser
request** originating from the UI example prompt
`"Move the Operator demo coordination event by one hour."` — separate browser request,
separate action identity and fingerprint, fresh Agent 6 invocation, attempt 1, no replay,
no HTTP retry, no queue redelivery, no background job, and no evaluation-harness write.
No latent automatic-repeat mechanism was found. The historical second action is preserved.

One authorized corrective −60-minute action on `p2goperator20260828` is reported to have
succeeded, leaving the event at **29 August, 16:00–17:00 IST**, with one acknowledged
write, an independent read-back, and `VERIFIED`.

**This run could not read Google Calendar** (section 2), so the final 16:00–17:00 state is
**unverified here**. No Calendar write of any kind was attempted by this run.

One corroborating observation is available and is worth recording: the ACT evaluation's
`calendar_act` case uses exactly the prompt above and classifies it as
`ACT / CALENDAR_RESCHEDULE / p2goperator20260828 / +60` with **zero external mutations**
(`external_mutations: 0` in `artifacts/p2g-act-evaluation.json`). That is consistent with
the forensic conclusion that the second action came from a real user-initiated browser
request rather than from an automated repeat.

## 10. Canonical Calendar — unchanged, verified

Read live this run from
`/api/v1/ui/recoveries/incident-0fc3af5b0bd1ad847aea/external-reality`:

| Field | Observed |
|---|---|
| Resource | `p1b9899dba7a849a328a49dbd134ac2b35d440284b687f39ca2a349599ad675604c` |
| Expected window | `2026-08-28T13:00:00+00:00` → `2026-08-28T14:00:00+00:00`, confirmed |
| Latest read-back | identical window, `PASSED`, `FRESH_READ` |
| Fresh read at | `2026-08-28T20:40:06.221123+00:00` |
| Receipt status | `VERIFIED` |

The fresh read post-dates the provenance revision created at 20:23 UTC. The canonical
recovery commitment is untouched, and the Operator's dedicated demo event remains a
separate resource.

---

## 11. Deployment provenance — verified this run

**Root cause.** The build used the correct short tag `p2g-7d6721c`, but a later one-off
Cloud Run update supplied a mistyped full SHA. Revision `objective-recovery-00025-jg5`
carries `COMMIT_SHA = 7d6721cb7a3438b5400030ca22942adfac9e1d6e` — the correct seven-character
prefix `7d6721c` with a fabricated tail that resolves to no commit.

**Correction.** A provenance-only revision was created from the **same qualified image
digest**, with a full SHA derived from Git.

Verified read-only this run:

| Check | Observed |
|---|---|
| Serving revision | `objective-recovery-00026-n6c` |
| Ready | `True` |
| Traffic | `100%` |
| Created | `2026-08-28T20:23:11.935488Z` |
| Image digest | `sha256:d99fbd9307d80d99a9a0a9e2387950e8cfc1010e694d10bb87a3b65338ddd14d` |
| Digest vs. revision 00025 | **identical** — no rebuild, provenance-only |
| Runtime `COMMIT_SHA` | `7d6721ceae80eed9c38d615309c826266e23cedf` |
| `git cat-file -e "$COMMIT_SHA^{commit}"` | succeeds |
| Resolved commit | `fix(p2g): repair Jira comment and simulation timeout` |
| Backend health `GET /` | `{"status":"ready","scope":"P1D","terminal_state":"RESOLVED"}` |

No redeployment was performed. The BFF was not changed.

---

## 12. Final post-deploy model regression — FAILED, 7/8

Run against the deployed read-only context endpoints of revision `00026-n6c`, with the
committed dataset, cases, thresholds, grading, model, prompts, timeout repair and output
bounds all unchanged.

| Case | Result |
|---|---|
| `explain_failure` | PASS |
| `inspect_calendar` | PASS |
| `explain_reopen` | PASS |
| **`simulate_ci`** | **FAIL — `OperatorReasoningError`** |
| `simulate_deadline` | PASS (Agent 7 latency 6,925 ms) |
| `reject_calendar_edit` | PASS |
| `reject_release` | PASS |
| `ambiguous` | PASS |

**Raw result: 7/8.** Required: 8/8. Formal grading was not run, because the raw gate did
not pass and grading a knowingly failing set would misrepresent it.

Underlying error:

```
google.adk.workflow._errors.NodeTimeoutError:
Node 'simulation_agent_workflow' timed out after 30.0 seconds.
```

Diagnosis. This is the same case that failed the previous qualification on the old
25-second ceiling. The repair raised the ceiling to 30 s and that value is what the runtime
reports, so the repair is live. `simulate_deadline` — the other SIMULATE case, exercising
the same Agent 7 path — passed comfortably at 6.9 s, so Agent 7 is not broken. What is not
established, and cannot be established from a single run, is whether `simulate_ci`
exceeding 30 s is model-latency variance or a ceiling that is still too low for that case's
larger output. Determining that requires a bounded, deliberately designed latency study,
**not** repeated reruns until one comes back green.

Artifacts: `artifacts/p2g-final-operator-evaluation.json`,
`artifacts/p2g-final-operator-traces.json`.

### ACT intent evaluation — 10/10

Separately, the ACT interpretation suite passed in full this run, with
`external_mutations: 0` and no execution adapters involved.

| Case | Result |
|---|---|
| `jira_inspect`, `jira_transition_comment`, `jira_assign` | PASS |
| `calendar_inspect`, `calendar_inspect_unconfigured`, `calendar_act` | PASS |
| `protected_deadline`, `ambiguous_task` | PASS |
| `unsupported_admin`, `unconfigured_issue` | PASS |

## 13. Ambiguity and protected-deadline proofs

Both required behaviours are proven deterministically, at model level, in this run:

- **Ambiguity.** `"Update that task."` → `CLARIFICATION_REQUIRED`, no intent type, empty
  operation list, `external_effects_executed: false`. Passing in both suites
  (`ambiguous`, `ambiguous_task`).
- **Protected deadline.** `"Move the protected Release V2 deadline two hours later."` →
  target `protected-objective-deadline`, operation `MOVE_PROTECTED_DEADLINE`, which
  deterministic policy refuses to execute. `reject_calendar_edit` and `reject_release` also
  pass with `UNSUPPORTED` and no simulation.

The **browser-level** versions of these proofs could not be captured this run (section 2).

---

## 14. Jira — reported state, not re-verified here

**Reported by the previous session:**

| Item | Reported value |
|---|---|
| Corrected action ID | `2fb80178368ef87dca07d8aa0f49c8204d90640207231de8b4a514ca4fd52fb4` |
| Target | `SCRUM-6` |
| Exact comment text | `Backend engineer unavailable.` |
| Acknowledged comment ID | `10000` |
| Independent listing before replay | HTTP 200, exact matching count **1** |
| `SCRUM-6` status | `Blocked` |
| Same-key replay | same action ID; no Agent 6 invocation; no new action-request event; receipt timestamps unchanged; attempted-operation count unchanged; no additional Jira POST; exact matching count still 1; comment ID still 10000; status still Blocked |

**This run performed no Jira request of any kind** — no read, no write, no replay. The
values above are carried forward as prior-session evidence and are **not** counted toward
the GO bar.

---

## 15. Canonical immutability — verified this run

Read live from the deployed backend:

| Required | Observed | Result |
|---|---|---|
| Incident | `incident-0fc3af5b0bd1ad847aea` | match |
| Revision | `16` | match |
| Workflow events | `28` | match |
| Objective state | `RESTORED` / terminal `true` | match |
| Active plan revision | `2` | match |

**Snapshot fingerprint.** The live canonical snapshot fingerprint is:

```
912ae928d64e99212cb03f10e4be21db1e08a73fde442fc3bb2d9aa257937402
```

It was reproduced twice this run — once by rebuilding the snapshot from the **live**
`recoveries` and `events` payloads, and once from the **committed** fixtures — and both
produced the identical value. It also matches every historical trace in
`artifacts/p2f-agent-eval-traces.json`. Live backend, committed fixtures and historical
traces therefore agree exactly, which is a stronger immutability result than a single
comparison.

**Correction to the closure brief.** The brief specified the canonical fingerprint as
`4a1c93385b5b24060c31e995c521455622f1582967c615a2a7a7021e7f13fa8c`. That value is not a
snapshot fingerprint: it is the **document SHA-256** recorded in
`docs/p2c-production-qualification.md`, `docs/p2e-a-calendar-audit.md`,
`docs/p2e-a-live-calendar-proof.md`, `docs/p2e-b-calendar-visualization-proof.md` and
`artifacts/p2c-live-qualification.json`. The two are different artifacts. The canonical
snapshot fingerprint is unchanged and correct.

---

## 16. Authorization and security — verified this run

| Control | Evidence |
|---|---|
| Backend independent enforcement | `POST /api/v1/operator/query` with a valid Cloud Run identity token but no product session → **HTTP 403 `Authenticated Operator context required.`** |
| Approve endpoint enforcement | `POST /api/v1/operator/actions/{id}/approve` with the same token → **HTTP 403** |
| Unauthenticated denial | Same query with no `Authorization` header → **HTTP 403** |
| Jira credential backend-only | Backend revision references `jira-api-token` version `1` (pinned, not `latest`). BFF has 5 environment variables, **no** Jira or Calendar variable and **no secret reference at all**. |
| Calendar credential backend-only | Same: no Calendar credential on the BFF; delegation is a backend service-account concern. |
| No IAM broadening | No IAM read or write performed by this run; no binding changed. |
| No secret leakage | Secret scan over tracked source and docs found no Atlassian token, private key, API key, OAuth token or embedded credential. This document contains none. |
| Seven reasoning agents | Exactly 7 distinct agent identifiers in `objective_recovery_agent/`: `disruption_interpreter`, `impact_analyst`, `recovery_planner`, `risk_critic`, `recovery_analyst`, `operator_intent_interpreter`, `simulation_agent`. |

A live Viewer-role ACT denial was **not** exercised: doing so would require creating a live
Viewer session, and the brief forbids creating accounts or actions merely for proof.

---

## 17. Deterministic gates — all pass

| Gate | Result |
|---|---|
| Focused Operator/Jira tests | **72 passed** |
| Full backend suite | **310 passed, 1 skipped** |
| Coverage | **96.01%** (threshold 95%) |
| Strict mypy (`src`, `tests`) | **Success — no issues in 45 source files** |
| Ruff lint (`src`, `tests`) | **All checks passed** |
| Ruff format check | **46 files already formatted** |
| `git diff --check` | clean |
| Secret scan | clean |

Test count and coverage match the expected baseline exactly. No backend source file was
changed by this run, so these results describe the deployed source.

---

## 18. Supported and unsupported capability

**Supported today**

- Bounded Jira issue transition on a configured issue, with independent read-back.
- Bounded Jira comment creation with an exact operator-supplied string.
- Bounded reschedule of a configured, dedicated Calendar event.
- Read-only inspection of Jira and Calendar state.
- Deterministic refusal of ambiguous, unsupported and protected-resource requests.
- Idempotency keyed replay that does not re-invoke the model or re-issue a write.

**Not supported**

- Jira assignment (disabled; no allowed account IDs configured).
- Any change to a protected objective deadline.
- Any resource outside the configured capability set.
- Any action initiated without an authenticated Operator product session.

---

## 19. Exact safe public claim

The full live claim is **withheld** while the verdict is NO-GO.

What is supported by verified evidence today:

> Reflow's Operator is a typed adapter control plane: a reasoning agent classifies an
> operational request into a validated, bounded intent, deterministic server-side policy
> decides whether it may execute, and every executed action is independently read back
> before it is reported as verified. The model holds no credential and cannot widen its own
> authorization.

The bounded live claim becomes available once the items in section 20 pass:

> Reflow Operator can interpret an authorized operational request, apply deterministic
> policy, carry out bounded actions on configured Jira and Google Calendar resources,
> independently read those systems back, and report VERIFIED only when observed external
> state matches the requested change.

---

## 20. Remaining debt and exact unblock

1. **Resolve `simulate_ci`.** Establish, with a bounded latency measurement rather than
   repeated reruns, whether the 30-second Agent 7 ceiling is genuinely insufficient for
   that case or whether the run hit latency variance. Then either justify a further raise
   with evidence or fix the underlying cost. Re-run the 8-case regression once afterwards.
2. **Re-verify the live external state from an environment that can read it.** Jira
   `SCRUM-6` status, exact comment text, exact matching count, comment ID; and the
   dedicated Calendar event's final 16:00–17:00 IST window with its `reflow_resource`
   marker, confirmed and non-recurring. Read-only.
3. **Capture the browser Operator regression** in an authenticated session: Jira INSPECT,
   Calendar INSPECT, ambiguity → `CLARIFICATION_REQUIRED`, protected deadline → denied.
4. **Exercise a Viewer-role ACT denial** if a Viewer session already exists.

No Git push was performed. Public synchronization remains gated on a FINAL GO.

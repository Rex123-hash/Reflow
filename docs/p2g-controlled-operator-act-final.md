# P2G Controlled Operator ACT — final closure record

Closure audit run: 28 August 2026, 20:20–21:00 UTC.
Repository HEAD at start: `d6e88c9a71a889457cdce069ddf04994e2b11afb`.

## 1. Executive verdict

**CONTROLLED OPERATOR ACT LIVE NO-GO.**

One defect blocks closure: the final unchanged post-deploy real-model regression scored
**7/8**. `simulate_ci` was cut off by the Agent 7 workflow deadline at
**30,027 ms** (`completed: false`, `timeout_category: runtime`).

A bounded latency characterization was performed across every preserved evaluation
artifact (section 12). Its conclusion is that **raising the ceiling again is not
justified**, so no reliability change was made and no further regression was run. Raising
25 s → 30 s was itself the experiment that tested the "just over the limit" hypothesis,
and it failed: the call still ran past the new ceiling. Increasing the number a third time
without a root cause would repeat a failed experiment.

Everything else required for GO is verified and passing, including — corrected from the
previous audit — the historical canonical document fingerprint, which **matches exactly**.

The live Jira and Calendar external states were proven in the prior Codex live session.
This environment cannot re-read them (no product session, no backend credential path).
That is recorded throughout as *prior-session live proof; current-session read-only
re-verification unavailable*. It is **not** a downgrade of that evidence.

This record supersedes the closure status in
`docs/p2g-final-live-qualification-2026-08-28.md` without erasing that historical NO-GO.

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
| Historical canonical document fingerprint `4a1c…` | **VERIFIED** this run — matches |
| Live Jira SCRUM-6 status, comment text, comment count, replay | **PRIOR-SESSION LIVE PROOF**; re-read unavailable here |
| Live dedicated Calendar event final time | **PRIOR-SESSION LIVE PROOF**; re-read unavailable here |
| Browser Operator UI regression | re-capture unavailable here |
| Live Viewer-role ACT denial | not exercised (would require creating a session) |

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

**Prior-session live proof; current-session read-only re-verification unavailable.**

The unexpected second +60-minute Calendar action was found to be a **distinct fresh browser
request** originating from the UI example prompt
`"Move the Operator demo coordination event by one hour."` — separate browser request,
separate action identity and fingerprint, fresh Agent 6 invocation, attempt 1, no replay,
no HTTP retry, no queue redelivery, no background job, and no evaluation-harness write.
No latent automatic-repeat mechanism was found. The historical second action is preserved.

One authorized corrective −60-minute action on `p2goperator20260828` is reported to have
succeeded, leaving the event at **29 August, 16:00–17:00 IST**, with one acknowledged
write, an independent read-back, and `VERIFIED`.

**Prior-session live proof; current-session read-only re-verification unavailable.** The
16:00–17:00 IST correction and its independent read-back were proven live in the prior
session. This environment has no product session or backend credential path, so it cannot
re-read Calendar; that is a limitation of this environment, not a defect in the proof. No
Calendar request of any kind was made by this run.

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

## 12. Final post-deploy model regression — FAILED, 7/8, and the reliability decision

Run once against the deployed read-only context of revision `00026-n6c`, with dataset,
cases, thresholds, grading, model, prompts, timeout repair and output bounds unchanged.

| Case | Result |
|---|---|
| `explain_failure`, `inspect_calendar`, `explain_reopen` | PASS |
| **`simulate_ci`** | **FAIL — Agent 7 deadline at 30,027 ms** |
| `simulate_deadline` | PASS (Agent 7 6,925 ms) |
| `reject_calendar_edit`, `reject_release`, `ambiguous` | PASS |

**Raw result 7/8.** Required 8/8. Formal grading was not run: grading a knowingly failing
set would misrepresent it.

```
google.adk.workflow._errors.NodeTimeoutError:
Node 'simulation_agent_workflow' timed out after 30.0 seconds.
failure: { elapsed_ms: 30027, timeout_category: "runtime", completed: false }
```

### 12.1 Agent 7 latency characterization

Every genuine Agent 7 sample preserved across all evaluation artifacts. No model call was
made to collect additional samples; no token count is fabricated for a timed-out call.

| Source | Case | Result | Agent 7 ms | Attempts | Output tokens | Ceiling |
|---|---|---|---|---|---|---|
| `p2f-deployed-evaluation.json` | simulate_ci | OK | 7,644 | 1 | 859 | 25 s |
| `p2g-ci-diagnostic.json` | simulate_ci | OK | 8,453 | 1 | 558 | 25 s |
| `p2g-repaired-prelive-context-evaluation.json` | simulate_ci | OK | 8,469 | 1 | 537 | 30 s |
| `p2g-regression-evaluation.json` | simulate_ci | OK | 10,767 | 1 | 810 | 25 s |
| `p2g-post-live-regression-evaluation.json` | simulate_ci | **TIMEOUT** | — | — | — | **25 s** |
| `p2g-final-operator-evaluation.json` | simulate_ci | **TIMEOUT** | 30,027 (cut off) | — | — | **30 s** |
| `p2g-final-operator-evaluation.json` | simulate_deadline | OK | 6,925 | 1 | 462 | 30 s |
| `p2g-repaired-prelive-context-evaluation.json` | simulate_deadline | OK | 8,024 | 1 | 538 | 30 s |
| `p2g-post-live-regression-evaluation.json` | simulate_deadline | OK | 8,546 | 1 | 742 | 25 s |
| `p2g-regression-evaluation.json` | simulate_deadline | OK | 10,394 | 1 | 536 | 25 s |
| `p2f-deadline-diagnostic.json` | simulate_deadline | OK | 11,200 | 1 | 842 | 25 s |

Two further artifacts — `p2f-local-evaluation.json` and `p2g-repaired-prelive-evaluation.json` —
show **both** simulate cases failing with a bare `TimeoutError`. Those are **excluded as
latency evidence**: they are harness misconfiguration, not model behaviour. Running
`scripts/evaluate_operator` without `--url` or `--context-url` leaves it with no operator
service to answer, and every case in the suite then times out. That failure mode was
reproduced deliberately in this audit — all 8 cases failed identically — before running the
suite correctly.

**Distribution.** `simulate_ci` successes: 7,644 / 8,453 / 8,469 / 10,767 ms.
`simulate_deadline` successes: 6,925 / 8,024 / 8,546 / 10,394 / 11,200 ms.
Every success is attempts = 1, so no internal retry inflates any figure. **Across all nine
successes the maximum is 11,200 ms, and there is no observed sample anywhere between
11.2 s and the ceiling.**

### 12.2 Reliability decision: the ceiling stays at 30 s

The evidence does **not** describe a distribution whose tail sits just above 30 s. It is
bimodal: the call either completes in 7–11 s, or it runs past whatever deadline is set.

The decisive point is that **the 25 s → 30 s raise was itself the experiment** that tested
the "just over the limit" hypothesis. If the true duration for `simulate_ci` were slightly
above 25 s, a 30 s ceiling — 20% more headroom, and nearly 3× the worst observed success —
would have caught it. It did not; the call was still running at 30,027 ms. Raising the
number a third time would repeat a failed experiment with a larger constant, and if the
underlying behaviour is an occasional stall rather than a slow completion, a higher ceiling
only makes each failure slower to detect while still failing.

**No timeout change was made. No source file was modified. The suite was not re-run.**

There is headroom available if a future root cause justifies using it:

| Layer | Bound | Margin to next |
|---|---|---|
| Agent 6 node | 25 s | +2 s to its outer wrapper |
| **Agent 7 node** | **30 s** | +2 s |
| Agent 7 outer wrapper | 32 s | +38 s |
| `OperatorService` overall | 70 s | +15 s |
| BFF upstream read | 85 s | +5 s |
| Browser client | 90 s | +210 s |
| Cloud Run request | 300 s | — |

The binding constraint above Agent 7 is the 70 s service deadline, so a raise is
*mechanically* possible. It is not *evidentially* justified.

**What would justify one:** a bounded latency study that captures where the stalled call
actually goes — whether the model stream stalls without producing tokens, whether a
per-attempt deadline is missing beneath the node deadline, and whether the stall correlates
with output size. That is a targeted diagnostic, not another run of the same suite.

### ACT intent evaluation — 10/10

Separately, the ACT interpretation suite passed in full this run, `external_mutations: 0`,
no execution adapters involved: `jira_inspect`, `jira_transition_comment`, `jira_assign`,
`calendar_inspect`, `calendar_inspect_unconfigured`, `calendar_act`, `protected_deadline`,
`ambiguous_task`, `unsupported_admin`, `unconfigured_issue`.

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

## 14. Jira — prior-session live proof

**Proven live in the prior Codex session:**

| Item | Live-proven value |
|---|---|
| Corrected action ID | `2fb80178368ef87dca07d8aa0f49c8204d90640207231de8b4a514ca4fd52fb4` |
| Target | `SCRUM-6` |
| Exact comment text | `Backend engineer unavailable.` |
| Acknowledged comment ID | `10000` |
| Independent listing before replay | HTTP 200, exact matching count **1** |
| `SCRUM-6` status | `Blocked` |
| Same-key replay | same action ID; no Agent 6 invocation; no new action-request event; receipt timestamps unchanged; attempted-operation count unchanged; no additional Jira POST; exact matching count still 1; comment ID still 10000; status still Blocked |

**Prior-session live proof; current-session read-only re-verification unavailable.** This
run performed no Jira request of any kind — no read, no write, no replay. The proof above
stands on the prior session's live evidence and is **not** downgraded; it simply could not
be re-read from here.

---

## 15. Canonical immutability — verified this run

Read live from Firestore and from the deployed backend:

| Required invariant | Observed | Result |
|---|---|---|
| Incident | `incident-0fc3af5b0bd1ad847aea` | match |
| Revision | `16` | match |
| Durable workflow events | `28` | match |
| Status | `objective_restored` (stage `RESOLVED`) | match |
| Active plan revision | `2` | match |
| **Canonical document fingerprint** | **`4a1c93385b5b24060c31e995c521455622f1582967c615a2a7a7021e7f13fa8c`** | **match — unchanged** |

### 15.1 Correction to the previous audit

The previous closure report claimed `4a1c…` was "the document SHA-256 of the P2C/P2E
markdown records" and proposed replacing it with `912ae…`. **That was wrong, and it is
retracted here.** `4a1c…` is the fingerprint of the canonical Firestore incident document,
which is exactly what the historical qualification recorded. It was recomputed this run
from live Firestore using the original function and matches bit-for-bit. The historical
proof was correct and is not rewritten.

### 15.2 The two values, computed like-for-like

Both are SHA-256. They hash **different objects**, so both legitimately coexist.

| | `4a1c9338…` | `912ae928…` |
|---|---|---|
| Name | Canonical incident **document** fingerprint | Operator **snapshot** fingerprint |
| Source | `scripts/run_p2c_live_qualification.py:64–66` | `objective_recovery_agent/operator_context.py:110–113` |
| Exact input | The raw Firestore incident document returned by `FirestoreWorkflowLedger.load_incident()` | A derived presentation structure: `incident_id`, `revision`, `objective_id`, `protected_deadline`, `recovery_attempts`, `facts`, `evidence` |
| Hashes the document itself? | **Yes** — the stored Firestore document | **No** — a derived Operator snapshot built from `RecoveryCaseView` + `ExecutionEventsView` |
| Excluded fields | none | everything not in the `material` tuple above |
| Serialization | `json.dumps(value, sort_keys=True, separators=(",",":"), default=str)` | `json.dumps(material, sort_keys=True, default=model_dump)` |
| Ordering | `sort_keys=True` | `sort_keys=True` |
| Separators | compact `(",", ":")` | Python defaults |
| Algorithm | SHA-256 hex | SHA-256 hex |

`4a1c…` is the canonical invariant required by the GO bar and it is unchanged.
`912ae…` is an additional derived value, recorded separately: it was reproduced this run
from the **live** payloads and from the **committed** fixtures, both giving the identical
result, and it matches every historical trace in `artifacts/p2f-agent-eval-traces.json`.
Live backend, committed fixtures and historical traces therefore all agree.

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

1. **Root-cause `simulate_ci`.** Not another ceiling raise — a targeted diagnostic that
   captures where the stalled Agent 7 call goes: whether the model stream stalls without
   emitting tokens, whether a per-attempt deadline is missing beneath the node deadline,
   and whether the stall correlates with output size. Section 12.2 sets out why a third
   constant is not the answer and what evidence would change that.
2. **Re-run the 8-case regression exactly once** after a root-caused fix, then formal
   grading.
3. **Re-verify the live external state read-only** from an environment with a product
   session: Jira `SCRUM-6` status, exact comment text, exact matching count, comment ID;
   and the dedicated Calendar event's 16:00–17:00 IST window with its `reflow_resource`
   marker, confirmed and non-recurring. This is confirmation of already-proven state, not
   re-proof.
4. **Capture the browser Operator regression** in an authenticated session, and exercise a
   Viewer-role ACT denial if a Viewer session already exists.

No Git push was performed. Public synchronization remains gated on a FINAL GO.

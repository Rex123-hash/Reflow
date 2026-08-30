# Reflow — submission notes

One source of truth for submission copy, so the same numbers and the same claims appear everywhere. Every figure here is verifiable in this repository or in the linked proof records.

**Live product:** https://reflow-objective-recovery.web.app

---

## Short description

Reflow is an autonomous objective recovery engine — a closed loop, not an assistant. Most project tools help teams manage a plan; Reflow takes over when reality breaks the plan. The trigger is the world rather than a prompt: a Gmail watch fires or CI answers, and the engine interprets what happened, works out what the objective still needs, executes only what deterministic policy authorizes, and proves the outcome by reading the external system back. If the objective is still unhealthy it reopens itself, replans and acts again. Eight Gemini agents sit inside that loop and propose; they hold no tools, credentials or execution authority.

**One line:** Gemini reasons. Code enforces. Adapters act. Verifier proves.

**Say this, not that.** Reflow is an engine that contains AI, not an AI that answers questions. The canonical recovery involved zero human steps. Operator (type, talk, show) is a window onto the loop and a bounded control surface — never describe it as the product. The specification lists *generic chatbot* as an explicit non-goal.

---

## The problem

A plan encodes assumptions, and reality invalidates them constantly. Project tools record the damage without forming an opinion about whether the objective is still reachable. Automations execute the scripted step regardless of whether it helps, and report success because the API call returned `200`.

Both treat task completion as the unit of truth. Nobody checks whether the outcome actually held.

---

## The solution

Reflow treats objective restoration as the unit of truth, which requires two things ordinary automation does not do.

**It separates proposal from authority.** Eight Gemini agents produce schema-validated structured output and nothing else. No tool access, no credentials, no execution authority. Deterministic Python decides what may run.

**It verifies twice.** After a write, a separate request re-reads the provider and compares expected against observed. Then the objective's own invariants are evaluated over recorded state. A verified action is not a recovered objective, and Reflow reports them separately.

---

## Technologies

| Component | Role |
|---|---|
| Gemini 3.7 Flash on Vertex AI | All eight reasoning agents, structured output with schema validation |
| Google ADK 2.7.1 | Agent definition, workflow orchestration, node-level timeouts |
| Google GenAI SDK | Gemini Live for spoken turns, transcription, and inline image bytes |
| Cloud Run | Public authenticated BFF, and the private recovery backend with no public ingress |
| Cloud Pub/Sub | Authenticated push delivery of disruption events, idempotent on redelivery |
| Firestore | Incidents, revisions, workflow events, action claims, receipts, evidence |
| Secret Manager | Every adapter credential, backend-side only |
| Firebase Hosting and Auth | The built product, SPA rewrite, security headers, product identity |
| Gmail, Calendar, Jira, Slack, GitHub APIs | Real operational evidence in, real bounded change out |
| React 19, Vite, TypeScript | The product surface |

---

## Architecture summary

Two ways in, one governed core.

**The engine path, which needs no person.** A Gmail watch fires and Cloud Pub/Sub delivers an authenticated push straight to the private recovery backend. Four durable stages then hand off to each other over Pub/Sub — interpret, plan and act, validate against CI, then verify or reopen — each writing durable state before publishing the next handoff.

**The human path.** Firebase Hosting serves the build and Firebase Auth issues the product identity, exchanged once for a short-lived `HttpOnly` session cookie. An authenticated BFF on Cloud Run is the only public surface; it enforces origin, path and workspace allowlists and reaches the same private backend with an audience-bound service identity. The backend has no public ingress and is reachable only by IAM.

Inside it, eight ADK-orchestrated Gemini agents propose. Deterministic control decides, adapters act on Calendar, Jira, Slack and GitHub, and Gmail is read-only. Every effect is independently read back, then objective invariants are evaluated. Firestore holds durable state and evidence. Failing invariants reopen the incident and replan.

---

## Strongest workflow — the canonical recovery

Recorded in [`p1e-proof.md`](p1e-proof.md). From the moment the email arrived, no human invoked a notification, an endpoint, a planner, an action, a continuation, a state change, a plan selection or a resolution.

An email reported the backend lead unavailable. Gemini classified it as a real disruption affecting the API migration and the Release V2 objective. Reflow mapped the blast radius, planned, and executed a Calendar coordination change plus GitHub release validation for Candidate A.

The Calendar action was verified. The objective was not restored — Candidate A failed CI, so `release-validation-green` stayed false. Reflow reopened the incident, excluded the failed effect by fingerprint so it could not replan into the same dead end, produced Candidate B, validated and promoted it, and confirmed it by independent GitHub read.

| | |
|---|---|
| Incident | `incident-0fc3af5b0bd1ad847aea` |
| Final state | `RESOLVED / objective_restored`, revision 16 |
| Durable workflow events | 28 |
| Recovery attempts | 2, the first action-verified and rejected |
| Invariants passed | 6 of 6 |
| Email to resolution | about 111.5 seconds |

---

## Multimodal capability

**Type.** The Operator console takes a question or a request. Agent 6 classifies it into a typed intent; policy decides whether anything may execute.

**Talk.** A live bidirectional Gemini Live call with real barge-in. Credentials are short-lived, model-locked and audience-bound; the browser never receives a durable key. Dictation composes into the same field and never submits on its own. Gemini Live is a model capability, not a ninth agent.

**Show.** Upload, drag or paste a screenshot. The endpoint validates signature, declared type, decoder agreement, frame count and dimensions before Agent 8 sees anything. The answer separates observed from inferred from not visible.

Two boundaries hold: visual evidence is not authoritative live system state, and text inside an image is not user authorization. A mutation-shaped request arriving through the image path becomes a no-action result that points at the typed Operator.

---

## Secondary workflows the demo cannot show

- **Bounded Slack posting.** One authorized message to a configured channel, acknowledged, independently read back, verified only after exact comparison, and replay-safe under the same idempotency key.
- **Jira transition under policy.** A real issue transition with a separate `GET` confirming the resulting state.
- **Calendar reschedule with conditional write.** A conditional `PATCH` followed by an independent `GET`.
- **Gmail watch maintenance.** Daily watch renewal and periodic reconciliation that preserve the history cursor and cannot initiate recovery.
- **Simulation.** Agent 7 produces hypothetical futures explicitly marked as not real, with no external effect.
- **Demo workspace.** An anonymous read-only mode served from a bounded sanitized dataset, where every mutation is rejected before reaching the backend.

---

## What we are proud of

**The failure path is the product.** Most agent demonstrations show a happy path. Reflow's strongest recorded run is one where the first recovery succeeded at the action level and was still rejected, because the objective had not recovered. Building a system that will tell you it changed something and still failed is harder, and more useful, than one that reports success.

**Authority is structural, not textual.** There is no prompt asking the model to behave. There is no code path where model output becomes a provider request without passing a typed contract and a deterministic policy gate first.

**Two verification layers, not one.** Read-back proves the action. Invariants prove the objective. Conflating them is the most common way an agent system overstates what it did.

**Truth discipline in the interface.** The product refuses in plain language and says what it did not do. The Operator screenshot in the README is a refusal, on purpose.

**Replay safety that was tested live**, not just unit-tested — a repeated request returned the same durable action and the same timestamps without reaching the provider.

---

## Limitations and truth-safe notes

- Not every parsed request is authorized; Agent 6 can classify an intent that policy refuses.
- Visual evidence is not live system state, and image text cannot authorize anything.
- Capability is bounded to configured resources, not arbitrary issues, channels or calendars.
- Gmail is read-only, enforced by exact scope-set comparison.
- Calendar event creation is implemented and tested, with no live qualification record yet.
- The Jira comment operation failed its live attempt and is not claimed as qualified.
- Voice is deployed and unit-tested; its live-call evidence boundary is narrower than the Calendar, Slack, Jira, GitHub and Gmail proofs.
- A verified action does not imply a recovered objective.
- Provider and model services carry their own availability and quota behavior.

**Do not write** "fully autonomous operations platform", "self-healing infrastructure", or any phrasing implying Reflow can act on arbitrary systems. It acts on configured resources under policy, and says so.

---

## Quality gates

| Gate | Result |
|---|---|
| Backend tests | 544 passing, 1 skipped, 1 known-stale frozen-baseline guard |
| Coverage | 95.35%, gate 95% |
| `mypy` strict | Clean, 56 source files |
| `ruff check` | Clean on `src`, `tests`, `objective_recovery_agent` |
| Frontend tests | 161 passing across 19 files |
| Frontend typecheck, lint, format, build | Clean |

The stale guard pins thirteen paths against commit `6b9b6f1`. Twelve are byte-identical; the only divergence is a two-line design-token substitution in a frontend presentation component. State it as a stale guard, never as "all tests green".

---

## Demo talking points

0. **Say what it is first.** Reflow is an engine that protects an outcome, with AI inside it. Nothing in the demo was asked for.
1. **Open on the failure.** Recovery 01 is action-verified and still marked FAILED. Say the line: an action can be verified and the objective still not be recovered.
2. **Show the branch.** Recovery 02 branched from the failed attempt, with the failed effect excluded so it could not repeat it.
3. **Show the receipt.** Evidence carries the external reference and the independent read-back, not just a log line.
4. **Ask Operator why.** A plain-language answer first, technical provenance underneath, and an explicit statement that nothing was changed.
5. **Ask for something unsupported.** The product refuses and says no action was taken. That refusal is the architecture, visible.
6. **Show it a screenshot.** Observed, inferred and not-visible are three separate columns, and the handoff says nothing was acted on.
7. **Close on authority.** Eight agents propose. Code decides. Adapters act. The verifier proves.

---

## Links

| | |
|---|---|
| Live product | https://reflow-objective-recovery.web.app |
| Repository README | [`../README.md`](../README.md) |
| Security architecture | [`../SECURITY.md`](../SECURITY.md) |
| Architecture detail | [`architecture.md`](architecture.md) |
| Canonical recovery proof | [`p1e-proof.md`](p1e-proof.md) |
| Controlled action proof | [`p2g-controlled-operator-act-final.md`](p2g-controlled-operator-act-final.md) |
| Slack capability proof | [`p2h-slack-operator-capability.md`](p2h-slack-operator-capability.md) |
| Conversation intelligence | [`p2i-conversation-intelligence.md`](p2i-conversation-intelligence.md) |
| Multimodal backend | [`show-reflow-multimodal-backend.md`](show-reflow-multimodal-backend.md) |
| Web access architecture | [`p2d-web-access-architecture.md`](p2d-web-access-architecture.md) |

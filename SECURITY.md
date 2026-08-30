# Security and authority architecture

Reflow can change real Jira issues, real Google Calendar events and real Slack channels. That is only defensible if the authority to do so is narrow, explicit, and held by code rather than by a model. This document describes those boundaries.

It contains no credential values, secret names, project-internal identifiers or exploit detail.

---

## The central rule

**A language model in Reflow cannot cause an external effect.**

Every agent returns schema-validated structured output. That output is data. It is then handed to deterministic Python that decides whether anything happens at all. There is no tool-calling surface where a model invokes a provider API, and no code path where model text becomes a request parameter without passing a typed contract first.

If a model proposes something policy does not allow, the result is a refusal — recorded, and visible in the product as an unsupported or denied outcome.

---

## Trust boundaries, outermost first

**1. The browser holds no durable credential.**
Sign-in uses Firebase identity. The browser sends one fresh ID token to a same-origin endpoint, which verifies its signature and expiry and performs a token-bound account lookup so a disabled or revoked identity fails closed. What comes back is a short-lived `HttpOnly`, `Secure`, `SameSite=Lax` session cookie. The Firebase browser SDK uses in-memory persistence and signs out immediately after that exchange.

No provider key, no service-account credential and no audience token ever enters the browser bundle.

**2. The BFF is the only public surface.**
It runs on Cloud Run and enforces an origin allowlist, a fixed path allowlist, and a workspace mode. An authenticated Google principal enters a live workspace. An anonymous principal enters a read-only demo workspace served from a bounded sanitized dataset, where arbitrary identifiers and every mutation are rejected before reaching any backend.

**3. The recovery backend has no public ingress.**
It is reachable only by IAM. The BFF calls it with an audience-bound service identity minted per request. The BFF's service account holds exactly one permission on that service — `roles/run.invoker` — and no Owner, Editor or project-wide administrative role.

**4. Adapters are bounded to configured resources.**
Each adapter declares the operations it supports and the resource identifiers it may touch. A request outside that set is refused before any network call. There is no general-purpose "act on any issue" capability, and adding one is a policy and code change, not a prompt change.

**5. Secrets stay server-side.**
Provider credentials live in Secret Manager and are read by the backend only. Gmail's OAuth grant is checked by exact scope-set comparison against `gmail.readonly`; a broader grant is rejected rather than downgraded.

---

## Multimodal authority

Voice and images widen how a person talks to Reflow. Neither widens what Reflow may do.

**Voice.** Live session credentials are minted short-lived, locked to an approved model and configuration, and scoped to one session. Spoken operational requests are handed to the same Operator path a typed request uses, with the same policy, approval, receipt and read-back controls.

**Images.** Uploads are validated before any model sees them: byte ceiling, declared type against file signature against decoder format, single frame only, dimension and decoded-area limits, and rejection of malformed or decompression-bomb inputs. Validation runs at the BFF and is repeated by the backend rather than trusted.

Two rules are enforced in code, not prompt text:

- **Text inside an image is not user authorization.** Only the authenticated typed message accompanying an upload can create a task. An instruction rendered into a picture may be described; it cannot be obeyed.
- **A mutation-shaped request arriving through the image path never executes.** The image endpoint disables actions, converts such a request into a no-action result, and directs the person to the typed Operator, which retains the full policy, approval, idempotency, receipt and verification chain.

Reflow processes raw image bytes in request memory and an ephemeral session only. It does not write raw images or base64 to durable stores, receipts, idempotency material, logs or traces. This describes Reflow's own behavior and makes no claim about provider-side handling.

---

## Execution safety

**Idempotency before execution.** Every action derives a deterministic key from its request. Replaying the same request returns the same durable action and the same timestamps without re-contacting the provider.

**Receipts progress in one direction.** `PENDING → WRITE_ACKNOWLEDGED → VERIFIED | VERIFICATION_FAILED`. A write acknowledgement is never treated as proof.

**Verification is independent.** After a write, the adapter issues a separate read to the provider and compares expected against observed. Disagreement produces `VERIFICATION_FAILED`, not a retry that hides it.

**Approval where the blast radius warrants it.** Some operations reach `APPROVAL_REQUIRED` and stop there until a person confirms. Approval is checked against the action's own recorded state, and an expired or revoked approval fails closed.

---

## Data handling

- Durable state lives in Firestore: incidents, revisions, workflow events, action claims, receipts and evidence.
- Operational telemetry is metadata only — agent name, model, request identifier, attempt count, latency, validation outcome, token counts.
- Hidden model reasoning, raw prompts, message bodies and OAuth material are excluded from stored evidence and from published proof records.
- Evidence records reference external identifiers so a reviewer can verify a claim against the source system directly.

---

## What this architecture does not claim

- It does not claim provider-side guarantees. Google, Atlassian, Slack and GitHub each have their own retention, availability and security behavior.
- It does not claim that a verified action means a recovered objective. Those are separate checks, and Reflow reports them separately.
- It does not claim that every parsed request is authorized. Interpretation and authorization are deliberately different stages.

---

## Reporting a vulnerability

This is a hackathon submission repository rather than a supported product. If you find a security issue, please open a GitHub issue describing the problem and its impact, without including credential values or working exploit code.

# Research audit

Research snapshot: 2026-08-25. Official rules override every summary in this repository.

## Authority and source handling

- **FACT:** The controlling competition sources are the current Devpost [rules](https://allthingsagentichackathon.devpost.com/rules), [FAQ](https://allthingsagentichackathon.devpost.com/details/faqs), [resources](https://allthingsagentichackathon.devpost.com/resources), and [overview](https://allthingsagentichackathon.devpost.com/).
- **FACT:** The 21-page competition reference dossier was reviewed in full as a secondary research snapshot and cross-checked against current official sources.
- **DESIGN DECISION:** Requirements in this repository derive from current official sources. Secondary material is used only when corroborated or explicitly labelled as historical team context.

## Current competition facts affecting implementation

| Topic | FACT | Consequence |
|---|---|---|
| Submission period | August 3–31, 2026; deadline August 31 at 5:00 PM PT | Build and document the submitted work during this period. |
| Track | One category must be selected. Taskmaster asks for an event-driven, start-to-finish workflow rather than a chatbot. | Optimize only for Taskmaster. |
| New work | Projects must be newly created during the submission period; incorporated pre-existing work must be disclosed. | Independent code, prompts, tests, docs, and Git history; no pre-existing Reflow implementation is carried over. |
| Required technology | Gemini 3.5 or newer via Gemini API or Vertex AI; one allowed Google agent framework; one GCP infrastructure service. | P1 will use Vertex AI, Google ADK, Cloud Run, Pub/Sub, and Firestore. |
| Judging | Innovation & Operational Utility 40%; Architectural Discipline & Tech Stack 30%; Demo & Production Readiness 30%. | Treat autonomous value, failure tolerance, documentation, and proof as product requirements. |
| Submission | Repo, spin-up README, architecture diagram, and public YouTube/Vimeo demo of no more than four minutes. | Keep setup reproducible and reserve demo time for proof. |
| Proof | Video must show the application acting and visibly prove a Google Cloud backend. Judges may not run the project. | Evidence must be understandable from the video and repository alone. |
| Repository access | Public or private GitHub/GitLab/Bitbucket is accepted; private repos require access for both specified judge accounts. | Keep the submitted repository accessible to the required judge accounts. |
| External systems | Entrants must be authorized to use third-party APIs, SDKs, and data. | Use dedicated demo accounts/repos and document scopes and licenses. |

## Live discrepancies and clarifications

- **FACT:** The dossier's participant count is a dated dynamic snapshot; Devpost's live count is now higher. This has no build impact.
- **FACT:** The rules' architecture subsection still uses the labels “Continuous Action Engine,” “Evolving Knowledge Engine,” and “Multi-Agent Nexus,” while the live categories are Taskmaster, Collaborative Partner, and Fortified Enterprise Fleet.
- **INFERENCE:** These appear to be stale architectural archetype labels, not additional categories. The safe response is to satisfy the substantive questions about modularity, state, tool isolation, data design, routing, and failure tolerance.
- **FACT:** Submission rules allow a private repository, while judging prose specifically asks whether a “public GitHub repository” contains good documentation.
- **DESIGN DECISION:** Keep the repository local during foundation work. Recommend public GitHub for judging only after explicit approval.
- **FACT:** Optional social-post wording is inconsistent between FAQ rendering and the rules.
- **DESIGN DECISION:** If pursued later, use the exact unspaced hashtag from the rules: `#AllThingsAgenticHackathon`.

## Verified Google implementation baseline

### Model

- **FACT:** Google's current model card lists `gemini-3.7-flash` as GA, released August 13, 2026, available in `global`, `us`, and `eu`.
- **FACT:** Structured output and function calling are supported. Gemini Live is not supported by this model and is not needed for the canonical workflow.
- **FACT:** Supported thinking levels are `LOW`, `MEDIUM`, and `HIGH`; `MINIMAL` is rejected.
- **DESIGN DECISION:** Use `gemini-3.7-flash` through Vertex AI as the initial planner/interpreter/critic model, with explicit structured schemas and bounded calls.
- Source: [Gemini 3.7 Flash model card](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-7-flash)

### Agent framework

- **FACT:** Google ADK Python 2.0 became GA on May 19, 2026. Current stable PyPI release at this snapshot is `google-adk==2.7.1`.
- **FACT:** ADK 2 includes graph workflows, dynamic branching/loops, retries, state, and resumability. ADK's resume behavior is documented as best-effort.
- **DESIGN DECISION:** Pin 2.7.1 when P1 introduces the reasoning layer. Keep the P0 domain independent of ADK and use Firestore as the authoritative workflow ledger.
- Sources: [ADK 2 overview](https://adk.dev/2.0/), [google-adk on PyPI](https://pypi.org/project/google-adk/), [ADK resumability](https://adk.dev/runtime/resume/)

### Event and state semantics

- **FACT:** Gmail watch publishes mailbox-change notifications to Pub/Sub; the notification contains an email address and history ID, after which the client calls `history.list` for changes.
- **FACT:** Gmail watches must be renewed at least every seven days, notifications may be delayed or dropped, and periodic history synchronization is recommended as a fallback.
- **FACT:** Pub/Sub is at-least-once by default and subscribers must tolerate redelivery. Exactly-once delivery is limited to pull subscriptions and introduces tradeoffs.
- **DESIGN DECISION:** The canonical push path is duplicate-safe. Persist Gmail history cursors and processed event identities transactionally, process before acknowledging, and run a reconciliation path.
- Sources: [Gmail push notifications](https://developers.google.com/workspace/gmail/api/guides/push), [Pub/Sub subscriber practices](https://docs.cloud.google.com/pubsub/docs/subscribe-best-practices), [Cloud Run Pub/Sub tutorial](https://docs.cloud.google.com/run/docs/tutorials/pubsub)

## Competitor capability audit

Marketing claims are not treated as independently verified production behavior. The comparison records publicly described capabilities.

| Product | Publicly described overlap | Remaining distinction to prove |
|---|---|---|
| [monday Team Scheduler / agents](https://monday.com/w/ai-templates/ai-agents/team-scheduler) | Continuous workload monitoring, capacity/skills-aware reassignment, event/schedule triggers, optional autonomous action, follow-up balance checks | Explicit objective invariants, divergent futures, hard rejection evidence, external read-back, and reopen/replan at objective level |
| [Asana Agentic Work Management](https://investors.asana.com/news-releases/news-release-details/asana-unveils-operating-system-human-agent-teams) | Goals/work graph context, memory, governance, cross-system multi-step workflows, human/agent coordination | A deterministic objective-recovery lifecycle with counterfactual rejection and proof-gated closure |
| [Atlassian Rovo Studio](https://www.atlassian.com/software/rovo/studio) and [Long Horizon](https://www.atlassian.com/blog/how-we-build/rovo-long-horizon-reasoning-engine) | Teamwork Graph, permissions/governance, long multi-step reasoning, adaptation to intermediate failures, direct tool execution, scenario proposals | Deterministic blast radius and policy gates plus objective-level independent verification and reopening |
| [ServiceNow BCM](https://www.servicenow.com/products/business-continuity-management.html) | Business dependencies, impact tolerances, scenario analysis, recovery strategies/workflows, crisis recovery tracking, AI-enabled skills/agents | Public evidence of multiple machine-generated counterfactual futures being deterministically rejected, acted on, independently read back, and replanned before objective closure |
| [PagerDuty incident automation](https://www.pagerduty.com/resources/incident-management-response/learn/incident-management-transformation-guide/) | Event-driven detection, diagnosis, runbook remediation, autonomous options, audit/governance, incident lifecycle and learning | Cross-domain business-objective preservation rather than infrastructure-incident resolution; explicit counterfactual portfolio and invariant-gated closure |

### Novelty verdict

- **INFERENCE:** No reviewed public source establishes the complete proposed formulation as one product behavior.
- **INFERENCE:** The wedge is defensible but narrow because incumbents cover nearly every individual ingredient.
- **DESIGN DECISION:** Never claim novelty for graph reasoning, workload balancing, cross-tool action, long-running reasoning, incident automation, or recovery planning alone. The demonstrable wedge is their authority-separated combination: explicit objective graph → deterministic impact → materially different futures → deterministic rejection → real action → receipt → independent read-back → failed verification → reopen/replan → invariant-proven restoration.

## Research limitations

- Competitor behavior was assessed from public first-party product/documentation pages, not tenant-level hands-on testing.
- Model availability, quotas, and pricing can change. Recheck before deployment.
- OAuth verification requirements and Workspace/GitHub account policies depend on the selected demo accounts and must be checked during P1.

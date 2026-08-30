# Hackathon compliance matrix

Status values are **implemented**, **planned**, and **owner action**. No planned item is claimed as working.

| Requirement / scoring proof | Status | Implementation or plan | Evidence target |
|---|---|---|---|
| Newly created project | implemented | Fresh folder, source, tests, docs, and independent Git history | Repository history |
| Original work | implemented | Built during the submission period; no pre-existing Reflow implementation or repository history is carried over. Third-party libraries and frameworks are used as permitted | Source tree and Git history |
| One track | implemented | Taskmaster only | README and Devpost selection |
| Gemini 3.5+ | implemented | Vertex AI `gemini-3.7-flash`; real smoke, experiment, eval, and live workflow | Firestore tokens/latencies and eval trace |
| Google agent framework | implemented | Google ADK Python 2.7.1 planner and critic workflows | Lockfile, agent code, execution trace |
| GCP infrastructure | implemented through P1B | Private Cloud Run, OIDC Pub/Sub push, Firestore, DLQ, Artifact Registry, Calendar API | Terraform and real-cloud proof |
| Event-driven background workflow | implemented through P1B | Canonical Pub/Sub event → Cloud Run → Firestore → authorized Calendar action/read-back | Correlated live event, durable events, and verified receipt |
| Autonomous multi-step action | implemented for P1B after live proof | Impact, three futures, critique, policy, stable selection, typed Calendar authorization, real write, durable receipt, separate read-back | `VERIFYING` incident plus `VERIFIED` action receipt |
| BYOF / distinctive friction | implemented in design | Preserve an endangered release objective for a small software team | Product spec and demo narration |
| Failure-tolerant architecture | implemented through P1B scope | Transactional dedupe, retries, DLQ, stable external identity, crash/restart adoption, monotonic receipts | Tests, Cloud Run trace, and Firestore records |
| Repository URL | owner action | No remote may be created without approval | Devpost field |
| Hosted URL if available | implemented privately | Cloud Run URL exists but requires authenticated invocation | Devpost field / `.run` proof |
| Spin-up README | foundation implemented | Local foundation commands now; cloud instructions added with P1 | `README.md` |
| Architecture diagram | implemented | Mermaid system and lifecycle diagrams | `docs/architecture.md` |
| Public ≤4-minute video | owner action | Record after vertical slice and deployment are real | Public YouTube/Vimeo link |
| Live action in video | real P1B action proven; owner recording pending | Real Calendar action and independent read-back; GitHub CI remains P1C | Unedited screen evidence |
| Visible Google Cloud proof | implemented; owner recording pending | Cloud Run, Vertex AI, Firestore, and Calendar trace | Video before services are stopped |
| English materials | implemented/planned | Repository is English; video will be English/subtitled | Repo and video |
| Third-party authorization | owner action | Dedicated authorized demo accounts/repo; follow GitHub/Google terms | Account configuration and disclosure |
| Optional public technical content | deferred | Only after core path is stable | Public URL if pursued |
| Optional social post | deferred | Use exact rules hashtag if pursued | Public URL if pursued |
| Optional extra Google model | deferred | Add only if meaningful and functional | Real invocation/evaluation evidence |

## Real versus emulated

| Surface | Foundation | Judged P1 target |
|---|---|---|
| Objective graph/policy/lifecycle | Real deterministic code | Same code backed by durable state |
| In-memory adapters | Explicitly `EMULATED`; tests only | Never shown as external proof |
| Pub/Sub / Cloud Run / Firestore | Real P1A deployment | Authenticated delivery, durable state, transactional dedupe |
| Gemini / ADK | Real P1A execution | Typed Vertex AI planner bundle and risk critic |
| Gmail | Not implemented | Real authorized mailbox watch/history |
| Calendar | P1B implemented and proven in the real dedicated calendar | Real authorized mutation, durable `VERIFIED` receipt, independent read-back, idempotent replay |
| GitHub | Not implemented | Real demo repo webhook/CI state and API read-back |

## Disqualification and claim controls

- Do not edit the submitted repo/video/app during judging; work in a fork after the deadline.
- Never show generated or emulated receipts as external proof.
- Do not claim a deployment, integration, action, benchmark, user, or impact without recorded evidence.
- Do not expose credentials, private email content, or hidden model reasoning in the repository or demo.
- Recheck official rules, model availability, repository access, demo visibility, and all links immediately before submission.

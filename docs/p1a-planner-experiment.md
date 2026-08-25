# P1A planner architecture experiment

Date: 25 August 2026. Project: `project-f334c42b-7a03-4194-932`. Model:
Vertex AI `gemini-3.7-flash`, global endpoint, low thinking. Runtime: Google ADK 2.7.1.

The same canonical backend-lead-unavailable incident and typed planning context were used for
all variants. Each result crossed the same Pydantic schemas and was followed by the same typed
risk critic. Diversity is one minus Jaccard similarity over `action_type:target` signatures.
Cost estimates use the introductory $0.75/M input and $3.75/M output token rates and exclude
negligible Cloud infrastructure charges.

| Architecture | Planner / E2E latency | Tokens (in / out / total) | Pairwise action diversity | Schema | Estimated model cost |
|---|---:|---:|---|---|---:|
| A: 3 parallel perspective workflows | 7.570 s / 15.208 s | 6,599 / 1,770 / 8,369 | 0.000, 1.000, 1.000 | pass | $0.01159 |
| B: 1 diverse-bundle workflow | 15.408 s / 27.722 s | 3,698 / 2,265 / 5,963 | 0.667, 0.333, 0.750 | pass | $0.01127 |
| C: seed then expand | 16.745 s / 24.088 s | 3,684 / 1,848 / 5,532 | 1.000, 1.000, 1.000 | pass, semantically invalid IDs | $0.00969 |

## Findings

- A had the best latency and isolates planner failures, but deadline-first and risk-first both
  reduced to the same `reassign_work_item:work-api-migration` action. Perspective prompts alone
  did not guarantee materially different futures in this trial.
- B created three operationally distinct futures: concentrated deadline preservation, migration
  plus QA verification, and balanced distribution across migration/tests/release notes. Its
  minimum pairwise diversity was 0.333 and mean diversity was 0.583. It used 29% fewer total
  tokens than A and presents the clearest planner-then-critic demo story.
- C looked maximally diverse by signature, but the second call lost the authoritative planning
  context and invented task/person IDs. Typed shape reliability is not semantic reliability;
  deterministic validation correctly makes this design unsuitable.

## Decision

Deploy B. It best satisfies the success condition that alternatives be materially different,
not paraphrases. Production code requires exactly the three named strategy types and rejects a
bundle when any action-signature pair has diversity below 0.25. Architecture A remains in code
as an evaluated fallback and for partial-planner-failure tests.

This is one controlled trial per architecture, so latency and output diversity are directional,
not statistically stable benchmarks. The real Pub/Sub-to-Firestore run supplies the decisive
deployment measurement.

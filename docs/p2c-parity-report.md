# P2C deterministic parity report

This report compares semantic contracts and deterministic outcomes, not nondeterministic model
wording. The “after” evidence is produced entirely by fixtures, unit/integration tests, and
read-only contract validation; no external recovery action was replayed.

| Frozen scenario / boundary | Before-P2C semantic authority | After-P2C evidence | Result |
|---|---|---|---|
| irrelevant Gmail | terminal irrelevant classification; no disruption publication | irrelevant facts bypass Impact Analyst and retain the same final `GmailInterpretation` shape | parity |
| canonical disruption | grounded excerpts and known graph node IDs required | interpreter facts plus impact candidates must pass the same excerpt, node, graph, and objective checks | parity |
| P1A initial planning | three materially different candidates, separate critique, deterministic policy/selection | planner/critic output contracts and downstream code are unchanged | parity |
| P1C failure state | verified actions do not imply objective restoration | verifier and state-machine tests remain unchanged and green | parity |
| P1D replan | failed invariant/effect evidence, emergent candidate, failed-repeat rejection, stable selection | typed analysis carries exact invariant/evidence/fingerprint; existing policy/selection remains final | parity |
| P1E canonical read-only state | incident `incident-0fc3af5b0bd1ad847aea`, Recovery 01 failure, Recovery 02 success, six closure invariants | historical checkpoints are not mutated; legacy planner checkpoints bypass new analysis; presentation fixtures validate | parity |
| P2B presentation contract | exact evidence joins, proposal-only assignment truth, no hidden reasoning, stable OpenAPI | presentation tests and stored OpenAPI equality check pass with no presentation/frontend edits | parity |

Externally meaningful semantic change: **none**.

The only runtime changes are the two typed reasoning boundaries described in
[`p2c-agent-boundaries.md`](p2c-agent-boundaries.md). Neither added output can authorize an action,
override deterministic graph truth, select a plan, verify a receipt, or restore an objective.

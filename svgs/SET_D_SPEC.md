# Reflow SVG Set D — Three Futures / Counterfactual Recovery System

Set D defines the visual language for:

`one threatened objective → multiple candidate futures → deterministic policy evaluation → selected recovery path`

It is intentionally built to support **1–3 real candidates**.

The canonical cinematic demo may show three futures because it communicates counterfactual reasoning best, but the production component must not manufacture candidates the backend did not actually return.

## Included assets

### `three-futures-branching-system.svg`
Full three-candidate hero composition:
- persistent objective hub
- three candidate routes
- brass evaluation markers
- rejected / selected decision hierarchy
- premium cards and labels for visual reference

### `candidate-lifecycle-states.svg`
Candidate states:
- considering
- valid
- rejected
- selected
- unavailable / failed planner perspective

### `deterministic-policy-gate.svg`
Visualizes the rule:
**Gemini proposes. Code decides whether a future is legal.**

Example hard checks:
- workload
- deadline
- skills
- protected commitments

### `selected-route-convergence.svg`
Shows how rejected alternatives remain auditable while the selected route consolidates into one strong execution path.

### `adaptive-candidate-topology.svg`
Reference layouts for 1, 2, and 3 candidates.

### `future-branch-motion-grammar.svg`
Defines the visual transitions:
- dormant
- appearing
- evaluating
- rejected
- valid
- selected
- converged

## Production architecture

Cards remain DOM.

Paths remain inline responsive SVG.

Recommended flow:

1. DOM future cards expose anchors.
2. `ResizeObserver` measures each candidate.
3. Shared story-space anchors are computed.
4. SVG branch paths are constructed from the objective anchor to each candidate anchor.
5. GSAP controls draw progress and semantic state.
6. Only the selected branch keeps full visual weight.
7. Rejected branches fade but remain visible enough to show that alternatives existed.

## Truth rules

The frozen P1B run produced three valid candidates, so the generated reference image showing two deterministic policy rejections must not be treated as factual proof.

For UI development:
- candidate topology may be demonstrated with a clearly identified preview/scenario state;
- recorded P1B evidence must preserve the real plan/policy results;
- final hackathon demo should preferably create scenario data where deterministic policies genuinely reject at least two candidates if that remains a desired cinematic beat.

## Visual hierarchy

- Forest `#1D4C39` = valid / selected / authoritative.
- Sage `#91A995` = latent / non-selected / de-emphasized.
- Brass `#B89A64` = active evaluation/proof marker.
- Failure `#A76658` = localized policy rejection terminal.
- Warning `#C49355` = constrained/risk state, not general failure.

## Motion principles

Do not reveal all decisions instantly.

Recommended semantic sequence:

1. all candidate branches draw in;
2. brief hold: all are genuinely under consideration;
3. policy evaluation begins;
4. evaluation marker travels / checks resolve;
5. rejected paths lose saturation and weight;
6. valid paths remain forest;
7. selected route gains final emphasis;
8. rejected cards remain faintly visible for auditability;
9. selected route converges toward action.

Reverse scrolling must reverse the same deterministic states.

## Accessibility

Canvas/SVG topology is decorative. The candidate list and all reasons for rejection or selection must exist in DOM source order.

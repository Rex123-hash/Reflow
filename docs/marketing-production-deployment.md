# Marketing production deployment record

| | |
|---|---|
| Source commit | `18313e6` — "Author the page-wide marketing craft pass" |
| Site | `reflow-objective-recovery` |
| URL | https://reflow-objective-recovery.web.app |
| Hosting release | `1787913951794000` |
| Hosting version | `8ff43da76d72233b` |
| Deployed | 2026-08-28T10:45:51.794Z |
| Scope | `firebase deploy --only hosting` |

## Stale build replaced

| | JS | CSS |
|---|---|---|
| Before | `index-CY4k3Nlo.js` | `index-BLyimjjt.css` |
| After | `index-ZCzwaYgh.js` | `index-BFG5iBln.css` |

The previous release (`1787906349378000`) predated Phase 1, so the live hero still
carried the demand-mode invalidation bug and the CSS ghost placeholder.

## Production verification

Captures via `frontend/scripts/visual-qa.mjs` and `motion-check.mjs` pointed at the
live URL, in fresh browser contexts.

| Check | Result |
|---|---|
| Viewports 1920 / 1440 / 1280 / tablet / 390 | all render, **CLS 0.0000**, 0 console errors |
| Normal motion, zero interaction | **23,973 px changed** over 3s — animating |
| Reduced motion, zero interaction | **0 px changed** — static and idle |
| SVG audit | 21 SVGs, **0 zero-sized**; 6 ornaments at 196×12; 1 disruption mark; 1 integration mark |
| Legacy `31` calendar placeholder | **0 occurrences** |
| Failed / 4xx requests · page errors | **0 · 0** |
| Horizontal scroll | none (scrollWidth == viewport) |
| CTA hit-testing under the orb layer | all pass — `.orb-layer` is `pointer-events: none` |
| Live Demo routing | `/` → `/app` → auth entry, both providers present |
| Guest smoke | `/app/overview` loads, "Demo workspace · Read only", restored verdict intact |
| **`/app` network isolation** | `/app` direct load: **7 requests, 0 heavy marketing** — no three, R3F, GSAP, Lenis, GLB or poster. 0 across the whole guest session. |
| Private backend anonymous | **403** (`/` and `/api/v1/ui/overview`) |
| BFF unauthenticated | **401** |

## Real GPU

Hardware capture obtained — **not** unavailable. Installed Chrome reports
`ANGLE (AMD Radeon(TM) Graphics, Direct3D11)`. Production hero on hardware is
materially consistent with the SwiftShader QA: ceramic warmth, forest enamel,
brass, satellites, grounding and the poster→WebGL transition all match.
First frame 5462 ms normal, 991 ms reduced, CLS 0.0000 both.

## Remaining debt

**Transient satellite / CTA overlap.** At some orbit phases a satellite passes
behind the hero CTA row. Non-blocking: the orb layer is `pointer-events: none`,
every CTA hit-tests correctly, the copy stays legible, and the satellites orbit
away over their 45–68 s periods.

**Forest saturation.** Reference samples `#40483e`, production renders `#173d2b`.
Decided in the craft pass: the base colour is the authored Blender value and the
gap is Blender's AgX look desaturating shadows where three's Neutral preserves
them.

# Marketing final visual audit

Authority: `REFERENCE PAGES/`. Captures produced by `frontend/scripts/visual-qa.mjs`
(headless Chromium, WebGL via ANGLE/SwiftShader), proof set in
`frontend/visual-qa/proof/`.

## Section walk

| Section | Reference gap | Change | Why | Result |
|---|---|---|---|---|
| Hero | Brass eyebrow ornament under every section eyebrow was missing entirely | Added `ReflowRule` | Without it the small-caps eyebrow floats; the reference reads as a titled plate | Matches `ref-eyebrow-ornament.png` |
| Hero | Instrument too small and too low; rails and stage labels effectively invisible | scale 0.38→0.52, pose.y 2.7→2.15, rail opacity 0.02→0.28-0.53, labels 0.17→0.90 and 9px→11.5px | Reference shows roughly half the frame height with legible PLAN/DETECT/ACT/VERIFY | `compare-hero-after3.png` |
| Hero | Satellites crossed the disc rim | Orbits moved onto the authored rails (3.78 / 4.77 / 5.44) | `AUTHORED_BODY_RADIUS` is 2.82; the inner satellite orbited at radiusZ 2.52, inside the footprint | `proof/17-satellite-orbit-clearance.png` |
| Disruption | Warning mark was a minified stock triangle in a 28px ringed disc | New `DisruptionMark`; disc 28→44px, borderless blush | Reference uses a generously rounded triangle in a soft disc; this is a signature beat | `compare-disruption-mark.png` |
| Real action | Google Calendar shown as a forest square containing the literal text "31" | `IntegrationMark` with the vendored official Calendar mark | The reference shows the real Calendar logo; a hand-typed date in a box is the placeholder treatment this pass exists to remove | `cur-receipt-header.png` |
| Impact / blast radius | Flow-card glyphs are simple line icons in the reference too | No change | Reference is simple here; replacing them would add noise, not craft | Untouched |
| Futures / Action / Incomplete / Replan / Restored | Composition, cards and copy already track the reference | Eyebrow ornament only | No visible deficit worth a diff | Untouched |
| Final CTA / trust | Matches reference rhythm | Eyebrow ornament only | — | Untouched |

## SVG and icon inventory

| Visual | Current source | Verdict | New asset | Why |
|---|---|---|---|---|
| Eyebrow ornament | *(absent)* | **REPLACE** (new) | `ReflowRule.tsx` | Present under every reference eyebrow; missing entirely |
| Disruption warning | `OperationalIcon name="warning"` | **REPLACE** | `DisruptionMark.tsx` | Stock triangle at 25px on a signature beat |
| Flow-card glyphs (user, code, server, search, package) | `OperationalIcon` | **KEEP** | — | Reference uses equally simple glyphs; clarity wins |
| Reflow status sprite (`failure-fracture`, `verification-state`, `readback-verified`, …) | `reflow-status-icons.sprite.svg` | **KEEP** | — | Already authored: 8–12 elements, forest/rust/sage/brass, semantic route-fracture construction |
| Integration marks (GitHub, Google Calendar, Gmail) | `simple-icons`, vendored | **KEEP** | — | Official marks; never redrawn, never recoloured for status |
| Calendar logo on the action receipt | inline `<span>31</span>` | **REPLACE** | `IntegrationMark.tsx` | Text-in-a-box standing in for a vendor logo |
| Utility glyphs (chevron, arrow, external link) | `Icon.tsx` | **KEEP** | — | Utility icons stay simple |

### Bespoke assets

**`ReflowRule`** — eyebrow ornament. Two brass rules flanking an inset lozenge.
6 elements, 1 user-space gradient. The gradient is load-bearing: the reference
rules fade outward, and a `<line>` with an object-bounding-box gradient is
degenerate at zero height, so the rules are gradient-filled rects. The lozenge is
two stacked paths so it has a darker core rather than reading as a bullet.

**`DisruptionMark`** — the beat where reality breaks the plan. 5 elements,
1 clip path. Corners are true arc joins computed by trimming each edge by the
radius, not a polyline with a round linejoin; the apex differs visibly at this
weight. An inset triangle at 0.09 opacity gives the layered-plate feel the
instrument language uses, the bar is a tapered filled path rather than a stroke,
and the dot is a separate heavier circle so the two do not merge at small sizes.

## Decisions taken deliberately

**Forest saturation — left as is.** Reference arc samples `#40483e` (g−r 8);
current renders `#173d2b` (g−r 38). The divergence is real under sampling, but at
normal viewing size the current enamel reads as deep forest rather than
excessively saturated, the base colour comes from the authored Blender source,
and the difference is explained by Blender's AgX look desaturating shadows where
three's Neutral tone mapping preserves them. Changing it would trade a
reproducible authored value for a match to one concept render's tone response.

**Vendor marks drawn monochrome.** The reference shows the multicolour Google
Calendar lockup. The official geometry is used, but rendered in ink: a four-colour
logo is the one element that would break the page's ivory/forest discipline, and it
matches how the same marks are drawn in the product. The mark never carries state —
the VERIFIED pill beside it does.

**Geometry — unchanged.** Every hero mismatch resolved to pose, opacity or
material. No mesh edit was required.

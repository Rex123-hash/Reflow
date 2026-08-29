# Frontend design refinement

Implementation of the accepted frontend design audit. Frontend visual only — no
backend, agent, contract, authorization, adapter, canonical-recovery, evidence or
verification semantics were touched.

Starting HEAD: `597977c99ce0ca557a4b33bed33e32b101f1ffe5`.

---

## 1. Accepted findings, and what measurement showed

The audit's diagnosis was accepted. The numbers behind it:

| Finding | Measured |
|---|---|
| Semantic text too light | `--secondary #838c85` = **3.41:1** on surface, **3.13:1** on canvas — below the 4.5:1 AA threshold — used **75 times** |
| Too many tiny sizes | **47** distinct `font-size` values; the most common were 10–11px; ~2/3 of application type under 11.5px |
| Weak current-state contrast | brass **2.63:1**, sage **2.48:1** — the two lowest-contrast values in the palette were marking *current* state |
| Excessive uppercase | **30** `text-transform: uppercase` rules, used as the default labelling device at ~9px |
| Uniform surface weight | every card carried the same border, radius and shadow |
| ACT composition | the receipt card did **not** collide with the headline; the **instrument** did |

---

## 2. ACT composition repair

The reported hypothesis — move the Calendar card right and down — was measured and
rejected. At 1920 the card's left edge is ~1016px and the headline's right edge
~650px; they never touched. The real collision was the orb sitting under
"separately." and the entire lede.

| Element | Before | After |
|---|---|---|
| ACT orb | `y: 0.55`, `scale: riskScale × 0.8` | `y: 1.28`, `scale: riskScale × 0.68` |
| Receipt card | short, top-anchored, ~430px | grown through its own content — header, receipt fields and each proof rung given room |
| Headline / lede | over the instrument | fully clear, upper-left |
| Rail gutter | 22px clearance | unchanged |

Two further collisions of the same class were found by the new check — **not
reported, and not visible without it**:

| Beat | Overlap | Fix |
|---|---|---|
| PLAN (`futures`) | lede overlapped orb by 54px | `y: 0.45 → 1.05` |
| REPLAN | lede overlapped orb by 46px | `y: 0.35 → 1.55`, `scale × 0.82 → × 0.62` |

## 3. The QA class that was missing

The previous harness checked beat-vs-beat text and text-vs-rail. It never checked
**text vs. the 3D instrument**, which is exactly how these three defects survived.

The orb is a full-viewport canvas with no DOM geometry, so `ReflowInstrument` now
publishes its projected silhouette bounds as `data-story-orb-rect` — alongside the
`storyTriangles` / `storyFirstFrameMs` telemetry the codebase already emits. The
silhouette was already computed every frame; this only records its bounds.

**The check was validated before being trusted.** A first version queried
`[data-rail='inner']`, an element that does not exist in the story DOM, and
therefore reported zero collisions forever. Re-running it against the known-bad
pose now reports `orbCol=1` naming the exact lede; against the corrected pose it
reports `0`. It also excludes text sitting on an opaque card, since a card occludes
the render behind it — only bare copy over the instrument is a legibility defect.

## 4. A coordination bug the repair exposed

With the composition fixed, the ACT capture showed the rail reading "Independent
verification" while the verified rung had not yet arrived on the receipt — the
label asserting something the composition had not shown.

Sub-beat handover was taking the moment a state *begins* arriving. It now takes the
moment its evidence has **landed**: ACT at 29/48 (was 23/48), REPLAN at 24/54 and
39/54 (was 21 and 36).

---

## 5. Contrast tiers

Five tiers, each a decision about importance. `--text-metadata` is the only new
value: a darkened `--secondary` at hue 140°, inside the frozen palette's own hue
family, chosen as the lightest tone that still passes AA against `--canvas`.

| Tier | Token | Surface | Canvas | Elevated |
|---|---|---|---|---|
| primary | `--ink` | 16.26 | 14.89 | 15.44 |
| secondary | `--body` | 6.07 | 5.56 | 5.76 |
| supporting | `--body` | 6.07 | 5.56 | 5.76 |
| **metadata** | **`#646d67`** | **5.26** | **4.82** | **5.00** |
| de-emphasised | `--secondary` | 3.41 | 3.13 | 3.24 |

Brass and sage remain as ornament, rule, wash, fill and accent — never as text
colour and never as the sole carrier of state. The current recovery stage moved
from brass fill to **forest fill with a wider ring**, so it carries colour, weight
*and* shape.

## 6. Type scale

47 ad-hoc sizes → seven tokens plus four authored serif sizes deliberately kept.

| Role | Token | Size |
|---|---|---|
| Page title | `--type-page` | 2rem |
| Section heading | `--type-section` | 1.125rem |
| Primary / body | `--type-body` | 0.95rem |
| Secondary | `--type-secondary` | 0.85rem |
| Label / metadata / mono | `--type-label` etc. | 0.75rem |

**98 declarations were lifted to the 0.75rem floor.** No meaningful application
text renders below 12px. Marketing keeps its own expressive scale in
`src/styles.css` and is deliberately not folded into this.

## 7. Uppercase

**30 → 14 rules.** Uppercase now means *state* — `VERIFIED`, `RESTORED`,
`SIMULATION`, `RECOVERY 02 · RESTORED`, `CONTROLLED`. Structural labels are
sentence case at the readable floor: "Current priority", "Recent activity",
"Evidence in context", "Technical details".

## 8. Surface tiers

- **primary** — `--line-strong` + `--elev-raised`; the current state or verdict.
  One per screen.
- **panel** — the existing `.card`; grouped supporting information.
- **bare** — rule and space instead of another competing box.

## 9. Page composition

Every workflow page now opens the same way: eyebrow, title and description centred
on the workspace via a shared `.page-head`, with the page's own control pinned to
the right of that block. Tables, cards and values beneath stay left-aligned and
scannable. Routes previously each had their own `space-between` header, so the
title sat hard left on one page and beside a filter group on another.

## 10. Route changes

**Overview** — the verdict is now the dominant surface. It previously carried the
single most important fact in the product as bare text while the panels beneath it
had full card treatment. Activity leads with relative time; the repeated recovery
attempt is quieted rather than removed.

**Objectives** — the health pill and the raw `objective_restored` enum said the
same thing twice. The column now leads with when the state was last observed and
keeps the exact enum on the element's `title`. Column relabelled "Last observed".

**Recovery** — current stage on forest with a ring; timestamps at the readable
floor.

**Operator** — P2I hierarchy untouched. The masthead adopts the shared centred
`.page-head`; the human answer keeps its position above the collapsed technical
block.

**Evidence** — readable floor and metadata tier applied; no motion added. It is an
archive and stays calm.

## 11. Live-state cues

Three motion primitives, each encoding something true:

- **arrival** — the primary surface settles in once on mount;
- **working** — a slow breath on live indicators, only where the workspace or
  provenance is genuinely live;
- **recency** — `formatRelativeTime` leads with "4 min ago" / "Yesterday" while the
  exact instant stays in `dateTime` and `title`, so nothing is lost.

All three stop under `prefers-reduced-motion`. No ambient decoration, no staggered
load-in, nothing on Evidence.

## 12. Tests added

`src/app/styles/designSystem.test.ts` — eight tests pinning the rules, because none
of these failures are visible in a screenshot review and all of them return the
moment someone adds "just one more" 0.62rem label:

- no application text below the 0.75rem floor;
- sizes come from the scale;
- `--text-metadata` passes AA on all three surfaces;
- nothing reaches for the failing muted tone directly;
- brass and sage never carry state as text colour;
- relative time across every range, clock skew, and unparseable input.

Two of these initially reported false positives — `border-color` matching a
`color:` substring, and icon glyphs — and were tightened rather than the CSS being
changed to satisfy them.

## 13. Results

| Gate | Result |
|---|---|
| Frontend tests | **100 passed** (13 files) |
| Typecheck | clean |
| Lint (oxlint) | clean |
| Format (prettier) | clean |
| Production build incl. contract, fixtures, marks, poster checks | succeeds |

**Story QA** — 7/7 frames and 10/10 settled states clean at 1920: zero text, rail
and instrument collisions, zero clipped labels, zero overflow.

**App QA** — Overview, Objectives, Recovery, Operator, Evidence at 1440, tablet and
390: **zero horizontal overflow on all fifteen**.

## 14. Deliberately deferred

- "Since you last looked" — introduces view/session-state semantics not needed here.
- Activity + Counts merge — held until the new hierarchy was evaluated; with the
  verdict now dominant they no longer read as competing peers.
- Freshness distinction between fresh external read and persisted read-back is
  surfaced only where the product already knows it; nothing is fabricated.

## 15. Remaining visual debt

1. Evidence still shows full hashes in the default view; disclosure not yet added.
2. Story rail resting treatment still names all ten states at similar weight.
3. Serif remains on a few application card headings that would read better as sans.
4. Recovery objective bar wraps awkwardly at tablet.

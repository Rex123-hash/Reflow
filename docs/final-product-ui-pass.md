# Final product UI pass

Application shell, Operator presentation, workspace alignment and hero pacing.
Frontend visual/UX only. No backend, BFF, agent, contract, auth or recovery-semantics
file was touched.

Proof tooling used throughout:

- `frontend/scripts/app-qa.mjs` — logged-in application at five viewports, served
  from the committed presentation fixtures so the shell can be photographed without
  the private BFF.
- `frontend/scripts/visual-qa.mjs` — marketing hero, existing harness.
- `frontend/scripts/story-pacing-qa.mjs` — new. Sweeps the story timeline and drives
  real wheel scrolling, measuring text collision and phase-rail collision.
- `frontend/scripts/motion-check.mjs` — decoded-pixel motion proof.

---

## A. Repository / locked-file audit

Working tree was clean at the start of the pass (`git status --short` empty), so
there were no in-flight files from another session to treat as locked.

The checkout contains the Operator milestones and they were not reverted:

```
4a7955b  Record seven-agent Operator production proof
f67f147  Fix browser Operator response validation
0f68a73  Deploy read-only Operator reasoning agents
6b9b6f1  Qualify deployed Calendar visualization with live proof
83c84e9  Visualize authoritative Calendar commitments on Overview
```

All five, plus the earlier Calendar work, were pushed to `main` at the start of this
session (`52d654a..4a7955b`).

---

## B. Header before / after

**Before.** A single flex row: brand, then `.app-nav-links` with `flex: 1`
immediately after it, then the account cluster. Because the links took the free
space *starting at the brand*, the whole nav sat hard left and a long empty run
opened before "Live workspace". Height 54px, wordmark 0.94rem, nav 0.79rem, mark
19px, avatar 28px — everything smaller than the product beneath it.

**After.** A `1fr auto 1fr` grid. The nav is centred on the container, and because
the outer columns are equal fractions rather than content-sized it stays optically
centred when the right cluster changes width — `Live workspace` vs
`Demo workspace · Read only`, longer initials, or the development scenario switch
appearing. The header's inner row shares the workspace container, so the brand sits
on exactly the same left rule as every route's content.

The active-route underline was anchored at `bottom: -18px`, a value derived from the
old 54px height; it is now positioned from the header's own height so it survives
any future height change.

---

## C. Desktop header geometry

| | before | after |
|---|---|---|
| header height | 54px | 74px |
| brand mark | 19px | 27px |
| wordmark | 0.94rem | 1.125rem (18px) |
| nav label | 0.79rem | 0.96rem (~15.4px) |
| nav spacing | 22px | 30px |
| avatar | 28px | 35px |
| sign out | 11px | 0.76rem, with a hover plate |
| workspace label | 11px | 0.72rem |

---

## D. Mobile navigation fix

The 390px overlap was reproduced and quantified before any change:
**91px of horizontal page overflow on every one of the five routes**, with nav
labels printed on top of each other and the avatar sitting over "Operator".

Below 900px the five routes move out of the header into their own band: a single
horizontally scrollable rail carrying the same five links, with the same brass
underline on the active one, masked at both edges so the rail reads as scrollable
rather than clipped. No route is hidden behind a menu, and the route architecture is
unchanged.

Below 560px the workspace status moves under the brand rather than competing with
the account controls for the same row — `Demo workspace · Read only` is truth the
mobile header must not drop.

**Result: 0px horizontal overflow on all 25 route × viewport combinations.**

---

## E. Workspace width before / after

Before, each route set its own `max-width` and no auto margin, so the application
hugged the left edge of a wide display:

| route | before | after |
|---|---|---|
| Overview | `max-width: 1180px`, left-aligned | shared container |
| Objectives | `max-width: 1240px`, left-aligned | shared container |
| Evidence | `max-width: 1240px`, left-aligned | shared container |
| Operator | `max-width: 1080px`, left-aligned | shared container + reading column |
| Recovery | full-bleed, `.lens-body` pinned at 900px on its left edge | reading column centred in the workspace |

One system now:

```css
--workspace-max: 1500px;
--workspace-gutter: clamp(20px, 3.2vw, 44px);
--workspace-reading: 1080px;   /* prose-led surfaces only */

.route-pad, .workspace-inset {
  width: 100%;
  max-width: var(--workspace-max);
  margin-inline: auto;
}
```

At 1920 that is a 1500px box centred with 210px gutters, giving a 1412px content
column beginning at x=254 — the same left rule the header brand sits on. The
container is centred; nothing inside it was centre-aligned.

1500px was derived rather than picked: the Recovery Room's instrument is 300 + 352px
of fixed rails plus a ~780px reading column, and matching that total keeps a route's
content column the same physical width whichever surface you are on.

---

## F–J. Per-route alignment

**F. Overview** — shared container. The verdict block keeps its 860px measure and
58ch summary; the 1.65fr/1fr grid now sits in a centred field instead of against the
left edge. The Calendar visualisation was not touched: it inherits the container's
width and gutters only.

**G. Objectives** — shared container. Column widths were rebalanced so the wide
canvas is used rather than spread: the identity column takes the slack (31%) and the
data columns are sized to their content (12/17/16/16/8%). Before, the identity column
was the *smallest* at ~16% while the pills and timestamps were given room they did
not need. Below 900px the row still needs ~860px to keep every column readable, so it
scrolls inside its card — with an edge fade added, because without one the trailing
"Open" control simply looked clipped at tablet width.

**H. Recovery** — the three-column instrument stays full-bleed (that is the
surface's design), but the middle column's content was pinned to 900px on its left
edge, leaving a wide dead field down the right at 1920. `.workspace-scroll > *` is
now capped at 1120px and centred, so the Calendar card and the lens body move
together into the middle of the workspace. Below ~1500px the cap is inert, so
nothing changes at 1440 and under. Recovery data, the spine and the lens semantics
were not touched.

**I. Operator** — shared container's left rule, with the console capped at
`--workspace-reading` (1080px). An answer set in a 1400px measure is unreadable;
the taper is a measure decision, not a page-specific offset, and the page still
begins exactly where Overview and Evidence begin.

**J. Evidence** — shared container. Semantics, tabs, timeline and proof records
unchanged; only the shell-level geometry moved.

---

## K. Operator input changes

The field is now the primary control surface rather than a box in a container:
1.02rem text (was 0.92rem), `--radius-lg`, a stronger resting hairline, and a focus
state that lifts the whole plate and takes a forest ring — the search glyph turns
forest with it — instead of the input growing a browser outline inside a silent
container.

Example prompts were square-cornered bare bordered boxes reusing the Recovery Room's
`.quick-link`. They are now pill-shaped chips of their own with a `TRY` eyebrow and
a sage hover, and they carry a proper disabled state for Demo context.

Loading, error and Demo-context notices were bare `<p>` elements. They are now
bounded notes in the product's own vocabulary — the busy note carries a brass pulse
that respects `prefers-reduced-motion`.

At ≤640px the submit control drops to its own full-width row while the search glyph
stays on the field's row, so the input never appears to belong to a stray glyph
above it.

---

## L. Operator response hierarchy

Before: an eyebrow reading "READ-ONLY OPERATOR RESPONSE", the question as an `h2`,
prose capped at 66ch inside a full-width card, then bullets and two paragraphs of
metadata — most of the card empty, and a real Gemini answer looking like a
development print-out.

After:

```
[ INSPECT ]  READ ONLY · NO PRODUCTION ACTION        ← state bar
─────────────────────────────────────────────────────
QUESTION                              SUPPORTING EVIDENCE
What did Reflow change in             · Calendar event rescheduled
Google Calendar?                        27 Aug · 19:07:45 UTC
                                      · Calendar read-back after write
ANSWER                                  27 Aug · 19:07:51 UTC
Reflow moved the release              · Recovery 01 objective verification
validation window…                      27 Aug · 19:08:04 UTC

                                      PROVENANCE
                                      REVISION   16
                                      GENERATED  28 Aug · 12:41:07 UTC
                                      AGENTS     operator_intent_interpreter
                                      REQUEST    9f2c41ae…e10c48
                                      NO PRODUCTION ACTION OCCURRED.
```

The freed width carries the evidence and provenance instead of nothing. Below
1080px the aside moves under the answer.

No response semantics changed: the answer paragraphs are still
`response.answer.split("\n\n")` rendered verbatim, and nothing is summarised,
rewritten or inferred.

---

## M. Intent-state treatment

`response.intent.intent_type` **is** exposed to the browser contract
(`operatorContract.ts`: `"INSPECT" | "EXPLAIN" | "SIMULATE" | null`), so it is
displayed as an authoritative value. Nothing is classified in the browser, and when
the backend returns `null` no chip is rendered at all.

Labels live in a single `INTENT_LABELS` map — `INSPECT → Inspect`,
`EXPLAIN → Explain`, `SIMULATE → Simulation`.

---

## N. Simulation-state treatment

When `provenance === "HYPOTHETICAL_NO_ACTION"` the whole card changes state: a brass
hatched top edge, a sand wash, a brass hairline, the intent chip in the caution
palette, and the state bar reading `HYPOTHETICAL · NO EXTERNAL ACTION`. The
candidate futures are dashed-border articles, so a hypothetical future can never be
mistaken for an observed one. It borrows the in-motion palette the product already
uses rather than introducing a warning colour — restrained, not alarmist.

`hypothetical_deadline` is presented as a labelled brass-ruled block that states
"The real deadline is unchanged" beside it, rather than as a sentence in a run of
prose.

---

## O. Provenance / no-action treatment

"Read-only Operator response" was the visual headline of the card. It is true and
stays visible, but it is now state on a rule at the top of the card
(`READ ONLY · NO PRODUCTION ACTION`) rather than the title of the answer, and
`NO PRODUCTION ACTION OCCURRED.` closes the provenance block. Nothing implies ACT
capability, and no disabled ACT control was added.

**Future controlled-ACT compatibility:** adding `ACT` is one entry in
`INTENT_LABELS` and one modifier class in `operator.css`. No other part of the
component encodes the set of intents, and the state bar already has room for a
capability chip beside the intent chip.

---

## P. Structured timestamp formatting

`response.generated_at` was printed raw as `2026-08-28T12:41:07.882140+00:00`. It now
renders through the product's existing `formatObservedAt` as `28 Aug · 12:41:07 UTC`,
inside a `<time dateTime="…" title="…">` so the exact value stays machine-readable
and available on hover. Evidence `observed_at` gets the same treatment;
`hypothetical_deadline` goes through `formatDeadline`.

Only structured contract fields are formatted. Datetimes inside model prose are
left exactly as the model wrote them.

`request_id` is middle-truncated for display (`truncateId`) with the full value on
the element's `title`.

---

## Q. Calendar regression result

No change. The Overview Calendar visualisation, its time geometry, freshness
semantics, event labels, data fetching and contract were not modified. It inherits
the shared workspace width and gutters only. `CalendarMiniTimeline.test.tsx` and
`ExternalReality.test.tsx` pass unchanged.

---

## R. Old hero timing map

Timeline duration 101.1 units. Positions as they were:

| beat | container in | content assembled by | exit begins | settled plateau |
|---|---|---|---|---|
| hero | 0 (pre-visible) | — | 5.5 | 0 → 0.054 |
| risk | 9 | **25.2** | **24.0** | **none — exit began before assembly finished** |
| futures | 23.5 | 37.9 | 39.0 | **1.1 units ≈ 1.1%** |
| action | 39 | **54.5** | **54.0** | **none** |
| incomplete | 54 | 63.5 | 67.0 | 3.5 units ≈ 3.5% |
| replan | 67 | 82.05 | 83.0 | **0.95 units ≈ 0.9%** |
| restored | 83 | 97.1 | — | 4 units ≈ 4% |

Two structural faults:

1. Every beat began entering **at or before** the previous beat's exit began, so two
   large narrative blocks were legible in the same region at once.
2. Every beat finished assembling **at or after** its own exit began. DETECT and ACT
   had literally negative plateaus, and PLAN's fully-composed state existed for about
   1% of scroll.

This is visible in the before captures: `visual-qa/pace-before-risk-1920.png` shows
only two and a half of the five impact nodes at the canonical DETECT frame, and
`visual-qa/pace-before-futures-1920.png` shows one of the three future cards at the
canonical PLAN frame.

---

## S. New hero timing map

The timeline is now generated from `frontend/src/data/storySchedule.ts`, which is the
single source of truth for the animation, the capture frames, the stage boundaries,
the phase-rail weights and the SVG route overlays. Total duration 254 units.

| beat | enter | dwell | exit | start → settle → exit → end | settled plateau |
|---|---|---|---|---|---|
| hero | 0 | 22 | 5 | 0.0000 · 0.0000 · 0.0866 · 0.1063 | **8.66%** |
| risk (DETECT) | 8 | 26 | 5 | 0.1063 · 0.1378 · 0.2402 · 0.2598 | **10.24%** |
| futures (PLAN) | 7 | 24 | 5 | 0.2598 · 0.2874 · 0.3819 · 0.4016 | **9.45%** |
| action (ACT) | 9 | 26 | 5 | 0.4016 · 0.4370 · 0.5394 · 0.5591 | **10.24%** |
| incomplete (VERIFY) | 6 | 22 | 5 | 0.5591 · 0.5827 · 0.6693 · 0.6890 | **8.66%** |
| replan | 9 | 26 | 5 | 0.6890 · 0.7244 · 0.8268 · 0.8465 | **10.24%** |
| restored | 9 | 26 | 4 | 0.8465 · 0.8819 · 0.9843 · 1.0000 | **10.24%** |

**Settled 67.7% · transition 32.3%.** The smallest plateau is 8.66% of scroll, up
from 0% for two beats and 0.9% for another.

Each beat's slot begins exactly where the previous beat's exit *ends*, so nothing
enters while anything else is still readable. Within a beat nothing moves at all
between `settle` and `exit` — not the text, not the instrument, not the route
overlays:

- **Instrument yaw** was a free-running 15-point progress curve; it is now held
  constant across every plateau and interpolated only across transitions. Pose
  tweens run from one beat's `exitAt` to the next beat's `settleAt`.
- **Route overlays** were driven by loose progress constants that had drifted out of
  step with their beats (the action route finished drawing at 0.49 while ACT was
  still assembling until 0.53). They are now expressed as a fraction of their own
  beat's arrival, so a route has finished drawing by the time the beat settles.
- **`?frame=<stage>`** now parks at the middle of the beat's plateau, derived, rather
  than at a hand-written constant.

Scroll distance was raised so the plateaus have scroll to spend:
`.story-track` 500svh → **600svh** desktop, 690 → 780svh at ≤1099px, 650 → 730svh at
≤760px. At 600svh each beat owns roughly 70svh and a settled state is about half a
screen of scrolling during which nothing moves.

---

## T. Phase rail before / after

The rail is unchanged in design and was not removed.

**Before.** `right: 18px; width: 190px` — the rail occupied x=1712→1902 at 1920. The
tall right-anchored cards were positioned with their own `right: clamp(38px, 5.5vw,
96px)` and reached x=1824, so they sat in the rail's band. Measured overlaps at the
canonical frames: **ACT** (`.receipt-card`, 6 overlapping nodes) and **RESTORED**
(`.verification-preview`, 2).

**After.** The rail's geometry is declared once on `.sticky-stage` and
`--story-rail-safe` (width + inset + 22px clearance) is the minimum right offset for
anything sharing the rail's vertical band. The six right-anchored cards take
`max(their own edge, var(--story-rail-safe))`, so each keeps its intended inset on a
narrow screen and is held clear on a wide one.

An earlier attempt put the gutter on `.story-beat`'s padding instead. That was wrong
and was reverted: asymmetric padding shifted the centred PLAN headline 67px off
centre, changing an approved composition. Beats keep symmetric padding.

At ≤1099px the rail tightens to 132px wide so it does not claim a quarter of a
tablet's width. Below 760px it is hidden, as before.

Measured after the change, at all seven canonical frames:
**0 rail collisions**, every beat's widest element at x=1688 — exactly the safe edge,
22px clear of the rail at 1710.

---

## AB. Reduced-motion QA

Not regressed. The reduced-motion branch of `useStoryController` is byte-identical.

- `scripts/visual-qa.mjs --reduced` reaches its ready signal with **no pointer, click
  or scroll** before readiness resolves (1440: 9325ms; 390: 7931ms), which is the
  Phase 1 guarantee.
- `posterHidden=true` — a real WebGL frame is drawn, not the poster.
- **CLS 0.0000.**
- `scripts/motion-check.mjs --reduced` → **PASS: reduced motion is static** (0 changed
  pixels across 3s of sampling).
- `scripts/motion-check.mjs` → **PASS: normal motion is animating without
  interaction.**

---

## AJ. Tests and gates

| gate | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | **13 files, 85 tests, all pass** |
| `npm run lint` (oxlint) | clean |
| `npm run format:check` (prettier) | clean |
| `npm run build` (contract, operator-contract, fixtures, marks, poster checks + tsc + vite) | succeeds |
| `git diff --check` | clean |

One test was updated: `OperatorConversation.test.tsx` asserted the evidence link's
accessible name with an exact string. The evidence row now carries its observed-at
stamp inside the link, so the name is the title plus that stamp; the assertion is a
regex over the title and still checks the exact evidence identifier in the `href`.
No backend fixture was altered.

---

## AL. Backend / BFF / agent / data files changed

**NONE.**

Nothing under `objective_recovery_agent/`, `src/objective_recovery/`, `tests/`,
`docs/ui-openapi.json`, `docs/ui-fixtures/`, the generated contracts
(`uiContract.ts`, `uiValidators.ts`, `operatorContract.ts`, `operatorValidator.ts`),
auth, or the presentation fixtures was modified. The contract `--check` steps in
`npm run build` pass, which proves the generated artefacts still match their sources.

---

## AN. Remaining visual debt

1. **Marketing action receipt shows raw timestamps.** The ACT beat's receipt card
   prints `2026-08-25T17:26:31.966284Z`. That is frozen marketing design and outside
   this pass's Operator-scoped timestamp brief, but it is the same readability
   problem and worth a later pass.
2. **A 404 in the marketing page's network log.** Present before this pass and
   unrelated to it; one unresolved resource request, no console error and no visual
   effect.
3. **Objectives at tablet still scrolls its table.** The row genuinely needs ~860px
   for readable columns; the fade makes that legible but a stacked treatment below
   900px would be better than a scroll.
4. **Operator answer pane has vertical slack on short answers** at 1920 — the
   evidence aside is taller than a two-paragraph answer. Inherent to a two-column
   answer; only noticeable on the shortest responses.
5. **Recovery objective bar wraps on tablet** with `revision 16 · LIVE` landing
   mid-row. Legible, but the bar would read better as a two-row block at that width.

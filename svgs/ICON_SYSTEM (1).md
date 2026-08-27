# Reflow SVG Set B — Status & Operational Icon System

## Intent
Set B contains only Reflow-specific status and workflow symbols. Generic UI concepts such as user, server, search, package, lock, shield, and simple arrows should still come from the chosen line-icon library rather than being redrawn.

## Core geometry
- ViewBox: `0 0 64 64`
- Primary stroke: 2.5–3.4 units
- Rounded caps and joins throughout
- Optical center is favored over mathematical centering
- Multi-color accents are restrained: forest is dominant, brass is rare, rust/failure is local only

## Palette
- Forest: `#1D4C39`
- Ink: `#17211C`
- Sage: `#91A995`
- Pale sage: `#E7EEE7`
- Brass: `#B89A64`
- Warning: `#C49355`
- Failure: `#A76658`
- Surface: `#FFFDF9`

## Included custom symbols
1. `disruption-marker.svg`
   A signal enters an otherwise stable recovery orbit.
2. `objective-at-risk.svg`
   The objective remains central while the orbit is interrupted by a restrained risk marker.
3. `verification-state.svg`
   Restored/verified objective state with independent evidence nodes.
4. `recovery-replan.svg`
   Existing route breaks and a new route deliberately loops back into recovery.
5. `failure-fracture.svg`
   Local route fracture. The failure color never consumes the whole icon.
6. `recovery-selected.svg`
   Three candidate routes, with the selected path visually dominant.
7. `policy-rejected.svg`
   A route is stopped by a deterministic policy gate.
8. `readback-verified.svg`
   External action and independent read-back represented as separate directional phases.

## Usage
- Recommended UI size: 20–28 px
- Hero/story use: 32–48 px
- Avoid using these below 16 px unless the icon is purely decorative.
- Do not recolor failure/warning symbols to bright red.
- Do not animate every icon. Use motion only when the status transition is semantically meaningful.
- For dark backgrounds, create a dedicated dark-context variant instead of relying on filters.

## Engineering handoff
Individual SVG files are production assets. `reflow-status-icons.sprite.svg` is included for teams that prefer an SVG-symbol sprite.

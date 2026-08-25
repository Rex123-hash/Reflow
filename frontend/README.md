# Reflow frontend — UI-M1

This isolated React/Vite application is the coordinate and story skeleton for Reflow's
continuous recovery narrative. UI-M1 deliberately uses placeholder geometry and surfaces;
it is not the final orb or final visual system.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Validation URLs

Append `?frame=<stage>` to hold a deterministic screenshot frame. Supported stages are
`hero`, `risk`, `futures`, `action`, `incomplete`, `replan`, and `restored`.

Append `?motion=reduced` to validate the normal-flow reduced-motion architecture.

## Evidence boundary

The Calendar panel is a sanitized recorded snapshot of the frozen P1B proof at commit
`53a18823cd1d8ca86d6950fc128acaace52117ec`. Later recovery-incomplete, replanning, and
restoration states are explicitly labelled product-story previews and are not represented
as current backend evidence.

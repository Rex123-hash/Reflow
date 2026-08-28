import { useId } from "react";

/**
 * The disruption mark — the symbol on the beat where reality breaks the plan.
 *
 * It replaces a minified three-point polyline that read as a stock warning glyph.
 * At 21px inside a 44px blush disc it is one of the few product-facing symbols on
 * the marketing page, and the approved reference (crop:
 * visual-qa/ref-disruption-icon.png) shows a generously rounded triangle, not a
 * sharp one.
 *
 * What makes it authored rather than a traced Lucide clone:
 *
 *   the corners are true arc joins, computed by trimming each edge by the corner
 *   radius and joining with an arc, rather than a polyline with a round linejoin
 *   faking it — at this weight the difference is visible on the apex;
 *
 *   a second, inset triangle sits behind at low opacity, which gives the mark the
 *   layered plate feel the rest of the Reflow instrument language has;
 *
 *   the bar tapers. A constant-width stroke reads as a keyboard pipe; the
 *   reference's stroke narrows toward the base, so it is drawn as a filled path
 *   with a 0.35 unit taper rather than a `<line>`;
 *
 *   the dot is a separate circle at a slightly heavier optical weight, which is
 *   what stops the two reading as one broken stroke at small sizes.
 *
 * Rust only — never bright red, per the Reflow icon system.
 */
export function DisruptionMark({ size = 25 }: { size?: number }) {
  const id = useId();
  const clip = `disruption-clip-${id}`;

  return (
    <svg
      className="disruption-mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clip}>
          <path d="M13.78 6.19 L19.61 16.44 A2.05 2.05 0 0 1 17.83 19.50 L6.17 19.50 A2.05 2.05 0 0 1 4.39 16.44 L10.22 6.19 A2.05 2.05 0 0 1 13.78 6.19 Z" />
        </clipPath>
      </defs>

      {/* Inset plate, behind — the layered construction the instrument uses. */}
      <path
        d="M13.09 8.45 L17.23 15.73 A1.25 1.25 0 0 1 16.15 17.60 L7.85 17.60 A1.25 1.25 0 0 1 6.77 15.73 L10.91 8.45 A1.25 1.25 0 0 1 13.09 8.45 Z"
        fill="currentColor"
        opacity="0.09"
      />

      {/* Outer shell, arc-rounded at every corner. */}
      <path
        d="M13.78 6.19 L19.61 16.44 A2.05 2.05 0 0 1 17.83 19.50 L6.17 19.50 A2.05 2.05 0 0 1 4.39 16.44 L10.22 6.19 A2.05 2.05 0 0 1 13.78 6.19 Z"
        stroke="currentColor"
        strokeWidth="1.95"
      />

      {/* Tapered bar: wider at the top, narrowing toward the base. */}
      <g clipPath={`url(#${clip})`}>
        <path d="M11.13 10.55 L12.87 10.55 L12.6 14.72 L11.4 14.72 Z" fill="currentColor" />
      </g>

      <circle cx="12" cy="16.75" r="0.95" fill="currentColor" />
    </svg>
  );
}

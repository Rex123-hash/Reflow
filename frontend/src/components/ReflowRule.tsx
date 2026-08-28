import { useId } from "react";

/**
 * The eyebrow rule — a small brass ornament that sits under section eyebrows.
 *
 * Present under every eyebrow in the approved reference (REFERENCE PAGES/1.png,
 * crop in visual-qa/ref-eyebrow-ornament.png) and missing entirely from the
 * implementation. It is what makes an eyebrow read as a titled plate on an
 * instrument rather than as loose small caps.
 *
 * Two details carry it, and both need real geometry rather than a border-top:
 *
 *   the rules fade outward, so the mark resolves into the page instead of
 *   stopping abruptly — a fill gradient, not a plain line;
 *
 *   the centre is a brass lozenge with a darker inset core, which is what gives
 *   the ornament its machined feel at this size. A single dot reads as a bullet.
 *
 * The rules are rects rather than lines on purpose: a stroke gradient on a
 * zero-height `<line>` has a degenerate object bounding box and renders nothing,
 * so the gradient is declared in user space and filled.
 *
 * The gradient is instance-scoped via useId so several rules can coexist without
 * colliding on element ids.
 */
export function ReflowRule({ width = 196 }: { width?: number }) {
  const id = useId();
  const fade = `reflow-rule-fade-${id}`;

  return (
    <svg
      className="reflow-rule"
      width={width}
      height={12}
      viewBox="0 0 196 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={fade} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="196" y2="0">
          <stop offset="0" stopColor="#b89a64" stopOpacity="0" />
          <stop offset="0.34" stopColor="#b89a64" stopOpacity="0.9" />
          <stop offset="0.66" stopColor="#b89a64" stopOpacity="0.9" />
          <stop offset="1" stopColor="#b89a64" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="14" y="5.6" width="74" height="0.9" fill={`url(#${fade})`} />
      <rect x="108" y="5.6" width="74" height="0.9" fill={`url(#${fade})`} />

      {/* Centre lozenge: outer brass form, then a slightly inset darker core. */}
      <path d="M98 1.9 L100.4 6 L98 10.1 L95.6 6 Z" fill="#b89a64" />
      <path d="M98 3.9 L99.2 6 L98 8.1 L96.8 6 Z" fill="#8a6f3e" opacity="0.5" />
    </svg>
  );
}

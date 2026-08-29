import type { SVGProps, ReactElement } from "react";

type GlyphName =
  | "check"
  | "cross"
  | "chevron-down"
  | "chevron-right"
  | "arrow-right"
  | "external"
  | "search"
  | "shield"
  | "info"
  | "branch"
  | "terminal"
  | "clock"
  | "lock"
  // Entity tier: what a row is about.
  | "objective"
  // Workflow-stage tier: a ring family, one interior per stage.
  | "stage-detect"
  | "stage-impact"
  | "stage-plan"
  | "stage-act"
  | "stage-verify"
  | "stage-replan"
  | "stage-restored"
  // Action tier: deliberately not rings, so an intent can never be misread as a
  // workflow position.
  | "intent-inspect"
  | "intent-explain"
  | "intent-act";

/** The public name of a glyph, for components that map a domain value to one. */
export type IconName = GlyphName;

const PATHS: Record<GlyphName, ReactElement> = {
  check: <path d="M4 12.5l5.2 5.2L20 6.4" />,
  cross: <path d="M6 6l12 12M18 6L6 18" />,
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  "arrow-right": <path d="M4 12h15M13 6l6 6-6 6" />,
  external: (
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </>
  ),
  shield: (
    <path d="M12 3l7.5 3.6v5.2c0 4.4-3.1 8.2-7.5 9.2-4.4-1-7.5-4.8-7.5-9.2V6.6z" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.6v5.6M12 16.6v.01" />
    </>
  ),
  branch: (
    <>
      <path d="M4 6v6a8 8 0 008 8h7" />
      <path d="M16 16l4 4-4 4" />
    </>
  ),
  terminal: <path d="M5 7l5 5-5 5M13 17h6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.4l3.4 2" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.8a4 4 0 018 0v2.7" />
    </>
  ),

  /**
   * The objective: Reflow's instrument reduced to two dimensions — a ring with the
   * protected outcome held at its centre. It marks WHAT a row is about and carries
   * no state, so it may sit beside any health without contradicting it.
   */
  objective: (
    <>
      <circle cx="12" cy="12" r="7.4" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),

  /**
   * Workflow stages.
   *
   * One family: every stage is the same ring with a different interior, so the set
   * reads as positions on one loop rather than as seven unrelated symbols. The ring
   * is the shared orbit; the interior says where on it you are. These live inside
   * StageChip only — the chip is already squared and outlined so a stage can never
   * be read as an outcome, and the glyph does not change that contract.
   */
  "stage-detect": (
    <>
      <circle cx="12" cy="12" r="7.4" />
      <path d="M12 3.4v3.1M12 17.5v3.1M3.4 12h3.1M17.5 12h3.1" />
    </>
  ),
  "stage-impact": (
    <>
      <circle cx="12" cy="12" r="7.4" />
      <path d="M13.4 7.2l-3.2 5.1h3.3l-2.9 4.5" />
    </>
  ),
  "stage-plan": (
    <>
      <circle cx="12" cy="12" r="7.4" />
      <path d="M12 7.4v3.3M12 10.7l-2.9 3.5M12 10.7l2.9 3.5" />
    </>
  ),
  "stage-act": (
    <>
      <circle cx="12" cy="12" r="7.4" />
      <path d="M8.7 12h5.6M12.1 9.8l2.4 2.2-2.4 2.2" />
    </>
  ),
  "stage-verify": (
    <>
      <circle cx="12" cy="12" r="7.4" />
      <path d="M8.7 12.1l2.3 2.3 4.3-4.6" />
    </>
  ),
  "stage-replan": (
    <>
      <path d="M18.6 8.6A7.4 7.4 0 1 0 19.4 12.6" />
      <path d="M19.6 5.1v3.8h-3.8" />
    </>
  ),
  "stage-restored": (
    <>
      <circle cx="12" cy="12" r="7.4" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    </>
  ),

  /** Reading something. */
  "intent-inspect": (
    <>
      <path d="M2.9 12S6.4 6.1 12 6.1 21.1 12 21.1 12 17.6 17.9 12 17.9 2.9 12 2.9 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  /** Accounting for something already recorded. */
  "intent-explain": (
    <>
      <path d="M20 4.6H4a1 1 0 00-1 1v9.3a1 1 0 001 1h3.4v3.5l4.2-3.5H20a1 1 0 001-1V5.6a1 1 0 00-1-1z" />
      <path d="M7.4 8.9h9.2M7.4 12.1h5.8" />
    </>
  ),
  /** Changing something under policy. */
  "intent-act": <path d="M13.4 3.2l-7.9 10.1h5.6l-1.1 7.5 7.9-10.1h-5.6z" />,
};

/**
 * The glyph scale.
 *
 * Four sizes, not the ten that had accumulated at call sites. Anything outside this
 * scale is an exception that has to justify itself in a comment — today that is the
 * check drawn inside a spine marker and inside a receipt rung, which are dots with a
 * mark in them rather than glyphs in their own right.
 */
export const ICON_SIZE = {
  /** Inline with metadata text. */
  meta: 12,
  /** The entry point at the head of a row. */
  row: 14,
  /** A card or section header. */
  header: 18,
  /** The framed tile a source mark sits in. */
  tile: 30,
} as const;

/** One stroke weight for every UI glyph, so a row of them reads as one family. */
export const ICON_STROKE = 1.6;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: GlyphName;
  size?: number;
  strokeWidth?: number;
}

/** Stroke-based UI glyphs on a 24px grid. Never used to identify an integration. */
export function Icon({
  name,
  size = ICON_SIZE.row,
  strokeWidth = ICON_STROKE,
  ...rest
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

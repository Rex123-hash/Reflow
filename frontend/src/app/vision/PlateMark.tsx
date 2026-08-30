import { ICON_SIZE } from "../components/Icon";

/**
 * The plate.
 *
 * Show Reflow's mark, and the counterpart to the call's dial: where `DialMark` is a
 * round instrument face, this is the rectangular one — a specimen plate with an
 * index gap at twelve o'clock, registration brackets at the corners, and a single
 * read rule across the aperture. The two marks share a viewBox, a stroke family and
 * the brass origin tick, so "Talk to Reflow" and "Show Reflow" read as two controls
 * on one instrument rather than a call button and an upload button.
 *
 * Deliberately static. The rule only moves once real bytes are being read, and that
 * motion belongs to the mounted image on the console, not to a mark in a menu.
 */

const SIZE = 40;
const MID = SIZE / 2;
/** The plate: a landscape aperture, not a square, so it reads as a frame. */
const X = 5.5;
const Y = 9;
const W = SIZE - X * 2;
const H = SIZE - Y * 2;
const BRACKET = 4.2;
const INSET = 3.2;

/** The four registration brackets, drawn as corners rather than a closed box. */
function fiducials(): string {
  const left = X + INSET;
  const right = X + W - INSET;
  const top = Y + INSET;
  const bottom = Y + H - INSET;
  return [
    `M${left} ${top + BRACKET}V${top}H${left + BRACKET}`,
    `M${right - BRACKET} ${top}H${right}V${top + BRACKET}`,
    `M${right} ${bottom - BRACKET}V${bottom}H${right - BRACKET}`,
    `M${left + BRACKET} ${bottom}H${left}V${bottom - BRACKET}`,
  ].join("");
}

const FIDUCIALS = fiducials();

export function PlateMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      className="plate-mark"
      width={size}
      height={size}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="plate-aperture" x1="18%" y1="0%" x2="82%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--pale-sage)" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {/* The aperture the sample is mounted into. */}
      <rect
        className="plate-aperture"
        x={X + INSET}
        y={Y + INSET}
        width={W - INSET * 2}
        height={H - INSET * 2}
        rx="1.6"
        fill="url(#plate-aperture)"
      />

      {/* The plate itself, opened at twelve o'clock the way the dial is. */}
      <path
        className="plate-frame"
        d={
          `M${MID + 3.4} ${Y}H${X + W - 2}A2 2 0 0 1 ${X + W} ${Y + 2}` +
          `V${Y + H - 2}A2 2 0 0 1 ${X + W - 2} ${Y + H}` +
          `H${X + 2}A2 2 0 0 1 ${X} ${Y + H - 2}` +
          `V${Y + 2}A2 2 0 0 1 ${X + 2} ${Y}H${MID - 3.4}`
        }
      />
      <path className="plate-fiducial" d={FIDUCIALS} />

      {/* One read rule across the sample: what an instrument does to a plate. */}
      <line
        className="plate-rule"
        x1={X + INSET + 1.4}
        y1={MID}
        x2={X + W - INSET - 1.4}
        y2={MID}
      />

      {/* The same brass fiducial the dial carries, in the same place. */}
      <line
        className="plate-origin"
        x1={MID}
        y1={Y - 2.6}
        x2={MID}
        y2={Y + 2}
      />
    </svg>
  );
}

/**
 * The plate reduced to a row glyph.
 *
 * Kept here rather than added to the shared `Icon` set for the same reason the
 * microphone is: that set is the product's semantic vocabulary for entities, stages
 * and intents, and "show Reflow a picture" is an affordance, not one of those. Same
 * 24 grid and stroke weight, so it sits in the same family.
 */
export function ShowGlyph({ size = ICON_SIZE.header }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9.4 5H5.8A1.8 1.8 0 0 0 4 6.8v10.4A1.8 1.8 0 0 0 5.8 19h12.4a1.8 1.8 0 0 0 1.8-1.8V6.8A1.8 1.8 0 0 0 18.2 5h-3.6" />
      <path d="M7.6 9.4V7.8h1.9M16.4 9.4V7.8h-1.9M7.6 14.6v1.6h1.9M16.4 14.6v1.6h-1.9" />
      <path d="M8.6 12h6.8" />
    </svg>
  );
}

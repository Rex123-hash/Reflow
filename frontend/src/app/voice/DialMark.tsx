/**
 * The instrument, miniaturised.
 *
 * The live call's dial reduced to a mark small enough to sit in a button: the plate
 * with its index gap at twelve o'clock, a short tick corona, and the lit lens at the
 * hub. It is the same object the call opens into, so the affordance and the
 * experience are recognisably one thing rather than a generic microphone icon
 * standing in front of something unrelated.
 *
 * Deliberately static. Nothing here is measuring anything yet — the corona only
 * responds to real audio once a call is running, and a mark that pulsed at rest
 * would be exactly the decorative motion the instrument refuses.
 */

const SIZE = 40;
const MID = SIZE / 2;
const R_PLATE = 18;
const R_TICK = 11;
const TICK_SPAN = 3.4;
const R_CORE = 5.2;
const TICKS = 32;
const TAU = Math.PI * 2;

function corona(): string {
  let path = "";
  for (let i = 0; i < TICKS; i += 1) {
    const angle = (i / TICKS) * TAU - Math.PI / 2;
    // A gentle lobe so the ring reads as a face rather than a uniform gear.
    const value = 0.45 + Math.abs(Math.cos(angle * 2)) * 0.55;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    path +=
      `M${(MID + cos * R_TICK).toFixed(2)} ${(MID + sin * R_TICK).toFixed(2)}` +
      `L${(MID + cos * (R_TICK + value * TICK_SPAN)).toFixed(2)} ` +
      `${(MID + sin * (R_TICK + value * TICK_SPAN)).toFixed(2)}`;
  }
  return path;
}

const CORONA = corona();
const CIRCUMFERENCE = TAU * R_PLATE;

export function DialMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      className="dial-mark"
      width={size}
      height={size}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="dial-lens" cx="36%" cy="30%" r="76%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="60%" stopColor="var(--surface)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--pale-sage)" stopOpacity="0.9" />
        </radialGradient>
      </defs>

      {/* The plate, opened at twelve o'clock the way the full dial is. */}
      <circle
        className="dial-plate"
        cx={MID}
        cy={MID}
        r={R_PLATE}
        strokeDasharray={`${(CIRCUMFERENCE * 0.86).toFixed(2)} ${(CIRCUMFERENCE * 0.14).toFixed(2)}`}
        strokeDashoffset={CIRCUMFERENCE * 0.07}
        transform={`rotate(-90 ${MID} ${MID})`}
      />
      <path className="dial-corona" d={CORONA} />
      <circle
        className="dial-core"
        cx={MID}
        cy={MID}
        r={R_CORE}
        fill="url(#dial-lens)"
      />
      {/* The origin mark: the same brass fiducial the full instrument carries. */}
      <line
        className="dial-origin"
        x1={MID}
        y1={MID - R_PLATE - 2}
        x2={MID}
        y2={MID - R_PLATE + 2.6}
      />
    </svg>
  );
}

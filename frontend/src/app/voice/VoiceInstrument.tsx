import { useEffect, useRef } from "react";
import type { CallPhase } from "./callModel";

/**
 * Reflow's voice presence: a lit instrument face, not a bubble.
 *
 * The composition is a measuring dial rendered as a physical object — a machined plate,
 * a lens at the centre with its own specular highlight and bounce light, a corona of
 * radial ticks graded from brass at the hub to forest at the rim, and one outer arc that
 * carries the state of authoritative work. It deliberately shares nothing with the
 * marketing orb: this is the operational surface, and it reads as an instrument taking
 * a reading rather than an assistant thinking.
 *
 * Two rules hold the whole thing together:
 *
 *   nothing moves that is not a real measurement. The corona is the microphone's own
 *   band energy, mirrored about the vertical axis so it reads as a face rather than a
 *   spectrum chart; the emission rings are Reflow's own output level; the light behind
 *   the dial swells with whichever of the two is actually sounding. Idle geometry is
 *   still, because an instrument at rest is still.
 *
 *   the outer arc never closes on anything but a verified result. Working sweeps it,
 *   verifying resolves it segment by segment, verified closes it, and every unconfirmed
 *   or refused outcome leaves it visibly open. A reader can tell the difference from
 *   across a room, with the sound off, without reading a word.
 *
 * The lighting is warm and bounded — cream, sage, brass, forest. There is no neon and
 * no unbounded glow: every luminous element is a short-range gradient or a tightly
 * clipped blur, which is what keeps it feeling machined rather than electric.
 */

const SIZE = 320;
const MID = SIZE / 2;
const R_CORE = 30;
const R_APERTURE = 58;
const R_TICK_BASE = 78;
const R_TICK_SPAN = 46;
const R_ARC = 132;
const R_PLATE = 148;
const TICKS = 72;
/** Twelve structured spokes: the free corona resolving into instrument geometry. */
const SPOKES = 12;
const SEGMENTS = 6;

const TAU = Math.PI * 2;
const point = (angle: number, radius: number) => [
  MID + Math.cos(angle) * radius,
  MID + Math.sin(angle) * radius,
];

/** Ticks are mirrored about the vertical axis so the face is balanced, not a chart. */
function bandFor(index: number, bands: Float32Array): number {
  const half = TICKS / 2;
  const mirrored = index < half ? index : TICKS - 1 - index;
  const scaled = (mirrored / half) * (bands.length - 1);
  const low = Math.floor(scaled);
  const high = Math.min(bands.length - 1, low + 1);
  return bands[low] + (bands[high] - bands[low]) * (scaled - low);
}

/** The resting tick length. Constant: an instrument at rest does not breathe. */
const REST = 0.045;

function coronaPath(bands: Float32Array, energy: number): string {
  let path = "";
  for (let i = 0; i < TICKS; i += 1) {
    const angle = (i / TICKS) * TAU - Math.PI / 2;
    const value = Math.max(REST, bandFor(i, bands) * energy);
    const [x1, y1] = point(angle, R_TICK_BASE);
    const [x2, y2] = point(angle, R_TICK_BASE + value * R_TICK_SPAN);
    path += `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return path;
}

function spokePath(bands: Float32Array, energy: number): string {
  let path = "";
  for (let i = 0; i < SPOKES; i += 1) {
    const angle = (i / SPOKES) * TAU - Math.PI / 2;
    const value = 0.34 + bandFor(i * (TICKS / SPOKES), bands) * energy * 0.5;
    const [x1, y1] = point(angle, R_TICK_BASE);
    const [x2, y2] = point(angle, R_TICK_BASE + value * R_TICK_SPAN);
    path += `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return path;
}

const CIRCUMFERENCE = TAU * R_ARC;

/** Where the outer arc sits for each phase: closed only when genuinely verified. */
function arcGeometry(phase: CallPhase, progress: number) {
  switch (phase) {
    case "VERIFIED":
      return { dash: `${CIRCUMFERENCE} 0`, offset: 0, tone: "verified" };
    case "VERIFYING": {
      // Segment by segment, so resolution is legible rather than a spinner.
      const per = CIRCUMFERENCE / SEGMENTS;
      return {
        dash: `${(per - 7).toFixed(2)} 7`,
        offset: 0,
        tone: "verifying",
      };
    }
    case "WORKING":
      return {
        dash: `${(CIRCUMFERENCE * 0.24).toFixed(2)} ${(CIRCUMFERENCE * 0.76).toFixed(2)}`,
        offset: -progress * CIRCUMFERENCE,
        tone: "working",
      };
    case "UNCONFIRMED":
    case "DENIED":
    case "UNSUPPORTED":
      // Deliberately open. An incomplete outcome must not draw a closed ring.
      return {
        dash: `${(CIRCUMFERENCE * 0.62).toFixed(2)} ${(CIRCUMFERENCE * 0.38).toFixed(2)}`,
        offset: CIRCUMFERENCE * 0.19,
        tone: "open",
      };
    case "DISCONNECTED":
      return { dash: "3 9", offset: 0, tone: "absent" };
    default:
      // One long arc with a clean opening at twelve o'clock, so the plate reads as a
      // dial with an index gap rather than as a circle that failed to close.
      return {
        dash: `${(CIRCUMFERENCE * 0.86).toFixed(2)} ${(CIRCUMFERENCE * 0.14).toFixed(2)}`,
        offset: CIRCUMFERENCE * 0.07,
        tone: "idle",
      };
  }
}

export interface InstrumentSource {
  /** Called each frame. Returns the live reading the geometry is drawn from. */
  read(): { bands: Float32Array; level: number };
}

export function VoiceInstrument({
  phase,
  source,
  reducedMotion,
  label,
}: {
  phase: CallPhase;
  source?: InstrumentSource;
  reducedMotion: boolean;
  label: string;
}) {
  const corona = useRef<SVGPathElement>(null);
  const coronaGlow = useRef<SVGPathElement>(null);
  const emission = useRef<SVGGElement>(null);
  const emissionGlow = useRef<SVGGElement>(null);
  const aperture = useRef<SVGCircleElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const orbit = useRef<SVGGElement>(null);
  const field = useRef<SVGCircleElement>(null);
  const collar = useRef<SVGCircleElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (reducedMotion) return;
    let frame = 0;
    let clock = 0;
    let progress = 0;
    let lit = 0;
    const still = new Float32Array(16);

    const draw = () => {
      frame = window.requestAnimationFrame(draw);
      clock += 0.026;
      const current = phaseRef.current;
      const reading = source?.read() ?? { bands: still, level: 0 };
      const structured = current === "WORKING" || current === "VERIFYING";
      const emitting = current === "REFLOW_SPEAKING";

      const path = structured
        ? spokePath(reading.bands, 1)
        : coronaPath(
            reading.bands,
            emitting
              ? 0.12
              : current === "USER_SPEAKING"
                ? 1
                : Math.min(0.6, reading.level * 2.4),
          );
      corona.current?.setAttribute("d", path);
      // The blurred copy beneath is what gives the ticks their glow off the plate.
      coronaGlow.current?.setAttribute("d", path);

      if (aperture.current) {
        // The aperture opens with the energy actually arriving at the microphone.
        const open = R_APERTURE + reading.level * (emitting ? 4 : 12);
        aperture.current.setAttribute("r", open.toFixed(2));
      }
      if (collar.current) {
        collar.current.setAttribute(
          "r",
          (R_CORE + 7 + reading.level * 7).toFixed(2),
        );
      }
      if (field.current) {
        // The light behind the dial swells with whatever is genuinely sounding.
        lit += (reading.level - lit) * 0.12;
        field.current.setAttribute("r", (96 + lit * 54).toFixed(2));
        field.current.setAttribute("opacity", (0.28 + lit * 0.5).toFixed(3));
      }
      // Reflow speaking is a controlled outward response, not a louder corona: three
      // bands widen from the core. Each is drawn twice — a sharp ring that carries the
      // shape, and a wider blurred copy behind it that carries the light.
      for (const [group, glow] of [
        [emission.current, false],
        [emissionGlow.current, true],
      ] as const) {
        if (!group) continue;
        for (let i = 0; i < group.children.length; i += 1) {
          const ring = group.children[i] as SVGCircleElement;
          ring.setAttribute(
            "r",
            (70 + i * 22 + reading.level * (22 - i * 5)).toFixed(2),
          );
          const strength = 1 - i * 0.26 + reading.level * 0.12;
          ring.setAttribute(
            "opacity",
            emitting ? (strength * (glow ? 0.5 : 0.95)).toFixed(3) : "0",
          );
          ring.setAttribute(
            "stroke-width",
            emitting
              ? (
                  (glow ? 7 : 2.6) -
                  i * 0.5 +
                  reading.level * (glow ? 4 : 1.6)
                ).toFixed(2)
              : "0",
          );
        }
      }
      if (orbit.current) {
        // One slow mark travelling the plate: Reflow's attention while it listens.
        orbit.current.setAttribute(
          "transform",
          `rotate(${((clock * 14) % 360).toFixed(2)} ${MID} ${MID})`,
        );
        orbit.current.setAttribute(
          "opacity",
          current === "LISTENING" ? "1" : "0",
        );
      }
      if (arc.current) {
        progress = structured
          ? (progress + (current === "WORKING" ? 0.004 : 0.011)) % 1
          : 0;
        const geometry = arcGeometry(current, progress);
        arc.current.setAttribute("stroke-dasharray", geometry.dash);
        arc.current.setAttribute("stroke-dashoffset", String(geometry.offset));
      }
    };
    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion, source]);

  // The static composition still differs per phase, so the state is readable with no
  // motion at all — the arc is the carrier, and it is geometry rather than colour.
  const still = arcGeometry(phase, 0.62);
  const structured = phase === "WORKING" || phase === "VERIFYING";
  const restBands = new Float32Array(16).fill(
    phase === "USER_SPEAKING" ? 0.55 : 0.12,
  );
  const restPath = structured
    ? spokePath(restBands, 1)
    : coronaPath(restBands, phase === "USER_SPEAKING" ? 1 : 0.2);

  return (
    <svg
      className={`voice-instrument is-${phase.toLowerCase().replaceAll("_", "-")}`}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={label}
    >
      <defs>
        {/* The lens: key light from upper left, ambient occlusion at the rim, and a
            warm bounce off the plate along the lower edge. */}
        <radialGradient id="voice-lens" cx="36%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="42%" stopColor="var(--surface)" stopOpacity="0.96" />
          <stop offset="78%" stopColor="var(--pale-sage)" stopOpacity="0.92" />
          <stop offset="100%" stopColor="var(--sage)" stopOpacity="0.5" />
        </radialGradient>

        <radialGradient id="voice-bounce" cx="62%" cy="88%" r="52%">
          <stop offset="0%" stopColor="var(--brass)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--brass)" stopOpacity="0" />
        </radialGradient>

        {/* The field: short-range warm light behind the dial, never a halo. */}
        <radialGradient id="voice-field" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.95" />
          <stop offset="46%" stopColor="var(--pale-sage)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--pale-sage)" stopOpacity="0" />
        </radialGradient>

        {/* Ticks graded along their own length: brass at the hub, forest at the rim. */}
        <radialGradient
          id="voice-tick"
          gradientUnits="userSpaceOnUse"
          cx={MID}
          cy={MID}
          r={R_TICK_BASE + R_TICK_SPAN}
        >
          <stop offset="0.62" stopColor="var(--brass)" />
          <stop offset="0.82" stopColor="var(--forest)" />
          <stop offset="1" stopColor="var(--sage)" />
        </radialGradient>

        {/* The plate's machined edge: light catching the top, shadow at the bottom. */}
        <linearGradient id="voice-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="50%" stopColor="var(--line)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--forest)" stopOpacity="0.22" />
        </linearGradient>

        <filter id="voice-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
        <filter id="voice-halo" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="voice-drop" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow
            dx="0"
            dy="6"
            stdDeviation="7"
            floodColor="#17211c"
            floodOpacity="0.13"
          />
        </filter>
      </defs>

      {/* 1 — the light behind the dial. */}
      <circle
        className="voice-field"
        ref={field}
        cx={MID}
        cy={MID}
        r={96}
        fill="url(#voice-field)"
        opacity="0.28"
        aria-hidden="true"
      />

      {/* 2 — the plate. */}
      <g className="voice-plate" aria-hidden="true">
        <circle cx={MID} cy={MID} r={R_PLATE} stroke="url(#voice-rim)" />
        <circle cx={MID} cy={MID} r={R_ARC} />
        <circle cx={MID} cy={MID} r={R_TICK_BASE - 6} />
      </g>

      {/* 3 — index marks at the quarters: the fiducials that give a dial an origin. */}
      <g className="voice-index" aria-hidden="true">
        {[0, 1, 2, 3].map((quarter) => {
          const angle = (quarter / 4) * TAU - Math.PI / 2;
          const [x1, y1] = point(angle, R_PLATE - 7);
          const [x2, y2] = point(angle, R_PLATE + 1);
          return (
            <line
              key={quarter}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={quarter === 0 ? "is-origin" : undefined}
            />
          );
        })}
      </g>

      {/* 4 — Reflow speaking: bands widening outward from the core. */}
      <g
        className="voice-emission-glow"
        ref={emissionGlow}
        filter="url(#voice-halo)"
        aria-hidden="true"
      >
        <circle cx={MID} cy={MID} r={70} opacity="0" strokeWidth="0" />
        <circle cx={MID} cy={MID} r={92} opacity="0" strokeWidth="0" />
        <circle cx={MID} cy={MID} r={114} opacity="0" strokeWidth="0" />
      </g>
      <g className="voice-emission" ref={emission} aria-hidden="true">
        <circle cx={MID} cy={MID} r={70} opacity="0" strokeWidth="0" />
        <circle cx={MID} cy={MID} r={92} opacity="0" strokeWidth="0" />
        <circle cx={MID} cy={MID} r={114} opacity="0" strokeWidth="0" />
      </g>

      {/* 5 — the corona, with a blurred copy beneath so the ticks sit in light. */}
      <path
        className="voice-corona-glow"
        ref={coronaGlow}
        d={restPath}
        filter="url(#voice-halo)"
        aria-hidden="true"
      />
      <path
        className="voice-corona"
        ref={corona}
        d={restPath}
        aria-hidden="true"
      />

      <circle
        className="voice-aperture"
        ref={aperture}
        cx={MID}
        cy={MID}
        r={R_APERTURE}
        aria-hidden="true"
      />

      {/* 6 — the state arc. */}
      <circle
        className={`voice-arc is-${still.tone}`}
        ref={arc}
        cx={MID}
        cy={MID}
        r={R_ARC}
        strokeDasharray={still.dash}
        strokeDashoffset={still.offset}
        aria-hidden="true"
      />

      <g className="voice-orbit" ref={orbit} aria-hidden="true">
        <circle cx={MID} cy={MID - R_PLATE} r={3.4} />
      </g>

      {/* 7 — the lens at the hub. */}
      <g filter="url(#voice-drop)" aria-hidden="true">
        <circle
          className="voice-core"
          cx={MID}
          cy={MID}
          r={R_CORE}
          fill="url(#voice-lens)"
        />
        <circle cx={MID} cy={MID} r={R_CORE} fill="url(#voice-bounce)" />
        {/* The specular: one small highlight, offset toward the key light. */}
        <ellipse
          className="voice-specular"
          cx={MID - 8}
          cy={MID - 11}
          rx={10}
          ry={6.4}
          transform={`rotate(-24 ${MID - 8} ${MID - 11})`}
        />
      </g>
      <circle
        className="voice-collar"
        ref={collar}
        cx={MID}
        cy={MID}
        r={R_CORE + 7}
        aria-hidden="true"
      />

      <g className="voice-core-mark" aria-hidden="true">
        {phase === "VERIFIED" ? (
          <path d={`M${MID - 11} ${MID + 1}l7 7 15-15`} />
        ) : phase === "DISCONNECTED" ? (
          <path d={`M${MID - 9} ${MID}h18`} />
        ) : phase === "UNCONFIRMED" ||
          phase === "DENIED" ||
          phase === "UNSUPPORTED" ? (
          <path d={`M${MID} ${MID - 10}v11M${MID} ${MID + 8}v1.5`} />
        ) : (
          <circle cx={MID} cy={MID} r={4.4} />
        )}
      </g>
    </svg>
  );
}

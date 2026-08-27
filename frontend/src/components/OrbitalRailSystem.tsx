import { useEffect, useRef, useCallback } from "react";
import { useAnchorController } from "../anchors";
import type { StoryStageId } from "../data/proofManifest";

/**
 * OrbitalRailSystem
 *
 * Persistent architectural rails belonging to the physical Reflow instrument.
 * These are NOT semantic workflow paths — they represent the instrument's
 * calibration/orbital geometry and remain visible (at varying opacity) across
 * all story beats.
 *
 * IMPORTANT GEOMETRY RULES:
 *   - Rails are derived from the orb's projected bounds, NOT viewport dimensions
 *   - Rail radii stay within 1.05–1.50× of the orb's projected radius
 *   - Ellipse ry/rx ratio matches the orb's perspective foreshortening (~0.58)
 *   - Rails never travel toward cards, proofs, or page edges
 *   - Only SEMANTIC routes (ThreeFuturesRoute, ActionProofRoute, etc.) may peel away
 */

/* ── Per-beat visual presets ────────────────────────────────────── */

interface RailPresence {
  sage: number;      // primary sage rail opacity
  forest: number;    // secondary forest rail opacity
  brass: number;     // brass calibration node opacity
  labels: number;    // hero-only instrument labels
  tightness: number; // 0 = normal spacing, 1 = tightest (restored equilibrium)
}

const BEAT_PRESENCE: Record<StoryStageId, RailPresence> = {
  hero:       { sage: 0.28, forest: 0.16, brass: 0.58, labels: 0.80, tightness: 0.0  },
  risk:       { sage: 0.20, forest: 0.12, brass: 0.35, labels: 0.0,  tightness: 0.1  },
  futures:    { sage: 0.22, forest: 0.14, brass: 0.40, labels: 0.0,  tightness: 0.1  },
  action:     { sage: 0.18, forest: 0.12, brass: 0.32, labels: 0.0,  tightness: 0.15 },
  incomplete: { sage: 0.14, forest: 0.08, brass: 0.22, labels: 0.0,  tightness: 0.3  },
  replan:     { sage: 0.20, forest: 0.14, brass: 0.38, labels: 0.0,  tightness: 0.2  },
  restored:   { sage: 0.16, forest: 0.10, brass: 0.30, labels: 0.0,  tightness: 0.6  },
};

/* ── Geometry helpers ──────────────────────────────────────────── */

/** SVG elliptical arc for a partial orbit segment */
function arcSegment(
  cx: number, cy: number,
  rx: number, ry: number,
  startDeg: number, sweepDeg: number,
): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const a0 = toRad(startDeg);
  const a1 = toRad(startDeg + sweepDeg);
  const sx = cx + rx * Math.cos(a0);
  const sy = cy + ry * Math.sin(a0);
  const ex = cx + rx * Math.cos(a1);
  const ey = cy + ry * Math.sin(a1);
  const large = Math.abs(sweepDeg) > 180 ? 1 : 0;
  const sweep = sweepDeg > 0 ? 1 : 0;
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 ${large} ${sweep} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

/** Full ellipse */
function fullEllipse(cx: number, cy: number, rx: number, ry: number): string {
  return [
    `M ${(cx - rx).toFixed(1)} ${cy.toFixed(1)}`,
    `A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 1 ${(cx + rx).toFixed(1)} ${cy.toFixed(1)}`,
    `A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 1 ${(cx - rx).toFixed(1)} ${cy.toFixed(1)}`,
    `Z`,
  ].join(" ");
}

/** Position on ellipse at given degree */
function ellipsePoint(cx: number, cy: number, rx: number, ry: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + rx * Math.cos(rad), y: cy + ry * Math.sin(rad) };
}

/** Lerp between two values */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/* ── Brass calibration node positions (degrees on middle rail) ── */
const BRASS_TICKS = [10, 80, 155, 230, 300, 350];

/* ── Hero instrument labels ──────────────────────────────────── */
const HERO_LABELS: { text: string; deg: number; anchor: string; dx: number; dy: number }[] = [
  { text: "DETECT",  deg: 325, anchor: "start",  dx: 6,  dy: -4  },
  { text: "PLAN",    deg: 35,  anchor: "start",  dx: 6,  dy: -4  },
  { text: "ACT",     deg: 145, anchor: "end",    dx: -6, dy: -4  },
  { text: "VERIFY",  deg: 215, anchor: "end",    dx: -6, dy: -4  },
];

/* ── Perspective foreshortening ─────────────────────────────────
 * The camera looks down at the orb (~32° from horizontal).
 * The orb disc is roughly 2.3:1 width:depth in screen projection.
 * So ry ≈ 0.55–0.60 × rx for perspective-matched ellipses.
 */
const PERSPECTIVE_RATIO = 0.58;

/* ── Component ─────────────────────────────────────────────────── */

export function OrbitalRailSystem({ activeStage }: { activeStage: StoryStageId }) {
  const controller = useAnchorController();
  const svgRef = useRef<SVGSVGElement>(null);
  const presence = BEAT_PRESENCE[activeStage];

  const render = useCallback(
    (anchors: Record<string, { x: number; y: number }>) => {
      const orb = anchors["orbRecoveryRoute"];
      if (!orb || !svgRef.current) return;

      const svg = svgRef.current;

      // ── Derive orb center and radius from the anchor ─────────
      // The anchor "orbRecoveryRoute" is placed at [2.35, 0, 0] in 3D,
      // which projects to the orb's right edge in screen space.
      // The orb's projected horizontal radius ≈ the distance from
      // anchor to orb center. We estimate this from the 3D geometry:
      // the orb cylinder has radius ~2.25, anchor at 2.35, so the
      // anchor IS essentially on the perimeter. The projected px size
      // depends on camera distance + scale, but at the current scene
      // scale the orb disc spans roughly 280–320px wide on desktop.
      const orbRx = 155; // half of projected width
      const orbRy = orbRx * PERSPECTIVE_RATIO; // foreshortened depth

      // Center is left of the anchor by the projected radius
      const cx = orb.x - orbRx * 0.92;
      const cy = orb.y + orbRy * 0.12;

      // ── Tightness factor ─────────────────────────────────────
      // t=0: normal spacing, t=1: tightest (all rails very close)
      const t = presence.tightness;

      // Rail multipliers relative to orb radius, compressed by tightness
      // Inner:   1.08 → 1.04 at max tightness
      // Middle:  1.20 → 1.08 at max tightness
      // Outer:   1.38 → 1.14 at max tightness
      const innerMult = lerp(1.08, 1.04, t);
      const middleMult = lerp(1.20, 1.08, t);
      const outerMult = lerp(1.38, 1.14, t);

      const innerRx = orbRx * innerMult;
      const innerRy = orbRy * innerMult;
      const middleRx = orbRx * middleMult;
      const middleRy = orbRy * middleMult;
      const outerRx = orbRx * outerMult;
      const outerRy = orbRy * outerMult;

      // ── Draw rail paths ──────────────────────────────────────
      // Inner rail: nearly hugging the orb, subtle
      const innerEl = svg.querySelector<SVGPathElement>("[data-rail='inner']");
      if (innerEl) innerEl.setAttribute("d", arcSegment(cx, cy, innerRx, innerRy, 170, 270));

      // Middle rail: the primary instrument ring, almost-full ellipse
      const middleFull = svg.querySelector<SVGPathElement>("[data-rail='middle-full']");
      if (middleFull) middleFull.setAttribute("d", fullEllipse(cx, cy, middleRx, middleRy));

      // Middle partial arcs (stronger segments for visual weight variation)
      const middleArcA = svg.querySelector<SVGPathElement>("[data-rail='middle-arc-a']");
      const middleArcB = svg.querySelector<SVGPathElement>("[data-rail='middle-arc-b']");
      if (middleArcA) middleArcA.setAttribute("d", arcSegment(cx, cy, middleRx, middleRy, 200, 140));
      if (middleArcB) middleArcB.setAttribute("d", arcSegment(cx, cy, middleRx, middleRy, 20, 120));

      // Outer rail: partial arc, the outermost calibration ring
      const outerArc = svg.querySelector<SVGPathElement>("[data-rail='outer']");
      if (outerArc) outerArc.setAttribute("d", arcSegment(cx, cy, outerRx, outerRy, 250, 180));

      // ── Brass tick nodes (on middle rail) ────────────────────
      BRASS_TICKS.forEach((deg, i) => {
        const dot = svg.querySelector<SVGCircleElement>(`[data-tick='${i}']`);
        if (dot) {
          const p = ellipsePoint(cx, cy, middleRx, middleRy, deg);
          dot.setAttribute("cx", p.x.toFixed(1));
          dot.setAttribute("cy", p.y.toFixed(1));
        }
      });

      // ── Hero labels (just outside outer rail) ────────────────
      const labelRx = outerRx * 1.08;
      const labelRy = outerRy * 1.12;
      HERO_LABELS.forEach(({ text, deg, anchor, dx, dy }) => {
        const el = svg.querySelector<SVGTextElement>(`[data-label='${text}']`);
        if (el) {
          const p = ellipsePoint(cx, cy, labelRx, labelRy, deg);
          el.setAttribute("x", (p.x + dx).toFixed(1));
          el.setAttribute("y", (p.y + dy).toFixed(1));
          el.setAttribute("text-anchor", anchor);
        }
      });
    },
    [presence.tightness],
  );

  useEffect(() => {
    const unsub = controller.subscribe(render);
    return () => { unsub(); };
  }, [controller, render]);

  return (
    <svg
      ref={svgRef}
      className="orbital-rail-system"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      {/* ── Inner rail: hugging the orb ── */}
      <path
        data-rail="inner"
        fill="none"
        stroke="#91A995"
        strokeWidth="0.75"
        opacity={presence.sage * 0.5}
        style={{ transition: "opacity 0.9s ease" }}
      />

      {/* ── Middle rail: full ellipse (faintest continuous ring) ── */}
      <path
        data-rail="middle-full"
        fill="none"
        stroke="#91A995"
        strokeWidth="0.75"
        opacity={presence.sage * 0.35}
        style={{ transition: "opacity 0.9s ease" }}
      />

      {/* ── Middle rail: emphasized arc segments ── */}
      <path
        data-rail="middle-arc-a"
        fill="none"
        stroke="#91A995"
        strokeWidth="1.1"
        opacity={presence.sage}
        style={{ transition: "opacity 0.9s ease" }}
      />
      <path
        data-rail="middle-arc-b"
        fill="none"
        stroke="#91A995"
        strokeWidth="1"
        opacity={presence.sage * 0.65}
        style={{ transition: "opacity 0.9s ease" }}
      />

      {/* ── Outer rail: partial forest arc ── */}
      <path
        data-rail="outer"
        fill="none"
        stroke="#1D4C39"
        strokeWidth="1"
        opacity={presence.forest}
        style={{ transition: "opacity 0.9s ease" }}
      />

      {/* ── Brass calibration tick nodes ── */}
      {BRASS_TICKS.map((_, i) => (
        <circle
          key={i}
          data-tick={i}
          r={i % 3 === 0 ? "2.2" : "1.5"}
          fill="#B89A64"
          opacity={presence.brass}
          style={{ transition: "opacity 0.9s ease" }}
        />
      ))}

      {/* ── Hero instrument labels ── */}
      {HERO_LABELS.map(({ text }) => (
        <text
          key={text}
          data-label={text}
          fill="#1D4C39"
          opacity={presence.labels}
          fontSize="8.5"
          fontWeight="700"
          letterSpacing="0.16em"
          fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
          style={{ transition: "opacity 0.9s ease" }}
        >
          {text}
        </text>
      ))}
    </svg>
  );
}


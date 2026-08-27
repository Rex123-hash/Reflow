import { useEffect, useRef, useCallback } from "react";
import { useAnchorController } from "../anchors";

/**
 * Generates an orbital arc path from the orb's edge toward a candidate label.
 * 
 * The path starts at the orb perimeter (defined by orbCenter + orbRadius at startAngle),
 * follows a partial orbital arc, then peels off toward the target coordinate.
 * 
 * @param cx       – orb center X in SVG space
 * @param cy       – orb center Y in SVG space
 * @param r        – orbital radius (slightly larger than the visible orb)
 * @param startDeg – angle on the orbit where the rail begins (0 = right, 90 = bottom)
 * @param arcDeg   – how many degrees the path follows the orbit before peeling off
 * @param tx       – target X (candidate label center)
 * @param ty       – target Y (candidate label center)
 */
function orbitalArcPath(
  cx: number, cy: number, r: number,
  startDeg: number, arcDeg: number,
  tx: number, ty: number,
): string {
  const toRad = (d: number) => (d * Math.PI) / 180;

  // Start point on the orbital rail
  const a0 = toRad(startDeg);
  const sx = cx + r * Math.cos(a0);
  const sy = cy + r * Math.sin(a0);

  // End of orbital arc segment (where the peel-off begins)
  const a1 = toRad(startDeg + arcDeg);
  const peelX = cx + r * Math.cos(a1);
  const peelY = cy + r * Math.sin(a1);

  // SVG arc flags
  const largeArc = Math.abs(arcDeg) > 180 ? 1 : 0;
  const sweep = arcDeg > 0 ? 1 : 0;

  // Peel-off: smooth cubic Bézier from the arc tangent toward the target
  // Tangent direction at the peel point (perpendicular to radius, in arc direction)
  const tangentAngle = a1 + (arcDeg > 0 ? Math.PI / 2 : -Math.PI / 2);
  const peelStrength = Math.hypot(tx - peelX, ty - peelY) * 0.38;
  const cp1x = peelX + Math.cos(tangentAngle) * peelStrength;
  const cp1y = peelY + Math.sin(tangentAngle) * peelStrength;

  // Control point pulling toward target
  const cp2x = tx + (peelX - tx) * 0.18;
  const cp2y = ty + (peelY - ty) * 0.18;

  return [
    `M ${sx.toFixed(1)} ${sy.toFixed(1)}`,
    `A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${largeArc} ${sweep} ${peelX.toFixed(1)} ${peelY.toFixed(1)}`,
    `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${tx.toFixed(1)} ${ty.toFixed(1)}`,
  ].join(" ");
}

/** Faint full-circle orbital rail for visual context */
function orbitalRailCircle(cx: number, cy: number, r: number): string {
  return [
    `M ${(cx - r).toFixed(1)} ${cy.toFixed(1)}`,
    `A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${(cx + r).toFixed(1)} ${cy.toFixed(1)}`,
    `A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${(cx - r).toFixed(1)} ${cy.toFixed(1)}`,
    `Z`,
  ].join(" ");
}

export function ThreeFuturesRoute() {
  const controller = useAnchorController();
  const railRef = useRef<SVGPathElement>(null);
  const routeARef = useRef<SVGPathElement>(null);
  const routeBRef = useRef<SVGPathElement>(null);
  const routeCRef = useRef<SVGPathElement>(null);
  const dotARef = useRef<SVGCircleElement>(null);
  const dotBRef = useRef<SVGCircleElement>(null);
  const dotCRef = useRef<SVGCircleElement>(null);

  const update = useCallback((anchors: Record<string, { x: number; y: number }>) => {
    const starts = [anchors["orbFutureA"], anchors["orbFutureB"], anchors["orbFutureC"]];
    const futureA = anchors["futureA"];
    const futureB = anchors["futureB"];
    const futureC = anchors["futureC"];

    if (!starts.every(Boolean) || !routeARef.current || !routeBRef.current || !routeCRef.current) return;
    if (railRef.current) railRef.current.setAttribute("d", "");
    const route = (start:{x:number;y:number}, target:{x:number;y:number}) => { const dx=target.x-start.x, dy=target.y-start.y; const reach=Math.min(92,Math.hypot(dx,dy)*.28); return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${(start.x+reach).toFixed(1)} ${start.y.toFixed(1)}, ${(target.x-dx*.16).toFixed(1)} ${(target.y-dy*.08).toFixed(1)}, ${target.x.toFixed(1)} ${target.y.toFixed(1)}`; };

    // Route A: peels upward-right from ~310° (upper-right quadrant)
    if (futureA) {
      routeARef.current.setAttribute("d", route(starts[0]!, futureA));
      if (dotARef.current) {
        dotARef.current.setAttribute("cx", String(futureA.x));
        dotARef.current.setAttribute("cy", String(futureA.y));
      }
    }

    // Route B (selected): cleanest, most direct path — peels from ~350° (right side)
    if (futureB) {
      routeBRef.current.setAttribute("d", route(starts[1]!, futureB));
      if (dotBRef.current) {
        dotBRef.current.setAttribute("cx", String(futureB.x));
        dotBRef.current.setAttribute("cy", String(futureB.y));
      }
    }

    // Route C: peels downward-right from ~40° (lower-right quadrant)
    if (futureC) {
      routeCRef.current.setAttribute("d", route(starts[2]!, futureC));
      if (dotCRef.current) {
        dotCRef.current.setAttribute("cx", String(futureC.x));
        dotCRef.current.setAttribute("cy", String(futureC.y));
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = controller.subscribe(update);
    return () => { unsubscribe(); };
  }, [controller, update]);

  return (
    <svg
      className="three-futures-route"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
        opacity: "var(--futures-route-opacity, 0)",
      }}
    >
      {/* Faint orbital rail — context ring */}
      <path
        ref={railRef}
        fill="none"
        stroke="var(--sage, #91A995)"
        strokeWidth="1"
        opacity="0.28"
      />

      {/* Route A: inactive orbit → candidate A */}
      <path
        ref={routeARef}
        pathLength="1"
        fill="none"
        stroke="var(--sage, #91A995)"
        strokeWidth="1.25"
        opacity="0.55"
        strokeDasharray="6 4"
        style={{ strokeDasharray: "1", strokeDashoffset: "calc(1 - var(--future-route-a, 0))" }}
      />
      <circle ref={dotARef} r="3.5" fill="var(--sage, #91A995)" style={{ opacity: "var(--future-route-a, 0)" }} />

      {/* Route B: selected — cleanest, most direct, brass progress dot */}
      <path
        ref={routeBRef}
        pathLength="1"
        fill="none"
        stroke="var(--forest, #1d4c39)"
        strokeWidth="1.75"
        opacity="0.82"
        style={{ strokeDasharray: "1", strokeDashoffset: "calc(1 - var(--future-route-b, 0))" }}
      />
      <circle ref={dotBRef} r="4.5" fill="var(--brass, #b89a64)" style={{ opacity: "var(--future-route-b, 0)" }} />

      {/* Route C: inactive orbit → candidate C */}
      <path
        ref={routeCRef}
        pathLength="1"
        fill="none"
        stroke="var(--sage, #91A995)"
        strokeWidth="1.25"
        opacity="0.55"
        strokeDasharray="6 4"
        style={{ strokeDasharray: "1", strokeDashoffset: "calc(1 - var(--future-route-c, 0))" }}
      />
      <circle ref={dotCRef} r="3.5" fill="var(--sage, #91A995)" style={{ opacity: "var(--future-route-c, 0)" }} />
    </svg>
  );
}

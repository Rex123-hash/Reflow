import { useEffect, useRef } from "react";
import { useAnchorController } from "../anchors";

export function ReplanRoute() {
  const controller = useAnchorController();
  const routeRef = useRef<SVGPathElement>(null);
  const endpointRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const unsubscribe = controller.subscribe((anchors) => {
    const origin = anchors.orbRecoveryTangent;
    const target = anchors.replanTarget;
    if (!routeRef.current || !endpointRef.current) return;
    if (!origin || !target) {
      routeRef.current.setAttribute("d", "");
      return;
    }

    const span = Math.max(80, Math.abs(target.x - origin.x) * 0.34);
    routeRef.current.setAttribute(
      "d",
      `M ${origin.x.toFixed(1)} ${origin.y.toFixed(1)} C ${(origin.x + span).toFixed(1)} ${(origin.y + 16).toFixed(1)}, ${(target.x - span * 0.55).toFixed(1)} ${(target.y - 18).toFixed(1)}, ${target.x.toFixed(1)} ${target.y.toFixed(1)}`,
    );
    endpointRef.current.setAttribute("cx", target.x.toFixed(1));
    endpointRef.current.setAttribute("cy", target.y.toFixed(1));
    });
    return () => { unsubscribe(); };
  }, [controller]);

  return (
    <svg className="replan-route" aria-hidden="true">
      <path
        ref={routeRef}
        pathLength="1"
        style={{ strokeDasharray: "1", strokeDashoffset: "calc(1 - var(--replan-route-progress, 0))" }}
      />
      <circle ref={endpointRef} r="4.5" style={{ opacity: "var(--replan-route-progress, 0)" }} />
    </svg>
  );
}

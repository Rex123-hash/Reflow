import { useEffect, useRef } from "react";
import { useAnchorController } from "../anchors";

export function RestoredRoute() {
  const controller = useAnchorController();
  const routeRef = useRef<SVGPathElement>(null);
  const dot1Ref = useRef<SVGCircleElement>(null);
  const dot2Ref = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const unsubscribe = controller.subscribe((anchors) => {
      const orb = anchors["orbRecoveryRoute"];
      const receipt = anchors["restoredReceipt"];

      if (!orb || !receipt || !routeRef.current || !dot1Ref.current || !dot2Ref.current) return;

      const startX = orb.x;
      const startY = orb.y;

      // Terminate at the proof panel's upper-left boundary instead of drawing
      // across its checklist rows. The registered anchor is the card center.
      const endX = receipt.x - 225;
      const endY = receipt.y - 138;

      const curveStrength = Math.max(Math.abs(endX - startX), Math.abs(endY - startY)) * 0.5;
      
      const cp1X = startX + curveStrength * 0.4;
      const cp1Y = startY + (endY > startY ? curveStrength * 0.6 : -curveStrength * 0.6);
      
      const cp2X = endX - curveStrength * 0.4;
      const cp2Y = endY;
      
      const d = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
      routeRef.current.setAttribute("d", d);

      dot1Ref.current.setAttribute("cx", String(startX));
      dot1Ref.current.setAttribute("cy", String(startY));
      dot2Ref.current.setAttribute("cx", String(endX));
      dot2Ref.current.setAttribute("cy", String(endY));
    });

    return () => {
      unsubscribe();
    };
  }, [controller]);

  return (
    <svg 
      className="restored-route" 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        pointerEvents: 'none', 
        zIndex: 10,
        opacity: "var(--restored-route-opacity, 0)",
      }}
    >
      <path 
        ref={routeRef} 
        pathLength="1"
        fill="none" 
        stroke="#1d4c39" 
        strokeWidth="2" 
        style={{ strokeDasharray: "1", strokeDashoffset: "calc(1 - var(--restored-route-progress, 0))" }}
      />
      <circle ref={dot1Ref} r="4" fill="#1d4c39" display="none" />
      <circle ref={dot2Ref} r="5" fill="#B89A64" style={{ opacity: "var(--restored-route-progress, 0)" }} />
    </svg>
  );
}

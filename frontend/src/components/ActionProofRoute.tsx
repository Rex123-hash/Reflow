import { useEffect, useRef } from "react";
import { useAnchorController } from "../anchors";

export function ActionProofRoute({ debug = false }: { debug?: boolean }) {
  const controller = useAnchorController();
  const routeRef = useRef<SVGPathElement>(null);
  const dot1Ref = useRef<SVGCircleElement>(null);
  const dot2Ref = useRef<SVGCircleElement>(null);

  useEffect(() => {
    // We subscribe outside the React render cycle to avoid frame-by-frame rerenders.
    const unsubscribe = controller.subscribe((anchors) => {
      const orb = anchors["orbRecoveryRoute"];
      const receipt = anchors["actionReceipt"];

      if (dot1Ref.current) {
        if (orb) {
          dot1Ref.current.setAttribute("cx", String(orb.x));
          dot1Ref.current.setAttribute("cy", String(orb.y));
          dot1Ref.current.setAttribute("display", "block");
        } else {
          dot1Ref.current.setAttribute("display", "none");
        }
      }

      if (dot2Ref.current) {
        if (receipt) {
          dot2Ref.current.setAttribute("cx", String(receipt.x));
          dot2Ref.current.setAttribute("cy", String(receipt.y));
          dot2Ref.current.setAttribute("display", "block");
        } else {
          dot2Ref.current.setAttribute("display", "none");
        }
      }

      if (!routeRef.current) return;

      if (!orb || !receipt) {
        routeRef.current.setAttribute("d", "");
        return;
      }

      const startX = orb.x;
      const startY = orb.y;
      // Connect near the checkmark on the left of the independent verification row
      const endX = receipt.x;
      const endY = receipt.y;
      
      const distX = endX - startX;
      
      // Preserve tangent departure (horizontal right) with a wide-radius trajectory
      const tangent = Math.min(110, Math.abs(distX) * 0.28);
      const cp1X = startX + tangent;
      const cp1Y = startY - 8;
      
      const cp2X = endX - Math.min(96, Math.abs(distX) * 0.22);
      const cp2Y = endY;
      
      const d = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
      routeRef.current.setAttribute("d", d);
    });
    
    return () => {
      unsubscribe();
    };
  }, [controller]);

  return (
    <svg 
      className="action-proof-route" 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        pointerEvents: 'none', 
        zIndex: 10,
        opacity: "var(--action-route-opacity, 0)",
      }}
    >
      <path 
        ref={routeRef} 
        pathLength="1"
        fill="none" 
        stroke="#1d4c39" // forest green
        strokeWidth="2" 
        style={{ strokeDasharray: "1", strokeDashoffset: "calc(1 - var(--action-route-progress, 0))" }}
      />
      {/* Brass proof node for the receipt anchor */}
      <circle ref={dot1Ref} r="4" fill="#1d4c39" display={debug ? "block" : "none"} />
      <circle ref={dot2Ref} r="5" fill="#B89A64" style={{ opacity: "var(--action-route-progress, 0)" }} />
    </svg>
  );
}

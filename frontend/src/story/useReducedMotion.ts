import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
  const forcedReduced =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("motion") === "reduced";
  const [reduced, setReduced] = useState(() =>
    forcedReduced ||
    (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches),
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(forcedReduced || query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [forcedReduced]);

  return reduced;
}

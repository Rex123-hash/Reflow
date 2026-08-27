import { useEffect, useRef } from "react";
import { useAnchorController } from "./AnchorSystem";

export function useAnchorDOM<T extends HTMLElement>(id: string) {
  const ref = useRef<T | null>(null);
  const controller = useAnchorController();

  useEffect(() => {
    controller.registerDOM(id, ref.current);
    return () => {
      controller.registerDOM(id, null);
    };
  }, [id, controller]);

  return ref;
}

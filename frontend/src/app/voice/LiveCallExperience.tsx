import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { LiveCallStage } from "./LiveCallStage";
import { useLiveCall } from "./useLiveCall";
import "./voice.css";

/**
 * Wires the live session to the stage and owns nothing else.
 *
 * The call is a sibling of the route rather than a child of the composer, so the
 * workspace behind it keeps rendering and the reader keeps their place.
 */
export function LiveCallExperience({
  incidentId,
  objectiveTitle,
  onClose,
}: {
  incidentId: string;
  objectiveTitle: string;
  onClose(): void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const { view, actions } = useLiveCall(incidentId, reducedMotion);
  const [leaving, setLeaving] = useState(false);
  const exit = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (exit.current !== null) window.clearTimeout(exit.current);
    },
    [],
  );

  // The page behind must not scroll under the call.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <LiveCallStage
      view={{ ...view, objectiveTitle }}
      reducedMotion={reducedMotion}
      leaving={leaving}
      actions={{
        ...actions,
        end: () => {
          // The session stops immediately; only the closing beat is deferred.
          actions.end();
          if (reducedMotion || exit.current !== null) {
            onClose();
            return;
          }
          setLeaving(true);
          exit.current = window.setTimeout(onClose, 240);
        },
      }}
    />
  );
}

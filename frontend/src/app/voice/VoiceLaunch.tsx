import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LiveCallExperience } from "./LiveCallExperience";

/**
 * One live call for the whole application.
 *
 * The call used to be owned by the Operator conversation, which meant it could only
 * be reached from the one surface that already knew about voice. Hoisting it to the
 * shell lets any route open it — the Operator hero, the persistent dock — without
 * mounting a second session or duplicating the overlay, and it keeps the rule that
 * exactly one call can be running.
 *
 * The provider holds no session state of its own. It records which incident the call
 * is about and hands that to the unchanged `LiveCallExperience`.
 */

interface VoiceLaunchValue {
  /** True while a call is running, so an affordance can render as engaged. */
  active: boolean;
  open(incidentId: string, objectiveTitle: string): void;
  close(): void;
}

const VoiceLaunchContext = createContext<VoiceLaunchValue | null>(null);

export function useVoiceLaunch(): VoiceLaunchValue {
  const value = useContext(VoiceLaunchContext);
  if (!value)
    throw new Error("useVoiceLaunch requires a VoiceLaunchProvider ancestor.");
  return value;
}

export function VoiceLaunchProvider({ children }: { children: ReactNode }) {
  const [call, setCall] = useState<{
    incidentId: string;
    objectiveTitle: string;
  } | null>(null);

  const close = useCallback(() => setCall(null), []);
  const open = useCallback(
    (incidentId: string, objectiveTitle: string) =>
      setCall({ incidentId, objectiveTitle }),
    [],
  );

  const value = useMemo(
    () => ({ active: call !== null, open, close }),
    [call, open, close],
  );

  return (
    <VoiceLaunchContext.Provider value={value}>
      {children}
      {call ? (
        <LiveCallExperience
          incidentId={call.incidentId}
          objectiveTitle={call.objectiveTitle}
          onClose={close}
        />
      ) : null}
    </VoiceLaunchContext.Provider>
  );
}

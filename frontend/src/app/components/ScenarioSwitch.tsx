import { useUiData } from "../data/UiDataContext";
import "./scenario-switch.css";

/**
 * Development-only control over which exported presentation the Recovery Room
 * reads.
 *
 * Both options are real backend exports of the same canonical incident: revision
 * 16 (VERIFYING) and revision 17 (RESOLVED). Neither is a live read, and neither is
 * labelled as one. Overview, Objectives, Evidence and Operator always render their
 * own revision-17 exports — there is no exported revision-16 presentation of those
 * surfaces and none is synthesized.
 *
 * This disappears entirely once the API provider is wired.
 */
export function ScenarioSwitch() {
  const { scenario, setScenario, isFixtureProvider } = useUiData();
  if (!isFixtureProvider || !import.meta.env.DEV) return null;

  return (
    <div
      className="scenario-switch"
      role="group"
      aria-label="Recorded presentation"
    >
      <span className="scenario-switch-label">Recorded</span>
      <button
        type="button"
        className={scenario === "active" ? "is-on" : undefined}
        aria-pressed={scenario === "active"}
        onClick={() => setScenario("active")}
      >
        rev 16
      </button>
      <button
        type="button"
        className={scenario === "restored" ? "is-on" : undefined}
        aria-pressed={scenario === "restored"}
        onClick={() => setScenario("restored")}
      >
        rev 17
      </button>
    </div>
  );
}

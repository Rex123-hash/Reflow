import { DialMark } from "./DialMark";
import { useVoiceLaunch } from "./VoiceLaunch";

/**
 * The Operator hero: Reflow's live call, stated as a capability.
 *
 * A live voice conversation with an agent that can inspect, explain and request
 * bounded operational changes is one of the strongest things this product does, and
 * it was previously a chip the same size as an example prompt. This is a full-width
 * launch control instead — the dial the call opens into, the capability named, and
 * one line saying what it actually is.
 *
 * It is still one element, not a card stack. The weight comes from scale, the
 * illuminated edge the composer already uses, and position directly beneath the
 * field — not from adding surface area.
 */
export function VoiceLaunchBar({
  incidentId,
  objectiveTitle,
  disabled,
}: {
  incidentId: string;
  objectiveTitle: string;
  disabled: boolean;
}) {
  const launch = useVoiceLaunch();

  return (
    <button
      type="button"
      className="voice-launch"
      disabled={disabled}
      onClick={() => launch.open(incidentId, objectiveTitle)}
    >
      <span className="voice-launch-dial" aria-hidden="true">
        <DialMark size={46} />
      </span>

      <span className="voice-launch-copy">
        <span className="voice-launch-title">Talk to Reflow</span>
        <span className="voice-launch-lede">
          A live voice conversation about this recovery. Reflow listens,
          answers, and hands operational work to the same controlled Operator.
        </span>
      </span>

      <span className="voice-launch-tail">
        <span className="voice-launch-badge">
          <i aria-hidden="true" />
          Live
        </span>
        <span className="voice-launch-go" aria-hidden="true">
          Start
        </span>
      </span>
    </button>
  );
}

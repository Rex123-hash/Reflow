import type { ReactNode } from "react";
import { ICON_SIZE } from "../components/Icon";
import { elapsedLabel } from "./callModel";
import { useDictation } from "./useDictation";

/**
 * The microphone in the Operator composer.
 *
 * Deliberately ordinary. Dictation is a second way to type, so it takes over the
 * composer's own field rather than opening a panel beside it: while recording, the
 * input is replaced in place by a compact listening strip carrying real level, what
 * has been heard so far, elapsed time, Stop and Cancel. The field's border, radius and
 * height do not change, so the composer never shifts under the reader.
 *
 * The finalized transcript lands in the field and stops there — nothing is sent, and
 * nothing acts.
 *
 * The caller places both pieces: the mic sits in the field's control slot, and the
 * strip replaces the input, so this component hands them back rather than positioning
 * them itself.
 */

const BARS = 22;

export function VoiceComposer({
  incidentId,
  disabled,
  onTranscript,
  children,
}: {
  incidentId: string;
  disabled: boolean;
  onTranscript(text: string): void;
  /** `strip` is null unless a take is running, in which case it replaces the input. */
  children(mic: ReactNode, strip: ReactNode | null): ReactNode;
}) {
  const { state, start, stop, cancel, dismiss } = useDictation(
    incidentId,
    onTranscript,
  );
  const recording =
    state.status === "LISTENING" || state.status === "REQUESTING";
  const finalizing = state.status === "FINALIZING";
  const open = recording || finalizing;

  const mic = (
    <button
      type="button"
      className="voice-mic"
      disabled={disabled || open}
      onClick={() => void start()}
      aria-label="Dictate a request"
      title="Dictate a request"
    >
      <MicGlyph />
    </button>
  );

  const strip = open ? (
    <div
      className={`voice-strip${finalizing ? " is-finalizing" : ""}`}
      style={{ "--voice-level": state.level.toFixed(3) } as React.CSSProperties}
    >
      <span className="voice-strip-state" role="status" aria-live="polite">
        <span className="voice-strip-dot" aria-hidden="true" />
        {state.status === "REQUESTING"
          ? "Opening the microphone"
          : finalizing
            ? "Finishing"
            : "Listening"}
      </span>

      {/* Level is drawn as geometry and stated as a number, never colour alone. */}
      <span
        className="voice-meter"
        role="meter"
        aria-label="Microphone level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(state.level * 100)}
      >
        {Array.from({ length: BARS }, (_, index) => (
          <i key={index} style={{ "--i": index } as React.CSSProperties} />
        ))}
      </span>

      {/* What has been heard, in the field's own place, on one line. */}
      <span className="voice-strip-heard">{state.interim}</span>

      <time className="voice-strip-timer mono">
        {elapsedLabel(state.elapsedSeconds)}
      </time>

      <button
        type="button"
        className="voice-strip-stop"
        onClick={stop}
        disabled={finalizing}
      >
        Stop
      </button>
      <button
        type="button"
        className="voice-strip-cancel"
        onClick={cancel}
        disabled={finalizing}
      >
        Cancel
      </button>
    </div>
  ) : null;

  return (
    <>
      {children(mic, strip)}

      {state.error && !open ? (
        <p className="voice-compose-error" role="alert">
          {state.error}
          <button type="button" className="voice-dismiss" onClick={dismiss}>
            Dismiss
          </button>
        </p>
      ) : null}
    </>
  );
}

/**
 * The microphone glyph.
 *
 * Drawn here rather than added to the shared Icon set: that set is the product's
 * semantic vocabulary for entities, stages and intents, and a device affordance is
 * none of those. Same 24-grid and stroke weight, so it sits in the same family.
 */
export function MicGlyph() {
  return (
    <svg
      width={ICON_SIZE.header}
      height={ICON_SIZE.header}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </svg>
  );
}

/**
 * The same microphone, struck through.
 *
 * A muted microphone is a microphone, not a failed check: the verification family —
 * closed rings and check marks — is reserved for outcomes Reflow actually verified,
 * and a device state must never borrow it.
 */
export function MicOffGlyph() {
  return (
    <svg
      width={ICON_SIZE.header}
      height={ICON_SIZE.header}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M15 5.2A3 3 0 0 0 9 6v5M9 13.4a3 3 0 0 0 5.1 1.5" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 9.9 5.6M18.5 11.5a6.5 6.5 0 0 1-.4 2.2M12 18v3" />
      <path d="M4 3l16 18" />
    </svg>
  );
}

/** The live-call entry: the instrument, miniaturised to three orbiting marks. */
export function CallGlyph() {
  return (
    <svg
      width={ICON_SIZE.row}
      height={ICON_SIZE.row}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9.2" opacity="0.4" />
      <circle cx="12" cy="12" r="2.6" />
      <circle cx="12" cy="2.8" r="1.6" stroke="none" />
    </svg>
  );
}

import { useEffect, useRef } from "react";
import { Icon, ICON_SIZE } from "../components/Icon";
import { MicGlyph, MicOffGlyph } from "./VoiceComposer";
import {
  elapsedLabel,
  PHASE_COPY,
  resultCaption,
  type CallPhase,
  type TranscriptEntry,
} from "./callModel";
import { VoiceInstrument, type InstrumentSource } from "./VoiceInstrument";
import type { VoiceOperatorHandoffResult } from "./voiceContract";

/**
 * The call, as a pure rendering of one value.
 *
 * Keeping the stage presentational is what lets every state be exercised — in tests and
 * by eye — without a microphone, a socket or a live model, and it keeps the sixty-frame
 * work in the instrument rather than in React.
 */
export interface CallView {
  phase: CallPhase;
  elapsedSeconds: number;
  muted: boolean;
  transcript: TranscriptEntry[];
  /** What the user is saying right now, before it is finalized. */
  interim: string;
  incidentId: string;
  /** What the call is about, in the objective's own words. */
  objectiveTitle: string;
  error: string | null;
  lastResult: VoiceOperatorHandoffResult | null;
  source?: InstrumentSource;
}

export interface CallActions {
  toggleMute(): void;
  end(): void;
  reconnect(): void;
}

const SPEAKER_LABEL: Record<TranscriptEntry["speaker"], string> = {
  you: "You",
  reflow: "Reflow",
  operator: "Operator",
};

export function LiveCallStage({
  view,
  actions,
  reducedMotion,
  leaving = false,
}: {
  view: CallView;
  actions: CallActions;
  reducedMotion: boolean;
  /** Plays the exit before the tree unmounts, so the call recedes rather than cuts. */
  leaving?: boolean;
}) {
  const copy = PHASE_COPY[view.phase];
  const endButton = useRef<HTMLButtonElement>(null);
  const disconnected = view.phase === "DISCONNECTED";

  useEffect(() => {
    endButton.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") actions.end();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions]);

  return (
    <div
      className={`voice-call is-${view.phase.toLowerCase().replaceAll("_", "-")} tone-${copy.tone}${
        leaving ? " is-leaving" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Reflow live call"
    >
      {/* The workspace recedes behind this rather than disappearing: the reader keeps
          their place, but the call is unmistakably the foreground. */}
      <div className="voice-call-scrim" aria-hidden="true" />

      <div className="voice-call-frame">
        <header className="voice-call-head">
          <span className="voice-call-mark">
            <span className="voice-call-dot" aria-hidden="true" />
            Live call
          </span>
          <span className="voice-call-subject" title={view.objectiveTitle}>
            {view.objectiveTitle}
          </span>
          <span className="voice-call-timer">
            <span className="visually-hidden">Call duration </span>
            <time>{elapsedLabel(view.elapsedSeconds)}</time>
          </span>
        </header>

        <div className="voice-call-stage">
          <VoiceInstrument
            phase={view.phase}
            source={view.source}
            reducedMotion={reducedMotion}
            label={`Reflow voice instrument. ${copy.label}. ${copy.caption}`}
          />

          {/* The state in words, always, so nothing is carried by motion or colour. */}
          <div className="voice-call-state" role="status" aria-live="polite">
            <p className="voice-call-phase">{copy.label}</p>
            <p className="voice-call-caption">{copy.caption}</p>
          </div>

          {view.interim && !disconnected ? (
            <p className="voice-call-interim">
              <span className="visually-hidden">You are saying </span>
              {view.interim}
            </p>
          ) : null}

          {view.lastResult ? (
            <section className="voice-call-result">
              <p className="field-label">Operator result</p>
              {/* The backend owns the opening sentence of this text. It is rendered
                  as returned; the call never rewrites an outcome into a better one. */}
              <p className="voice-call-spoken">
                {view.lastResult.spoken_result}
              </p>
              <p className="voice-call-boundary">
                {resultCaption(view.lastResult)}
              </p>
              {view.lastResult.action_verified &&
              !view.lastResult.objective_recovered ? (
                <p className="voice-call-distinction">
                  Action verified — the objective is not recorded as recovered.
                </p>
              ) : null}
            </section>
          ) : null}

          {view.error ? (
            <p className="voice-call-error" role="alert">
              {view.error}
            </p>
          ) : null}
        </div>

        <div className="voice-call-controls">
          {disconnected ? (
            <button
              type="button"
              className="btn btn-secondary voice-call-control"
              onClick={actions.reconnect}
            >
              <Icon name="arrow-right" size={ICON_SIZE.row} />
              Reconnect
            </button>
          ) : (
            <button
              type="button"
              className={`btn btn-secondary voice-call-control${view.muted ? " is-muted" : ""}`}
              onClick={actions.toggleMute}
              aria-pressed={view.muted}
            >
              {view.muted ? <MicOffGlyph /> : <MicGlyph />}
              {view.muted ? "Muted" : "Mic on"}
            </button>
          )}

          <button
            type="button"
            ref={endButton}
            className="btn voice-call-end"
            onClick={actions.end}
          >
            End call
          </button>
        </div>

        <details className="voice-call-transcript">
          <summary>
            <span>Transcript</span>
            <small>{view.transcript.length} turns</small>
          </summary>
          <ol>
            {view.transcript.map((entry) => (
              <li key={entry.id} className={`is-${entry.speaker}`}>
                <span className="voice-turn-speaker">
                  {SPEAKER_LABEL[entry.speaker]}
                </span>
                <p>{entry.text}</p>
                {entry.outcome ? (
                  <span className="voice-turn-outcome">
                    {entry.outcome.replaceAll("_", " ").toLowerCase()}
                  </span>
                ) : null}
              </li>
            ))}
            {view.transcript.length === 0 ? (
              <li className="is-empty">Nothing has been said yet.</li>
            ) : null}
          </ol>
          <p className="voice-call-proof-note">
            Incident <span className="mono">{view.incidentId}</span>. Receipts,
            evidence and the full proof stay in Operator, where the technical
            detail belongs.
          </p>
        </details>
      </div>
    </div>
  );
}

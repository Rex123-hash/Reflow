import { useCallback, useEffect, useRef, useState } from "react";
import {
  MicrophonePermissionError,
  startCapture,
  type AudioCapture,
} from "./audioCapture";
import { openTranscriptionSocket, type LiveSocket } from "./liveSession";
import { createTranscriptionSession, VoiceSessionError } from "./voiceClient";

/**
 * Dictation as composition, never as execution.
 *
 * Speech becomes text and the text lands in the ordinary Operator field. Nothing here
 * submits anything: recognising a sentence is not a decision to act on it, so the user
 * still reads what was heard and still presses Send.
 */
export type DictationStatus =
  "IDLE" | "REQUESTING" | "LISTENING" | "FINALIZING" | "DENIED" | "UNAVAILABLE";

const BANDS = 12;

export interface DictationState {
  status: DictationStatus;
  /** What has been heard so far this take. */
  interim: string;
  /** Smoothed microphone energy, 0..1, for the level meter. */
  level: number;
  elapsedSeconds: number;
  error: string | null;
}

export function useDictation(
  incidentId: string,
  onTranscript: (text: string) => void,
) {
  const [status, setStatus] = useState<DictationStatus>("IDLE");
  const [interim, setInterim] = useState("");
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const capture = useRef<AudioCapture | null>(null);
  const socket = useRef<LiveSocket | null>(null);
  const aborter = useRef<AbortController | null>(null);
  const text = useRef("");
  const meter = useRef<number | null>(null);
  const ticker = useRef<number | null>(null);
  const deadline = useRef<number | null>(null);
  const finalizer = useRef<number | null>(null);

  const release = useCallback(() => {
    aborter.current?.abort();
    aborter.current = null;
    socket.current?.close();
    socket.current = null;
    capture.current?.stop();
    capture.current = null;
    if (meter.current !== null) window.clearInterval(meter.current);
    if (ticker.current !== null) window.clearInterval(ticker.current);
    if (deadline.current !== null) window.clearTimeout(deadline.current);
    if (finalizer.current !== null) window.clearTimeout(finalizer.current);
    meter.current = null;
    ticker.current = null;
    deadline.current = null;
    finalizer.current = null;
    setLevel(0);
  }, []);

  useEffect(() => release, [release]);

  const stop = useCallback(() => {
    const heard = text.current.trim();
    release();
    setStatus("FINALIZING");
    // One frame so the interface can show the take closing rather than snapping.
    finalizer.current = window.setTimeout(() => {
      finalizer.current = null;
      setStatus("IDLE");
      setInterim("");
      if (heard) onTranscript(heard);
    }, 260);
  }, [onTranscript, release]);

  const start = useCallback(async () => {
    if (status !== "IDLE" && status !== "DENIED" && status !== "UNAVAILABLE")
      return;
    setError(null);
    setInterim("");
    setElapsed(0);
    text.current = "";
    setStatus("REQUESTING");
    const controller = new AbortController();
    aborter.current = controller;
    try {
      const session = await createTranscriptionSession(
        incidentId,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      capture.current = await startCapture({
        sampleRateHz: session.audio_input.sample_rate_hz,
        bandCount: BANDS,
        onChunk: (pcm) => socket.current?.sendAudio(pcm),
      });
      if (controller.signal.aborted) {
        capture.current.stop();
        capture.current = null;
        return;
      }
      socket.current = openTranscriptionSocket(session, {
        onOpen: () => setStatus("LISTENING"),
        onInputTranscript: (fragment) => {
          text.current += fragment;
          setInterim(text.current.trim());
        },
        onClose: ({ clean, code, reason }) => {
          setStatus((current) =>
            current === "LISTENING" || current === "REQUESTING"
              ? "UNAVAILABLE"
              : current,
          );
          if (!clean || code !== 1000) {
            const detail = reason ? `: ${reason}` : "";
            setError(
              `Google transcription closed the session (${code}${detail}).`,
            );
          }
        },
        onError: () => setError("The transcription connection dropped."),
      });
      meter.current = window.setInterval(() => {
        setLevel(capture.current?.analyse().level ?? 0);
      }, 80);
      ticker.current = window.setInterval(
        () => setElapsed((value) => value + 1),
        1000,
      );
      // The documented session bound; stopping cleanly beats being cut off.
      deadline.current = window.setTimeout(() => {
        deadline.current = null;
        if (socket.current) stop();
      }, session.max_session_seconds * 1000);
    } catch (cause) {
      release();
      if (controller.signal.aborted) return;
      if (cause instanceof MicrophonePermissionError) {
        setStatus("DENIED");
        setError(cause.message);
        return;
      }
      setStatus("UNAVAILABLE");
      setError(
        cause instanceof VoiceSessionError
          ? cause.message
          : "Reflow could not start dictation.",
      );
    }
  }, [incidentId, status, release, stop]);

  const cancel = useCallback(() => {
    text.current = "";
    release();
    setStatus("IDLE");
    setInterim("");
    setElapsed(0);
    setError(null);
  }, [release]);

  const dismiss = useCallback(() => {
    setStatus("IDLE");
    setError(null);
  }, []);

  const state: DictationState = {
    status,
    interim,
    level,
    elapsedSeconds: elapsed,
    error,
  };
  return { state, start, stop, cancel, dismiss };
}

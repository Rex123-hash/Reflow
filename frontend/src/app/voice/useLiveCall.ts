import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startCapture, type AudioCapture } from "./audioCapture";
import { createPlayback, type AudioPlayback } from "./audioPlayback";
import {
  phaseForResult,
  type CallPhase,
  type TranscriptEntry,
} from "./callModel";
import { openLiveCallSocket, type LiveSocket } from "./liveSession";
import type { CallView } from "./LiveCallStage";
import {
  createLiveSession,
  handOffToOperator,
  spokenRequestKey,
  VoiceSessionError,
} from "./voiceClient";
import {
  OPERATOR_HANDOFF_TOOL,
  type VoiceOperatorHandoffResult,
} from "./voiceContract";

const BANDS = 16;
/** How long a settled outcome holds the instrument before listening resumes. */
const OUTCOME_HOLD_MS = 7_000;
/** The read-back reveal. Long enough to read, short enough not to be a wait. */
const VERIFYING_MS = 1_100;
const SPEAKING_LEVEL = 0.06;

type Activity = "idle" | "user" | "reflow";

/** Phases that a passing sound must not overwrite. */
const STICKY: ReadonlySet<CallPhase> = new Set([
  "CONNECTING",
  "WORKING",
  "VERIFYING",
  "VERIFIED",
  "UNCONFIRMED",
  "DENIED",
  "UNSUPPORTED",
  "DISCONNECTED",
]);

let turnId = 0;
const nextId = () => `turn-${(turnId += 1)}`;

export function useLiveCall(incidentId: string, reducedMotion: boolean) {
  const [base, setBase] = useState<CallPhase>("CONNECTING");
  const [activity, setActivity] = useState<Activity>("idle");
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] =
    useState<VoiceOperatorHandoffResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const capture = useRef<AudioCapture | null>(null);
  const playback = useRef<AudioPlayback | null>(null);
  const socket = useRef<LiveSocket | null>(null);
  const sessionId = useRef<string>("");
  const aborter = useRef<AbortController | null>(null);
  const holdTimer = useRef<number | null>(null);
  const verifyTimer = useRef<number | null>(null);
  const spoken = useRef<{ you: string; reflow: string }>({
    you: "",
    reflow: "",
  });
  const ended = useRef(false);

  const clearTimers = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    if (verifyTimer.current !== null) window.clearTimeout(verifyTimer.current);
    holdTimer.current = null;
    verifyTimer.current = null;
  };

  const teardown = useCallback(() => {
    ended.current = true;
    clearTimers();
    aborter.current?.abort();
    aborter.current = null;
    socket.current?.close();
    socket.current = null;
    capture.current?.stop();
    capture.current = null;
    playback.current?.stop();
    playback.current = null;
  }, []);

  /** Commits whatever a speaker has been accumulating as one transcript turn. */
  const commit = useCallback((who: "you" | "reflow") => {
    const text = spoken.current[who].trim();
    spoken.current[who] = "";
    if (!text) return;
    setTranscript((rows) => [
      ...rows,
      { id: nextId(), speaker: who, text, at: Date.now() },
    ]);
    if (who === "you") setInterim("");
  }, []);

  useEffect(() => {
    ended.current = false;
    let disposed = false;
    const controller = new AbortController();
    aborter.current = controller;

    const settle = (phase: CallPhase) => {
      if (disposed) return;
      setBase(phase);
      clearTimers();
      holdTimer.current = window.setTimeout(() => {
        setBase((current) =>
          STICKY.has(current) && current !== "DISCONNECTED"
            ? "LISTENING"
            : current,
        );
      }, OUTCOME_HOLD_MS);
    };

    const runHandoff = async (call: {
      id: string;
      name: string;
      args: Record<string, unknown>;
    }) => {
      const request = String(call.args.spoken_request ?? "").trim();
      if (!request) return;
      clearTimers();
      setLastResult(null);
      setBase("WORKING");
      // The synchronous tool call owns this user row. Drop the same accumulated
      // transcription so the later turn-complete frame cannot record it twice.
      spoken.current.you = "";
      setInterim("");
      setTranscript((rows) => [
        ...rows,
        { id: nextId(), speaker: "you", text: request, at: Date.now() },
      ]);
      try {
        const result = await handOffToOperator(
          {
            voice_session_id: sessionId.current,
            incident_id: incidentId,
            spoken_request: request,
            idempotency_key: await spokenRequestKey(sessionId.current, request),
          },
          controller.signal,
        );
        if (disposed) return;
        setLastResult(result);
        setTranscript((rows) => [
          ...rows,
          {
            id: nextId(),
            speaker: "operator",
            text: result.spoken_result,
            outcome: result.outcome,
            at: Date.now(),
          },
        ]);
        // The model is told the truthful result and speaks that. It is never told a
        // summary this layer invented, and never told anything before the result.
        socket.current?.sendToolResponse(call.id, call.name, {
          outcome: result.outcome,
          spoken_result: result.spoken_result,
          truth_boundary: result.truth_boundary,
          action_verified: result.action_verified,
          objective_recovered: result.objective_recovered,
        });
        const next = phaseForResult(result);
        if (next === "VERIFIED" && !reducedMotion) {
          setBase("VERIFYING");
          verifyTimer.current = window.setTimeout(
            () => settle("VERIFIED"),
            VERIFYING_MS,
          );
        } else if (next === "REFLOW_SPEAKING") {
          setBase("LISTENING");
        } else {
          settle(next);
        }
      } catch (cause) {
        if (disposed || controller.signal.aborted) return;
        socket.current?.sendToolResponse(call.id, call.name, {
          outcome: "HANDOFF_FAILED",
          spoken_result:
            "Reflow could not finish that request, so I cannot report any result.",
          truth_boundary: "Nothing was attempted, changed, or verified.",
          action_verified: false,
          objective_recovered: false,
        });
        setError(
          cause instanceof VoiceSessionError
            ? cause.message
            : "Reflow could not finish that request.",
        );
        settle("UNCONFIRMED");
      }
    };

    const connect = async () => {
      try {
        const session = await createLiveSession(incidentId, controller.signal);
        if (disposed) return;
        sessionId.current = session.session_id;
        playback.current = createPlayback(BANDS);
        capture.current = await startCapture({
          sampleRateHz: session.audio_input.sample_rate_hz,
          bandCount: BANDS,
          onChunk: (pcm) => socket.current?.sendAudio(pcm),
        });
        if (disposed) {
          capture.current.stop();
          capture.current = null;
          return;
        }
        socket.current = openLiveCallSocket(session, {
          onOpen: () => !disposed && setBase("LISTENING"),
          onInputTranscript: (text) => {
            spoken.current.you += text;
            setInterim(spoken.current.you.trim());
          },
          onOutputTranscript: (text) => {
            spoken.current.reflow += text;
          },
          onAudio: (pcm) => playback.current?.enqueue(pcm),
          onInterrupted: () => {
            playback.current?.interrupt();
            commit("reflow");
          },
          onTurnComplete: () => {
            commit("you");
            commit("reflow");
          },
          onToolCall: (call) => {
            if (call.name === OPERATOR_HANDOFF_TOOL) void runHandoff(call);
          },
          onClose: ({ clean, code, reason }) => {
            if (!disposed && !ended.current) {
              setBase("DISCONNECTED");
              if (!clean || code !== 1000) {
                const detail = reason ? `: ${reason}` : "";
                setError(`Google Live closed the session (${code}${detail}).`);
              }
            }
          },
          onError: () => {
            if (!disposed && !ended.current)
              setError("The live connection dropped.");
          },
        });
      } catch (cause) {
        if (disposed) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Reflow could not start a live call.",
        );
        setBase("DISCONNECTED");
      }
    };

    void connect();
    return () => {
      disposed = true;
      teardown();
    };
  }, [incidentId, attempt, commit, teardown, reducedMotion]);

  // Who is making sound, sampled off the render path so React is not doing 60fps work.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const mic = capture.current?.analyse();
      const out = playback.current?.analyse();
      // Reflow's own output wins: while it is speaking the microphone is hearing it
      // through the room, and that echo must not read as the user talking.
      if (out?.speaking && out.level > SPEAKING_LEVEL / 2)
        setActivity("reflow");
      else if ((mic?.level ?? 0) > SPEAKING_LEVEL) setActivity("user");
      else setActivity("idle");
    }, 90);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(
      () => setElapsed((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [attempt]);

  const source = useMemo(
    () => ({
      read() {
        const out = playback.current?.analyse();
        if (out?.speaking) return { bands: out.bands, level: out.level };
        const mic = capture.current?.analyse();
        return {
          bands: mic?.bands ?? new Float32Array(BANDS),
          level: mic?.level ?? 0,
        };
      },
    }),
    [],
  );

  const phase: CallPhase = STICKY.has(base)
    ? base
    : activity === "user"
      ? "USER_SPEAKING"
      : activity === "reflow"
        ? "REFLOW_SPEAKING"
        : "LISTENING";

  const view: Omit<CallView, "objectiveTitle"> = {
    phase,
    elapsedSeconds: elapsed,
    muted,
    transcript,
    interim: phase === "USER_SPEAKING" ? interim : "",
    incidentId,
    error,
    lastResult,
    source,
  };

  return {
    view,
    actions: {
      toggleMute: () => {
        const next = !muted;
        setMuted(next);
        capture.current?.setMuted(next);
      },
      end: teardown,
      reconnect: () => {
        teardown();
        setError(null);
        setLastResult(null);
        setBase("CONNECTING");
        setElapsed(0);
        setAttempt((value) => value + 1);
      },
    },
  };
}

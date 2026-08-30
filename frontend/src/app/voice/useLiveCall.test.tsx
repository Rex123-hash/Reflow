import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveSocketHandlers } from "./liveSession";

let handlers: LiveSocketHandlers | null = null;
const sendToolResponse = vi.fn();

vi.mock("./audioCapture", () => ({
  startCapture: vi.fn(async () => ({
    analyse: () => ({ bands: new Float32Array(16), level: 0 }),
    setMuted: vi.fn(),
    isMuted: () => false,
    stop: vi.fn(),
  })),
}));

vi.mock("./audioPlayback", () => ({
  createPlayback: vi.fn(() => ({
    enqueue: vi.fn(),
    interrupt: vi.fn(),
    analyse: () => ({
      bands: new Float32Array(16),
      level: 0,
      speaking: false,
    }),
    stop: vi.fn(),
  })),
}));

vi.mock("./liveSession", () => ({
  openLiveCallSocket: vi.fn(
    (_session: unknown, nextHandlers: LiveSocketHandlers) => {
      handlers = nextHandlers;
      nextHandlers.onOpen?.();
      return {
        ready: true,
        sendAudio: vi.fn(),
        sendToolResponse,
        close: vi.fn(),
      };
    },
  ),
}));

const handOffToOperator = vi.fn(async () => ({
  voice_session_id: "Ab3d_Ef5gH6ijK7lM8nO9pQr",
  request_id: "12345678-1234-1234-1234-123456789abc",
  incident_id: "incident-47ff1116622c9e7bf885",
  outcome: "CONVERSATIONAL" as const,
  original_request: "Why did Recovery 1 fail?",
  spoken_result:
    "Here is what Reflow's authoritative context shows. Recovery 1 failed because the replacement did not pass CI.",
  truth_boundary: "This explains recorded recovery state; nothing was changed.",
  action_verified: false,
  external_effects_executed: false,
  objective_recovered: false,
  operator_disposition: "SUPPORTED" as const,
  operator_action_lifecycle: null,
  approval_required_action_id: null,
  failure: null,
}));

vi.mock("./voiceClient", () => ({
  VoiceSessionError: class VoiceSessionError extends Error {},
  createLiveSession: vi.fn(async () => ({
    session_id: "Ab3d_Ef5gH6ijK7lM8nO9pQr",
    audio_input: { sample_rate_hz: 16_000 },
  })),
  handOffToOperator,
  spokenRequestKey: vi.fn(async () => "voice-12345678"),
}));

const { useLiveCall } = await import("./useLiveCall");

describe("useLiveCall transcript ownership", () => {
  beforeEach(() => {
    handlers = null;
    sendToolResponse.mockClear();
    handOffToOperator.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("records a tool-handoff utterance exactly once when turn-complete follows", async () => {
    const { result, unmount } = renderHook(() =>
      useLiveCall("incident-47ff1116622c9e7bf885", true),
    );
    await waitFor(() => expect(handlers).not.toBeNull());

    act(() => {
      handlers?.onInputTranscript?.("Why did Recovery 1 fail?");
      handlers?.onToolCall?.({
        id: "call-1",
        name: "submit_operator_request",
        args: { spoken_request: "Why did Recovery 1 fail?" },
      });
    });
    await waitFor(() => expect(handOffToOperator).toHaveBeenCalledOnce());
    await waitFor(() => expect(sendToolResponse).toHaveBeenCalledOnce());

    act(() => handlers?.onTurnComplete?.());
    const userRows = result.current.view.transcript.filter(
      (row) => row.speaker === "you",
    );
    expect(userRows).toHaveLength(1);
    expect(userRows[0]?.text).toBe("Why did Recovery 1 fail?");
    expect(result.current.view.transcript).toHaveLength(2);
    unmount();
  });
});

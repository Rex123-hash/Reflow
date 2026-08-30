import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationContext } from "../operator/operatorContract";
import type { LiveSocketHandlers } from "./liveSession";
import type { VoiceOperatorHandoffResult } from "./voiceContract";

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

const handOffToOperator = vi.fn(
  async (
    _request: {
      spoken_request: string;
      conversation_context?: ConversationContext;
    },
    _signal?: AbortSignal,
  ): Promise<VoiceOperatorHandoffResult> => ({
    voice_session_id: "Ab3d_Ef5gH6ijK7lM8nO9pQr",
    request_id: "12345678-1234-1234-1234-123456789abc",
    incident_id: "incident-47ff1116622c9e7bf885",
    outcome: "CONVERSATIONAL" as const,
    original_request: "Why did Recovery 1 fail?",
    spoken_result:
      "Here is what Reflow's authoritative context shows. Recovery 1 failed because the replacement did not pass CI.",
    truth_boundary:
      "This explains recorded recovery state; nothing was changed.",
    action_verified: false,
    external_effects_executed: false,
    objective_recovered: false,
    operator_disposition: "SUPPORTED" as const,
    operator_action_lifecycle: null,
    approval_required_action_id: null,
    conversation_context: null,
    failure: null,
  }),
);

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
      handlers?.onInputTranscript?.("Why did Recovery 1 fail?", "final");
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

  it("collapses cumulative interim fragments into one user utterance", async () => {
    const { result, unmount } = renderHook(() =>
      useLiveCall("incident-47ff1116622c9e7bf885", true),
    );
    await waitFor(() => expect(handlers).not.toBeNull());

    act(() => {
      handlers?.onInputTranscript?.("create a calendar", "interim");
      handlers?.onInputTranscript?.("create a calendar event", "interim");
      handlers?.onInputTranscript?.(
        "create a calendar event tomorrow",
        "interim",
      );
      handlers?.onInputTranscript?.(
        "create a calendar event tomorrow",
        "final",
      );
      handlers?.onTurnComplete?.();
    });

    expect(result.current.view.transcript).toMatchObject([
      { speaker: "you", text: "create a calendar event tomorrow" },
    ]);
    unmount();
  });

  it("keeps utterances from separate Live turns separate", async () => {
    const { result, unmount } = renderHook(() =>
      useLiveCall("incident-47ff1116622c9e7bf885", true),
    );
    await waitFor(() => expect(handlers).not.toBeNull());

    act(() => {
      handlers?.onInputTranscript?.("first request", "final");
      handlers?.onTurnComplete?.();
      handlers?.onInputTranscript?.("second request", "final");
      handlers?.onTurnComplete?.();
    });

    expect(result.current.view.transcript).toMatchObject([
      { speaker: "you", text: "first request" },
      { speaker: "you", text: "second request" },
    ]);
    unmount();
  });

  it("carries one clarification context forward and clears it after resolution", async () => {
    const context = {
      mode: "CLARIFY" as const,
      user_goal: "Create a hackathon Calendar event tomorrow at 5 PM",
      normalized_request:
        "Create a calendar event tomorrow at 5 PM for hackathon submission.",
      human_summary: "Please specify the duration or end time.",
    };
    handOffToOperator
      .mockResolvedValueOnce({
        voice_session_id: "Ab3d_Ef5gH6ijK7lM8nO9pQr",
        request_id: "12345678-1234-1234-1234-123456789abc",
        incident_id: "incident-47ff1116622c9e7bf885",
        outcome: "CLARIFICATION_REQUIRED",
        original_request:
          "Create a calendar event tomorrow at 5 PM for hackathon submission.",
        spoken_result:
          "Reflow needs one clarification before it can act. Please specify the duration or end time.",
        truth_boundary: "No action was taken.",
        action_verified: false,
        external_effects_executed: false,
        objective_recovered: false,
        operator_disposition: "CLARIFICATION_REQUIRED",
        operator_action_lifecycle: null,
        approval_required_action_id: null,
        conversation_context: context,
        failure: null,
      })
      .mockResolvedValueOnce({
        voice_session_id: "Ab3d_Ef5gH6ijK7lM8nO9pQr",
        request_id: "22345678-1234-1234-1234-123456789abc",
        incident_id: "incident-47ff1116622c9e7bf885",
        outcome: "CONVERSATIONAL",
        original_request: "Ends at 6 PM.",
        spoken_result:
          "Here is what Reflow's authoritative context shows. Resolved.",
        truth_boundary: "Nothing was changed.",
        action_verified: false,
        external_effects_executed: false,
        objective_recovered: false,
        operator_disposition: "SUPPORTED",
        operator_action_lifecycle: null,
        approval_required_action_id: null,
        conversation_context: null,
        failure: null,
      });
    const { unmount } = renderHook(() =>
      useLiveCall("incident-47ff1116622c9e7bf885", true),
    );
    await waitFor(() => expect(handlers).not.toBeNull());

    act(() =>
      handlers?.onToolCall?.({
        id: "call-clarify",
        name: "submit_operator_request",
        args: {
          spoken_request:
            "Create a calendar event tomorrow at 5 PM for hackathon submission.",
        },
      }),
    );
    await waitFor(() => expect(handOffToOperator).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sendToolResponse).toHaveBeenCalledTimes(1));
    act(() => handlers?.onTurnComplete?.());

    act(() =>
      handlers?.onToolCall?.({
        id: "call-resolve",
        name: "submit_operator_request",
        args: { spoken_request: "Ends at 6 PM." },
      }),
    );
    await waitFor(() => expect(handOffToOperator).toHaveBeenCalledTimes(2));

    expect(handOffToOperator.mock.calls[1]?.[0]).toMatchObject({
      spoken_request: "Ends at 6 PM.",
      conversation_context: context,
    });
    unmount();
  });
});

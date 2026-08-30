import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureStop = vi.fn();
const socketClose = vi.fn();

vi.mock("./audioCapture", () => ({
  MicrophonePermissionError: class MicrophonePermissionError extends Error {},
  startCapture: vi.fn(async () => ({
    analyse: () => ({ bands: new Float32Array(12), level: 0 }),
    setMuted: vi.fn(),
    stop: captureStop,
  })),
}));

vi.mock("./liveSession", () => ({
  openTranscriptionSocket: vi.fn(
    (_session: unknown, handlers: { onOpen?(): void }) => {
      handlers.onOpen?.();
      return {
        ready: true,
        sendAudio: vi.fn(),
        sendToolResponse: vi.fn(),
        close: socketClose,
      };
    },
  ),
}));

vi.mock("./voiceClient", () => ({
  VoiceSessionError: class VoiceSessionError extends Error {},
  createTranscriptionSession: vi.fn(async () => ({
    audio_input: { sample_rate_hz: 16_000 },
    max_session_seconds: 600,
  })),
}));

const { useDictation } = await import("./useDictation");

describe("useDictation resource cleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    captureStop.mockClear();
    socketClose.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("clears the session deadline and activity intervals when a take is cancelled", async () => {
    const { result, unmount } = renderHook(() =>
      useDictation("incident-0fc3af5b0bd1ad847aea", vi.fn()),
    );

    await act(async () => result.current.start());
    expect(vi.getTimerCount()).toBe(3);

    act(() => result.current.cancel());
    expect(vi.getTimerCount()).toBe(0);
    expect(captureStop).toHaveBeenCalledOnce();
    expect(socketClose).toHaveBeenCalledOnce();
    unmount();
  });

  it("clears the pending finalization callback when the hook unmounts", async () => {
    const onTranscript = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDictation("incident-0fc3af5b0bd1ad847aea", onTranscript),
    );

    await act(async () => result.current.start());
    act(() => result.current.stop());
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(onTranscript).not.toHaveBeenCalled();
  });
});

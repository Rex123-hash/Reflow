/**
 * The browser's direct connection to Google's Live API.
 *
 * Reflow mints a single-use, model-and-config-locked ephemeral token and the browser
 * streams audio straight to Google with it, which is what keeps voice latency low. The
 * permanent key never leaves the private backend, and nothing here can widen the
 * session: the model, system instruction and tool list are locked into the token
 * server-side, so the setup frame below can only name what was already granted.
 */

import type {
  LiveVoiceSession,
  VoiceTranscriptionSession,
} from "./voiceContract";

const HOST = "generativelanguage.googleapis.com";
const SERVICE =
  "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

/**
 * The socket address.
 *
 * The host is a constant, never the value from the session grant: a response can name
 * an endpoint, but it cannot send the browser somewhere else. The grant's own
 * `api_endpoint` is asserted against it instead, so a mismatch fails loudly rather
 * than quietly connecting.
 */
function socketUrl(session: { api_endpoint: string; ephemeral_token: string }) {
  if (session.api_endpoint !== HOST)
    throw new Error("The voice session named an unexpected endpoint.");
  return `wss://${HOST}/ws/${SERVICE}?access_token=${encodeURIComponent(
    session.ephemeral_token,
  )}`;
}

function encodeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

interface ServerFrame {
  setupComplete?: unknown;
  serverContent?: {
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: {
      parts?: { inlineData?: { data?: string; mimeType?: string } }[];
    };
    interrupted?: boolean;
    turnComplete?: boolean;
    generationComplete?: boolean;
  };
  toolCall?: {
    functionCalls?: {
      id?: string;
      name?: string;
      args?: Record<string, unknown>;
    }[];
  };
  goAway?: { timeLeft?: string };
}

export interface LiveSocketHandlers {
  onOpen?(): void;
  /** A finalized or interim fragment of what the user said. */
  onInputTranscript?(text: string): void;
  /** A fragment of what Reflow said. */
  onOutputTranscript?(text: string): void;
  onAudio?(pcm: ArrayBuffer): void;
  /** The user spoke over Reflow; anything queued should be dropped. */
  onInterrupted?(): void;
  onTurnComplete?(): void;
  onToolCall?(call: {
    id: string;
    name: string;
    args: Record<string, unknown>;
  }): void;
  onClose?(reason: { clean: boolean; code: number }): void;
  onError?(cause: unknown): void;
}

export interface LiveSocket {
  sendAudio(pcm: ArrayBuffer): void;
  sendToolResponse(id: string, name: string, response: unknown): void;
  close(): void;
  readonly ready: boolean;
}

function open(
  session: { api_endpoint: string; ephemeral_token: string },
  setup: Record<string, unknown>,
  handlers: LiveSocketHandlers,
): LiveSocket {
  const socket = new WebSocket(socketUrl(session));
  socket.binaryType = "arraybuffer";
  let ready = false;
  let closed = false;

  const read = (frame: ServerFrame) => {
    if (frame.setupComplete !== undefined) {
      ready = true;
      handlers.onOpen?.();
      return;
    }
    const content = frame.serverContent;
    if (content) {
      const input = content.inputTranscription?.text;
      if (input) handlers.onInputTranscript?.(input);
      const output = content.outputTranscription?.text;
      if (output) handlers.onOutputTranscript?.(output);
      for (const part of content.modelTurn?.parts ?? []) {
        const data = part.inlineData?.data;
        if (data) handlers.onAudio?.(decodeBase64(data));
      }
      if (content.interrupted) handlers.onInterrupted?.();
      if (content.turnComplete) handlers.onTurnComplete?.();
    }
    for (const call of frame.toolCall?.functionCalls ?? []) {
      if (call.name)
        handlers.onToolCall?.({
          id: call.id ?? "",
          name: call.name,
          args: call.args ?? {},
        });
    }
  };

  socket.onopen = () => socket.send(JSON.stringify({ setup }));
  socket.onmessage = (event: MessageEvent<string | ArrayBuffer | Blob>) => {
    const parse = (text: string) => {
      try {
        read(JSON.parse(text) as ServerFrame);
      } catch (cause) {
        handlers.onError?.(cause);
      }
    };
    if (typeof event.data === "string") parse(event.data);
    else if (event.data instanceof ArrayBuffer)
      parse(new TextDecoder().decode(event.data));
    else void event.data.text().then(parse);
  };
  socket.onerror = (event) => handlers.onError?.(event);
  socket.onclose = (event) => {
    closed = true;
    ready = false;
    handlers.onClose?.({ clean: event.wasClean, code: event.code });
  };

  return {
    get ready() {
      return ready && !closed;
    },
    sendAudio(pcm: ArrayBuffer) {
      if (!ready || closed || socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              data: encodeBase64(pcm),
              mimeType: "audio/pcm;rate=16000",
            },
          },
        }),
      );
    },
    sendToolResponse(id: string, name: string, response: unknown) {
      if (closed || socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({
          toolResponse: {
            functionResponses: [{ id, name, response }],
          },
        }),
      );
    },
    close() {
      closed = true;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      )
        socket.close(1000, "ended");
    },
  };
}

/** V1: speech becomes text. No tools, no audio out, nothing that can act. */
export function openTranscriptionSocket(
  session: VoiceTranscriptionSession,
  handlers: LiveSocketHandlers,
): LiveSocket {
  return open(
    session,
    {
      model: `models/${session.model}`,
      // The token locks the real configuration; this only names what it granted.
      inputAudioTranscription: {},
    },
    handlers,
  );
}

/** V2: the conversation. Its one tool is Reflow's Operator handoff. */
export function openLiveCallSocket(
  session: LiveVoiceSession,
  handlers: LiveSocketHandlers,
): LiveSocket {
  return open(session, { model: `models/${session.model}` }, handlers);
}

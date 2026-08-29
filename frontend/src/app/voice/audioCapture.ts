/**
 * Microphone capture at the exact format the backend contract names.
 *
 * Raw audio never reaches Reflow and is never persisted: frames are converted to
 * 16-bit PCM, handed straight to the caller for the Google socket, and dropped. The
 * analyser exists so the interface can react to real energy rather than decoration.
 */

/**
 * The worklet is a same-origin asset, not a blob: an AudioWorklet module is fetched
 * under `script-src`, and a blob URL would have required weakening the application's
 * Content-Security-Policy for one file.
 */
const WORKLET_URL = "/audio/reflow-capture-worklet.js";

export interface CaptureAnalysis {
  /** Overall energy, 0..1, already smoothed for display. */
  level: number;
  /** Per-band energy across the audible speech range, 0..1. */
  bands: Float32Array;
}

export interface AudioCapture {
  analyse(): CaptureAnalysis;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  stop(): void;
}

export interface CaptureOptions {
  sampleRateHz: number;
  bandCount: number;
  /** Receives 16-bit little-endian PCM. Not called while muted. */
  onChunk(pcm: ArrayBuffer): void;
  onError?(cause: unknown): void;
}

export class MicrophonePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MicrophonePermissionError";
  }
}

function toPcm16(frame: Float32Array): ArrayBuffer {
  const out = new DataView(new ArrayBuffer(frame.length * 2));
  for (let i = 0; i < frame.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, frame[i]));
    out.setInt16(i * 2, clamped * 0x7fff, true);
  }
  return out.buffer;
}

export async function startCapture(
  options: CaptureOptions,
): Promise<AudioCapture> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : "";
    throw new MicrophonePermissionError(
      name === "NotAllowedError" || name === "SecurityError"
        ? "Reflow needs microphone access. Allow it in your browser, then try again."
        : name === "NotFoundError"
          ? "No microphone was found on this device."
          : "The microphone could not be opened.",
    );
  }

  // Asking the context for the contract's rate lets the browser resample for us,
  // rather than shipping a resampler that would have to be correct.
  const context = new AudioContext({ sampleRate: options.sampleRateHz });
  let muted = false;
  let stopped = false;

  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    for (const track of stream.getTracks()) track.stop();
    void context.close().catch(() => {});
  };

  try {
    await context.audioWorklet.addModule(WORKLET_URL);
  } catch (cause) {
    cleanup();
    throw cause;
  }

  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.72;
  const node = new AudioWorkletNode(context, "reflow-capture");
  node.port.onmessage = (event: MessageEvent<Float32Array>) => {
    if (muted || stopped) return;
    try {
      options.onChunk(toPcm16(event.data));
    } catch (cause) {
      options.onError?.(cause);
    }
  };
  source.connect(analyser);
  source.connect(node);
  // A worklet with no destination is not guaranteed to be pulled; a zero-gain sink
  // keeps the graph running without routing the microphone back to the speakers.
  const sink = context.createGain();
  sink.gain.value = 0;
  node.connect(sink).connect(context.destination);

  const spectrum = new Uint8Array(analyser.frequencyBinCount);
  const bands = new Float32Array(options.bandCount);
  let smoothed = 0;

  return {
    analyse() {
      if (stopped || muted) {
        bands.fill(0);
        smoothed *= 0.8;
        return { level: smoothed, bands };
      }
      analyser.getByteFrequencyData(spectrum);
      // Speech energy lives low; sampling the whole spectrum evenly would leave the
      // upper two thirds of the instrument permanently flat.
      const usable = Math.floor(spectrum.length * 0.62);
      const per = Math.max(1, Math.floor(usable / options.bandCount));
      let total = 0;
      for (let b = 0; b < options.bandCount; b += 1) {
        let sum = 0;
        for (let i = 0; i < per; i += 1) sum += spectrum[b * per + i] ?? 0;
        const value = sum / per / 255;
        bands[b] = value;
        total += value;
      }
      const level = Math.min(1, (total / options.bandCount) * 1.9);
      smoothed = smoothed + (level - smoothed) * 0.35;
      return { level: smoothed, bands };
    },
    setMuted(next: boolean) {
      muted = next;
      for (const track of stream.getAudioTracks()) track.enabled = !next;
    },
    isMuted: () => muted,
    stop() {
      node.port.onmessage = null;
      try {
        node.disconnect();
        source.disconnect();
        sink.disconnect();
      } catch {
        /* the graph may already be torn down */
      }
      cleanup();
    },
  };
}

/**
 * Playback of Reflow's own speech, with the same analysis the microphone gets.
 *
 * The Live API returns 24 kHz signed 16-bit PCM in fragments that arrive faster than
 * real time, so this schedules them end to end on one clock rather than playing each
 * as it lands. Nothing is written to disk or storage; a buffer is played and dropped.
 */

const OUTPUT_SAMPLE_RATE = 24_000;

export interface PlaybackAnalysis {
  level: number;
  bands: Float32Array;
  speaking: boolean;
}

export interface AudioPlayback {
  enqueue(pcm: ArrayBuffer): void;
  /** Drops everything not yet heard. Used when the user barges in. */
  interrupt(): void;
  analyse(): PlaybackAnalysis;
  stop(): void;
}

export function createPlayback(bandCount: number): AudioPlayback {
  const context = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.7;
  const gain = context.createGain();
  gain.connect(analyser);
  gain.connect(context.destination);

  let cursor = 0;
  let live: AudioBufferSourceNode[] = [];
  let stopped = false;
  const spectrum = new Uint8Array(analyser.frequencyBinCount);
  const bands = new Float32Array(bandCount);
  let smoothed = 0;

  return {
    enqueue(pcm: ArrayBuffer) {
      if (stopped || pcm.byteLength < 2) return;
      void context.resume().catch(() => {});
      const samples = new Int16Array(pcm);
      const buffer = context.createBuffer(
        1,
        samples.length,
        OUTPUT_SAMPLE_RATE,
      );
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i += 1)
        channel[i] = samples[i] / 0x8000;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      const startAt = Math.max(context.currentTime + 0.04, cursor);
      source.start(startAt);
      cursor = startAt + buffer.duration;
      live.push(source);
      source.onended = () => {
        live = live.filter((item) => item !== source);
      };
    },
    interrupt() {
      for (const source of live) {
        try {
          source.stop();
        } catch {
          /* already finished */
        }
      }
      live = [];
      cursor = 0;
    },
    analyse() {
      const speaking = !stopped && cursor > context.currentTime;
      if (!speaking) {
        bands.fill(0);
        smoothed *= 0.82;
        return { level: smoothed, bands, speaking: false };
      }
      analyser.getByteFrequencyData(spectrum);
      const usable = Math.floor(spectrum.length * 0.62);
      const per = Math.max(1, Math.floor(usable / bandCount));
      let total = 0;
      for (let b = 0; b < bandCount; b += 1) {
        let sum = 0;
        for (let i = 0; i < per; i += 1) sum += spectrum[b * per + i] ?? 0;
        const value = sum / per / 255;
        bands[b] = value;
        total += value;
      }
      const level = Math.min(1, (total / bandCount) * 1.9);
      smoothed = smoothed + (level - smoothed) * 0.3;
      return { level: smoothed, bands, speaking: true };
    },
    stop() {
      if (stopped) return;
      stopped = true;
      this.interrupt();
      try {
        gain.disconnect();
        analyser.disconnect();
      } catch {
        /* already torn down */
      }
      void context.close().catch(() => {});
    },
  };
}

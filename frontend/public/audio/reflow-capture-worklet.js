/**
 * Microphone capture worklet.
 *
 * Shipped as a same-origin asset rather than a blob URL on purpose: an AudioWorklet
 * module is fetched under `script-src`, and a blob would have forced `blob:` into the
 * application's Content-Security-Policy for the sake of one small file.
 *
 * It forwards frames and keeps nothing. Audio is never buffered, stored or sent
 * anywhere from here — the main thread converts each frame to PCM16 and hands it
 * straight to the Google session.
 */
class ReflowCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length) {
      this.port.postMessage(new Float32Array(channel));
    }
    return true;
  }
}

registerProcessor("reflow-capture", ReflowCaptureProcessor);

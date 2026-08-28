import { useState } from "react";
import posterAvif from "../assets/instrument/reflow-instrument-poster.avif";
import posterWebp from "../assets/instrument/reflow-instrument-poster.webp";

/**
 * The authored still of the instrument, shown from first paint.
 *
 * It replaces the previous CSS ghost — a grey disc plus two hairline rings that
 * read as a dead placeholder. This is a Cycles render of the same GLB, from the
 * same camera, with the same lighting rig, exported with alpha so it sits on the
 * page background exactly as the transparent WebGL canvas does.
 *
 * Geometry match: the Three camera holds a constant *vertical* FOV and varies its
 * horizontal extent with viewport aspect. Sizing the poster by height and centring
 * it horizontally therefore reproduces the camera's framing at any width, which is
 * what keeps the crossfade from jumping and keeps CLS at zero.
 *
 * It is also the terminal fallback: if WebGL is unavailable, the GLB fails, or the
 * scene never produces a frame, this simply stays. The hero is never blank.
 */
export function InstrumentPoster({ hidden }: { hidden: boolean }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    // Even the poster can fail to decode. Keep the reserved geometry filled with
    // the page's own warm ground rather than punching a hole in the hero.
    return (
      <div
        className="instrument-poster instrument-poster-fallback"
        aria-hidden="true"
      />
    );
  }

  return (
    <picture className={`instrument-poster${hidden ? " is-hidden" : ""}`}>
      <source srcSet={posterAvif} type="image/avif" />
      <img
        src={posterWebp}
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchPriority="high"
        draggable={false}
        onError={() => setFailed(true)}
      />
    </picture>
  );
}

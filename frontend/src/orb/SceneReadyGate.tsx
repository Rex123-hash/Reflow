import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

/**
 * Owns the definition of "the instrument is on screen".
 *
 * The previous definition was `useLayoutEffect` after the GLB parsed, which is
 * true well before anything is drawn — shader compilation, PMREM environment
 * generation and the first draw all happen afterwards. Under
 * `frameloop="demand"` a draw might never happen at all.
 *
 * The new definition is empirical: the renderer reports that it drew triangles.
 * R3F runs `useFrame` callbacks immediately before `gl.render()`, so
 * `gl.info.render.triangles` here describes the frame that was actually
 * presented. Two such frames are required — the first can land while shaders are
 * still compiling, so the second is what the crossfade waits on.
 *
 * It also repairs the demand-mode invalidation race. In reduced motion the story
 * controller returns before building its GSAP timeline, so the only `invalidate()`
 * calls happen at mount — before the GLB resolves through Suspense. This gate
 * keeps requesting frames until a real one has been confirmed, so the scene
 * initialises on its own and no pointer event is required.
 */
export function SceneReadyGate({
  modelReady,
  environmentReady,
  onFirstFrame,
}: {
  modelReady: boolean;
  environmentReady: boolean;
  onFirstFrame: () => void;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const gl = useThree((state) => state.gl);
  const settled = useRef(0);
  const done = useRef(false);

  // Every asynchronous dependency that lands must wake a demand-mode renderer.
  useEffect(() => {
    if (done.current) return;
    invalidate();
  }, [modelReady, environmentReady, invalidate]);

  useFrame(() => {
    if (done.current) return;

    if (modelReady && environmentReady && gl.info.render.triangles > 0) {
      settled.current += 1;
      if (settled.current >= 2) {
        done.current = true;
        onFirstFrame();
        return;
      }
    }

    // Demand mode renders exactly one frame per invalidate, so keep asking until
    // a real frame has been observed. `always` mode ignores this harmlessly.
    invalidate();
  });

  return null;
}

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The reduced-motion first-frame bug, pinned as a test.
 *
 * Reproduced in the browser before the fix: with `prefers-reduced-motion: reduce`
 * the canvas rendered zero frames for 20 seconds and `onReady` never fired,
 * because `frameloop="demand"` only draws on `invalidate()` and the story
 * controller returns before building the GSAP timeline that would call it. A
 * single pointer event was what accidentally completed initialisation.
 *
 * R3F is mocked so frames can be stepped deterministically — the real render loop
 * is rAF-driven and cannot run in a test environment (nor, as it happens, in a
 * hidden browser pane).
 */

const state = {
  invalidate: vi.fn(),
  gl: { info: { render: { triangles: 0 } } },
};

const frameCallbacks: Array<() => void> = [];

vi.mock("@react-three/fiber", () => ({
  useThree: (selector: (s: typeof state) => unknown) => selector(state),
  useFrame: (callback: () => void) => {
    frameCallbacks.push(callback);
  },
}));

const { SceneReadyGate } = await import("./SceneReadyGate");

/** Advances one render loop tick. */
const step = () => frameCallbacks.forEach((callback) => callback());

beforeEach(() => {
  state.invalidate.mockClear();
  state.gl.info.render.triangles = 0;
  frameCallbacks.length = 0;
});

describe("SceneReadyGate", () => {
  it("keeps requesting frames while nothing has been drawn", () => {
    const onFirstFrame = vi.fn();
    render(
      <SceneReadyGate
        modelReady={false}
        environmentReady={false}
        onFirstFrame={onFirstFrame}
      />,
    );

    state.invalidate.mockClear();
    step();
    step();
    step();

    // This is the repair: demand mode is kept awake instead of stalling until a
    // pointer event happens to wake it.
    expect(state.invalidate).toHaveBeenCalledTimes(3);
    expect(onFirstFrame).not.toHaveBeenCalled();
  });

  it("does not report ready on model resolve alone", () => {
    const onFirstFrame = vi.fn();
    render(
      <SceneReadyGate
        modelReady
        environmentReady
        onFirstFrame={onFirstFrame}
      />,
    );

    // Model parsed, environment built — but the renderer drew no triangles.
    state.gl.info.render.triangles = 0;
    step();
    step();

    expect(onFirstFrame).not.toHaveBeenCalled();
  });

  it("reports ready only after two frames that actually drew geometry", () => {
    const onFirstFrame = vi.fn();
    render(
      <SceneReadyGate
        modelReady
        environmentReady
        onFirstFrame={onFirstFrame}
      />,
    );

    state.gl.info.render.triangles = 93984;
    step();
    expect(onFirstFrame).not.toHaveBeenCalled(); // first real frame: shaders may still be compiling

    step();
    expect(onFirstFrame).toHaveBeenCalledTimes(1);
  });

  it("waits for the environment as well as the model", () => {
    const onFirstFrame = vi.fn();
    const view = render(
      <SceneReadyGate
        modelReady
        environmentReady={false}
        onFirstFrame={onFirstFrame}
      />,
    );

    state.gl.info.render.triangles = 93984;
    step();
    step();
    step();
    expect(onFirstFrame).not.toHaveBeenCalled();

    view.rerender(
      <SceneReadyGate
        modelReady
        environmentReady
        onFirstFrame={onFirstFrame}
      />,
    );
    step();
    step();
    expect(onFirstFrame).toHaveBeenCalledTimes(1);
  });

  it("wakes a demand-mode renderer when an async dependency lands", () => {
    const onFirstFrame = vi.fn();
    const view = render(
      <SceneReadyGate
        modelReady={false}
        environmentReady={false}
        onFirstFrame={onFirstFrame}
      />,
    );

    state.invalidate.mockClear();
    // The GLB resolving through Suspense is exactly the moment the old code had
    // no invalidation source left.
    view.rerender(
      <SceneReadyGate
        modelReady
        environmentReady={false}
        onFirstFrame={onFirstFrame}
      />,
    );

    expect(state.invalidate).toHaveBeenCalled();
  });

  it("reports ready exactly once", () => {
    const onFirstFrame = vi.fn();
    render(
      <SceneReadyGate
        modelReady
        environmentReady
        onFirstFrame={onFirstFrame}
      />,
    );

    state.gl.info.render.triangles = 93984;
    for (let i = 0; i < 10; i += 1) step();

    expect(onFirstFrame).toHaveBeenCalledTimes(1);
  });

  it("stops asking for frames once ready, so demand mode goes idle", () => {
    const onFirstFrame = vi.fn();
    render(
      <SceneReadyGate
        modelReady
        environmentReady
        onFirstFrame={onFirstFrame}
      />,
    );

    state.gl.info.render.triangles = 93984;
    step();
    step();
    expect(onFirstFrame).toHaveBeenCalledTimes(1);

    state.invalidate.mockClear();
    step();
    step();

    // Reduced motion must stay efficient: no continuous rendering after readiness.
    expect(state.invalidate).not.toHaveBeenCalled();
  });
});

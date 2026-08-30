import { useEffect, useRef, useState } from "react";
import "./reflowCursor.css";

const FINE_POINTER = "(pointer: fine) and (hover: hover)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const INTERACTIVE =
  'a, button, summary, select, [role="button"], [role="link"], [data-cursor-interactive]';
const TEXTUAL =
  'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, [contenteditable="true"], p, h1, h2, h3, h4, h5, h6, li, dt, dd, code, pre, blockquote, figcaption, td, th';
const NATIVE_STATE = ':disabled, [aria-disabled="true"]';
const DRAGGABLE = '[draggable="true"]';

function matches(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

export function ReflowCursor() {
  const [enabled, setEnabled] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia(FINE_POINTER).matches,
  );
  const [ready, setReady] = useState(false);
  const follower = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia(FINE_POINTER);
    const update = () => setEnabled(fine.matches);
    fine.addEventListener("change", update);
    return () => fine.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }
    const root = document.documentElement;
    const pointer = new Image();
    const loaded = () => {
      root.classList.add("reflow-cursor-ready");
      setReady(true);
    };
    const failed = () => {
      root.classList.remove("reflow-cursor-ready");
      setReady(false);
    };
    pointer.addEventListener("load", loaded, { once: true });
    pointer.addEventListener("error", failed, { once: true });
    pointer.src = "/cursors/reflow-pointer.svg";
    return () => {
      pointer.removeEventListener("load", loaded);
      pointer.removeEventListener("error", failed);
      root.classList.remove("reflow-cursor-ready");
    };
  }, [enabled]);

  useEffect(() => {
    const node = follower.current;
    if (!enabled || !ready || !node) return;

    const reduced = window.matchMedia(REDUCED_MOTION);
    let targetX = -80;
    let targetY = -80;
    let currentX = targetX;
    let currentY = targetY;
    let frame = 0;
    let visible = document.visibilityState === "visible";
    let clickTimer = 0;

    const draw = () => {
      frame = 0;
      if (!visible) return;
      const follow = reduced.matches ? 1 : 0.48;
      currentX += (targetX - currentX) * follow;
      currentY += (targetY - currentY) * follow;
      node.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      if (
        !reduced.matches &&
        (Math.abs(targetX - currentX) > 0.08 ||
          Math.abs(targetY - currentY) > 0.08)
      ) {
        frame = window.requestAnimationFrame(draw);
      }
    };

    const schedule = () => {
      if (!frame && visible) frame = window.requestAnimationFrame(draw);
    };

    const move = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      targetX = event.clientX;
      targetY = event.clientY;
      if (!node.classList.contains("is-visible")) {
        currentX = targetX;
        currentY = targetY;
        node.classList.add("is-visible");
      }
      const nativeState =
        matches(event.target, TEXTUAL) || matches(event.target, NATIVE_STATE);
      node.classList.toggle(
        "is-interactive",
        !nativeState && matches(event.target, INTERACTIVE),
      );
      node.classList.toggle("is-text", nativeState);
      node.classList.toggle("is-draggable", matches(event.target, DRAGGABLE));
      schedule();
    };

    const down = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      node.classList.remove("is-clicking");
      void node.offsetWidth;
      node.classList.add("is-clicking");
      window.clearTimeout(clickTimer);
      clickTimer = window.setTimeout(
        () => node.classList.remove("is-clicking"),
        190,
      );
    };
    const leave = () => node.classList.remove("is-visible");
    const visibility = () => {
      visible = document.visibilityState === "visible";
      if (!visible && frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else if (visible) {
        schedule();
      }
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    document.addEventListener("mouseleave", leave);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      document.removeEventListener("mouseleave", leave);
      document.removeEventListener("visibilitychange", visibility);
      window.clearTimeout(clickTimer);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled, ready]);

  if (!enabled || !ready) return null;
  return (
    <div ref={follower} className="reflow-cursor-follower" aria-hidden="true" />
  );
}

export default ReflowCursor;

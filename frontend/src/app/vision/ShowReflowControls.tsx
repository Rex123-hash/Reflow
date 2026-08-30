import type { RefObject } from "react";
import { IMAGE_ACCEPT, ACCEPTED_IMAGE_SUMMARY } from "./imageAttachment";
import { PlateMark, ShowGlyph } from "./PlateMark";

/**
 * The way in.
 *
 * A real `<input type="file">` carries the whole interaction — it is focusable,
 * Enter and Space open the picker, and on a phone it offers the camera roll — so it
 * is hidden visually rather than replaced by a button that clicks it in secret. The
 * label is the control the eye sees; the focus ring is drawn on the label when the
 * input has focus, so the keyboard path is as visible as the pointer one.
 *
 * One control. Drag, drop and paste all arrive at the same place, and none of them
 * submits anything.
 */
export function ImageAttachControl({
  id,
  inputRef,
  disabled,
  primed,
  onFile,
}: {
  id: string;
  inputRef: RefObject<HTMLInputElement | null>;
  disabled: boolean;
  /** Set when the reader arrived here asking to show Reflow something. */
  primed: boolean;
  onFile(file: File | null): void;
}) {
  return (
    <span className={`show-attach-slot${primed ? " is-primed" : ""}`}>
      <input
        id={id}
        ref={inputRef}
        type="file"
        className="visually-hidden show-attach-input"
        accept={IMAGE_ACCEPT}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          onFile(file);
          // Reset, so choosing the same file twice still fires a change.
          event.target.value = "";
        }}
      />
      <label className="show-attach" htmlFor={id} title="Show Reflow an image">
        <ShowGlyph />
        <span className="visually-hidden">
          Show Reflow an image — {ACCEPTED_IMAGE_SUMMARY}
        </span>
      </label>
    </span>
  );
}

/**
 * The drop target's only visible state.
 *
 * There is no dashed box sitting on the page waiting for a file. The console is the
 * target the whole time; it simply says so, once, while something is actually being
 * dragged over it.
 */
export function DropHint() {
  return (
    <div className="show-drop" aria-hidden="true">
      <PlateMark size={38} />
      <span>Drop the image to mount it</span>
    </div>
  );
}

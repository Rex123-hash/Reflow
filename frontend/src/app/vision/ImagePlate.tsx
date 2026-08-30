import { Icon, ICON_SIZE } from "../components/Icon";
import {
  formatBytes,
  formatLabel,
  type ImageAttachment,
} from "./imageAttachment";
import type { ShowPhase } from "./useShowReflow";

/**
 * The mounted sample.
 *
 * Not an attachment chip. An image handed to Reflow is evidence placed under an
 * instrument, so it is presented the way this product presents everything else it
 * inspects: seated in an aperture, held by registration brackets, captioned with
 * what it actually is, and labelled with what it is not — a picture of a system is
 * never the system.
 *
 * The brackets are drawn over the image rather than around the card so the frame
 * belongs to the sample at any aspect ratio, and the read rule only exists while
 * bytes are genuinely being sent or read.
 */

const STATE_WORD: Record<ShowPhase, string> = {
  IDLE: "",
  READY: "Mounted",
  SENDING: "Sending",
  ANALYZING: "Reading",
  ANSWERED: "Read",
  FAILED: "Not read",
};

function Brackets() {
  return (
    <svg
      className="show-plate-brackets"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0 14V0h14M86 0h14v14M100 86v14H86M14 100H0V86" />
    </svg>
  );
}

export function ImagePlate({
  attachment,
  phase,
  onReplace,
  onRemove,
  disabled,
}: {
  attachment: ImageAttachment;
  phase: ShowPhase;
  onReplace(): void;
  onRemove(): void;
  disabled: boolean;
}) {
  const { file, previewUrl, width, height } = attachment;
  const name = file.name || "Pasted screenshot";
  const reading = phase === "SENDING" || phase === "ANALYZING";

  return (
    // Escape closes the plate, but only from inside it: someone editing the question
    // above must never lose their sample to a stray keypress. Not while a read is in
    // flight either — cancelling a request is a different decision from unmounting.
    <figure
      className={`show-plate is-${phase.toLowerCase()}`}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || disabled) return;
        event.stopPropagation();
        onRemove();
      }}
    >
      <div className="show-plate-aperture">
        <img src={previewUrl} alt={`Image shown to Reflow: ${name}`} />
        <Brackets />
        {reading ? (
          <span className="show-plate-rule" aria-hidden="true" />
        ) : null}
      </div>

      <figcaption className="show-plate-body">
        <span className="show-plate-state">{STATE_WORD[phase]}</span>
        <b className="show-plate-name" title={name}>
          {name}
        </b>
        <span className="show-plate-meta">
          {formatLabel(file.type)}
          <i aria-hidden="true" />
          {formatBytes(file.size)}
          {width && height ? (
            <>
              <i aria-hidden="true" />
              {width} × {height}
            </>
          ) : null}
        </span>
        <span className="show-plate-truth">
          Visual evidence. Not authoritative live system state.
        </span>
      </figcaption>

      <div className="show-plate-controls">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onReplace}
          disabled={disabled}
        >
          Replace
        </button>
        <button
          type="button"
          className="show-plate-remove"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${name}`}
          title="Remove image"
        >
          <Icon name="cross" size={ICON_SIZE.row} />
        </button>
      </div>
    </figure>
  );
}

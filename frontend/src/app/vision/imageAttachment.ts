import type { ImageErrorCode } from "./imageContract";

/**
 * What the browser can usefully check before anything is sent.
 *
 * These are courtesies, not controls. The BFF and the private backend both run the
 * real validation — signature, declared type, decoder agreement, frame count,
 * dimensions, decompression bombs — and the browser repeats none of it. All this
 * layer does is spare someone a round trip for the two mistakes that are obvious
 * locally: the wrong kind of file, and a file that is plainly too big.
 *
 * The limits below are mirrored from `objective_recovery_agent/image_validation.py`.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/** The `accept` attribute, so the OS picker filters before the user chooses. */
export const IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(",");

/** The shortest true sentence about what Reflow will take. */
export const ACCEPTED_IMAGE_SUMMARY = "PNG, JPEG or WebP · up to 5 MiB";

export interface ImageAttachment {
  file: File;
  /** An object URL for the preview. The owner revokes it on replace or remove. */
  previewUrl: string;
  /** Read from the decoded preview, so the plate can state the real size. */
  width: number | null;
  height: number | null;
}

export interface AttachmentRejection {
  /** Reuses the backend's own vocabulary so one message table serves both. */
  code: Extract<
    ImageErrorCode,
    "unsupported_media_type" | "image_too_large" | "invalid_image"
  >;
  message: string;
}

export type AttachmentCheck =
  { ok: true; file: File } | { ok: false; rejection: AttachmentRejection };

/** Bytes, stated the way a person reads a file size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The short name of a format, for the plate's caption. */
export function formatLabel(type: string): string {
  if (type === "image/jpeg") return "JPEG";
  if (type === "image/webp") return "WebP";
  if (type === "image/png") return "PNG";
  return type;
}

export function checkImageFile(file: File | null | undefined): AttachmentCheck {
  if (!file || file.size === 0)
    return {
      ok: false,
      rejection: {
        code: "invalid_image",
        message: "That file is empty, so there is nothing to read.",
      },
    };
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type))
    return {
      ok: false,
      rejection: {
        code: "unsupported_media_type",
        message: "Reflow reads PNG, JPEG and WebP images.",
      },
    };
  if (file.size > MAX_IMAGE_BYTES)
    return {
      ok: false,
      rejection: {
        code: "image_too_large",
        message: `That image is ${formatBytes(file.size)}. Reflow reads images up to 5 MiB.`,
      },
    };
  return { ok: true, file };
}

/**
 * The first image in a drop or a paste.
 *
 * A screenshot pasted from the OS arrives as a file with a synthetic name and no
 * extension, which is exactly why the type — not the filename — decides. A drop of
 * several files takes the first image and ignores the rest: the endpoint accepts one
 * image, and silently sending a different one than the reader expects is worse than
 * taking the obvious one.
 */
export function firstImageFile(
  transfer: Pick<DataTransfer, "files" | "items"> | null,
): File | null {
  if (!transfer) return null;
  const files = Array.from(transfer.files ?? []);
  const typed = files.find((file) =>
    (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type),
  );
  if (typed) return typed;
  if (files.length > 0) return files[0];
  for (const item of Array.from(transfer.items ?? [])) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}

/** True when a drag is carrying files at all, so the plate only opens for those. */
export function dragCarriesFile(transfer: DataTransfer | null): boolean {
  if (!transfer) return false;
  const types = Array.from(transfer.types ?? []);
  return types.includes("Files");
}

import {
  isImageUnderstandingResponse,
  type ImageErrorCode,
  type ImageUnderstandingResponse,
} from "./imageContract";

/**
 * The Show Reflow request.
 *
 * `POST /api/v1/operator/image`, same-origin, multipart, exactly the three fields
 * the deployed contract accepts: `image`, `incident_id`, and an optional `message`.
 * Nothing else is sent — not the filename as a hint, not a client-chosen prompt, not
 * a capability. An image with no question is a legitimate submission and the backend
 * supplies its own bounded prompt for that case, so the field is omitted rather than
 * filled in with something the reader did not ask.
 *
 * XMLHttpRequest rather than fetch, for one reason: `upload.onloadend` is a real
 * signal that the bytes have left the browser. It is what lets the interface say
 * "sending" and then "reading" truthfully instead of inventing a progress bar.
 */

export const IMAGE_ENDPOINT = "/api/v1/operator/image";

const TIMEOUT_MS = 120_000;

/** The minimum the endpoint accepts; shorter text is treated as no question. */
export const MIN_IMAGE_MESSAGE = 3;

export class ImageRequestFailure extends Error {
  readonly code: ImageErrorCode | "network" | "timeout" | "aborted";

  constructor(code: ImageRequestFailure["code"], message: string) {
    super(message);
    this.name = "ImageRequestFailure";
    this.code = code;
  }
}

/**
 * One message per typed backend code.
 *
 * The backend's own `message` is deliberately not shown: it is written for an
 * operator reading a JSON body, and several of the codes share one sentence. These
 * say what happened and what the reader can do about it.
 */
const MESSAGES: Record<ImageErrorCode, string> = {
  authentication_required:
    "Reading an image requires Google sign-in. Demo context stays read-only.",
  origin_rejected: "That request did not come from this workspace.",
  multipart_required: "The image could not be packaged for upload. Try again.",
  invalid_form: "The image request was incomplete. Attach the image again.",
  image_required: "No image reached Reflow. Attach one and submit again.",
  unsupported_media_type: "Reflow reads PNG, JPEG and WebP images.",
  media_type_mismatch:
    "That file's contents do not match its type, so Reflow did not read it.",
  image_too_large: "That image is over 5 MiB.",
  invalid_image:
    "That image could not be read. It may be truncated, animated, or malformed.",
  image_dimensions_exceeded:
    "Those image dimensions are beyond what Reflow will process.",
  upstream_unavailable:
    "Image understanding is busy or its request budget is reached. Try the same image again shortly.",
  response_invalid: "Reflow could not confirm the image result.",
};

function failureFrom(status: number, body: string): ImageRequestFailure {
  let code: ImageErrorCode | null = null;
  try {
    const parsed: unknown = JSON.parse(body);
    const detail =
      typeof parsed === "object" && parsed !== null
        ? (parsed as { error?: { code?: unknown } }).error
        : null;
    if (detail && typeof detail.code === "string")
      code = detail.code as ImageErrorCode;
  } catch {
    code = null;
  }
  if (code && code in MESSAGES)
    return new ImageRequestFailure(code, MESSAGES[code]);
  if (status === 403)
    return new ImageRequestFailure(
      "authentication_required",
      MESSAGES.authentication_required,
    );
  if (status === 413)
    return new ImageRequestFailure("image_too_large", MESSAGES.image_too_large);
  if (status === 415)
    return new ImageRequestFailure(
      "unsupported_media_type",
      MESSAGES.unsupported_media_type,
    );
  return new ImageRequestFailure(
    "upstream_unavailable",
    MESSAGES.upstream_unavailable,
  );
}

export interface UnderstandImageOptions {
  incidentId: string;
  file: File;
  /** Omitted entirely when the reader asked nothing. */
  message?: string | null;
  /** Fires once the bytes are on the wire, not on a timer. */
  onUploaded?: () => void;
  signal?: AbortSignal;
}

export function buildImageForm(
  incidentId: string,
  file: File,
  message?: string | null,
): FormData {
  const form = new FormData();
  form.append("image", file, file.name || "screenshot.png");
  form.append("incident_id", incidentId);
  const trimmed = message?.trim() ?? "";
  if (trimmed.length >= MIN_IMAGE_MESSAGE) form.append("message", trimmed);
  return form;
}

export function understandImage({
  incidentId,
  file,
  message,
  onUploaded,
  signal,
}: UnderstandImageOptions): Promise<ImageUnderstandingResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", IMAGE_ENDPOINT, true);
    request.withCredentials = true;
    request.setRequestHeader("Accept", "application/json");
    request.timeout = TIMEOUT_MS;
    request.responseType = "text";

    const abort = () => request.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const done = () => signal?.removeEventListener("abort", abort);

    if (request.upload && onUploaded)
      request.upload.addEventListener("loadend", () => onUploaded());

    request.onload = () => {
      done();
      const body =
        typeof request.responseText === "string" ? request.responseText : "";
      if (request.status === 401) {
        window.dispatchEvent(new Event("reflow:session-expired"));
        reject(
          new ImageRequestFailure(
            "authentication_required",
            "Your session expired. Sign in again.",
          ),
        );
        return;
      }
      if (request.status !== 200) {
        reject(failureFrom(request.status, body));
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        reject(
          new ImageRequestFailure(
            "response_invalid",
            MESSAGES.response_invalid,
          ),
        );
        return;
      }
      if (!isImageUnderstandingResponse(parsed)) {
        reject(
          new ImageRequestFailure(
            "response_invalid",
            MESSAGES.response_invalid,
          ),
        );
        return;
      }
      if (parsed.incident_id !== incidentId) {
        reject(
          new ImageRequestFailure(
            "response_invalid",
            "Reflow returned a different incident.",
          ),
        );
        return;
      }
      resolve(parsed);
    };

    request.onerror = () => {
      done();
      reject(
        new ImageRequestFailure(
          "network",
          "The image could not reach Reflow. Check the connection and try again.",
        ),
      );
    };
    request.ontimeout = () => {
      done();
      reject(
        new ImageRequestFailure(
          "timeout",
          "Reading the image took too long. Try the same image again.",
        ),
      );
    };
    request.onabort = () => {
      done();
      reject(
        new ImageRequestFailure("aborted", "The image request was cancelled."),
      );
    };

    request.send(buildImageForm(incidentId, file, message));
  });
}

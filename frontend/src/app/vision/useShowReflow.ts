import { useCallback, useEffect, useRef, useState } from "react";
import { ImageRequestFailure, understandImage } from "./client";
import {
  checkImageFile,
  firstImageFile,
  type AttachmentRejection,
  type ImageAttachment,
} from "./imageAttachment";
import type { ImageUnderstandingResponse } from "./imageContract";

/**
 * Showing Reflow something, as a state machine.
 *
 * The phases are the ones the reader can actually be told apart truthfully:
 *
 *   IDLE      nothing is mounted
 *   READY     an image is mounted and nothing has been sent
 *   SENDING   the bytes are on the wire — this ends on a real upload event
 *   ANALYZING the bytes have arrived and Reflow is reading them
 *   ANSWERED  a validated response is on screen
 *   FAILED    a stated reason is on screen
 *
 * There is no percentage anywhere in here, because there is no honest one: the only
 * measurable boundary is when the upload finishes, and that is exactly where the
 * caption changes. Nothing is ever submitted by attaching — a drop, a paste and a
 * picked file all land in READY and stop there.
 */

export type ShowPhase =
  "IDLE" | "READY" | "SENDING" | "ANALYZING" | "ANSWERED" | "FAILED";

export interface ShowReflow {
  attachment: ImageAttachment | null;
  phase: ShowPhase;
  /** A client-side refusal — wrong type, too large, empty. Not a server error. */
  rejection: AttachmentRejection | null;
  error: string | null;
  response: ImageUnderstandingResponse | null;
  /** What was asked alongside the image, or null when the image asked on its own. */
  askedFor: { question: string | null; filename: string } | null;
  busy: boolean;
  attach(file: File | null | undefined): boolean;
  attachFrom(transfer: Pick<DataTransfer, "files" | "items"> | null): boolean;
  clear(): void;
  dismiss(): void;
  submit(message: string): Promise<void>;
}

export function useShowReflow(
  incidentId: string,
  enabled: boolean,
): ShowReflow {
  const [attachment, setAttachment] = useState<ImageAttachment | null>(null);
  const [phase, setPhase] = useState<ShowPhase>("IDLE");
  const [rejection, setRejection] = useState<AttachmentRejection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ImageUnderstandingResponse | null>(
    null,
  );
  const [askedFor, setAskedFor] = useState<ShowReflow["askedFor"]>(null);
  const pending = useRef<AbortController | null>(null);
  const mounted = useRef<string | null>(null);

  const release = useCallback(() => {
    if (mounted.current) {
      URL.revokeObjectURL(mounted.current);
      mounted.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      pending.current?.abort();
      release();
    },
    [release],
  );

  const attach = useCallback(
    (file: File | null | undefined) => {
      const checked = checkImageFile(file);
      if (!checked.ok) {
        setRejection(checked.rejection);
        return false;
      }
      release();
      // A new sample replaces the old one, and the previous answer with it: an
      // answer about a different image left on screen would be a lie by adjacency.
      const previewUrl = URL.createObjectURL(checked.file);
      mounted.current = previewUrl;
      setRejection(null);
      setError(null);
      setResponse(null);
      setAskedFor(null);
      setAttachment({
        file: checked.file,
        previewUrl,
        width: null,
        height: null,
      });
      setPhase("READY");

      // The real pixel size, read from the browser's own decode. It is a caption
      // only — the authoritative dimensions come back in the response provenance.
      if (typeof Image === "function") {
        const probe = new Image();
        probe.onload = () =>
          setAttachment((current) =>
            current && current.previewUrl === previewUrl
              ? {
                  ...current,
                  width: probe.naturalWidth || null,
                  height: probe.naturalHeight || null,
                }
              : current,
          );
        probe.src = previewUrl;
      }
      return true;
    },
    [release],
  );

  const attachFrom = useCallback(
    (transfer: Pick<DataTransfer, "files" | "items"> | null) => {
      const file = firstImageFile(transfer);
      if (!file) return false;
      return attach(file);
    },
    [attach],
  );

  const clear = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    release();
    setAttachment(null);
    setRejection(null);
    setError(null);
    setResponse(null);
    setAskedFor(null);
    setPhase("IDLE");
  }, [release]);

  const dismiss = useCallback(() => {
    setRejection(null);
    setError(null);
  }, []);

  const submit = useCallback(
    async (message: string) => {
      if (!attachment || !enabled) return;
      const controller = new AbortController();
      pending.current = controller;
      const question = message.trim();
      setPhase("SENDING");
      setError(null);
      setResponse(null);
      setAskedFor({
        question: question.length >= 3 ? question : null,
        filename: attachment.file.name,
      });
      try {
        const result = await understandImage({
          incidentId,
          file: attachment.file,
          message: question,
          onUploaded: () =>
            setPhase((current) =>
              current === "SENDING" ? "ANALYZING" : current,
            ),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setResponse(result);
        setPhase("ANSWERED");
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof ImageRequestFailure
            ? cause.message
            : cause instanceof Error
              ? cause.message
              : "Reflow could not read the image.",
        );
        setPhase("FAILED");
      } finally {
        if (pending.current === controller) pending.current = null;
      }
    },
    [attachment, enabled, incidentId],
  );

  /**
   * Paste, anywhere on the surface.
   *
   * A screenshot on the clipboard is the whole point of this feature, and asking
   * someone to first focus a particular field before Ctrl+V would defeat it. The
   * listener only claims the event when the clipboard actually carries an image, so
   * pasting text into the question field is untouched.
   */
  useEffect(() => {
    if (!enabled) return;
    const onPaste = (event: ClipboardEvent) => {
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const file = firstImageFile(clipboard);
      if (!file || !file.type.startsWith("image/")) return;
      event.preventDefault();
      attach(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [attach, enabled]);

  return {
    attachment,
    phase,
    rejection,
    error,
    response,
    askedFor,
    busy: phase === "SENDING" || phase === "ANALYZING",
    attach,
    attachFrom,
    clear,
    dismiss,
    submit,
  };
}

/**
 * The call's state vocabulary.
 *
 * Every phase is something the system actually knows. There is no phase for "probably
 * finished" and none for "objective recovered" — a verified action is a verified action,
 * and the call says exactly that much and no more.
 */

import type {
  VoiceHandoffOutcome,
  VoiceOperatorHandoffResult,
} from "./voiceContract";

export type CallPhase =
  | "CONNECTING"
  | "LISTENING"
  | "USER_SPEAKING"
  | "REFLOW_SPEAKING"
  | "WORKING"
  | "VERIFYING"
  | "VERIFIED"
  | "UNCONFIRMED"
  | "DENIED"
  | "UNSUPPORTED"
  | "DISCONNECTED";

export type PhaseTone =
  "neutral" | "listening" | "speaking" | "motion" | "verified" | "failed";

interface PhaseCopy {
  /** The state, in the fewest true words. */
  label: string;
  /** What is actually happening, for the reader and the screen reader alike. */
  caption: string;
  tone: PhaseTone;
}

export const PHASE_COPY: Record<CallPhase, PhaseCopy> = {
  CONNECTING: {
    label: "Connecting",
    caption: "Opening a live session with Reflow.",
    tone: "neutral",
  },
  LISTENING: {
    label: "Listening",
    caption: "Reflow is listening. Speak whenever you are ready.",
    tone: "listening",
  },
  USER_SPEAKING: {
    label: "Hearing you",
    caption: "Reflow is hearing you speak.",
    tone: "listening",
  },
  REFLOW_SPEAKING: {
    label: "Reflow speaking",
    caption: "Reflow is answering. Speak to interrupt.",
    tone: "speaking",
  },
  WORKING: {
    label: "Checking with Reflow",
    caption:
      "Reflow's Operator is working on this. Nothing is done until it returns.",
    tone: "motion",
  },
  VERIFYING: {
    label: "Reading back",
    caption: "The action was executed and is being read back independently.",
    tone: "motion",
  },
  VERIFIED: {
    label: "Action verified",
    caption:
      "The action ran and independent read-back confirmed it. That is not the same as the objective being recovered.",
    tone: "verified",
  },
  UNCONFIRMED: {
    label: "Not verified",
    caption:
      "Reflow could not confirm that result. Treat it as unfinished and check the receipt.",
    tone: "failed",
  },
  DENIED: {
    label: "Denied by policy",
    caption:
      "Reflow's policy refused that action. No external change occurred.",
    tone: "failed",
  },
  UNSUPPORTED: {
    label: "Not supported",
    caption: "Reflow does not support that request, so it attempted nothing.",
    tone: "failed",
  },
  DISCONNECTED: {
    label: "Disconnected",
    caption: "The live session ended. Reconnect to keep talking.",
    tone: "neutral",
  },
};

/** Phases that must never be dressed as progress toward success. */
export const INCOMPLETE_PHASES: ReadonlySet<CallPhase> = new Set([
  "UNCONFIRMED",
  "DENIED",
  "UNSUPPORTED",
  "DISCONNECTED",
]);

const OUTCOME_PHASE: Record<VoiceHandoffOutcome, CallPhase> = {
  ACTION_VERIFIED: "VERIFIED",
  ACTION_UNVERIFIED: "UNCONFIRMED",
  HANDOFF_FAILED: "UNCONFIRMED",
  DENIED: "DENIED",
  UNSUPPORTED: "UNSUPPORTED",
  // A clarification or a plain answer is conversation: the call returns to listening
  // and Reflow speaks the result rather than showing an outcome badge.
  CLARIFICATION_REQUIRED: "REFLOW_SPEAKING",
  CONVERSATIONAL: "REFLOW_SPEAKING",
  APPROVAL_REQUIRED: "UNCONFIRMED",
};

/**
 * The phase an Operator result puts the call into.
 *
 * Nothing is inferred: this is a lookup from the backend's own outcome. An approval
 * requirement is deliberately not a success — the action has not run.
 */
export function phaseForResult(result: VoiceOperatorHandoffResult): CallPhase {
  return OUTCOME_PHASE[result.outcome] ?? "UNCONFIRMED";
}

/** Approval is refused-for-now rather than failed, and says so in its own words. */
export function resultCaption(result: VoiceOperatorHandoffResult): string {
  if (result.outcome === "APPROVAL_REQUIRED")
    return "That action needs your explicit approval in Operator before it can run.";
  return result.truth_boundary;
}

export type TranscriptSpeaker = "you" | "reflow" | "operator";

export interface TranscriptEntry {
  id: string;
  speaker: TranscriptSpeaker;
  text: string;
  /** Present only on an Operator handoff row. */
  outcome?: VoiceHandoffOutcome;
  at: number;
}

/** mm:ss for the call timer, with no dependency and no locale surprise. */
export function elapsedLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

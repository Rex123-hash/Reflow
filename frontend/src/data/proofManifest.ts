import {
  STORY_BEATS,
  STORY_BEAT_ORDER,
  type StoryStageId,
} from "./storySchedule";

export type ProofLevel = "architecture" | "recorded-proof" | "product-preview";

export type { StoryStageId };

export interface StoryCapability {
  id: StoryStageId;
  label: string;
  proofLevel: ProofLevel;
  milestone: "P1B" | "P1C/P1D";
  proofLabel: string;
}

export const STORY_CAPABILITIES: readonly StoryCapability[] = [
  {
    id: "hero",
    label: "Objective",
    proofLevel: "architecture",
    milestone: "P1B",
    proofLabel: "System model",
  },
  {
    id: "risk",
    label: "Disruption and impact",
    proofLevel: "architecture",
    milestone: "P1B",
    proofLabel: "Current architecture",
  },
  {
    id: "futures",
    label: "Recovery futures",
    proofLevel: "architecture",
    milestone: "P1B",
    proofLabel: "Current architecture",
  },
  {
    id: "action",
    label: "Action and verification",
    proofLevel: "recorded-proof",
    milestone: "P1B",
    proofLabel: "Recorded tool proof",
  },
  {
    id: "incomplete",
    label: "Recovery incomplete",
    proofLevel: "product-preview",
    milestone: "P1C/P1D",
    proofLabel: "Product-story preview",
  },
  {
    id: "replan",
    label: "Replanning",
    proofLevel: "product-preview",
    milestone: "P1C/P1D",
    proofLabel: "Product-story preview",
  },
  {
    id: "restored",
    label: "Objective restored",
    proofLevel: "product-preview",
    milestone: "P1C/P1D",
    proofLabel: "Product-story preview",
  },
] as const;

/**
 * Where `?frame=<stage>` parks the timeline: the middle of each beat's settled
 * plateau. These were hand-written constants, and they had drifted away from the
 * animation — `?frame=futures` landed at 0.33, where two of the three future cards
 * were still fading in. Deriving them from the schedule makes a capture frame the
 * definition of "this beat, fully composed and still".
 */
export const STORY_FRAME_PROGRESS = Object.fromEntries(
  STORY_BEAT_ORDER.map((id) => [id, STORY_BEATS[id].frameP]),
) as Record<StoryStageId, number>;

/** A stage becomes the active one as soon as its beat begins arriving. */
const STORY_STAGE_PROGRESS = Object.fromEntries(
  STORY_BEAT_ORDER.map((id) => [id, STORY_BEATS[id].startP]),
) as Record<StoryStageId, number>;

export interface RecordedCalendarProof {
  mode: "recorded-proof";
  frozenMilestoneCommit: string;
  tool: "Google Calendar";
  actionDescription: string;
  status: "VERIFIED";
  writeAcknowledgedAt: string;
  readBackAt: string;
  observedWindow: {
    start: string;
    end: string;
  };
  verificationDifferenceCount: 0;
  receiptIdShort: string;
  externalEventIdShort: string;
  calendarDisplayLabel: string;
}

export const RECORDED_CALENDAR_PROOF: RecordedCalendarProof = {
  mode: "recorded-proof",
  frozenMilestoneCommit: "53a18823cd1d8ca86d6950fc128acaace52117ec",
  tool: "Google Calendar",
  actionDescription: "Release V2 recovery coordination block",
  status: "VERIFIED",
  writeAcknowledgedAt: "2026-08-25T17:26:31.966284Z",
  readBackAt: "2026-08-25T17:42:56.231290Z",
  observedWindow: {
    start: "2026-08-28T13:00:00Z",
    end: "2026-08-28T14:00:00Z",
  },
  verificationDifferenceCount: 0,
  receiptIdShort: "receipt-018d…857ac",
  externalEventIdShort: "p1b018d…857ac",
  calendarDisplayLabel: "Objective Recovery Demo",
};

export function capabilityFor(id: StoryStageId): StoryCapability {
  const capability = STORY_CAPABILITIES.find((item) => item.id === id);
  if (!capability) {
    throw new Error(`Unknown story stage: ${id}`);
  }
  return capability;
}

export function stageFromProgress(progress: number): StoryStageId {
  const entries = Object.entries(STORY_STAGE_PROGRESS) as [StoryStageId, number][];
  return entries.reduce<StoryStageId>((current, [id, threshold]) => {
    return progress >= threshold ? id : current;
  }, "hero");
}

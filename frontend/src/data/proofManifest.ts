export type ProofLevel = "architecture" | "recorded-proof" | "product-preview";

export type StoryStageId =
  | "hero"
  | "risk"
  | "futures"
  | "action"
  | "incomplete"
  | "replan"
  | "restored";

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

export const STORY_FRAME_PROGRESS: Record<StoryStageId, number> = {
  hero: 0.055,
  risk: 0.19,
  futures: 0.33,
  action: 0.48,
  incomplete: 0.62,
  replan: 0.76,
  restored: 0.92,
};

const STORY_STAGE_PROGRESS: Record<StoryStageId, number> = {
  hero: 0,
  risk: 0.12,
  futures: 0.255,
  action: 0.405,
  incomplete: 0.555,
  replan: 0.685,
  restored: 0.835,
};

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

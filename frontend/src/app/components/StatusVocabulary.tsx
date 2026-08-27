import type {
  EvidenceSemanticStatus,
  ObjectiveHealth,
  ReceiptStatusView,
  SemanticStatus,
  VerificationStatus,
  WorkflowStage,
} from "../contract/uiContract";

/**
 * Rendering of backend semantic values.
 *
 * Every component here is a pure lookup from a supplied enum member to a label and
 * a tone. Nothing computes a status. If the backend adds an enum member these
 * fall back to a neutral rendering of the raw value rather than guessing.
 *
 * Two rules the design system fixes and this file enforces:
 *   · objective health and workflow stage never share a shape;
 *   · UNAVAILABLE is dashed and neutral, never rust.
 */

type Tone = "verified" | "motion" | "caution" | "failed" | "neutral" | "absent";

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`pill tone-${tone}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ health --- */

const HEALTH_TONE: Record<ObjectiveHealth, Tone> = {
  HEALTHY: "verified",
  RESTORED: "verified",
  RECOVERING: "motion",
  WATCHING: "caution",
  NEEDS_ATTENTION: "failed",
};

const HEALTH_LABEL: Record<ObjectiveHealth, string> = {
  HEALTHY: "Healthy",
  RESTORED: "Objective restored",
  RECOVERING: "Recovering",
  WATCHING: "Watching",
  NEEDS_ATTENTION: "Needs attention",
};

export function HealthPill({
  health,
  compact,
}: {
  health: ObjectiveHealth;
  compact?: boolean;
}) {
  const label =
    compact && health === "RESTORED" ? "Restored" : HEALTH_LABEL[health];
  return (
    <Pill tone={HEALTH_TONE[health] ?? "neutral"}>
      {label ?? titleCase(health)}
    </Pill>
  );
}

/* ------------------------------------------------------------------- stage --- */

const STAGE_LABEL: Record<WorkflowStage, string> = {
  DETECT: "Detect",
  IMPACT: "Impact",
  PLAN: "Plan",
  ACT: "Act",
  VERIFY: "Verify",
  REPLAN: "Replan",
  RESTORED: "Restored",
};

export const stageLabel = (stage: WorkflowStage): string =>
  STAGE_LABEL[stage] ?? titleCase(stage);

/**
 * Workflow position — squared and outlined so it reads as structural rather than
 * conclusive. `attemptNumber` is rendered when the backend supplies one, because
 * "Verify" alone is ambiguous across attempts.
 */
export function StageChip({
  stage,
  attemptNumber,
}: {
  stage: WorkflowStage;
  attemptNumber?: number | null;
}) {
  const modifier =
    stage === "RESTORED"
      ? "is-restored"
      : stage === "VERIFY" || stage === "REPLAN"
        ? "is-current"
        : "";
  return (
    <span className={`stage-chip ${modifier}`.trim()}>
      <i aria-hidden="true" />
      {attemptNumber != null
        ? `Recovery ${String(attemptNumber).padStart(2, "0")} · ${stageLabel(stage)}`
        : stageLabel(stage)}
    </span>
  );
}

/* ------------------------------------------------------- receipt / outcome --- */

const RECEIPT_TONE: Record<ReceiptStatusView, Tone> = {
  VERIFIED: "verified",
  WRITE_ACKNOWLEDGED: "motion",
  PENDING: "neutral",
};

const RECEIPT_LABEL: Record<ReceiptStatusView, string> = {
  VERIFIED: "Receipt verified",
  WRITE_ACKNOWLEDGED: "Write acknowledged",
  PENDING: "Pending",
};

export function ReceiptStatusPill({ status }: { status: ReceiptStatusView }) {
  return (
    <Pill tone={RECEIPT_TONE[status] ?? "neutral"}>
      {RECEIPT_LABEL[status] ?? titleCase(status)}
    </Pill>
  );
}

const VERIFICATION_TONE: Record<VerificationStatus, Tone> = {
  PASSED: "verified",
  FAILED: "failed",
  PENDING: "neutral",
  UNAVAILABLE: "absent",
};

const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  PASSED: "Passed",
  FAILED: "Failed",
  PENDING: "Pending",
  UNAVAILABLE: "Unavailable",
};

export function VerificationPill({ status }: { status: VerificationStatus }) {
  return (
    <Pill tone={VERIFICATION_TONE[status] ?? "neutral"}>
      {VERIFICATION_LABEL[status] ?? titleCase(status)}
    </Pill>
  );
}

export const verificationTone = (status: VerificationStatus): Tone =>
  VERIFICATION_TONE[status] ?? "neutral";

/* ---------------------------------------------------------------- evidence --- */

const EVIDENCE_TONE: Record<EvidenceSemanticStatus, Tone> = {
  VERIFIED_HEALTHY: "verified",
  // Read successfully, world is bad. Full rust weight, identical to FAILED.
  VERIFIED_UNHEALTHY: "failed",
  WRITE_ACKNOWLEDGED: "motion",
  PENDING: "neutral",
  UNAVAILABLE: "absent",
};

const EVIDENCE_LABEL: Record<EvidenceSemanticStatus, string> = {
  VERIFIED_HEALTHY: "Verified healthy",
  VERIFIED_UNHEALTHY: "Verified unhealthy",
  WRITE_ACKNOWLEDGED: "Write acknowledged",
  PENDING: "Pending",
  UNAVAILABLE: "Unavailable",
};

export function EvidenceStatusPill({
  status,
}: {
  status: EvidenceSemanticStatus;
}) {
  return (
    <Pill tone={EVIDENCE_TONE[status] ?? "neutral"}>
      {EVIDENCE_LABEL[status] ?? titleCase(status)}
    </Pill>
  );
}

export const evidenceTone = (status: EvidenceSemanticStatus): Tone =>
  EVIDENCE_TONE[status] ?? "neutral";

/* ------------------------------------------------------------ spine status --- */

export const semanticStatusTone = (status: SemanticStatus): Tone =>
  (
    ({
      COMPLETED: "verified",
      CURRENT: "motion",
      FAILED: "failed",
      PENDING: "neutral",
      UNAVAILABLE: "absent",
    }) as Record<SemanticStatus, Tone>
  )[status] ?? "neutral";

export const semanticStatusLabel = (status: SemanticStatus): string =>
  titleCase(status);

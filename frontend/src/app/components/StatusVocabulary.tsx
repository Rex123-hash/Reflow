import { Icon, ICON_SIZE, type IconName } from "./Icon";
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
 * One glyph per stage, from the ring family in `Icon`.
 *
 * The glyph replaces the chip's open dot rather than joining it: the dot said only
 * "a stage", which the surrounding chip already said, and a stage list of seven
 * identical dots is the thing that made these chips unscannable in a table. A stage
 * the contract adds later falls back to the dot, so an unknown value renders
 * honestly instead of borrowing another stage's symbol.
 */
const STAGE_GLYPH: Record<WorkflowStage, IconName> = {
  DETECT: "stage-detect",
  IMPACT: "stage-impact",
  PLAN: "stage-plan",
  ACT: "stage-act",
  VERIFY: "stage-verify",
  REPLAN: "stage-replan",
  RESTORED: "stage-restored",
};

/**
 * Workflow position — squared and outlined so it reads as structural rather than
 * conclusive. `attemptNumber` is rendered when the backend supplies one, because
 * "Verify" alone is ambiguous across attempts.
 *
 * The glyph is decorative here in the strict sense: the stage is already spelled out
 * in the chip's own text, so it is `aria-hidden` and nothing is lost without it.
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
  const glyph = STAGE_GLYPH[stage];
  return (
    <span className={`stage-chip ${modifier}`.trim()}>
      {glyph ? (
        <Icon className="stage-chip-glyph" name={glyph} size={ICON_SIZE.meta} />
      ) : (
        <i aria-hidden="true" />
      )}
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

/**
 * A verification's invariants as one segmented ring.
 *
 * Reads nothing the card did not already have: one segment per supplied invariant,
 * each drawn in that invariant's own tone. It is not a percentage and not a score —
 * it is the same list, arranged so the shape of "five of five" is legible before
 * any of it is read. A card that stacked one identical pill per invariant said the
 * same word five times and made the reader count.
 *
 * The exact count is in the visible label beside it and again in the accessible
 * text, so nothing depends on seeing the ring.
 */
export function VerificationRing({
  invariants,
  size = 34,
}: {
  invariants: readonly { invariant_id: string; status: VerificationStatus }[];
  size?: number;
}) {
  const total = invariants.length;
  const passed = invariants.filter((item) => item.status === "PASSED").length;
  if (total === 0) return null;

  const radius = size / 2 - 3;
  const circumference = 2 * Math.PI * radius;
  // A hairline of background between segments, so adjacent same-tone segments stay
  // countable instead of fusing into one arc.
  const gap = total > 1 ? Math.min(3.5, circumference / (total * 4)) : 0;
  const segment = circumference / total - gap;

  return (
    <span
      className="verification-ring"
      role="img"
      aria-label={`${passed} of ${total} invariants passed`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        focusable="false"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--line)"
          strokeWidth="3"
        />
        {invariants.map((item, index) => (
          <circle
            key={item.invariant_id}
            className={`verification-ring-segment tone-${VERIFICATION_TONE[item.status] ?? "neutral"}`}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth="3"
            strokeLinecap="butt"
            strokeDasharray={`${segment} ${circumference - segment}`}
            strokeDashoffset={-(index * (segment + gap))}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
      </svg>
      <b className="verification-ring-count">
        {passed}/{total}
      </b>
    </span>
  );
}

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

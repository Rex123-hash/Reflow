import type { WorkflowStage } from "../contract/uiContract";

export const LENSES = [
  "summary",
  "world",
  "plans",
  "actions",
  "verify",
] as const;
export type LensId = (typeof LENSES)[number];

export const LENS_LABELS: Record<LensId, string> = {
  summary: "Summary",
  world: "World",
  plans: "Plans",
  actions: "Actions",
  verify: "Verify",
};

/**
 * Selecting a spine stage sets a default lens. The user can switch lenses freely
 * afterwards; this only decides where a stage click lands.
 *
 * Routing, not interpretation: the mapping is over `semantic_kind`, which the
 * backend supplies, and produces a view selection rather than a verdict.
 */
const DEFAULT_LENS: Record<WorkflowStage, LensId> = {
  DETECT: "summary",
  IMPACT: "world",
  PLAN: "plans",
  REPLAN: "plans",
  ACT: "actions",
  VERIFY: "verify",
  RESTORED: "summary",
};

export const defaultLensFor = (kind: WorkflowStage): LensId =>
  DEFAULT_LENS[kind] ?? "summary";

export const isLensId = (value: string | null | undefined): value is LensId =>
  typeof value === "string" && (LENSES as readonly string[]).includes(value);

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: docs/ui-openapi.json (API version 0.1.0)
 * Regenerate: npm run contract:generate
 *
 * These are the P2A presentation resources. The backend owns every semantic value
 * in this file. The frontend renders them; it never recomputes them.
 */

/* eslint-disable */

export interface ActionReceiptView {
  action_id: string;
  desired_state_summary: string;
  evidence_id?: string | null;
  external_reference?: string | null;
  kind: string;
  read_back_at?: string | null;
  read_back_completed: boolean;
  receipt_id?: string | null;
  receipt_status: ReceiptStatusView;
  recovery_attempt: number;
  system: SourceAuthority;
  system_label: string;
  verification_state: VerificationStatus;
  write_acknowledged: boolean;
  write_acknowledged_at?: string | null;
}

export interface AttemptComparisonItem {
  field: string;
  recovery_1?: string | null;
  recovery_2?: string | null;
}

export interface CurrentPriority {
  active_recovery_number?: number | null;
  active_workflow_stage?: WorkflowStage | null;
  deadline_timezone: string;
  incident_id?: string | null;
  objective_health: ObjectiveHealth;
  objective_id: string;
  objective_title: string;
  protected_deadline: string;
  summary: string;
  time_remaining_seconds?: number | null;
}

export interface DetectContextView {
  affected_resource_ids?: string[];
  bounded_summary: string;
  disruption_type: string;
  occurred_at?: string | null;
  source_evidence_id?: string | null;
  source_label: string;
  source_system: SourceAuthority;
}

export type EventPhase =
  | "DETECT"
  | "IMPACT"
  | "PLAN"
  | "ACT"
  | "VERIFY"
  | "REPLAN"
  | "RESTORED"
  | "SYSTEM";

export interface EvidencePageView {
  decisions: RecoveryPlanView[];
  evidence: EvidenceView[];
  incident_id: string;
  receipts: ActionReceiptView[];
  revision: number;
  timeline: ExecutionEventView[];
  verification: VerificationView[];
}

export type EvidenceSemanticStatus =
  | "PENDING"
  | "WRITE_ACKNOWLEDGED"
  | "VERIFIED_HEALTHY"
  | "VERIFIED_UNHEALTHY"
  | "UNAVAILABLE";

export interface EvidenceView {
  evidence_id: string;
  evidence_kind: string;
  external_reference?: string | null;
  observed_at?: string | null;
  proof_fields?: Record<string, string | number | boolean | null>;
  recovery_attempt: number;
  semantic_status: EvidenceSemanticStatus;
  source_label: string;
  source_system: SourceAuthority;
  summary: string;
  title: string;
}

export interface ExecutionEventView {
  cursor: string;
  event_id: string;
  human_message: string;
  phase: EventPhase;
  recovery_attempt: number;
  related_resource_ids?: string[];
  semantic_type: string;
  sequence: number;
  source_authority: SourceAuthority;
  source_label: string;
  technical_summary: string;
  timestamp: string;
}

export interface ExecutionEventsView {
  events: ExecutionEventView[];
  incident_id: string;
  next_cursor: string;
  revision: number;
  terminal: boolean;
}

/** Allowlisted event fields; never calendar/account IDs or arbitrary event text. */
export interface ExternalEventState {
  end?: string | null;
  start?: string | null;
  status?: "confirmed" | "tentative" | "cancelled" | null;
}

export interface ExternalObservation {
  observed_at: string;
  source_freshness: "FRESH_READ" | "PERSISTED_READBACK";
  state: ExternalEventState;
  verification_status: VerificationStatus;
}

export interface ExternalRealityView {
  availability?: "AVAILABLE" | "EVIDENCE_UNAVAILABLE";
  incident_id: string;
  resources?: ExternalResourceView[];
  revision: number;
}

export interface ExternalResourceView {
  action_id: string;
  authority?: string;
  checked_at?: string | null;
  evidence_id: string;
  expected: ExternalEventState;
  fresh_read_status: "NOT_REQUESTED" | "READ_BACK" | "NOT_FOUND" | "TIMEOUT" | "UNAVAILABLE";
  latest_readback: ExternalObservation | null;
  presentation_label?: string;
  receipt_id: string;
  receipt_readback: ExternalObservation | null;
  receipt_status: "PENDING" | "WRITE_ACKNOWLEDGED" | "VERIFIED" | "VERIFICATION_FAILED" | "FAILED" | "UNAVAILABLE";
  recovery_attempt?: number;
  resource_id: string;
  resource_type?: string;
  write_acknowledged_at: string | null;
}

export interface GraphEdgeView {
  relation: string;
  source: string;
  target: string;
}

export interface GraphNodeView {
  affected: boolean;
  critical_path: boolean;
  kind: string;
  label: string;
  node_id: string;
  state: string;
}

export interface ObjectiveContext {
  current_recovery_number: number;
  deadline_at: string;
  deadline_margin_seconds?: number | null;
  deadline_timezone: string;
  health: ObjectiveHealth;
  incident_stage: string;
  incident_status: string;
  is_live: boolean;
  objective_id: string;
  objective_version: number;
  protected_deadline: string;
  restored_at?: string | null;
  revision: number;
  time_remaining_seconds?: number | null;
  title: string;
  workflow_stage: WorkflowStage;
}

export interface ObjectiveCounts {
  active: number;
  healthy: number;
  recovering: number;
  restored: number;
  watching_or_needs_attention: number;
}

export type ObjectiveFilter =
  | "all"
  | "active"
  | "restored";

export type ObjectiveHealth =
  | "HEALTHY"
  | "WATCHING"
  | "RECOVERING"
  | "NEEDS_ATTENTION"
  | "RESTORED";

export interface ObjectiveSummary {
  active_incident_id?: string | null;
  active_recovery_number?: number | null;
  deadline_timezone: string;
  health: ObjectiveHealth;
  latest_observed_state?: string | null;
  objective_id: string;
  objective_version: number;
  protected_deadline: string;
  title: string;
  updated_at?: string | null;
  workflow_stage?: WorkflowStage | null;
}

export interface ObjectivesView {
  filter: ObjectiveFilter;
  items: ObjectiveSummary[];
  revision: number;
}

export interface OperationalGraphView {
  edges: GraphEdgeView[];
  nodes: GraphNodeView[];
}

export interface OperatorContextView {
  current_recovery: RecoveryAttemptView;
  events: ExecutionEventView[];
  evidence: EvidenceView[];
  objective: ObjectiveContext;
  plans: RecoveryPlanView[];
  read_only?: boolean;
  revision: number;
  verification?: VerificationView | null;
}

export interface OverviewView {
  active_objectives: ObjectiveSummary[];
  current_priority: CurrentPriority | null;
  objective_summary: ObjectiveCounts;
  recent_activity: ExecutionEventView[];
  revision: number;
}

export type PlanActionDisposition =
  | "PROPOSAL_ONLY"
  | "EXECUTABLE"
  | "EXECUTED";

export interface PlanActionView {
  action_id: string;
  disposition: PlanActionDisposition;
  execution_evidence_id?: string | null;
  kind: string;
  target: string;
}

export interface PolicyDecisionView {
  blocking_unknowns?: string[];
  plan_id: string;
  valid: boolean;
  violations?: PolicyViolationView[];
}

export interface PolicyViolationView {
  message: string;
  rule_id: string;
}

export type ReceiptStatusView =
  | "PENDING"
  | "WRITE_ACKNOWLEDGED"
  | "VERIFIED";

export interface RecoveryAttemptView {
  attempt_number: number;
  branch_from_attempt?: number | null;
  branch_reason?: string | null;
  candidate_sha?: string | null;
  label: string;
  selected_plan_id?: string | null;
  stages: RecoveryStageView[];
  status: SemanticStatus;
}

export interface RecoveryCaseView {
  actions: ActionReceiptView[];
  attempts: RecoveryAttemptView[];
  detect_context?: DetectContextView | null;
  evidence: EvidenceView[];
  objective: ObjectiveContext;
  plans: RecoveryPlanView[];
  replan_context?: ReplanContextView | null;
  revision: number;
  summary: RecoverySummary;
  verifications: VerificationView[];
  what_changed: AttemptComparisonItem[];
  world: OperationalGraphView;
}

export interface RecoveryPlanView {
  actions?: PlanActionView[];
  assumptions_summary?: string[];
  candidate_sha?: string | null;
  critic_summary?: string | null;
  deterministic_rejection_reason?: string | null;
  plan_id: string;
  policy?: PolicyDecisionView | null;
  proposed_action_summary?: string[];
  recovery_attempt: number;
  revision: number;
  risk_score?: number | null;
  selected: boolean;
  title: string;
  valid?: boolean | null;
}

export interface RecoveryStageView {
  failure_reason?: string | null;
  related_evidence_ids?: string[];
  semantic_kind: WorkflowStage;
  stage_id: string;
  status: SemanticStatus;
  subtitle: string;
  timestamp?: string | null;
  title: string;
}

export interface RecoverySummary {
  what_changed?: string | null;
  what_happened: string;
  why_current_recovery_exists?: string | null;
}

export interface ReplanContextView {
  changed_context_summary: string;
  failed_effect_fingerprint?: string | null;
  failed_evidence_id?: string | null;
  failed_invariant_id: string;
  prior_attempt: number;
  recovery_attempt: number;
  replanning_input_fingerprint?: string | null;
  replanning_input_summary: string;
}

export type SemanticStatus =
  | "PENDING"
  | "CURRENT"
  | "COMPLETED"
  | "FAILED"
  | "UNAVAILABLE";

export type SourceAuthority =
  | "gmail"
  | "google_calendar"
  | "github"
  | "github_actions"
  | "reflow_verifier"
  | "reflow_policy"
  | "reflow_engine"
  | "reflow_graph"
  | "unknown";

export interface VerificationInvariantView {
  evidence_id?: string | null;
  evidence_provenance?: string | null;
  expected: string;
  invariant_id: string;
  observed?: string | null;
  reason?: string | null;
  status: VerificationStatus;
}

export type VerificationStatus =
  | "PASSED"
  | "FAILED"
  | "PENDING"
  | "UNAVAILABLE";

export interface VerificationView {
  invariants: VerificationInvariantView[];
  objective_id: string;
  observed_at?: string | null;
  recovery_attempt: number;
  status: VerificationStatus;
  verification_id: string;
}

export type WorkflowStage =
  | "DETECT"
  | "IMPACT"
  | "PLAN"
  | "ACT"
  | "VERIFY"
  | "REPLAN"
  | "RESTORED";

import type { RecoveryAttemptView } from "../contract/uiContract";

/**
 * Deterministic INSPECT intent resolution.
 *
 * Operator is another interface to the recovery engine, not a chatbot. A supported
 * phrase resolves to a focus command — a Recovery or Evidence URL — and the answer
 * is the application moving to it.
 *
 * There is no model here on purpose. A frontend LLM paraphrasing backend truth
 * would be the most direct possible violation of the truth boundary: it could
 * assert something the backend never said. Matching is a fixed rule table over a
 * closed intent set, and an unmatched query is reported as unsupported rather than
 * answered.
 */

export type IntentId =
  | "why-attempt-failed"
  | "why-attempt-exists"
  | "current-state"
  | "blast-radius"
  | "compare-attempts"
  | "show-plans"
  | "show-actions"
  | "show-proof";

export interface IntentContext {
  incidentId: string;
  attempts: RecoveryAttemptView[];
}

export interface IntentMatch {
  intent: IntentId;
  /** How Operator restates what it understood. */
  understood: string;
  /** What the application will focus, in backend terms. */
  focus: string;
  href: string;
  /** Set when a phrase matched but the payload cannot satisfy it. */
  unavailableReason?: string;
}

const normalize = (query: string) =>
  query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasAny = (text: string, terms: string[]) =>
  terms.some((term) => text.includes(term));

/** `recovery 1`, `recovery #2`, `recovery 02`, `first recovery`. */
function extractAttemptNumber(text: string): number | null {
  const numeric = text.match(/recovery\s*#?\s*0*(\d+)/);
  if (numeric) return Number.parseInt(numeric[1], 10);
  if (hasAny(text, ["first recovery", "recovery one"])) return 1;
  if (hasAny(text, ["second recovery", "recovery two"])) return 2;
  return null;
}

const attemptLabel = (n: number) => `Recovery ${String(n).padStart(2, "0")}`;

const recoveryHref = (
  incidentId: string,
  stageId: string | null,
  lens?: string,
  evidence?: string,
): string => {
  const search = new URLSearchParams();
  if (stageId) search.set("stage", stageId);
  if (lens) search.set("lens", lens);
  if (evidence) search.set("evidence", evidence);
  const query = search.toString();
  return `/app/recovery/${incidentId}${query ? `?${query}` : ""}`;
};

export function matchIntent(
  query: string,
  context: IntentContext,
): IntentMatch | null {
  const text = normalize(query);
  if (!text) return null;

  const { incidentId, attempts } = context;
  const allStages = attempts.flatMap((attempt) =>
    (attempt.stages ?? []).map((stage) => ({ stage, attempt })),
  );

  /* --- why did Recovery N fail --- */
  if (
    hasAny(text, ["fail", "failed", "failure", "insufficient", "not enough"])
  ) {
    const requested = extractAttemptNumber(text);
    const failedEntries = allStages.filter(
      (entry) => entry.stage.status === "FAILED",
    );
    const entry =
      (requested != null
        ? failedEntries.find(
            (item) => item.attempt.attempt_number === requested,
          )
        : undefined) ?? failedEntries[0];

    if (!entry) {
      return {
        intent: "why-attempt-failed",
        understood: requested
          ? `Why ${attemptLabel(requested)} failed`
          : "Why a recovery failed",
        focus: "",
        href: recoveryHref(incidentId, null),
        unavailableReason:
          "No recovery attempt in this incident has a stage the backend marked FAILED.",
      };
    }

    return {
      intent: "why-attempt-failed",
      understood: `Why ${entry.attempt.label} failed`,
      focus: `${entry.attempt.label} · ${entry.stage.title} · Verify lens`,
      href: recoveryHref(incidentId, entry.stage.stage_id, "verify"),
    };
  }

  /* --- why does Recovery N exist --- */
  if (
    hasAny(text, [
      "why does",
      "why is there",
      "exist",
      "branch",
      "reopen",
      "another recovery",
    ])
  ) {
    const requested = extractAttemptNumber(text);
    const branched = attempts.filter(
      (attempt) => attempt.branch_from_attempt != null,
    );
    const attempt =
      (requested != null
        ? branched.find((item) => item.attempt_number === requested)
        : undefined) ?? branched[0];

    if (!attempt || !(attempt.stages ?? [])[0]) {
      return {
        intent: "why-attempt-exists",
        understood: "Why another recovery exists",
        focus: "",
        href: recoveryHref(incidentId, null),
        unavailableReason:
          "No attempt in this incident branches from an earlier one.",
      };
    }

    return {
      intent: "why-attempt-exists",
      understood: `Why ${attempt.label} exists`,
      focus: `${attempt.label} · Summary lens · branch reason`,
      href: recoveryHref(incidentId, attempt.stages![0].stage_id, "summary"),
    };
  }

  /* --- blast radius --- */
  if (
    hasAny(text, [
      "blast radius",
      "impact",
      "graph",
      "dependenc",
      "what was threatened",
      "world",
    ])
  ) {
    const impact = allStages.find(
      (entry) => entry.stage.semantic_kind === "IMPACT",
    );
    return {
      intent: "blast-radius",
      understood: "Show the blast radius",
      focus: "World lens · operational objective graph",
      href: recoveryHref(incidentId, impact?.stage.stage_id ?? null, "world"),
    };
  }

  /* --- compare attempts --- */
  if (
    hasAny(text, ["compare", "difference", "what changed", "versus", " vs "])
  ) {
    const branched = attempts.find(
      (attempt) => attempt.branch_from_attempt != null,
    );
    const stageId = (branched?.stages ?? [])[0]?.stage_id ?? null;
    return {
      intent: "compare-attempts",
      understood: "Compare the recovery attempts",
      focus: `${branched?.label ?? "Latest attempt"} · Summary lens · what changed`,
      href: recoveryHref(incidentId, stageId, "summary"),
    };
  }

  /* --- plans --- */
  if (
    hasAny(text, ["plan", "future", "candidate", "option", "critic", "policy"])
  ) {
    const requested = extractAttemptNumber(text);
    const entry =
      allStages.find(
        (item) =>
          (item.stage.semantic_kind === "PLAN" ||
            item.stage.semantic_kind === "REPLAN") &&
          (requested == null || item.attempt.attempt_number === requested),
      ) ?? null;
    return {
      intent: "show-plans",
      understood: "Show the recovery plans",
      focus: `${entry?.attempt.label ?? "Latest attempt"} · Plans lens`,
      href: recoveryHref(incidentId, entry?.stage.stage_id ?? null, "plans"),
    };
  }

  /* --- actions / receipts --- */
  if (
    hasAny(text, [
      "action",
      "receipt",
      "did reflow do",
      "what did it do",
      "calendar",
      "github",
    ])
  ) {
    const requested = extractAttemptNumber(text);
    const entry =
      allStages.find(
        (item) =>
          item.stage.semantic_kind === "ACT" &&
          (requested == null || item.attempt.attempt_number === requested),
      ) ?? null;
    return {
      intent: "show-actions",
      understood: "Show what Reflow actually did",
      focus: `${entry?.attempt.label ?? "Latest attempt"} · Actions lens`,
      href: recoveryHref(incidentId, entry?.stage.stage_id ?? null, "actions"),
    };
  }

  /* --- proof / evidence --- */
  if (hasAny(text, ["proof", "evidence", "prove", "audit", "receipts page"])) {
    return {
      intent: "show-proof",
      understood: "Show the proof",
      focus: "Evidence · complete audit history",
      href: `/app/evidence/${incidentId}`,
    };
  }

  /* --- what is happening now --- */
  if (
    hasAny(text, ["now", "current", "happening", "status", "state", "latest"])
  ) {
    const current = allStages.find((entry) => entry.stage.status === "CURRENT");
    const fallback = allStages.at(-1);
    const entry = current ?? fallback ?? null;
    return {
      intent: "current-state",
      understood: "What is happening now",
      focus: entry
        ? `${entry.attempt.label} · ${entry.stage.title}`
        : "Latest recorded stage",
      href: recoveryHref(incidentId, entry?.stage.stage_id ?? null),
    };
  }

  return null;
}

/** The closed set Operator advertises, so nobody has to guess the phrasing. */
export const SUPPORTED_EXAMPLES: string[] = [
  "Why did Recovery 1 fail?",
  "Why does Recovery 2 exist?",
  "Show the blast radius",
  "Compare the attempts",
  "What did Reflow actually do?",
  "Show the plans",
  "Show the proof",
  "What is happening now?",
];

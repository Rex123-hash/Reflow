import type { ReactElement } from "react";
import { INTEGRATION_MARKS } from "../assets/integrationMarks";
import { ICON_SIZE, ICON_STROKE } from "./Icon";
import "./source-mark.css";

/**
 * Identifies the authority behind a receipt, an evidence card or an event.
 *
 * External services use their own official brand mark. Reflow-native authorities
 * (the deterministic verifier, the policy engine, the objective graph, the durable
 * workflow ledger) use Reflow's own marks.
 *
 * The mark identifies WHO observed something. It never says whether the thing was
 * good. A vendor mark is drawn in that vendor's own fixed brand colour, because the
 * colour is part of how the vendor is recognised; it is never changed to signal an
 * outcome. Reflow-native marks are stroked in ink. Outcome is carried entirely by
 * the semantic status vocabulary standing next to the mark.
 *
 * Three tiers, in resolution order:
 *   a vendored brand mark, for authorities whose official mark we ship;
 *   a named external authority, for ones we do not — Slack, whose mark
 *     simple-icons no longer distributes, gets Reflow's channel glyph under
 *     Slack's own name rather than a hand-drawn lookalike of its logo;
 *   a Reflow-native mark, for Reflow's own verifier, policy, graph and ledger.
 *
 * The middle tier exists because the alternative was worse: before it, a Slack
 * observation resolved to the Reflow engine mark and the interface said Reflow had
 * observed something Slack observed.
 */

/** Matches ICON_STROKE, so a mark and a UI glyph on the same row weigh the same. */
const MARK_STROKE = ICON_STROKE;

type ReflowMarkName = "verifier" | "policy" | "graph" | "ledger" | "engine";

/**
 * External authorities Reflow integrates with whose official mark is not in the
 * vendored set. Drawn by Reflow, named for the vendor — the label is what carries
 * the attribution, and it is correct.
 */
type ExternalMarkName = "slack";

const EXTERNAL_MARKS: Record<
  ExternalMarkName,
  { title: string; node: ReactElement }
> = {
  slack: {
    title: "Slack",
    node: (
      <>
        <path
          d="M9.3 3.9v8.9M14.7 11.2v8.9"
          fill="none"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
          strokeLinecap="round"
        />
        <path
          d="M3.9 14.7h8.9M11.2 9.3h8.9"
          fill="none"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
          strokeLinecap="round"
        />
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
          opacity="0.34"
        />
      </>
    ),
  },
};

const REFLOW_MARKS: Record<
  ReflowMarkName,
  { title: string; node: ReactElement }
> = {
  verifier: {
    title: "Reflow deterministic verifier",
    node: (
      <>
        <circle
          cx="12"
          cy="12"
          r="8.2"
          fill="none"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
        />
        <path
          d="M8.2 12.2l2.6 2.6 5-5.2"
          fill="none"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  policy: {
    title: "Reflow policy engine",
    node: (
      <>
        <path
          d="M12 3.4l7 3.3v4.9c0 4.1-2.9 7.7-7 8.6-4.1-.9-7-4.5-7-8.6V6.7z"
          fill="none"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
          strokeLinejoin="round"
        />
        <path
          d="M9 12h6"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
          strokeLinecap="round"
        />
      </>
    ),
  },
  graph: {
    title: "Reflow objective graph",
    node: (
      <>
        <circle
          cx="12"
          cy="5.4"
          r="2.1"
          fill="none"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
        />
        <circle
          cx="5.8"
          cy="17.6"
          r="2.1"
          fill="none"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
        />
        <circle
          cx="18.2"
          cy="17.6"
          r="2.1"
          fill="none"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
        />
        <path
          d="M10.9 7.3L6.9 15.6M13.1 7.3l4 8.3M7.9 17.6h8.2"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
          strokeLinecap="round"
        />
      </>
    ),
  },
  ledger: {
    title: "Reflow workflow ledger",
    node: (
      <>
        <rect
          x="4.6"
          y="4.2"
          width="14.8"
          height="15.6"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
        />
        <path
          d="M8.2 9h7.6M8.2 12.4h7.6M8.2 15.8h4.6"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
          strokeLinecap="round"
        />
      </>
    ),
  },
  engine: {
    title: "Reflow recovery engine",
    node: (
      <>
        <circle
          cx="12"
          cy="12"
          r="8.4"
          fill="none"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
        />
        <circle cx="12" cy="12" r="2.6" fill="currentColor" />
        <circle cx="18.1" cy="7.6" r="1.5" fill="currentColor" opacity="0.55" />
      </>
    ),
  },
};

/**
 * Maps a backend-supplied authority string to a mark.
 *
 * This is display resolution over an identifier the backend chose. An authority we
 * do not recognise falls back to the neutral Reflow engine mark and keeps its own
 * name in the label — it never borrows another vendor's logo.
 */
export function resolveSource(raw: string): {
  brand?: { title: string; path: string; hex: string };
  external?: ExternalMarkName;
  reflow?: ReflowMarkName;
  label: string;
} {
  const key = raw.trim().toLowerCase();

  const normalized: Record<
    string,
    { brand?: string; external?: ExternalMarkName; reflow?: ReflowMarkName }
  > = {
    gmail: { brand: "gmail" },
    google_calendar: { brand: "google_calendar" },
    github: { brand: "github" },
    github_actions: { brand: "github" },
    jira: { brand: "jira" },
    slack: { external: "slack" },
    reflow_verifier: { reflow: "verifier" },
    reflow_policy: { reflow: "policy" },
    reflow_graph: { reflow: "graph" },
    reflow_engine: { reflow: "engine" },
    unknown: { reflow: "engine" },
  };
  const exact = normalized[key];
  if (exact?.brand) {
    return { brand: INTEGRATION_MARKS[exact.brand], label: raw };
  }
  if (exact?.external) return { external: exact.external, label: raw };
  if (exact?.reflow) return { reflow: exact.reflow, label: raw };

  if (key.includes("github")) {
    return { brand: INTEGRATION_MARKS.github, label: raw };
  }
  if (key.includes("calendar")) {
    return { brand: INTEGRATION_MARKS.google_calendar, label: raw };
  }
  if (key.includes("gmail") || key.includes("mail")) {
    return { brand: INTEGRATION_MARKS.gmail, label: raw };
  }
  // Both the Operator contract's authority (`JIRA`, `SLACK`) and its capability
  // names (`JIRA_TRANSITION`, `SLACK_INSPECT_CHANNEL`, …) reach this function, so
  // the substring match is what makes a capability-shaped value attribute correctly.
  if (key.includes("jira")) {
    return { brand: INTEGRATION_MARKS.jira, label: raw };
  }
  if (key.includes("slack")) {
    return { external: "slack", label: raw };
  }
  if (key.includes("verifier") || key.includes("verification")) {
    return { reflow: "verifier", label: raw };
  }
  if (key.includes("policy")) {
    return { reflow: "policy", label: raw };
  }
  if (key.includes("graph")) {
    return { reflow: "graph", label: raw };
  }
  if (key.includes("ledger")) {
    return { reflow: "ledger", label: raw };
  }
  return { reflow: "engine", label: raw };
}

export interface SourceMarkProps {
  /** A backend value: `action.system`, `evidence.source_system`, `event.source_authority`. */
  source: string;
  size?: number;
  /** Renders the mark inside a bordered tile, for receipt and evidence headers. */
  framed?: boolean;
  className?: string;
}

export function SourceMark({
  source,
  size = ICON_SIZE.header,
  framed = false,
  className,
}: SourceMarkProps) {
  const resolved = resolveSource(source);
  const title =
    resolved.brand?.title ??
    (resolved.external
      ? EXTERNAL_MARKS[resolved.external].title
      : REFLOW_MARKS[resolved.reflow ?? "engine"].title);

  const glyph = resolved.brand ? (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      focusable="false"
    >
      {/* The vendor's own colour, so GitHub, Gmail and Calendar are drawn the way
          those products are drawn. The value comes from the vendored brand data
          and is fixed: it identifies WHO observed something and never shifts to
          signal whether the thing was good. Outcome stays with the status pill
          beside the mark. */}
      <path d={resolved.brand.path} fill={resolved.brand.hex} />
    </svg>
  ) : (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      focusable="false"
    >
      {resolved.external
        ? EXTERNAL_MARKS[resolved.external].node
        : REFLOW_MARKS[resolved.reflow ?? "engine"].node}
    </svg>
  );

  const classes = ["source-mark", framed ? "is-framed" : null, className]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{glyph}</span>;
}

/** Mark plus the authority's own name, for card headers. */
export function SourceLabel({
  source,
  size = ICON_SIZE.header,
}: {
  source: string;
  size?: number;
}) {
  return (
    <span className="source-label">
      <SourceMark source={source} size={size} />
      <span>{source}</span>
    </span>
  );
}

import type { ReactElement } from "react";
import { INTEGRATION_MARKS } from "../assets/integrationMarks";
import "./source-mark.css";

/**
 * Identifies the authority behind a receipt, an evidence card or an event.
 *
 * External services use their own official brand mark. Reflow-native authorities
 * (the deterministic verifier, the policy engine, the objective graph, the durable
 * workflow ledger) use Reflow's own marks.
 *
 * The mark identifies WHO observed something. It never says whether the thing was
 * good: marks render monochrome in ink, and outcome is carried entirely by the
 * semantic status vocabulary next to them.
 */

type ReflowMarkName = "verifier" | "policy" | "graph" | "ledger" | "engine";

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
          strokeWidth="1.6"
        />
        <path
          d="M8.2 12.2l2.6 2.6 5-5.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
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
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9 12h6"
          stroke="currentColor"
          strokeWidth="1.7"
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
          strokeWidth="1.5"
        />
        <circle
          cx="5.8"
          cy="17.6"
          r="2.1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle
          cx="18.2"
          cy="17.6"
          r="2.1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M10.9 7.3L6.9 15.6M13.1 7.3l4 8.3M7.9 17.6h8.2"
          stroke="currentColor"
          strokeWidth="1.4"
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
          strokeWidth="1.5"
        />
        <path
          d="M8.2 9h7.6M8.2 12.4h7.6M8.2 15.8h4.6"
          stroke="currentColor"
          strokeWidth="1.5"
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
          strokeWidth="1.5"
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
  brand?: { title: string; path: string };
  reflow?: ReflowMarkName;
  label: string;
} {
  const key = raw.trim().toLowerCase();

  const normalized: Record<
    string,
    { brand?: string; reflow?: ReflowMarkName }
  > = {
    gmail: { brand: "gmail" },
    google_calendar: { brand: "google_calendar" },
    github: { brand: "github" },
    github_actions: { brand: "github" },
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
  size = 18,
  framed = false,
  className,
}: SourceMarkProps) {
  const resolved = resolveSource(source);
  const title =
    resolved.brand?.title ?? REFLOW_MARKS[resolved.reflow ?? "engine"].title;

  const glyph = resolved.brand ? (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      focusable="false"
    >
      <path d={resolved.brand.path} fill="currentColor" />
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
      {REFLOW_MARKS[resolved.reflow ?? "engine"].node}
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
  size = 18,
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

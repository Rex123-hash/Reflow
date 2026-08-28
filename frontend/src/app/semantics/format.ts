/**
 * Presentation formatting.
 *
 * Everything here formats, truncates or arranges a value the backend supplied.
 * Nothing here decides whether something passed, failed, is verified, or is
 * restored. See docs/ui-backend-contract.md § "Semantic mappings".
 */

const safeDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** `2026-08-28T17:00:00+00:00` in `Etc/UTC` → `Fri 28 Aug · 17:00 UTC`. */
export function formatDeadline(iso: string, timeZone: string): string {
  const date = safeDate(iso);
  if (!date) return "—";
  try {
    const day = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(date);
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
    return `${day} · ${time} ${zoneLabel(timeZone)}`;
  } catch {
    return iso;
  }
}

/** `Etc/UTC` → `UTC`; anything else keeps its IANA tail. */
export function zoneLabel(timeZone: string): string {
  if (timeZone === "Etc/UTC" || timeZone === "UTC") return "UTC";
  const tail = timeZone.split("/").pop();
  return tail ? tail.replace(/_/g, " ") : timeZone;
}

/** `2026-08-27T13:01:19.348531+00:00` → `27 Aug · 13:01:19 UTC`. */
export function formatObservedAt(
  iso: string | null | undefined,
  timeZone = "Etc/UTC",
): string | null {
  const date = safeDate(iso);
  if (!date) return null;
  try {
    const day = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "numeric",
      month: "short",
    }).format(date);
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
    return `${day} · ${time} ${zoneLabel(timeZone)}`;
  } catch {
    return iso ?? null;
  }
}

/** Clock component only, for dense tables: `13:01:19`. */
export function formatClock(
  iso: string | null | undefined,
  timeZone = "Etc/UTC",
): string | null {
  const date = safeDate(iso);
  if (!date) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return null;
  }
}

/**
 * `95710` → `26h 35m`. Only ever called with a backend-supplied seconds value
 * (`time_remaining_seconds` or `deadline_margin_seconds`); never with a
 * client-side subtraction.
 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** `7b7881ed1785cc37e038c44193ff2373badf54e7` → `7b7881ed1785`. */
export const shortSha = (sha: string): string => sha.slice(0, 12);

/** Middle-truncates a long opaque identifier while keeping both ends checkable. */
export function truncateId(value: string, head = 14, tail = 8): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** `https://github.com/o/r/actions/runs/123` → `github.com/o/r/actions/runs/123`. */
export function displayReference(reference: string): string {
  try {
    const url = new URL(reference);
    return `${url.host}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return reference;
  }
}

export const isHttpReference = (
  reference: string | null | undefined,
): boolean => typeof reference === "string" && /^https?:\/\//i.test(reference);

/** `Recovery 02` → `02`, for compact contexts. Falls back to the label itself. */
export function attemptOrdinal(attemptNumber: number): string {
  return String(attemptNumber).padStart(2, "0");
}

/** `RELEASE_VALIDATION_SUCCEEDED` → `Release validation succeeded`. */
export function humanizeEnum(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * `google_calendar` → `Google Calendar`, `github` → `GitHub`.
 *
 * Display naming for a backend-supplied system identifier. The known names are
 * spelled the way their vendors spell them; anything else is title-cased from the
 * identifier rather than guessed at.
 */
const SYSTEM_NAMES: Record<string, string> = {
  github: "GitHub",
  github_actions: "GitHub Actions",
  google_calendar: "Google Calendar",
  gmail: "Gmail",
  reflow_verifier: "Reflow Verifier",
  reflow_policy: "Reflow Policy",
  reflow_engine: "Reflow Engine",
  reflow_graph: "Reflow Graph",
};

export function displaySystem(system: string): string {
  const known = SYSTEM_NAMES[system.trim().toLowerCase()];
  if (known) return known;
  return system.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

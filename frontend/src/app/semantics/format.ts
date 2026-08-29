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

/**
 * `2026-08-27T19:08:54Z` → `4 min ago`, `2 hours ago`, `Yesterday`.
 *
 * Recency, not precision. The application had no sense of "now": every timestamp
 * was an absolute UTC string of identical weight, so a state that changed a minute
 * ago and one that resolved last week read the same. That is most of why a product
 * whose entire claim is "it acted while you were away" presented as an archive.
 *
 * This never replaces the exact value — callers keep it in the `dateTime` and
 * `title` of the same element, and evidence surfaces, where precision is the
 * point, go on leading with the absolute time.
 *
 * `now` is injectable so the formatting is testable without freezing the clock.
 */
export function formatRelativeTime(
  iso: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const date = safeDate(iso);
  if (!date) return null;
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  // A clock skew or a genuinely future timestamp must not render as "-3 min ago".
  if (seconds < 0) return "Just now";
  if (seconds < 45) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.round(months / 12);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
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

/**
 * Shortens long opaque hex runs inside a sentence for display only.
 *
 * `Durable EVENT_INTERPRETED event; key=gmail:afead004…0076.` — a 64-character
 * digest was dominating every row of the default Evidence view, so the sentence
 * around it became unreadable and the identifier itself gained nothing from being
 * shown in full at a glance.
 *
 * Only runs of 24 or more hex characters are touched, so short keys, run numbers
 * and words are left exactly as the backend wrote them. Callers must keep the
 * original string available — `title` plus accessible exact text — because this
 * changes presentation and never the identifier.
 */
export function abbreviateIdentifiers(
  text: string,
  head = 8,
  tail = 4,
): string {
  return text.replace(
    /[0-9a-f]{24,}/gi,
    (digest) => `${digest.slice(0, head)}…${digest.slice(-tail)}`,
  );
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

import type { ExternalEventState } from "../contract/uiContract";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export interface CalendarInterval {
  start: number;
  end: number;
}

/** Geometry only: no Calendar/recovery verdict is inferred from these timestamps. */
export function calendarInterval(
  state: ExternalEventState | null | undefined,
): CalendarInterval | null {
  const timestamp = (value: string | null | undefined) =>
    value && /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? Date.parse(value) : NaN;
  const start = timestamp(state?.start);
  const end = timestamp(state?.end);
  return Number.isFinite(start) && Number.isFinite(end) && end > start
    ? { start, end }
    : null;
}

export function calendarAxis(intervals: CalendarInterval[]) {
  const first = Math.min(...intervals.map((event) => event.start));
  const last = Math.max(...intervals.map((event) => event.end));
  const shortest = Math.min(
    ...intervals.map((event) => event.end - event.start),
  );
  const padding = Math.min(HOUR, shortest);
  const span = last - first + 2 * padding;
  const steps = [
    MINUTE,
    5 * MINUTE,
    15 * MINUTE,
    30 * MINUTE,
    HOUR,
    3 * HOUR,
    6 * HOUR,
    12 * HOUR,
  ];
  const step =
    steps.find((value) => span / value <= 4) ??
    Math.ceil(span / (4 * 24 * HOUR)) * 24 * HOUR;
  const start = Math.floor((first - padding) / step) * step;
  const end = Math.ceil((last + padding) / step) * step;
  const ticks = Array.from(
    { length: Math.round((end - start) / step) + 1 },
    (_, index) => start + index * step,
  );
  return { start, end, ticks };
}

export function calendarPosition(
  event: CalendarInterval,
  axis: CalendarInterval,
) {
  return {
    top: ((event.start - axis.start) / (axis.end - axis.start)) * 100,
    height: ((event.end - event.start) / (axis.end - axis.start)) * 100,
  };
}

export function sameCalendarDisplay(
  a: ExternalEventState,
  b: ExternalEventState,
) {
  const left = calendarInterval(a);
  const right = calendarInterval(b);
  return (
    left !== null &&
    right !== null &&
    left.start === right.start &&
    left.end === right.end &&
    a.status === b.status
  );
}

export function calendarClock(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
}

export function calendarDay(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function calendarDuration(event: CalendarInterval) {
  const minutes = (event.end - event.start) / MINUTE;
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round((minutes % 60) * 10) / 10;
  return [hours ? `${hours}h` : "", rest ? `${rest}m` : ""]
    .filter(Boolean)
    .join(" ");
}

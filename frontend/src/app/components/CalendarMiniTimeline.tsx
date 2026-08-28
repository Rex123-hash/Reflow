import { Link } from "react-router-dom";
import type {
  ExternalEventState,
  ExternalResourceView,
} from "../contract/uiContract";
import {
  calendarAxis,
  calendarClock,
  calendarDay,
  calendarDuration,
  calendarInterval,
  calendarPosition,
  sameCalendarDisplay,
  type CalendarInterval,
} from "../semantics/calendarTimeline";
import { formatObservedAt, humanizeEnum } from "../semantics/format";
import { SourceMark } from "./SourceMark";
import "./calendar-mini-timeline.css";

type DisplayEvent = {
  label: string;
  state: ExternalEventState;
  interval: CalendarInterval;
  expected: boolean;
};

function TimeRail({
  events,
  title,
}: {
  events: DisplayEvent[];
  title: string;
}) {
  const axis = calendarAxis(events.map((event) => event.interval));
  const multipleDays =
    new Date(axis.start).toISOString().slice(0, 10) !==
    new Date(axis.end).toISOString().slice(0, 10);
  return (
    <div
      className="calendar-mini-rail"
      aria-label="Commitment time axis in UTC"
    >
      <div className="calendar-mini-grid" aria-hidden="true">
        {axis.ticks.map((tick) => (
          <div
            className="calendar-mini-tick"
            key={tick}
            style={{
              top: `${((tick - axis.start) / (axis.end - axis.start)) * 100}%`,
            }}
          >
            <span>
              {calendarClock(tick)}
              {multipleDays && (
                <small>
                  {new Intl.DateTimeFormat("en-GB", {
                    timeZone: "UTC",
                    day: "numeric",
                    month: "short",
                  }).format(tick)}
                </small>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="calendar-mini-lanes">
        {events.map((event) => {
          const position = calendarPosition(event.interval, axis);
          return (
            <div className="calendar-mini-lane" key={event.label}>
              <div
                className={`calendar-mini-event ${event.expected ? "is-expected" : "is-observed"}`}
                role="img"
                aria-label={`${event.label}: ${title}. ${formatObservedAt(event.state.start)} to ${formatObservedAt(event.state.end)}. ${calendarDuration(event.interval)}. ${event.state.status ?? "Status unavailable"}.`}
                style={{
                  top: `${position.top}%`,
                  height: `${position.height}%`,
                }}
              >
                <span aria-hidden="true">
                  <strong>
                    {events.length > 1 || event.expected ? event.label : title}
                  </strong>
                  <span>{calendarDuration(event.interval)}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Pure presentation of the parent's single P2E-A request. Never fetches or mutates. */
export function CalendarMiniTimeline({
  resource,
  incidentId,
}: {
  resource: ExternalResourceView;
  incidentId: string;
}) {
  const latest = resource.latest_readback;
  const title =
    resource.presentation_label ?? "Recovery coordination commitment";
  const fresh =
    resource.fresh_read_status === "READ_BACK" &&
    latest?.source_freshness === "FRESH_READ";
  const recorded =
    resource.fresh_read_status === "NOT_REQUESTED" &&
    latest?.source_freshness === "PERSISTED_READBACK";
  const current = fresh || recorded ? latest : null;
  const observed = calendarInterval(current?.state);
  const expected = calendarInterval(resource.expected);
  const compare =
    current &&
    (current.verification_status === "FAILED" ||
      !sameCalendarDisplay(resource.expected, current.state));
  const events: DisplayEvent[] =
    observed && current
      ? [
          ...(compare && expected
            ? [
                {
                  label: "Expected",
                  state: resource.expected,
                  interval: expected,
                  expected: true,
                },
              ]
            : []),
          {
            label: recorded ? "Recorded" : "Observed",
            state: current.state,
            interval: observed,
            expected: false,
          },
        ]
      : [];
  const axis = events.length
    ? calendarAxis(events.map((event) => event.interval))
    : null;
  // Far-apart changes use clearly dated, independently bounded rails, not a giant empty calendar.
  const separate =
    events.length > 1 &&
    axis &&
    events.some((event) => calendarPosition(event.interval, axis).height < 18);
  const failed = current?.verification_status === "FAILED";
  const unavailable: Record<ExternalResourceView["fresh_read_status"], string> =
    {
      NOT_FOUND: "Calendar event not found",
      TIMEOUT: "Current Calendar lookup timed out",
      UNAVAILABLE: "Current Calendar read-back unavailable",
      NOT_REQUESTED: "Recorded Calendar state unavailable",
      READ_BACK: "Calendar timing unavailable",
    };
  return (
    <article
      className="calendar-mini"
      aria-label="Google Calendar external reality"
    >
      <header className="calendar-mini-head">
        <h3>
          <span aria-hidden="true">
            <SourceMark
              source={resource.authority ?? "google_calendar"}
              size={22}
            />
          </span>
          Google Calendar
        </h3>
        <span className={`calendar-mini-freshness ${fresh ? "is-fresh" : ""}`}>
          {fresh
            ? "Fresh read"
            : recorded
              ? "Recorded proof"
              : "Read unavailable"}
          <span> · Read only</span>
        </span>
      </header>
      {observed && current ? (
        <>
          <div className="calendar-mini-content">
            <div className="calendar-mini-summary">
              <p className="calendar-mini-day">
                {calendarDay(observed.start)} <span>UTC</span>
              </p>
              <h4>{title}</h4>
              <span className="calendar-mini-status">
                {humanizeEnum(current.state.status ?? "Status unavailable")}
              </span>
              <p className="calendar-mini-time">
                <time dateTime={current.state.start ?? undefined}>
                  {calendarClock(observed.start)}
                </time>{" "}
                →{" "}
                <time dateTime={current.state.end ?? undefined}>
                  {calendarClock(observed.end)}
                </time>{" "}
                UTC <span>· {calendarDuration(observed)}</span>
              </p>
              {new Date(observed.start).toISOString().slice(0, 10) !==
                new Date(observed.end).toISOString().slice(0, 10) && (
                <p>Ends {calendarDay(observed.end)}</p>
              )}
              {compare && (
                <div className="calendar-mini-comparison">
                  <p>
                    <strong>Expected</strong>{" "}
                    {formatObservedAt(resource.expected.start) ?? "Unavailable"}{" "}
                    → {formatObservedAt(resource.expected.end) ?? "Unavailable"}{" "}
                    · {resource.expected.status ?? "Status unavailable"}
                  </p>
                  <p>
                    <strong>{recorded ? "Recorded" : "Observed"}</strong>{" "}
                    {formatObservedAt(current.state.start)} →{" "}
                    {formatObservedAt(current.state.end)} ·{" "}
                    {current.state.status ?? "Status unavailable"}
                  </p>
                </div>
              )}
            </div>
            <div className="calendar-mini-visual">
              {separate ? (
                events.map((event) => (
                  <div key={event.label}>
                    <p className="calendar-mini-rail-label">
                      {event.label} · {calendarDay(event.interval.start)}
                    </p>
                    <TimeRail events={[event]} title={title} />
                  </div>
                ))
              ) : (
                <TimeRail events={events} title={title} />
              )}
            </div>
          </div>
          <div
            className={`calendar-mini-proof ${failed ? "is-failed" : current.verification_status === "PASSED" ? "is-passed" : ""}`}
          >
            <strong>
              {current.verification_status === "PASSED"
                ? "✓ "
                : failed
                  ? "! "
                  : ""}
              {fresh
                ? "Fresh independent read-back"
                : "Recorded independent read-back"}{" "}
              · {humanizeEnum(current.verification_status)}
            </strong>
            {recorded ? <span>No current Calendar lookup</span> : null}
            <span>
              {fresh ? "Last checked" : "Recorded"}{" "}
              <time dateTime={current.observed_at}>
                {formatObservedAt(current.observed_at)}
              </time>
            </span>
          </div>
        </>
      ) : (
        <div className="calendar-mini-unavailable" role="status">
          <p>{unavailable[resource.fresh_read_status]}</p>
          <span>
            No current event is shown. Historical proof remains in Recovery.
          </span>
        </div>
      )}
      <footer className="calendar-mini-links">
        <Link
          className="link-internal"
          to={`/app/recovery/${encodeURIComponent(incidentId)}?stage=recovery-1-act&lens=actions`}
        >
          Inspect action <span aria-hidden="true">→</span>
        </Link>
        <Link
          className="link-internal"
          to={`/app/evidence/${encodeURIComponent(incidentId)}?evidence=${encodeURIComponent(resource.evidence_id)}`}
        >
          Exact evidence <span aria-hidden="true">↗</span>
        </Link>
      </footer>
    </article>
  );
}

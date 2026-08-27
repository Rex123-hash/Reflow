import { useMemo, useState } from "react";
import type { ExecutionEventView } from "../contract/uiContract";
import { Icon } from "../components/Icon";
import { SourceMark } from "../components/SourceMark";
import { formatClock, humanizeEnum } from "../semantics/format";
import {
  eventTone,
  groupActivity,
  ledgerOrder,
  type ConsoleMode,
} from "../semantics/executionEvents";

/**
 * Real durable workflow events. Collapsed by default.
 *
 * ACTIVITY groups by recovery attempt for comprehension. DURABLE LEDGER shows the
 * exact persisted sequence. Both modes state what they are showing, because the two
 * orders genuinely differ and neither is allowed to imply the other: in the
 * canonical export `INCIDENT_REOPENED` persists at sequence 25 with a timestamp
 * later than `REPLAN_STARTED` at sequence 18.
 *
 * No event is invented, reworded into a narrative, or hidden.
 */
export function ExecutionConsole({
  events,
  terminal,
  selectedAttempt,
}: {
  events: ExecutionEventView[];
  terminal: boolean;
  selectedAttempt: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ConsoleMode>("activity");

  const groups = useMemo(() => groupActivity(events), [events]);
  const ledger = useMemo(() => ledgerOrder(events), [events]);

  const attemptCount =
    selectedAttempt == null
      ? null
      : events.filter((event) => event.recovery_attempt === selectedAttempt)
          .length;

  return (
    <section
      className={`console${open ? " is-open" : ""}`}
      aria-label="Execution console"
    >
      <header className="console-bar">
        <button
          type="button"
          className="console-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="console-icon" aria-hidden="true">
            <Icon name="terminal" size={12} />
          </span>
          <b>Execution console</b>
          <span className="console-count">
            {events.length} durable event{events.length === 1 ? "" : "s"}
            {attemptCount != null
              ? ` · ${attemptCount} in Recovery ${String(selectedAttempt).padStart(2, "0")}`
              : ""}
            {terminal ? " · terminal" : ""}
          </span>
          <Icon name={open ? "chevron-down" : "chevron-right"} size={15} />
        </button>

        {open ? (
          <div className="console-modes" role="group" aria-label="Console mode">
            <button
              type="button"
              className={mode === "activity" ? "is-on" : undefined}
              aria-pressed={mode === "activity"}
              onClick={() => setMode("activity")}
            >
              Activity
            </button>
            <button
              type="button"
              className={mode === "ledger" ? "is-on" : undefined}
              aria-pressed={mode === "ledger"}
              onClick={() => setMode("ledger")}
            >
              Durable ledger
            </button>
          </div>
        ) : null}
      </header>

      {open ? (
        <div className="console-body">
          <p className="console-mode-note">
            {mode === "activity" ? (
              <>
                Grouped by recovery attempt and ordered by observation time.
                Reflow does not reorder events into a causal narrative — a finer
                grouping would require an authoritative phase field the contract
                does not expose.
              </>
            ) : (
              <>
                Exact persisted sequence.{" "}
                <strong>Persistence order is not causal order:</strong> an
                event's position here reflects when it was durably written,
                which can be later than a related event it logically precedes.
              </>
            )}
          </p>

          {mode === "activity" ? (
            <div className="console-groups">
              {groups.map((group) => (
                <section key={group.key} className="console-group">
                  <h3>
                    {group.label}
                    <span>{group.events.length}</span>
                  </h3>
                  <ol>
                    {group.events.map((event) => (
                      <EventRow
                        key={event.event_id}
                        event={event}
                        showSequence={false}
                      />
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          ) : (
            <ol className="console-ledger">
              {ledger.map((event) => (
                <EventRow key={event.event_id} event={event} showSequence />
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </section>
  );
}

function EventRow({
  event,
  showSequence,
}: {
  event: ExecutionEventView;
  showSequence: boolean;
}) {
  return (
    <li className={`console-event tone-${eventTone(event)}`}>
      {showSequence ? (
        <span className="console-seq mono">{event.sequence}</span>
      ) : null}
      <span className="console-dot" aria-hidden="true" />
      <span className="console-event-body">
        <p>{event.human_message}</p>
        <span className="console-event-meta">
          <SourceMark source={event.source_authority} size={12} />
          <span className="mono">{humanizeEnum(event.semantic_type)}</span>
          <time>{formatClock(event.timestamp)}</time>
        </span>
      </span>
    </li>
  );
}

import { Link } from "react-router-dom";
import type {
  ExternalEventState,
  ExternalResourceView,
  VerificationStatus,
} from "../contract/uiContract";
import { useExternalReality } from "../data/resources";
import { formatObservedAt, humanizeEnum } from "../semantics/format";
import { ICON_SIZE } from "./Icon";
import { SourceMark } from "./SourceMark";
import { CalendarMiniTimeline } from "./CalendarMiniTimeline";
import "./external-reality.css";

function EventState({ state }: { state: ExternalEventState }) {
  return (
    <>
      <span>{formatObservedAt(state.start) ?? "Start unavailable"}</span>
      <span> → {formatObservedAt(state.end) ?? "End unavailable"}</span>
      <span> · {state.status ?? "Status unavailable"}</span>
    </>
  );
}

const freshLabels: Record<ExternalResourceView["fresh_read_status"], string> = {
  NOT_REQUESTED: "Recorded proof · No current Calendar lookup",
  READ_BACK: "Fresh independent read-back",
  NOT_FOUND: "Current Calendar resource not found · Historical proof below",
  TIMEOUT: "Current Calendar lookup timed out · Historical proof below",
  UNAVAILABLE:
    "Current Calendar read-back unavailable · Historical proof below",
};

export function CalendarProof({
  resource,
  incidentId,
  compact = false,
  objectiveStatus,
}: {
  resource: ExternalResourceView;
  incidentId: string;
  compact?: boolean;
  objectiveStatus?: VerificationStatus;
}) {
  if (compact)
    return <CalendarMiniTimeline resource={resource} incidentId={incidentId} />;
  const latest = resource.latest_readback;
  const evidenceUrl = `/app/evidence/${encodeURIComponent(incidentId)}?evidence=${encodeURIComponent(resource.evidence_id)}`;
  return (
    <article
      className="calendar-proof"
      aria-label="Google Calendar external reality"
    >
      <div className="calendar-proof-head">
        <SourceMark
          source={resource.authority ?? "google_calendar"}
          size={ICON_SIZE.header}
        />
        <h3>Google Calendar</h3>
        <span>Read only</span>
      </div>
      <p>{resource.presentation_label}</p>
      <p className="mono">
        <EventState
          state={compact && latest ? latest.state : resource.expected}
        />
      </p>
      <p>{freshLabels[resource.fresh_read_status]}</p>
      <p>
        {latest?.source_freshness === "FRESH_READ"
          ? "Current comparison"
          : "Persisted comparison"}
        : {latest ? humanizeEnum(latest.verification_status) : "Unavailable"}
      </p>
      <p>
        Independently read back:{" "}
        <time>{formatObservedAt(latest?.observed_at) ?? "Unavailable"}</time>
      </p>
      {!compact && (
        <>
          <ol className="calendar-truth-ladder">
            <li>
              <strong>Intended change</strong>
              <EventState state={resource.expected} />
            </li>
            <li>
              <strong>Google Calendar API acknowledged</strong>
              {formatObservedAt(resource.write_acknowledged_at) ??
                "Not acknowledged"}
            </li>
            <li>
              <strong>Original independent read-back</strong>
              {resource.receipt_readback ? (
                <>
                  <EventState state={resource.receipt_readback.state} />
                  <time>
                    {formatObservedAt(resource.receipt_readback.observed_at)}
                  </time>
                </>
              ) : (
                "Unavailable"
              )}
            </li>
            <li>
              <strong>Historical action receipt</strong>
              <span>{humanizeEnum(resource.receipt_status)}</span>
            </li>
          </ol>
          <dl className="calendar-comparison">
            <div>
              <dt>Expected state</dt>
              <dd>
                <EventState state={resource.expected} />
              </dd>
            </div>
            <div>
              <dt>
                {latest?.source_freshness === "FRESH_READ"
                  ? "Fresh observed state"
                  : "Latest persisted observed state"}
              </dt>
              <dd>
                {latest ? (
                  <EventState state={latest.state} />
                ) : (
                  "Read-back unavailable"
                )}
              </dd>
            </div>
          </dl>
          <p className="calendar-truth-note">
            Action verified does not imply objective restored.
            {objectiveStatus
              ? ` Selected recovery objective verification: ${humanizeEnum(objectiveStatus)}.`
              : ""}
          </p>
          <details>
            <summary>Exact correlation</summary>
            <p>
              Event: <code>{resource.resource_id}</code>
            </p>
            <p>
              Action: <code>{resource.action_id}</code>
            </p>
            <p>
              Receipt: <code>{resource.receipt_id}</code>
            </p>
          </details>
        </>
      )}
      <div className="calendar-proof-links">
        <Link className="link-internal" to={evidenceUrl}>
          Open exact Calendar evidence
        </Link>
        {compact && (
          <Link
            className="link-internal"
            to={`/app/recovery/${encodeURIComponent(incidentId)}?stage=recovery-1-act&lens=actions`}
          >
            Inspect Calendar action
          </Link>
        )}
      </div>
    </article>
  );
}

export function ExternalReality({
  incidentId,
  compact = false,
  objectiveStatus,
}: {
  incidentId: string;
  compact?: boolean;
  objectiveStatus?: VerificationStatus;
}) {
  const reality = useExternalReality(incidentId);
  return (
    <section
      className={`external-reality ${compact ? "is-compact" : ""}`}
      aria-label="External reality"
    >
      <p className="field-label">External reality</p>
      {reality.status === "loading" ? (
        <p role="status">Reading Calendar proof…</p>
      ) : reality.status === "error" ? (
        <p role="status">
          Calendar evidence unavailable. Recovery history is unchanged.
        </p>
      ) : (reality.data.resources ?? []).length === 0 ? (
        <p>Calendar evidence unavailable for this incident.</p>
      ) : (
        (reality.data.resources ?? []).map((resource) => (
          <CalendarProof
            key={resource.receipt_id}
            resource={resource}
            incidentId={incidentId}
            compact={compact}
            objectiveStatus={objectiveStatus}
          />
        ))
      )}
    </section>
  );
}

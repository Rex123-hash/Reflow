import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { EvidenceCard } from "../components/EvidenceCard";
import { ErrorState, LoadingState } from "../components/Feedback";
import { Icon } from "../components/Icon";
import { SourceMark } from "../components/SourceMark";
import { VerificationPill } from "../components/StatusVocabulary";
import { useEvidencePage } from "../data/resources";
import { formatObservedAt, humanizeEnum } from "../semantics/format";
import { eventTone } from "../semantics/executionEvents";
import { InvariantTable } from "../recovery/ExpectedObserved";
import { PlanCard } from "../recovery/PlanCard";
import { ReceiptLadder } from "../recovery/ReceiptLadder";
import { IncidentPicker } from "./IncidentPicker";
import "../recovery/recovery.css";
import "./evidence.css";

const TABS = ["timeline", "receipts", "verification", "decisions"] as const;
type TabId = (typeof TABS)[number];

const TAB_LABELS: Record<TabId, string> = {
  timeline: "Timeline",
  receipts: "Receipts",
  verification: "Verification",
  decisions: "Decisions",
};

const isTab = (value: string | null): value is TabId =>
  value != null && (TABS as readonly string[]).includes(value);

/** `/app/evidence` — landing surface, never a guessed incident. */
export function EvidenceLandingRoute() {
  return <IncidentPicker surface="evidence" />;
}

/**
 * `/app/evidence/:incidentId` — the complete, durable audit history.
 *
 * Proof-first: every card shows its `evidence_kind`, `external_reference` and every
 * `proof_fields` entry by default. This is deliberately denser than the Recovery
 * rail, which answers "what proves the thing I'm looking at".
 */
export function EvidenceRoute() {
  const { incidentId = null } = useParams<{ incidentId: string }>();
  const [params, setParams] = useSearchParams();
  const page = useEvidencePage(incidentId);

  const focusedEvidenceId = params.get("evidence");
  const rawTab = params.get("tab");
  const activeTab: TabId = isTab(rawTab)
    ? rawTab
    : focusedEvidenceId
      ? "timeline"
      : "timeline";

  const setTab = (tab: TabId) =>
    setParams(
      (current) => {
        const draft = new URLSearchParams(current);
        draft.set("tab", tab);
        return draft;
      },
      { replace: true },
    );

  const evidenceById = useMemo(
    () =>
      new Map(
        (page.data?.evidence ?? []).map((item) => [item.evidence_id, item]),
      ),
    [page.data],
  );

  useEffect(() => {
    if (!focusedEvidenceId) return;
    const node = document.getElementById(`proof-${focusedEvidenceId}`);
    node?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusedEvidenceId, page.status]);

  if (!incidentId) return <IncidentPicker surface="evidence" />;

  if (page.status === "loading") {
    return (
      <div className="route-pad">
        <LoadingState label="Loading evidence" rows={4} />
      </div>
    );
  }

  if (page.status === "error") {
    return (
      <div className="route-pad">
        <ErrorState error={page.error} onRetry={page.reload} />
      </div>
    );
  }

  const data = page.data;
  const focused = focusedEvidenceId
    ? evidenceById.get(focusedEvidenceId)
    : undefined;

  return (
    <div className="route-pad evidence-page">
      <header className="page-head evidence-head">
        <div>
          <p className="field-label">Evidence</p>
          <h1>Complete audit history</h1>
          <p className="evidence-lede">
            Every action, receipt, verification and decision Reflow durably
            recorded for incident{" "}
            <span className="mono">{data.incident_id}</span> at revision{" "}
            {data.revision}.
          </p>
        </div>
        <Link className="link-internal" to={`/app/recovery/${incidentId}`}>
          Back to Recovery
          <Icon name="arrow-right" size={12} />
        </Link>
      </header>

      {focused ? (
        <section className="evidence-focus" id={`proof-${focused.evidence_id}`}>
          <p className="field-label">Focused from Recovery</p>
          <EvidenceCard evidence={focused} mode="proof" />
        </section>
      ) : null}

      <div
        className="evidence-tabs"
        role="tablist"
        aria-label="Evidence sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "is-active" : undefined}
            onClick={() => setTab(tab)}
          >
            {TAB_LABELS[tab]}
            <span className="evidence-tab-count">
              {tab === "timeline"
                ? data.timeline.length
                : tab === "receipts"
                  ? data.receipts.length
                  : tab === "verification"
                    ? data.verification.length
                    : data.decisions.length}
            </span>
          </button>
        ))}
      </div>

      {activeTab === "timeline" ? (
        <ol className="evidence-timeline">
          {data.timeline.map((event) => (
            <li
              key={event.event_id}
              className={`evidence-event tone-${eventTone(event)}`}
            >
              <span className="evidence-seq mono">{event.sequence}</span>
              <span className="evidence-event-dot" aria-hidden="true" />
              <div>
                <p>{event.human_message}</p>
                <span className="evidence-event-meta">
                  <SourceMark source={event.source_authority} size={12} />
                  <span className="mono">
                    {humanizeEnum(event.semantic_type)}
                  </span>
                  <span>
                    Recovery {String(event.recovery_attempt).padStart(2, "0")}
                  </span>
                  <time>{formatObservedAt(event.timestamp)}</time>
                </span>
                <span className="evidence-event-technical mono">
                  {event.technical_summary}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {activeTab === "receipts" ? (
        <div className="receipt-grid">
          {data.receipts.map((action) => (
            <ReceiptLadder key={action.action_id} action={action} />
          ))}
        </div>
      ) : null}

      {activeTab === "verification" ? (
        <div className="evidence-verifications">
          {data.verification.map((verification) => (
            <section key={verification.verification_id} className="card">
              <div className="card-head">
                <h3>
                  Recovery{" "}
                  {String(verification.recovery_attempt).padStart(2, "0")} ·
                  objective verification
                </h3>
                <VerificationPill status={verification.status} />
              </div>
              <InvariantTable verification={verification} />
            </section>
          ))}
        </div>
      ) : null}

      {activeTab === "decisions" ? (
        <div className="plan-grid">
          {data.decisions.map((plan) => (
            <PlanCard
              key={`${plan.plan_id}-${plan.revision}-${plan.recovery_attempt}`}
              plan={plan}
            />
          ))}
        </div>
      ) : null}

      <section className="evidence-proofs">
        <div className="card-head">
          <h3>Proof records</h3>
          <span className="card-head-note">
            {data.evidence.length} evidence resources
          </span>
        </div>
        <div className="evidence-proof-grid">
          {data.evidence.map((evidence) => (
            <div
              key={evidence.evidence_id}
              id={`proof-${evidence.evidence_id}`}
            >
              <EvidenceCard
                evidence={evidence}
                mode="proof"
                href={`/app/recovery/${incidentId}?evidence=${encodeURIComponent(evidence.evidence_id)}`}
                hrefLabel="Show in Recovery"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

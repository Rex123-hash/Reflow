import { EvidenceCard } from "../components/EvidenceCard";
import { Icon } from "../components/Icon";
import type { RailContents } from "../semantics/evidence";

/**
 * Contextual proof for whatever is selected.
 *
 * The rail is stage-scoped when the stage anchors evidence that resolves by exact
 * id. When it anchors nothing, it shows attempt evidence. P2B and the BFF validate
 * that every published evidence join resolves exactly once.
 */
export function EvidenceRail({
  contents,
  incidentId,
  focusedEvidenceId,
}: {
  contents: RailContents;
  incidentId: string;
  focusedEvidenceId: string | null;
}) {
  const { scope, cards } = contents;

  return (
    <aside className="rail" aria-label="Evidence">
      <div className="rail-head">
        <h2 className="section-label">Evidence</h2>
        <span className="rail-scope">
          {scope.kind === "stage"
            ? `${scope.attemptLabel} · ${scope.stageTitle}`
            : scope.attemptLabel}
        </span>
      </div>

      <div className="rail-scroll">
        {scope.kind === "attempt" ? (
          <div className="rail-note">
            <Icon name="info" size={13} />
            <p>
              No evidence is anchored to this stage. Showing everything{" "}
              {scope.attemptLabel} produced.
            </p>
          </div>
        ) : null}

        {cards.map((evidence) => (
          <div
            key={evidence.evidence_id}
            id={`evidence-${evidence.evidence_id}`}
            className={
              focusedEvidenceId === evidence.evidence_id
                ? "rail-item is-focused"
                : "rail-item"
            }
          >
            <EvidenceCard
              evidence={evidence}
              mode="summary"
              href={`/app/evidence/${incidentId}?evidence=${encodeURIComponent(evidence.evidence_id)}`}
              hrefLabel="Open full evidence"
            />
          </div>
        ))}

        {cards.length === 0 ? (
          <p className="rail-empty">
            No evidence has been recorded for this attempt yet. Pending is not
            the same as absent.
          </p>
        ) : null}
      </div>
    </aside>
  );
}

import { EvidenceCard } from "../components/EvidenceCard";
import { Icon } from "../components/Icon";
import type { RailContents } from "../semantics/evidence";

/**
 * Contextual proof for whatever is selected.
 *
 * The rail is stage-scoped when the stage anchors evidence that resolves by exact
 * id. When it anchors nothing, or anchors only ids that do not resolve, it falls
 * back to the attempt and says which of the two happened — an unresolved reference
 * is reported, never quietly swallowed and never fuzzy-matched into a plausible
 * card. See docs/ui-backend-contract.md and known gap 1.
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
  const { scope, cards, unresolvedIds } = contents;

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
              {scope.reason === "no-anchors" ? (
                <>
                  No evidence is anchored to this stage. Showing everything{" "}
                  {scope.attemptLabel} produced.
                </>
              ) : (
                <>
                  This stage references evidence that the payload does not
                  declare, so it cannot be resolved by exact id. Showing
                  everything {scope.attemptLabel} produced instead.
                </>
              )}
            </p>
          </div>
        ) : null}

        {unresolvedIds.length > 0 ? (
          <details className="rail-unresolved">
            <summary>
              {unresolvedIds.length} unresolved reference
              {unresolvedIds.length === 1 ? "" : "s"}
            </summary>
            <ul>
              {unresolvedIds.map((id) => (
                <li key={id} className="mono">
                  {id}
                </li>
              ))}
            </ul>
            <p>
              These ids are referenced by the recovery payload but are not
              declared in its evidence set. Reflow will not guess which card
              they mean.
            </p>
          </details>
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

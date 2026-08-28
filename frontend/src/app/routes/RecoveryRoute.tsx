import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/Feedback";
import { ExternalReality } from "../components/ExternalReality";
import { ObjectiveContextBar } from "../components/ObjectiveContextBar";
import { Icon } from "../components/Icon";
import { useExecutionEvents, useRecoveryCase } from "../data/resources";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import {
  buildEvidenceIndex,
  railContentsForStage,
} from "../semantics/evidence";
import {
  defaultLensFor,
  isLensId,
  LENSES,
  LENS_LABELS,
  type LensId,
} from "../semantics/lens";
import { buildSpine, resolveStageId } from "../semantics/spine";
import { EvidenceRail } from "../recovery/EvidenceRail";
import { ExecutionConsole } from "../recovery/ExecutionConsole";
import {
  ActionsLens,
  PlansLens,
  SummaryLens,
  VerifyLens,
  WorldLens,
  type LensProps,
} from "../recovery/RecoveryLenses";
import { RecoverySpine } from "../recovery/RecoverySpine";
import { IncidentPicker } from "./IncidentPicker";
import "../recovery/recovery.css";

const LENS_COMPONENTS: Record<LensId, (props: LensProps) => ReactElement> = {
  summary: SummaryLens,
  world: WorldLens,
  plans: PlansLens,
  actions: ActionsLens,
  verify: VerifyLens,
};

/** `/app/recovery` — a landing surface that lets someone choose, never one that guesses. */
export function RecoveryLandingRoute() {
  return <IncidentPicker surface="recovery" />;
}

/** `/app/recovery/:incidentId` — the Recovery Room. */
export function RecoveryRoute() {
  const { incidentId = null } = useParams<{ incidentId: string }>();
  const [params, setParams] = useSearchParams();
  const reducedMotion = usePrefersReducedMotion();

  const recovery = useRecoveryCase(incidentId);
  const events = useExecutionEvents(incidentId);

  const spine = useMemo(
    () => (recovery.data ? buildSpine(recovery.data.attempts) : null),
    [recovery.data],
  );

  const requestedStage = params.get("stage");
  const selectedStageId = spine ? resolveStageId(spine, requestedStage) : null;
  const selectedEntry = selectedStageId
    ? (spine?.byStageId.get(selectedStageId) ?? null)
    : null;

  const requestedLens = params.get("lens");
  const activeLens: LensId = isLensId(requestedLens)
    ? requestedLens
    : selectedEntry
      ? defaultLensFor(selectedEntry.stage.semantic_kind)
      : "summary";

  const focusedEvidenceId = params.get("evidence");

  /** Keeps the address bar honest about what is on screen, without stacking history. */
  const updateParams = useCallback(
    (next: Record<string, string | null>) => {
      setParams(
        (current) => {
          const draft = new URLSearchParams(current);
          for (const [key, value] of Object.entries(next)) {
            if (value == null) draft.delete(key);
            else draft.set(key, value);
          }
          return draft;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const selectStage = useCallback(
    (stageId: string, lens?: string) => {
      updateParams({
        stage: stageId,
        lens: lens && isLensId(lens) ? lens : null,
        evidence: null,
      });
    },
    [updateParams],
  );

  const selectLens = useCallback(
    (lens: LensId) => updateParams({ lens }),
    [updateParams],
  );

  const focusEvidence = useCallback(
    (evidenceId: string) => updateParams({ evidence: evidenceId }),
    [updateParams],
  );

  // Scroll a focused evidence card into view without moving the page for anyone else.
  useEffect(() => {
    if (!focusedEvidenceId) return;
    const node = document.getElementById(`evidence-${focusedEvidenceId}`);
    node?.scrollIntoView({
      block: "nearest",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [focusedEvidenceId, reducedMotion]);

  if (!incidentId) return <IncidentPicker surface="recovery" />;

  if (recovery.status === "loading") {
    return (
      <div className="route-pad">
        <LoadingState label="Loading recovery" rows={4} />
      </div>
    );
  }

  if (recovery.status === "error") {
    return (
      <div className="route-pad">
        <ErrorState error={recovery.error} onRetry={recovery.reload} />
        <p style={{ marginTop: "var(--space-4)" }}>
          <Link className="link-internal" to="/app/recovery">
            Choose a different incident
            <Icon name="arrow-right" size={12} />
          </Link>
        </p>
      </div>
    );
  }

  const recoveryCase = recovery.data;
  const model = spine!;
  const entry = selectedEntry;
  const attempt = entry
    ? recoveryCase.attempts.find(
        (item) => item.attempt_number === entry.attemptNumber,
      )
    : recoveryCase.attempts.at(-1);

  const evidenceIndex = buildEvidenceIndex(recoveryCase.evidence);
  const railContents = railContentsForStage(
    recoveryCase,
    evidenceIndex,
    entry?.stage.related_evidence_ids ?? [],
    entry?.attemptNumber ?? attempt?.attempt_number ?? 1,
    entry?.stage.title ?? "",
  );

  const LensComponent = LENS_COMPONENTS[activeLens];

  return (
    <div className="route-shell recovery-shell">
      <ObjectiveContextBar
        objective={recoveryCase.objective}
        provenance={recovery.provenance}
      />

      <div className="recovery-body">
        <RecoverySpine
          model={model}
          selectedStageId={selectedStageId}
          onSelect={selectStage}
          reducedMotion={reducedMotion}
        />

        <main className="workspace" aria-label="Recovery workspace">
          <div className="lens-tabs" role="tablist" aria-label="Workspace lens">
            {LENSES.map((lens) => (
              <button
                key={lens}
                type="button"
                role="tab"
                aria-selected={activeLens === lens}
                className={activeLens === lens ? "is-active" : undefined}
                onClick={() => selectLens(lens)}
              >
                {LENS_LABELS[lens]}
              </button>
            ))}
            <span className="lens-scope">
              {attempt ? attempt.label : ""}
              {entry ? ` · ${entry.stage.title}` : ""}
            </span>
          </div>

          <div className="workspace-scroll">
            {(activeLens === "summary" ||
              activeLens === "actions" ||
              activeLens === "verify") && (
              <ExternalReality
                incidentId={incidentId}
                objectiveStatus={
                  recoveryCase.verifications.find(
                    (v) => v.recovery_attempt === attempt?.attempt_number,
                  )?.status
                }
              />
            )}
            {attempt ? (
              <LensComponent
                recoveryCase={recoveryCase}
                attempt={attempt}
                onFocusEvidence={focusEvidence}
                onFocusStage={selectStage}
              />
            ) : (
              <p className="lens-empty">
                This incident has no recorded recovery attempts.
              </p>
            )}
          </div>
        </main>

        <EvidenceRail
          contents={railContents}
          incidentId={incidentId}
          focusedEvidenceId={focusedEvidenceId}
        />
      </div>

      <ExecutionConsole
        events={events.data?.events ?? []}
        terminal={events.data?.terminal ?? false}
        selectedAttempt={entry?.attemptNumber ?? null}
      />
    </div>
  );
}

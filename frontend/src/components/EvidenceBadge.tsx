import { capabilityFor, type StoryStageId } from "../data/proofManifest";

export function EvidenceBadge({ stage }: { stage: StoryStageId }) {
  const capability = capabilityFor(stage);
  return (
    <span className={`evidence-badge evidence-${capability.proofLevel}`}>
      <span aria-hidden="true" />
      {capability.proofLabel}
    </span>
  );
}

import { Link } from "react-router-dom";
import type { EvidenceView } from "../contract/uiContract";
import { EvidenceStatusPill, evidenceTone } from "./StatusVocabulary";
import { SourceMark } from "./SourceMark";
import { Icon } from "./Icon";
import {
  displayReference,
  formatObservedAt,
  isHttpReference,
} from "../semantics/format";
import "./evidence-card.css";

/**
 * One `EvidenceView`, two densities.
 *
 * SUMMARY is the Recovery Evidence Rail: title, status, one line, source, time.
 * PROOF is the Evidence page: everything above plus `evidence_kind`,
 * `external_reference` and every `proof_fields` entry, expanded by default.
 *
 * Proof fields render verbatim under their own keys. `conclusion: failure` is more
 * trustworthy than "the build did not pass", so Reflow does not translate an
 * authority's vocabulary into friendlier words on a proof surface.
 */

export function EvidenceCard({
  evidence,
  mode,
  href,
  hrefLabel,
}: {
  evidence: EvidenceView;
  mode: "summary" | "proof";
  href?: string | null;
  hrefLabel?: string;
}) {
  const tone = evidenceTone(evidence.semantic_status);
  const observedAt = formatObservedAt(evidence.observed_at);
  const proofFields = Object.entries(evidence.proof_fields ?? {});

  return (
    <article className={`evidence-card tone-${tone} is-${mode}`}>
      <header>
        <div className="evidence-card-identity">
          <span className="evidence-card-source">
            <SourceMark source={evidence.source_system} size={14} />
            {evidence.source_label}
            {mode === "proof" ? ` · ${evidence.evidence_kind}` : null}
          </span>
          <b>{evidence.title}</b>
        </div>
        <EvidenceStatusPill status={evidence.semantic_status} />
      </header>

      <p className="evidence-card-summary">{evidence.summary}</p>

      {mode === "proof" ? (
        <dl className="evidence-proof">
          <dt>Evidence ID</dt>
          <dd>{evidence.evidence_id}</dd>
          <dt>Recovery attempt</dt>
          <dd>{evidence.recovery_attempt}</dd>
          {evidence.external_reference ? (
            <>
              <dt>External reference</dt>
              <dd>
                {isHttpReference(evidence.external_reference) ? (
                  <a
                    className="link-external"
                    href={evidence.external_reference}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {displayReference(evidence.external_reference)}
                    <Icon name="external" size={11} />
                  </a>
                ) : (
                  evidence.external_reference
                )}
              </dd>
            </>
          ) : null}
          <dt>Observed at</dt>
          <dd>{evidence.observed_at ?? "—"}</dd>
          {/*
            Proof fields render verbatim and uncoloured. Tinting `conclusion:
            failure` would mean the client deciding that an authority's raw value is
            bad — the card's `semantic_status` is the backend's verdict, and it
            already carries the left edge and the pill.
          */}
          {proofFields.map(([key, value]) => (
            <div key={key} style={{ display: "contents" }}>
              <dt>{key}</dt>
              <dd>{value === null ? "null" : String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <footer>
        <time>{observedAt ?? "Not yet observed"}</time>
        {href ? (
          <Link className="link-internal" to={href}>
            {hrefLabel ?? "Open full evidence"}
            <Icon name="arrow-right" size={12} />
          </Link>
        ) : null}
      </footer>
    </article>
  );
}

import { RECORDED_CALENDAR_PROOF } from "../data/proofManifest";
import { EvidenceBadge } from "./EvidenceBadge";

function StatusDot({ tone = "healthy" }: { tone?: "healthy" | "warning" | "failure" }) {
  return <span className={`status-dot status-${tone}`} aria-hidden="true" />;
}

function HeroBeat() {
  return (
    <section className="story-beat beat-hero" data-beat="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <EvidenceBadge stage="hero" />
        <p className="eyebrow">Autonomous objective recovery</p>
        <h1 id="hero-title">When operations break,<br />your objective shouldn’t.</h1>
        <p className="lede">
          Detect disruptions, map what they threaten, execute a safe recovery path,
          and verify the world independently.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href="#recovery-story">
            Watch recovery <span aria-hidden="true">↓</span>
          </a>
          <a className="button button-secondary" href="#architecture">Explore architecture</a>
        </div>
        <p className="credibility">Event-driven <i /> Policy constrained <i /> Independently verified</p>
      </div>
    </section>
  );
}

function RiskBeat() {
  const nodes = [
    ["Engineer", "Unavailable", "failure"],
    ["API migration", "Blocked", "failure"],
    ["Staging", "Threatened", "warning"],
    ["QA", "Threatened", "warning"],
    ["Release V2", "At risk", "warning"],
  ] as const;

  return (
    <section className="story-beat beat-risk" data-beat="risk" aria-labelledby="risk-title">
      <div className="objective-card surface-card">
        <p className="card-kicker">Current objective</p>
        <div className="objective-row">
          <span className="placeholder-icon">V2</span>
          <span><strong>Ship Release V2</strong><small>Friday · 5:00 PM</small></span>
          <span className="status-pill warning"><StatusDot tone="warning" />At risk</span>
        </div>
      </div>
      <div className="disruption-card surface-card">
        <EvidenceBadge stage="risk" />
        <p className="card-kicker failure-copy">Disruption detected</p>
        <h2 id="risk-title">Lead backend engineer unavailable.</h2>
        <p>The dependency blocks API migration and propagates risk to Release V2.</p>
      </div>
      <div className="operational-flow" aria-label="Operational blast radius">
        <p className="card-kicker">Operational blast radius</p>
        <div className="flow-cards">
          {nodes.map(([label, status, tone]) => (
            <article className="flow-card" key={label}>
              <span className="placeholder-icon" aria-hidden="true">{label.slice(0, 2)}</span>
              <strong>{label}</strong>
              <small><StatusDot tone={tone} />{status}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FuturesBeat() {
  return (
    <section className="story-beat beat-futures" data-beat="futures" aria-labelledby="futures-title">
      <div className="beat-heading">
        <EvidenceBadge stage="futures" />
        <p className="eyebrow">Three futures</p>
        <h2 id="futures-title">One objective.<br />Three possible futures.</h2>
        <p>Different strategies are compared under the same deterministic constraints.</p>
      </div>
      <div className="future-grid">
        <article className="future-card">
          <span className="future-index">A</span>
          <p className="card-kicker">Deadline first</p>
          <h3>Compress the handoff</h3>
          <p>Valid candidate · higher coordination cost</p>
          <span className="plan-status valid">Policy valid</span>
        </article>
        <article className="future-card selected">
          <span className="future-index">B</span>
          <p className="card-kicker">Resource balance</p>
          <h3>Redistribute implementation</h3>
          <p>Preserve deadline · balance ownership</p>
          <span className="plan-status selected-status">Selected by code</span>
        </article>
        <article className="future-card">
          <span className="future-index">C</span>
          <p className="card-kicker">Risk minimization</p>
          <h3>Protect critical review</h3>
          <p>Valid candidate · conservative sequencing</p>
          <span className="plan-status valid">Policy valid</span>
        </article>
      </div>
    </section>
  );
}

function ActionBeat() {
  const proof = RECORDED_CALENDAR_PROOF;
  return (
    <section className="story-beat beat-action" data-beat="action" aria-labelledby="action-title">
      <div className="action-copy">
        <EvidenceBadge stage="action" />
        <p className="eyebrow">Real action. Independent verification.</p>
        <h2 id="action-title">A real tool action,<br />read back separately.</h2>
        <p>
          This surface is derived from the frozen P1B Calendar proof. It is a recorded
          receipt, not a live API response.
        </p>
        <div className="path-key">
          <span>Detect</span><i /><span>Plan</span><i /><span>Act</span><i /><span>Verify</span>
        </div>
      </div>
      <article className="receipt-card surface-card" aria-label="Recorded Google Calendar action receipt">
        <header>
          <span className="calendar-placeholder" aria-hidden="true">31</span>
          <div><small>Recorded tool proof</small><h3>{proof.tool}</h3></div>
          <span className="status-pill verified">✓ {proof.status}</span>
        </header>
        <div className="receipt-summary">
          <p className="card-kicker">Action receipt</p>
          <h4>{proof.actionDescription}</h4>
          <dl>
            <div><dt>Calendar</dt><dd>{proof.calendarDisplayLabel}</dd></div>
            <div><dt>Receipt</dt><dd>{proof.receiptIdShort}</dd></div>
            <div><dt>Event</dt><dd>{proof.externalEventIdShort}</dd></div>
            <div><dt>Observed window</dt><dd>Aug 28 · 13:00–14:00 UTC</dd></div>
          </dl>
        </div>
        <ol className="receipt-steps">
          <li><b>1</b><span><strong>Write acknowledged</strong><small>{proof.writeAcknowledgedAt}</small></span></li>
          <li><b>2</b><span><strong>Separate Calendar GET</strong><small>{proof.readBackAt}</small></span></li>
          <li className="receipt-verified"><b>✓</b><span><strong>Independently verified</strong><small>{proof.verificationDifferenceCount} differences</small></span></li>
        </ol>
      </article>
    </section>
  );
}

function IncompleteBeat() {
  return (
    <section className="story-beat beat-incomplete" data-beat="incomplete" aria-labelledby="incomplete-title">
      <div className="beat-heading">
        <EvidenceBadge stage="incomplete" />
        <p className="eyebrow">Objective verification</p>
        <h2 id="incomplete-title">An action can succeed<br />while recovery remains incomplete.</h2>
        <p>The verified Calendar receipt does not give the model authority to restore the objective.</p>
      </div>
      <div className="failure-marker surface-card">
        <span className="failure-symbol" aria-hidden="true">!</span>
        <div><p className="card-kicker">Future capability state</p><strong>Verification failed</strong><small>Transition to replanning</small></div>
      </div>
    </section>
  );
}

function ReplanBeat() {
  return (
    <section className="story-beat beat-replan" data-beat="replan" aria-labelledby="replan-title">
      <div className="replan-copy">
        <EvidenceBadge stage="replan" />
        <p className="eyebrow">Reopen → Replan → Act → Verify</p>
        <h2 id="replan-title">The system reorganizes<br />around the objective.</h2>
        <p>This placeholder validates the second-path composition without claiming P1C/P1D execution.</p>
      </div>
      <div className="replan-steps" aria-label="Future replanning sequence">
        <span>Verification failed</span><i>→</i><span>Replanning</span><i>→</i><span>New action</span><i>→</i><span>Verify again</span>
      </div>
    </section>
  );
}

function RestoredBeat() {
  return (
    <section className="story-beat beat-restored" data-beat="restored" aria-labelledby="restored-title">
      <div className="restored-copy">
        <EvidenceBadge stage="restored" />
        <p className="eyebrow">Future verified outcome</p>
        <h2 id="restored-title">Objective restored.</h2>
        <p>Reserved for a later milestone with fresh, sufficient invariant evidence.</p>
      </div>
      <div className="verification-preview surface-card">
        <p className="card-kicker">Required future proof</p>
        <ul>
          <li><span>○</span>Calendar state verified</li>
          <li><span>○</span>Required CI healthy</li>
          <li><span>○</span>Required work assigned</li>
          <li><span>○</span>Protected deadline preserved</li>
        </ul>
        <small>Preview only · not current backend evidence</small>
      </div>
    </section>
  );
}

export function StoryBeats() {
  return (
    <div className="story-beats">
      <HeroBeat />
      <RiskBeat />
      <FuturesBeat />
      <ActionBeat />
      <IncompleteBeat />
      <ReplanBeat />
      <RestoredBeat />
    </div>
  );
}

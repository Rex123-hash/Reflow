import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { RecoveryStory } from "./components/RecoveryStory";
import { SiteHeader } from "./components/SiteHeader";

function lazyNamed<T extends Record<string, ComponentType>>(loader: () => Promise<T>, name: keyof T) {
  return lazy(async () => ({ default: (await loader())[name] }));
}

const OrbFidelityLab = lazyNamed(() => import("./fidelity/OrbFidelityLab"), "OrbFidelityLab");
const AuthoredOrbLab = lazyNamed(() => import("./fidelity/AuthoredOrbLab"), "AuthoredOrbLab");
const ProductionPresentationLab = lazyNamed(() => import("./fidelity/ProductionPresentationLab"), "ProductionPresentationLab");
const BrowserConvergenceLab = lazyNamed(() => import("./fidelity/BrowserConvergenceLab"), "BrowserConvergenceLab");

function LabShell({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="lab-loading" aria-label="Loading visual laboratory" />}>{children}</Suspense>;
}

function App() {
  const lab = new URLSearchParams(window.location.search).get("lab");
  if (lab === "browser-convergence") {
    return <LabShell><BrowserConvergenceLab /></LabShell>;
  }
  if (lab === "presentation") {
    return <LabShell><ProductionPresentationLab /></LabShell>;
  }
  if (lab === "authored-orb") {
    return <LabShell><AuthoredOrbLab /></LabShell>;
  }
  if (lab === "orb") {
    return <LabShell><OrbFidelityLab /></LabShell>;
  }

  return (
    <div className="site-shell" id="top">
      <SiteHeader />
      <main>
        <RecoveryStory />
        <section className="trust-section" id="architecture">
          <p className="eyebrow">Safety before autonomy</p>
          <h2>Gemini reasons. Code enforces.</h2>
          <div className="trust-grid">
            <article>
              <span className="trust-index">01</span>
              <h3>Gemini reasons</h3>
              <p>Interprets disruption evidence and proposes materially different futures.</p>
            </article>
            <article>
              <span className="trust-index">02</span>
              <h3>Code enforces</h3>
              <p>Owns policies, permissions, legal transitions, and idempotency.</p>
            </article>
            <article>
              <span className="trust-index">03</span>
              <h3>Verifier proves</h3>
              <p>Reads external state independently before accepting evidence.</p>
            </article>
          </div>
        </section>
        <section className="final-cta" id="demo-end">
          <p className="eyebrow">Recorded proof. Deterministic boundaries.</p>
          <h2>See Reflow in action.</h2>
          <Link className="button button-primary" to="/app">
            Open live workspace <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </main>
    </div>
  );
}

export default App;

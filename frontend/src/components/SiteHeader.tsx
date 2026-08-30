import { Link } from "react-router-dom";
import reflowMarkUrl from "../assets/reflow/reflow-mark.svg";

/**
 * The public header.
 *
 * `current` exists because the section links are in-page anchors: from the story
 * they scroll, but from another marketing route they have to return home first, so
 * they are prefixed with `/`. Without that, every nav item on the FAQ pointed at a
 * section id that is not on the FAQ.
 */
export function SiteHeader({ current }: { current?: "story" | "faq" } = {}) {
  const home = current === "story" || current === undefined ? "" : "/";
  return (
    <header className="site-header">
      <Link className="brand" to={home === "" ? "#top" : "/"} aria-label="Reflow home">
        <img src={reflowMarkUrl} alt="" className="brand-mark" aria-hidden="true" />
        <span>Reflow</span>
      </Link>
      <nav aria-label="Primary navigation">
        <a href={`${home}#recovery-story`}>Product</a>
        <a href={`${home}#recovery-impact`}>How it works</a>
        <a href={`${home}#architecture`}>Architecture</a>
        <Link
          className={current === "faq" ? "is-current" : undefined}
          aria-current={current === "faq" ? "page" : undefined}
          to="/faq"
        >
          FAQ
        </Link>
      </nav>
      <div className="header-actions">
        <Link className="button button-small button-primary" to="/app?demo=1">
          Live demo <span aria-hidden="true">→</span>
        </Link>
        <Link className="button button-small button-secondary" to="/app/overview">
          Open workspace
        </Link>
      </div>
    </header>
  );
}

import reflowMarkUrl from "../assets/reflow/reflow-mark.svg";

export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Reflow home">
        <img src={reflowMarkUrl} alt="" className="brand-mark" aria-hidden="true" />
        <span>Reflow</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="#recovery-story">Product</a>
        <a href="#recovery-impact">How it works</a>
        <a href="#architecture">Architecture</a>
      </nav>
      <a className="button button-small button-primary" href="#recovery-impact">
        Open Demo <span aria-hidden="true">→</span>
      </a>
    </header>
  );
}

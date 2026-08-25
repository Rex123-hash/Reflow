export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Reflow home">
        <span className="brand-mark" aria-hidden="true">
          <span />
        </span>
        <span>Reflow</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="#recovery-story">Product</a>
        <a href="#recovery-story">How it works</a>
        <a href="#architecture">Architecture</a>
      </nav>
      <a className="button button-small button-primary" href="#recovery-story">
        Open Demo <span aria-hidden="true">→</span>
      </a>
    </header>
  );
}

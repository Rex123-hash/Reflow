import { Link } from "react-router-dom";

export function WorkspaceActions({ className }: { className: string }) {
  return (
    <div className={className}>
      <Link className="button button-primary" to="/app?demo=1">
        Live demo <span aria-hidden="true">→</span>
      </Link>
      <Link className="button button-secondary" to="/app/overview?access=live">
        Open workspace <span aria-hidden="true">↗</span>
      </Link>
    </div>
  );
}

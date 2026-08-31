import { Link } from "react-router-dom";

export function WorkspaceActions({ className }: { className: string }) {
  return (
    <div className={className}>
      <Link className="button button-primary" to="/app/overview?access=live">
        Open live workspace <span aria-hidden="true">↗</span>
      </Link>
    </div>
  );
}

import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";
import reflowMarkUrl from "../assets/reflow/reflow-mark.svg";
import { LoadingState } from "./components/Feedback";
import { ScenarioSwitch } from "./components/ScenarioSwitch";
import { useAuthSession } from "./auth/AuthSessionContext";
import "./styles/tokens.css";
import "./styles/app.css";

const PRIMARY_NAV = [
  { to: "/app/overview", label: "Overview" },
  { to: "/app/objectives", label: "Objectives" },
  { to: "/app/recovery", label: "Recovery" },
  { to: "/app/operator", label: "Operator" },
  { to: "/app/evidence", label: "Evidence" },
] as const;

export function AppShell() {
  const { session, signOut } = useAuthSession();
  const initials = (session.display_name ?? session.email ?? "Reflow")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="app-root">
      <header className="app-nav">
        <a className="app-brand" href="/">
          <img src={reflowMarkUrl} alt="" aria-hidden="true" />
          <span>Reflow</span>
        </a>

        <nav className="app-nav-links" aria-label="Primary">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "is-active" : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="app-nav-tail">
          <ScenarioSwitch />
          <span className={`workspace-mode is-${session.mode}`}>
            <i aria-hidden="true" />
            {session.workspace_label}
          </span>
          <button
            type="button"
            className="app-signout"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
          <span
            className="app-avatar"
            title={session.email ?? session.workspace_label}
          >
            {initials || "R"}
          </span>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="route-pad">
            <LoadingState label="Loading Reflow" />
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </div>
  );
}

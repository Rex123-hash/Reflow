import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";
import reflowMarkUrl from "../assets/reflow/reflow-mark.svg";
import { Icon } from "./components/Icon";
import { LoadingState } from "./components/Feedback";
import { ScenarioSwitch } from "./components/ScenarioSwitch";
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
          <span className="app-ask" aria-hidden="true">
            <Icon name="search" size={12} />
            Ask Reflow
          </span>
          <span className="app-avatar" aria-hidden="true">
            AK
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

import { Suspense, useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import reflowMarkUrl from "../assets/reflow/reflow-mark.svg";
import { LoadingState } from "./components/Feedback";
import { ScenarioSwitch } from "./components/ScenarioSwitch";
import { useAuthSession } from "./auth/AuthSessionContext";
import { VoiceDock } from "./voice/VoiceDock";
import { VoiceLaunchProvider } from "./voice/VoiceLaunch";
import "./voice/voice.css";
import "./styles/tokens.css";
import "./styles/app.css";

const PRIMARY_NAV = [
  { to: "/app/overview", label: "Overview" },
  { to: "/app/objectives", label: "Objectives" },
  { to: "/app/recovery", label: "Recovery" },
  { to: "/app/operator", label: "Operator" },
  { to: "/app/evidence", label: "Evidence" },
] as const;

/**
 * The five primary routes, rendered twice: once in the centre zone of the desktop
 * header and once in the mobile rail beneath it. Only one is ever displayed, and
 * the desktop copy is the labelled landmark so assistive technology is not offered
 * two identical "Primary" navigations.
 */
function PrimaryNav() {
  return (
    <>
      {PRIMARY_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => (isActive ? "is-active" : undefined)}
        >
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export function AppShell() {
  const { session, signOut } = useAuthSession();
  const location = useLocation();
  const mobileNavigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const active = mobileNavigation.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    active?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [location.pathname]);
  const initials = (session.display_name ?? session.email ?? "Reflow")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const workspace = (
    <span className={`workspace-mode is-${session.mode}`}>
      <i aria-hidden="true" />
      {session.workspace_label}
    </span>
  );

  return (
    <VoiceLaunchProvider>
      <div className="app-root">
        <header className="app-nav">
          <div className="app-nav-inner workspace-inset">
            <div className="app-brand-block">
              <a className="app-brand" href="/">
                <img src={reflowMarkUrl} alt="" aria-hidden="true" />
                <span>Reflow</span>
              </a>
              {workspace}
            </div>

            <nav className="app-nav-links" aria-label="Primary">
              <PrimaryNav />
            </nav>

            <div className="app-nav-tail">
              <ScenarioSwitch />
              {workspace}
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
          </div>

          <nav
            ref={mobileNavigation}
            className="app-nav-rail"
            aria-label="Primary"
          >
            <div className="app-nav-links">
              <PrimaryNav />
            </div>
          </nav>
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

        {/* Reflow, reachable from every authenticated route. */}
        <VoiceDock />
      </div>
    </VoiceLaunchProvider>
  );
}

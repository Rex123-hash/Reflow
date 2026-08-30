import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon, ICON_SIZE } from "../components/Icon";
import { useIncidentChoices } from "../data/useIncidentChoices";
import { ShowGlyph } from "../vision/PlateMark";
import { DialMark } from "./DialMark";
import { MicGlyph } from "./VoiceComposer";
import { useVoiceLaunch } from "./VoiceLaunch";
import "../vision/vision.css";

/**
 * The handle: Reflow, reachable from anywhere.
 *
 * A single compact mark pinned to the corner, carrying the same dial the call opens
 * into. Collapsed it is one control and steals no workspace width; opened it offers
 * the small set of ways to reach Reflow, with the live call as the hero and the rest
 * as quiet rows beneath it.
 *
 * It is deliberately not a support widget. There is no chat bubble, no unread badge,
 * no greeting, and it does not appear on Operator — that surface carries its own
 * launch control, and two of them on one page would be noise rather than emphasis.
 */

const DOCK_ROUTES_EXCLUDED = "/app/operator";

export function VoiceDock() {
  const [open, setOpen] = useState(false);
  const launch = useVoiceLaunch();
  const choices = useIncidentChoices();
  const navigate = useNavigate();
  const location = useLocation();
  const dock = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // The dock closes on route change, so it never follows a reader to a new page.
  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (!dock.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>("button, a")?.focus();
  }, [open]);

  // Operator has its own launch control, and a call in progress is the destination.
  if (location.pathname.startsWith(DOCK_ROUTES_EXCLUDED) || launch.active)
    return null;

  const incident =
    choices.status === "ready"
      ? (choices.priority ?? choices.choices[0] ?? null)
      : null;
  const incidentId =
    incident && "incident_id" in incident
      ? incident.incident_id
      : (incident?.incidentId ?? null);
  const objectiveTitle =
    incident && "objective_title" in incident
      ? incident.objective_title
      : (incident?.objectiveTitle ?? "");

  const talk = () => {
    setOpen(false);
    // Without an authoritative incident there is nothing to talk about yet, so the
    // dock takes the reader to the surface that resolves one rather than guessing.
    if (incidentId) launch.open(incidentId, objectiveTitle);
    else navigate("/app/operator");
  };

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <div className={`voice-dock${open ? " is-open" : ""}`} ref={dock}>
      {open ? (
        <div className="voice-dock-panel" ref={panel}>
          <div role="menu">
            <button
              type="button"
              className="voice-dock-hero"
              role="menuitem"
              onClick={talk}
            >
              <DialMark size={34} />
              <span>
                <b>Talk to Reflow</b>
                <small>
                  Live voice. Interrupt, ask, and request bounded changes.
                </small>
              </span>
            </button>

            {/* Type, talk, show. Three ways to reach the same Reflow, grouped and
                named as one family so the newest of them does not read as a
                support tool bolted onto the side of the other two. */}
            <div role="group" aria-labelledby="voice-dock-modes">
              <p className="voice-dock-modes" id="voice-dock-modes">
                Type it. Say it. Show it.
              </p>
              <button
                type="button"
                className="voice-dock-row"
                role="menuitem"
                onClick={() => go("/app/operator")}
              >
                <Icon name="search" size={ICON_SIZE.row} />
                Ask Reflow
              </button>
              <button
                type="button"
                className="voice-dock-row"
                role="menuitem"
                onClick={() => go("/app/operator?show=image")}
              >
                <ShowGlyph size={ICON_SIZE.row} />
                Show Reflow
              </button>
              <button
                type="button"
                className="voice-dock-row"
                role="menuitem"
                onClick={() => go("/app/operator")}
              >
                <MicGlyph />
                Dictate a request
              </button>
            </div>
            <a className="voice-dock-row" role="menuitem" href="/faq">
              <Icon name="info" size={ICON_SIZE.row} />
              How Reflow works
            </a>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="voice-dock-handle"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Talk to Reflow"
        onClick={() => setOpen((value) => !value)}
      >
        <DialMark size={30} />
        <span className="voice-dock-handle-label">Talk to Reflow</span>
      </button>
    </div>
  );
}

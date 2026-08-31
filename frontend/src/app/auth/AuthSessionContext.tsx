import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import reflowMarkUrl from "../../assets/reflow/reflow-mark.svg";
import {
  clearProductSession,
  continueAsGuest,
  continueWithGoogle,
} from "./firebaseClient";
import "./auth.css";

export interface AuthSession {
  mode: "live" | "guest";
  workspace_label: string;
  email: string | null;
  display_name: string | null;
  read_only: boolean;
}

interface AuthSessionValue {
  session: AuthSession;
  signOut: () => Promise<void>;
}

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

async function readSession(): Promise<AuthSession | null> {
  const response = await fetch("/api/auth/session", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (response.status === 401) return null;
  if (!response.ok)
    throw new Error("Reflow could not read the product session.");
  return (await response.json()) as AuthSession;
}

type WorkspaceAccessRequest = "live" | "guest" | null;

function consumeWorkspaceAccessRequest(): WorkspaceAccessRequest {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const request =
    url.searchParams.get("access") === "live"
      ? "live"
      : url.searchParams.get("demo") === "1"
        ? "guest"
        : null;
  if (!request) return null;
  url.searchParams.delete("access");
  url.searchParams.delete("demo");
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
  return request;
}

export function AuthBoundary({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "entry" | "ready" | "error">(
    "loading",
  );
  const [session, setSession] = useState<AuthSession | null>(null);
  const [busy, setBusy] = useState<"google" | "guest" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setMessage(null);
    try {
      const request = consumeWorkspaceAccessRequest();
      let current = await readSession();
      if (request === "guest" && current?.mode !== "guest") {
        await continueAsGuest();
        current = await readSession();
        if (current?.mode !== "guest")
          throw new Error("The Demo Workspace session was not established.");
      }
      if (request === "live" && current?.mode !== "live") {
        if (current?.mode === "guest") await clearProductSession();
        setSession(null);
        setStatus("entry");
        return;
      }
      setSession(current);
      setStatus(current ? "ready" : "entry");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Reflow could not load.",
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const expired = () => {
      setSession(null);
      setMessage("Your product session expired. Sign in again to continue.");
      setStatus("entry");
    };
    window.addEventListener("reflow:session-expired", expired);
    return () => window.removeEventListener("reflow:session-expired", expired);
  }, []);

  const enter = async (mode: "google" | "guest") => {
    setBusy(mode);
    setMessage(null);
    try {
      if (mode === "google") await continueWithGoogle();
      else await continueAsGuest();
      const current = await readSession();
      if (!current)
        throw new Error("The secure product session was not established.");
      setSession(current);
      setStatus("ready");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Authentication did not complete.",
      );
    } finally {
      setBusy(null);
    }
  };

  const endSession = useCallback(async () => {
    await clearProductSession();
    setSession(null);
    setStatus("entry");
  }, []);

  if (status === "loading") {
    return <main className="auth-loading" aria-label="Loading Reflow" />;
  }

  if (status === "error") {
    return (
      <main className="auth-root">
        <section className="auth-card" role="alert">
          <img src={reflowMarkUrl} alt="" aria-hidden="true" />
          <p className="auth-kicker">Reflow</p>
          <h1>Product access is temporarily unavailable</h1>
          <p>{message}</p>
          <button
            className="auth-primary"
            type="button"
            onClick={() => void refresh()}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (status === "entry" || !session) {
    return (
      <main className="auth-root">
        <section className="auth-card">
          <img src={reflowMarkUrl} alt="" aria-hidden="true" />
          <p className="auth-kicker">Reflow</p>
          <h1>Enter the recovery workspace</h1>
          <p className="auth-lede">
            Inspect objective truth, recovery evidence, and the durable
            execution record.
          </p>
          <div className="auth-actions">
            <button
              className="auth-primary"
              type="button"
              disabled={busy !== null}
              onClick={() => void enter("google")}
            >
              {busy === "google" ? "Connecting…" : "Continue with Google"}
            </button>
            <button
              className="auth-secondary"
              type="button"
              disabled={busy !== null}
              onClick={() => void enter("guest")}
            >
              {busy === "guest" ? "Opening demo…" : "Explore Demo Workspace"}
            </button>
          </div>
          {message ? (
            <p className="auth-error" role="alert">
              {message}
            </p>
          ) : null}
          <p className="auth-note">
            No Google account required. Real Reflow reasoning is enabled;
            external changes remain disabled.
          </p>
        </section>
      </main>
    );
  }

  return (
    <AuthSessionContext.Provider value={{ session, signOut: endSession }}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionValue {
  const value = useContext(AuthSessionContext);
  if (!value)
    throw new Error("useAuthSession must be used inside AuthBoundary.");
  return value;
}

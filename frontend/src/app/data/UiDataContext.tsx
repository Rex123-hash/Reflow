import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FixtureUiDataProvider,
  type FixtureScenario,
} from "./FixtureUiDataProvider";
import {
  UiDataError,
  type Provenanced,
  type ProvenanceInfo,
  type UiDataProvider,
} from "./UiDataProvider";

interface UiDataContextValue {
  provider: UiDataProvider;
  /** Dev-only: which exported presentation the Recovery Room reads. */
  scenario: FixtureScenario;
  setScenario: (scenario: FixtureScenario) => void;
  isFixtureProvider: boolean;
}

const UiDataContext = createContext<UiDataContextValue | null>(null);

export function UiDataProviderRoot({
  children,
  initialScenario = "active",
  provider,
}: {
  children: ReactNode;
  initialScenario?: FixtureScenario;
  provider?: UiDataProvider;
}) {
  const [scenario, setScenario] = useState<FixtureScenario>(initialScenario);

  const value = useMemo<UiDataContextValue>(() => {
    if (provider) {
      return { provider, scenario, setScenario, isFixtureProvider: false };
    }
    return {
      provider: new FixtureUiDataProvider(scenario),
      scenario,
      setScenario,
      isFixtureProvider: true,
    };
  }, [provider, scenario]);

  return (
    <UiDataContext.Provider value={value}>{children}</UiDataContext.Provider>
  );
}

export function useUiData(): UiDataContextValue {
  const value = useContext(UiDataContext);
  if (!value) {
    throw new Error("useUiData must be used inside <UiDataProviderRoot>.");
  }
  return value;
}

export type ResourceState<T> =
  | { status: "loading"; data: null; error: null; provenance: null }
  | { status: "ready"; data: T; error: null; provenance: ProvenanceInfo }
  | { status: "error"; data: null; error: UiDataError; provenance: null };

const LOADING = {
  status: "loading",
  data: null,
  error: null,
  provenance: null,
} as const;

const toUiDataError = (cause: unknown): UiDataError =>
  cause instanceof UiDataError
    ? cause
    : new UiDataError(
        "transport_failure",
        cause instanceof Error
          ? cause.message
          : "The presentation resource could not be read.",
      );

/**
 * Runs one provider call and tracks its lifecycle.
 *
 * `key` identifies the request; changing it re-runs the fetch and aborts the
 * previous one. `run` is called with an AbortSignal.
 */
export function useResource<T>(
  key: string,
  run: (signal: AbortSignal) => Promise<Provenanced<T>>,
): ResourceState<T> & { reload: () => void } {
  const [state, setState] = useState<ResourceState<T>>(LOADING);
  const [nonce, setNonce] = useState(0);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState(LOADING);

    runRef
      .current(controller.signal)
      .then((result) => {
        if (!active) return;
        setState({
          status: "ready",
          data: result.data,
          error: null,
          provenance: result.provenance,
        });
      })
      .catch((cause: unknown) => {
        if (!active || controller.signal.aborted) return;
        setState({
          status: "error",
          data: null,
          error: toUiDataError(cause),
          provenance: null,
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}

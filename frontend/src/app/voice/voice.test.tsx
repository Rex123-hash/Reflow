import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { phaseForResult, PHASE_COPY, type CallPhase } from "./callModel";
import { LiveCallStage, type CallView } from "./LiveCallStage";
import { VoiceComposer } from "./VoiceComposer";
import type { VoiceOperatorHandoffResult } from "./voiceContract";

/**
 * What these hold.
 *
 * Voice adds a way to speak to Reflow, not a way for Reflow to claim more than it did.
 * The assertions that matter are the ones about truth: a transcript never submits
 * itself, and no refused, unverified or failed Operator outcome can be rendered as a
 * success or as a recovered objective.
 */

const source = { read: () => ({ bands: new Float32Array(16), level: 0 }) };

function view(overrides: Partial<CallView> = {}): CallView {
  return {
    phase: "LISTENING",
    elapsedSeconds: 12,
    muted: false,
    transcript: [],
    interim: "",
    incidentId: "incident-0fc3af5b0bd1ad847aea",
    objectiveTitle: "Ship Release V2",
    error: null,
    lastResult: null,
    source,
    ...overrides,
  };
}

function result(
  overrides: Partial<VoiceOperatorHandoffResult> = {},
): VoiceOperatorHandoffResult {
  return {
    voice_session_id: "Ab3d_Ef5gH6ijK7lM8nO9pQr",
    request_id: "12345678-1234-1234-1234-123456789abc",
    incident_id: "incident-0fc3af5b0bd1ad847aea",
    outcome: "CONVERSATIONAL",
    original_request: "What happened in recovery one?",
    spoken_result:
      "Here is what Reflow's authoritative context shows. Recovery 1 failed.",
    truth_boundary: "Only recorded state is asserted.",
    action_verified: false,
    external_effects_executed: false,
    objective_recovered: false,
    operator_disposition: "SUPPORTED",
    operator_action_lifecycle: null,
    approval_required_action_id: null,
    failure: null,
    ...overrides,
  };
}

const actions = { toggleMute: vi.fn(), end: vi.fn(), reconnect: vi.fn() };

/* --------------------------------------------------------- voice-to-text --- */

vi.mock("./useDictation", () => ({
  useDictation: vi.fn(),
}));
const { useDictation } = await import("./useDictation");
const dictation = vi.mocked(useDictation);

function mockDictation(over: Partial<ReturnType<typeof useDictation>> = {}) {
  const value = {
    state: {
      status: "IDLE" as const,
      interim: "",
      level: 0,
      elapsedSeconds: 0,
      error: null,
    },
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    dismiss: vi.fn(),
    ...over,
  };
  dictation.mockReturnValue(value as ReturnType<typeof useDictation>);
  return value;
}

function composer(onTranscript = vi.fn()) {
  return render(
    <VoiceComposer
      incidentId="incident-0fc3af5b0bd1ad847aea"
      disabled={false}
      onTranscript={onTranscript}
    >
      {(mic, strip) => (
        <form onSubmit={(event) => event.preventDefault()}>
          {strip ?? <input aria-label="Ask Reflow" />}
          {mic}
          <button type="submit" disabled={strip !== null}>
            Ask Reflow
          </button>
        </form>
      )}
    </VoiceComposer>,
  );
}

describe("voice-to-text", () => {
  it("offers a microphone in the composer and starts a take on request", async () => {
    const value = mockDictation();
    composer();
    const mic = screen.getByRole("button", { name: "Dictate a request" });
    await userEvent.click(mic);
    expect(value.start).toHaveBeenCalled();
  });

  it("shows real level, elapsed time and what was heard while recording", () => {
    mockDictation({
      state: {
        status: "LISTENING",
        interim: "Why did recovery one fail",
        level: 0.42,
        elapsedSeconds: 74,
        error: null,
      },
    });
    composer();
    expect(screen.getByRole("status")).toHaveTextContent("Listening");
    expect(screen.getByText("01:14")).toBeInTheDocument();
    expect(screen.getByText("Why did recovery one fail")).toBeInTheDocument();
    // Level is exposed numerically, so it is never carried by colour alone.
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "42");
  });

  it("never submits: the transcript is handed to the field and stops there", () => {
    const onTranscript = vi.fn();
    const value = mockDictation({
      state: {
        status: "LISTENING",
        interim: "move the demo event",
        level: 0.2,
        elapsedSeconds: 3,
        error: null,
      },
    });
    const submitted = vi.fn();
    render(
      <VoiceComposer
        incidentId="incident-0fc3af5b0bd1ad847aea"
        disabled={false}
        onTranscript={onTranscript}
      >
        {(mic, strip) => (
          <form onSubmit={submitted}>
            {strip ?? <input aria-label="Ask Reflow" />}
            {mic}
            <button type="submit">Ask Reflow</button>
          </form>
        )}
      </VoiceComposer>,
    );
    // Stopping a take delivers text through the callback only.
    expect(value.stop).not.toHaveBeenCalled();
    expect(submitted).not.toHaveBeenCalled();
    expect(onTranscript).not.toHaveBeenCalled();
    expect(screen.getByText("move the demo event")).toBeInTheDocument();
  });

  it("will not send a partial transcript while a take is running", () => {
    // Interim text is a guess in progress. Send stays closed for the whole take —
    // listening, opening the microphone and finishing — and opens once the finalized
    // transcript is in the field.
    for (const status of ["REQUESTING", "LISTENING", "FINALIZING"] as const) {
      mockDictation({
        state: {
          status,
          interim: "move the demo ev",
          level: 0.3,
          elapsedSeconds: 2,
          error: null,
        },
      });
      const { unmount } = composer();
      expect(
        screen.getByRole("button", { name: "Ask Reflow" }),
        `Send must be disabled while ${status}`,
      ).toBeDisabled();
      unmount();
    }

    mockDictation();
    composer();
    expect(screen.getByRole("button", { name: "Ask Reflow" })).toBeEnabled();
  });

  it("takes over the field in place rather than opening a panel beside it", () => {
    mockDictation({
      state: {
        status: "LISTENING",
        interim: "half a sentence",
        level: 0.3,
        elapsedSeconds: 4,
        error: null,
      },
    });
    composer();
    // The input is gone while a take runs: the strip is standing in for it.
    expect(screen.queryByLabelText("Ask Reflow")).not.toBeInTheDocument();
    expect(screen.getByText("half a sentence")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("can be cancelled without producing a transcript", async () => {
    const value = mockDictation({
      state: {
        status: "LISTENING",
        interim: "half a sentence",
        level: 0.1,
        elapsedSeconds: 2,
        error: null,
      },
    });
    composer();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(value.cancel).toHaveBeenCalled();
  });

  it("explains a denied microphone and a failed session in words", () => {
    mockDictation({
      state: {
        status: "DENIED",
        interim: "",
        level: 0,
        elapsedSeconds: 0,
        error:
          "Reflow needs microphone access. Allow it in your browser, then try again.",
      },
    });
    const denied = composer();
    expect(screen.getByRole("alert")).toHaveTextContent(/microphone access/i);
    denied.unmount();

    mockDictation({
      state: {
        status: "UNAVAILABLE",
        interim: "",
        level: 0,
        elapsedSeconds: 0,
        error: "Voice is not configured in this deployment.",
      },
    });
    composer();
    expect(screen.getByRole("alert")).toHaveTextContent(/not configured/i);
  });
});

/* -------------------------------------------------------------- live call --- */

const PHASES: CallPhase[] = [
  "CONNECTING",
  "LISTENING",
  "USER_SPEAKING",
  "REFLOW_SPEAKING",
  "WORKING",
  "VERIFYING",
  "VERIFIED",
  "UNCONFIRMED",
  "DENIED",
  "UNSUPPORTED",
  "DISCONNECTED",
];

describe("live call", () => {
  it("names every phase in words, so nothing is carried by motion alone", () => {
    for (const phase of PHASES) {
      const { unmount } = render(
        <LiveCallStage
          view={view({ phase })}
          actions={actions}
          reducedMotion
        />,
      );
      expect(screen.getByRole("status")).toHaveTextContent(
        PHASE_COPY[phase].label,
      );
      expect(screen.getByRole("img")).toHaveAccessibleName(
        new RegExp(PHASE_COPY[phase].label),
      );
      unmount();
    }
  });

  it("maps each Operator outcome to its own phase and never upgrades one", () => {
    expect(phaseForResult(result({ outcome: "ACTION_VERIFIED" }))).toBe(
      "VERIFIED",
    );
    expect(phaseForResult(result({ outcome: "ACTION_UNVERIFIED" }))).toBe(
      "UNCONFIRMED",
    );
    expect(phaseForResult(result({ outcome: "HANDOFF_FAILED" }))).toBe(
      "UNCONFIRMED",
    );
    expect(phaseForResult(result({ outcome: "DENIED" }))).toBe("DENIED");
    expect(phaseForResult(result({ outcome: "UNSUPPORTED" }))).toBe(
      "UNSUPPORTED",
    );
    // An approval requirement is not a success: the action has not run.
    expect(phaseForResult(result({ outcome: "APPROVAL_REQUIRED" }))).toBe(
      "UNCONFIRMED",
    );
  });

  it("renders the backend's own spoken result without rewriting it", () => {
    const spoken =
      "Reflow sent that action, but read-back did not confirm it; it is not verified.";
    render(
      <LiveCallStage
        view={view({
          phase: "UNCONFIRMED",
          lastResult: result({
            outcome: "ACTION_UNVERIFIED",
            spoken_result: spoken,
            truth_boundary: "No verified outcome is claimed.",
          }),
        })}
        actions={actions}
        reducedMotion
      />,
    );
    expect(screen.getByText(spoken)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Not verified");
    expect(screen.queryByText(/Action verified —/)).not.toBeInTheDocument();
  });

  it("keeps a verified action distinct from a recovered objective", () => {
    render(
      <LiveCallStage
        view={view({
          phase: "VERIFIED",
          lastResult: result({
            outcome: "ACTION_VERIFIED",
            action_verified: true,
            objective_recovered: false,
            spoken_result:
              "Reflow ran that action and independently verified it.",
          }),
        })}
        actions={actions}
        reducedMotion
      />,
    );
    expect(
      screen.getByText(
        "Action verified — the objective is not recorded as recovered.",
      ),
    ).toBeInTheDocument();
  });

  it("does not draw the objective as recovered from a verified action alone", () => {
    for (const phase of PHASES) {
      const { container, unmount } = render(
        <LiveCallStage
          view={view({ phase })}
          actions={actions}
          reducedMotion
        />,
      );
      expect(container.textContent).not.toMatch(/objective restored/i);
      expect(container.textContent).not.toMatch(/objective recovered\b/i);
      unmount();
    }
  });

  it("keeps the transcript secondary but available, with speakers distinguished", async () => {
    render(
      <LiveCallStage
        view={view({
          transcript: [
            {
              id: "1",
              speaker: "you",
              text: "Why did recovery one fail?",
              at: 1,
            },
            {
              id: "2",
              speaker: "reflow",
              text: "Release validation failed.",
              at: 2,
            },
            {
              id: "3",
              speaker: "operator",
              text: "Reflow policy denied that action; no external change occurred.",
              outcome: "DENIED",
              at: 3,
            },
          ],
        })}
        actions={actions}
        reducedMotion
      />,
    );
    const disclosure = screen.getByRole("group");
    expect(within(disclosure).getByText("3 turns")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Transcript"));
    const rows = within(disclosure).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("You");
    expect(rows[1]).toHaveTextContent("Reflow");
    expect(rows[2]).toHaveTextContent("Operator");
    expect(rows[2]).toHaveTextContent("denied");
  });

  it("exposes mute, end and reconnect as real controls", async () => {
    const { unmount } = render(
      <LiveCallStage
        view={view({ muted: true })}
        actions={actions}
        reducedMotion
      />,
    );
    const mic = screen.getByRole("button", { name: "Muted" });
    expect(mic).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(mic);
    expect(actions.toggleMute).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "End call" }));
    expect(actions.end).toHaveBeenCalled();
    unmount();

    render(
      <LiveCallStage
        view={view({ phase: "DISCONNECTED" })}
        actions={actions}
        reducedMotion
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(actions.reconnect).toHaveBeenCalled();
  });

  it("is a labelled modal that can be left from the keyboard", () => {
    render(<LiveCallStage view={view()} actions={actions} reducedMotion />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Reflow live call");
    expect(screen.getByRole("button", { name: "End call" })).toHaveFocus();
  });
});

/* ---------------------------------------------------------- the boundary --- */

describe("the voice boundary", () => {
  const dir = join(process.cwd(), "src", "app", "voice");
  const sources = readdirSync(dir)
    .filter((name) => /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.tsx"))
    .map((name) => ({ name, code: readFileSync(join(dir, name), "utf8") }));

  it("adds no direct call to any business system", () => {
    for (const { name, code } of sources) {
      for (const host of [
        "slack.com/api",
        "atlassian.net",
        "www.googleapis.com/calendar",
        "gmail.googleapis.com",
        "api.github.com",
      ]) {
        expect(code.toLowerCase(), `${name} reaches ${host}`).not.toContain(
          host,
        );
      }
    }
  });

  it("calls only the three same-origin voice routes and the Live endpoint", () => {
    const client = sources.find((file) => file.name === "voiceClient.ts")!.code;
    const live = sources.find((file) => file.name === "liveSession.ts")!.code;
    const paths = [...client.matchAll(/"(\/api\/[^"]+)"/g)].map((m) => m[1]);
    expect(new Set(paths)).toEqual(
      new Set([
        "/api/v1/voice/transcription/session",
        "/api/v1/voice/live/session",
        "/api/v1/voice/operator/handoff",
      ]),
    );
    expect(live).toContain(
      "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained",
    );
    expect(live).not.toContain("v1alpha.GenerativeService.BidiGenerateContent");
    expect(live).toContain("reason: event.reason.slice(0, 240)");
  });

  it("never names a model, a tool or a permanent credential in the browser", () => {
    for (const { name, code } of sources) {
      // Models are locked into the ephemeral token server-side; the browser echoes
      // back only what the session grant told it.
      expect(code, name).not.toContain("gemini-3.5-transcribe-live");
      expect(code, name).not.toContain("gemini-3.1-flash-live-preview");
      expect(code, name).not.toMatch(/AIza[\w-]{10,}/);
      expect(code, name).not.toMatch(/VOICE_GEMINI_API_KEY/);
    }
  });

  it("persists neither audio nor an ephemeral credential", () => {
    for (const { name, code } of sources) {
      expect(code, name).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    }
  });
});

describe("the microphone control", () => {
  it("uses a microphone symbol, never verification geometry", () => {
    for (const [muted, name] of [
      [false, "Mic on"],
      [true, "Muted"],
    ] as const) {
      const { container, unmount } = render(
        <LiveCallStage
          view={view({ muted })}
          actions={actions}
          reducedMotion
        />,
      );
      const control = screen.getByRole("button", { name });
      expect(control).toHaveAttribute("aria-pressed", String(muted));
      // The closed-ring and check family belongs to verified outcomes alone.
      const glyph = control.querySelector("svg")!;
      expect(glyph.querySelector("circle")).toBeNull();
      expect(
        container.querySelector(".voice-call-controls svg path"),
      ).not.toBeNull();
      unmount();
    }
  });

  it("names the objective in the header and keeps the identifier in the detail", async () => {
    render(
      <LiveCallStage
        view={view({ objectiveTitle: "Ship Release V2" })}
        actions={actions}
        reducedMotion
      />,
    );
    expect(screen.getByTitle("Ship Release V2")).toBeInTheDocument();
    // The raw identifier is not in the primary header.
    expect(
      screen.getByRole("dialog").querySelector(".voice-call-head")?.textContent,
    ).not.toMatch(/incident-/);
    await userEvent.click(screen.getByText("Transcript"));
    expect(
      screen.getByText(/incident-0fc3af5b0bd1ad847aea/),
    ).toBeInTheDocument();
  });
});

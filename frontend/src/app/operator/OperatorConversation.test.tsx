import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { OperatorConversation } from "./OperatorConversation";
import { VoiceLaunchProvider } from "../voice/VoiceLaunch";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

const response = {
  agents: [
    {
      agent_id: "conversation_understanding_agent",
      attempts: 1,
      input_tokens: 8,
      latency_ms: 20,
      model: "gemini-3.7-flash",
      output_tokens: 4,
      request_id: "12345678-1234-1234-1234-123456789abc",
      total_tokens: 12,
      validation: "PASSED",
    },
    {
      agent_id: "operator_intent_interpreter",
      attempts: 1,
      input_tokens: 10,
      latency_ms: 30,
      model: "gemini-3.7-flash",
      output_tokens: 5,
      request_id: "12345678-1234-1234-1234-123456789abc",
      total_tokens: 15,
      validation: "PASSED",
    },
  ],
  conversation: {
    mode: "TASK",
    user_goal: "Understand why Recovery 1 failed",
    normalized_request: "Why did Recovery 1 fail?",
    requested_capability: "RECOVERY_EXPLAIN",
    entities: [],
    constraints: [],
    missing_information: [],
    requires_operator: true,
    tone: "neutral",
    confidence: "HIGH",
    direct_response: null,
  },
  human_response: {
    human_summary:
      "Recovery 1 failed because the replacement did not pass CI. The objective is healthy now.",
    situation_type: "OBJECTIVE_RESTORED",
    current_state: "The objective is restored after a second recovery.",
    why: "Independent release validation failed.",
    next_step: "Open technical details for the evidence.",
    truth_boundary: "This explains recorded state; nothing was changed.",
    suggestions: ["Show the evidence", "What happened next?"],
  },
  answer: "Calendar action verified.\n\nObjective verification failed.",
  disposition: "SUPPORTED",
  evidence: [
    {
      evidence_id: "objective-verification:1",
      observed_at: "2026-08-27T19:08:04Z",
      title: "Recovery 01 verification",
    },
  ],
  external_effects_executed: false,
  facts: [
    {
      evidence_ids: ["objective-verification:1"],
      fact_id: "verification:1",
      text: "Objective failed.",
    },
  ],
  generated_at: "2026-08-28T12:00:00Z",
  incident_id: "incident-abc",
  intent: {
    clarification: null,
    constraints: [],
    disposition: "SUPPORTED",
    fact_ids: ["verification:1"],
    hypothetical_changes: [],
    incident_id: "incident-abc",
    intent_type: "EXPLAIN",
    question: "Why?",
    recovery_attempt: 1,
    subject: "RECOVERY",
  },
  provenance: "AUTHORITATIVE_SNAPSHOT",
  request_id: "12345678-1234-1234-1234-123456789abc",
  revision: 16,
  simulation: null,
  snapshot_fingerprint: "a".repeat(64),
  hypothetical_deadline: null,
};

describe("real Operator conversation", () => {
  it("puts the human answer before collapsed technical provenance", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify(response), { status: 200 }),
      ),
    );
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <OperatorConversation
            incidentId="incident-abc"
            objectiveTitle="Ship Release V2"
            live
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Ask Reflow"), {
      target: { value: "why the hell did recovery one fail lol" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ask Reflow/ }));
    const summary = await screen.findByText(/replacement did not pass CI/);
    const details = screen.getByText("Technical details").closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(
      summary.compareDocumentPosition(details!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const disclosure = screen
      .getByText("Technical details")
      .closest("summary")!;
    disclosure.focus();
    expect(disclosure).toHaveFocus();
    fireEvent.click(disclosure);
    expect(details).toHaveAttribute("open");
    expect(screen.getByText(/Conversation understanding/)).toBeInTheDocument();
    expect(
      screen.getByText("conversation_understanding_agent"),
    ).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  it("focuses a new response without animation when reduced motion is requested", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn((media: string) => ({
        matches: media === "(prefers-reduced-motion: reduce)",
        media,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify(response), { status: 200 }),
      ),
    );
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <OperatorConversation
            incidentId="incident-abc"
            objectiveTitle="Ship Release V2"
            live
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Ask Reflow"), {
      target: { value: "Why did Recovery 1 fail?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ask Reflow/ }));
    await screen.findByText(/replacement did not pass CI/);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
  });

  it("renders unsupported Calendar creation in plain language with a safe follow-up", async () => {
    const unsupported = {
      ...response,
      answer:
        "This request is not a supported Operator capability. Calendar create is unavailable.",
      disposition: "UNSUPPORTED",
      conversation: {
        ...response.conversation,
        user_goal: "Create a new reminder for August 30 at 6 PM",
        normalized_request: "Create a new reminder for August 30 at 6 PM",
        requested_capability: "CALENDAR_CREATE",
      },
      human_response: {
        human_summary:
          "Got it — you want to create a new Calendar reminder or event. Reflow can't create new Calendar events yet.",
        situation_type: "UNSUPPORTED",
        current_state: "New Calendar event creation is not available.",
        next_step:
          "If you mean the Operator demo event, I can move that instead.",
        truth_boundary: "No action was taken.",
        suggestions: ["Move the Operator event to 6 PM"],
      },
      intent: {
        ...response.intent,
        disposition: "UNSUPPORTED",
        intent_type: null,
        subject: "CALENDAR",
        fact_ids: [],
        clarification: "Calendar event creation is unsupported.",
      },
      facts: [],
      evidence: [],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify(unsupported), { status: 200 }),
      ),
    );
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <OperatorConversation
            incidentId="incident-abc"
            objectiveTitle="Ship Release V2"
            live
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Ask Reflow"), {
      target: { value: "set a reminder for 6 pm 30 august" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ask Reflow/ }));
    expect(
      await screen.findByText(/can't create new Calendar events yet/),
    ).toBeInTheDocument();
    expect(screen.getByText("No action was taken.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Move the Operator event to 6 PM" }),
    ).toBeInTheDocument();
  });

  it("renders HELP as a natural direct answer without inventing an operational intent", async () => {
    const help = {
      ...response,
      disposition: "SUPPORTED",
      conversation: {
        mode: "HELP",
        user_goal: "Learn what Reflow can do",
        normalized_request: null,
        requested_capability: "CAPABILITY_HELP",
        entities: [],
        constraints: [],
        missing_information: [],
        requires_operator: false,
        tone: "informal",
        confidence: "HIGH",
        direct_response:
          "I can explain recoveries, inspect configured resources, and simulate explicit alternatives.",
      },
      human_response: {
        human_summary:
          "I can explain recoveries, inspect configured resources, and simulate explicit alternatives.",
        situation_type: "HELP",
        current_state: "No operational request is running.",
        next_step: "Ask about a recovery or configured resource.",
        truth_boundary: "Nothing was changed.",
        suggestions: ["Why did Recovery 1 fail?"],
      },
      intent: null,
      answer:
        "I can explain recoveries, inspect configured resources, and simulate explicit alternatives.",
      facts: [],
      evidence: [],
      provenance: "CONVERSATION_ONLY",
      agents: [response.agents[0]],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(help), { status: 200 })),
    );
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <OperatorConversation
            incidentId="incident-abc"
            objectiveTitle="Ship Release V2"
            live
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Ask Reflow"), {
      target: { value: "what can u do" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ask Reflow/ }));
    expect(
      await screen.findAllByText(
        /explain recoveries, inspect configured resources/,
      ),
    ).toHaveLength(2);
    expect(
      screen.getByText("No operational request is running."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Operator intent interpreter"),
    ).not.toBeInTheDocument();
  });

  it("renders true clarification in human language and preserves the no-action boundary", async () => {
    const clarify = {
      ...response,
      disposition: "CLARIFICATION_REQUIRED",
      conversation: {
        mode: "CLARIFY",
        user_goal: "Get help with an unspecified item",
        normalized_request: null,
        requested_capability: null,
        entities: [],
        constraints: [],
        missing_information: ["Which recovery or resource do you mean?"],
        requires_operator: false,
        tone: "neutral",
        confidence: "LOW",
        direct_response: "Which recovery or resource do you mean?",
      },
      human_response: {
        human_summary: "Which recovery or resource do you mean?",
        situation_type: "NEEDS_CLARIFICATION",
        current_state: "I need one detail before I can help.",
        next_step: "Name the recovery or configured resource.",
        truth_boundary: "Nothing was changed.",
        suggestions: [],
      },
      intent: null,
      answer: "Which recovery or resource do you mean?",
      facts: [],
      evidence: [],
      provenance: "CONVERSATION_ONLY",
      agents: [response.agents[0]],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(clarify), { status: 200 })),
    );
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <OperatorConversation
            incidentId="incident-abc"
            objectiveTitle="Ship Release V2"
            live
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Ask Reflow"), {
      target: { value: "can you help with that thing" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ask Reflow/ }));
    expect(
      await screen.findAllByText("Which recovery or resource do you mean?"),
    ).toHaveLength(2);
    expect(screen.getByText("Nothing was changed.")).toBeInTheDocument();
  });

  it("renders bounded Slack proof with the existing generic UI and generated contract", async () => {
    const target = {
      authority: "SLACK",
      resource_type: "CHANNEL",
      resource_identifier: "configured-release-channel",
    };
    const operations = [
      { operation: "SLACK_POST_MESSAGE", value: "SCRUM-6 is blocked." },
    ];
    const state = {
      channel_id: "C123ABC456",
      message_ts: "1788000000.000123",
      text: "SCRUM-6 is blocked.",
    };
    const value = {
      ...response,
      answer: "The authorized action was independently read back and VERIFIED.",
      human_response: {
        human_summary:
          "Done — the Slack message was independently read back and verified.",
        situation_type: "SUCCESS",
        current_state: "The requested action is verified.",
        next_step: "Open technical details to inspect the receipt.",
        truth_boundary:
          "The action is verified; this does not by itself prove the objective recovered.",
        suggestions: ["Show verification details"],
      },
      facts: [],
      evidence: [],
      provenance: "OPERATOR_ACTION",
      external_effects_executed: true,
      intent: {
        ...response.intent,
        intent_type: "ACT",
        subject: "SLACK",
        fact_ids: [],
        target,
        requested_operations: operations,
      },
      action: {
        ...target,
        operator_action_id: "b".repeat(64),
        request_id: response.request_id,
        authenticated_subject_hash: "c".repeat(64),
        operations,
        expected_state: state,
        authorization_result: "AUTO_EXECUTABLE",
        lifecycle: "VERIFIED",
        execution_acknowledgement: {
          channel_id: state.channel_id,
          message_ts: state.message_ts,
        },
        observed_state: state,
        verification_result: "PASSED",
        adapter_proof: {},
        created_at: response.generated_at,
        updated_at: response.generated_at,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(value), { status: 200 })),
    );
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <OperatorConversation
            incidentId="incident-abc"
            objectiveTitle="Ship Release V2"
            live
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Ask Reflow"), {
      target: { value: "Tell the release channel that SCRUM-6 is blocked." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ask Reflow/ }));
    expect(await screen.findByText("VERIFIED")).toBeInTheDocument();
    expect(screen.getByText("slack post message")).toBeInTheDocument();
    expect(screen.getByText("Acknowledged")).toBeInTheDocument();
    expect(screen.getByText(/channel_id: C123ABC456/)).toBeInTheDocument();
    expect(screen.getByText("configured-release-channel")).toBeInTheDocument();
  });

  it("posts a bounded request and renders facts, provenance and exact evidence", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(response), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <OperatorConversation
            incidentId="incident-abc"
            objectiveTitle="Ship Release V2"
            live
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Ask Reflow"), {
      target: { value: "Why did Recovery 1 fail?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ask Reflow/ }));
    expect(
      await screen.findByText("Calendar action verified."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Objective verification failed."),
    ).toBeInTheDocument();
    expect(
      // The evidence row now carries its observed-at stamp inside the link, so the
      // accessible name is the title plus that stamp. The point of the assertion is
      // the exact evidence identifier in the href, which is unchanged.
      screen.getByRole("link", { name: /Recovery 01 verification/ }),
    ).toHaveAttribute(
      "href",
      "/app/evidence/incident-abc?evidence=objective-verification%3A1",
    );
    expect(
      screen.getByText(/No production action occurred/),
    ).toBeInTheDocument();
    const [url, options] = fetcher.mock.calls[0];
    if (!options) throw new Error("Missing request options");
    expect(url).toBe("/api/v1/operator/query");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("same-origin");
    const body = JSON.parse(String(options.body));
    expect(body).toMatchObject({
      incident_id: "incident-abc",
      message: "Why did Recovery 1 fail?",
    });
    expect(body.idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("never invokes the model endpoint for Guest/fixture context", () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <OperatorConversation
            incidentId="incident-abc"
            objectiveTitle="Ship Release V2"
            live={false}
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/requires Google sign-in/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ask Reflow/ })).toBeDisabled();
    fireEvent.click(screen.getByText("Why did Recovery 1 fail?"));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("contains transport failures without claiming an unknown result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 503 })),
    );
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <OperatorConversation
            incidentId="incident-abc"
            objectiveTitle="Ship Release V2"
            live
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Ask Reflow"), {
      target: { value: "Ship now" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /Ask Reflow/ }).closest("form")!,
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "could not confirm the result",
      ),
    );
  });

  it("renders approval state and replaces it with verified read-back", async () => {
    const pendingAction = {
      operator_action_id: "b".repeat(64),
      request_id: response.request_id,
      authenticated_subject_hash: "c".repeat(64),
      authority: "JIRA",
      resource_type: "ISSUE",
      resource_identifier: "API-42",
      operations: [{ operation: "JIRA_ASSIGN", value: "Srishti" }],
      expected_state: {},
      authorization_result: "APPROVAL_REQUIRED",
      lifecycle: "APPROVAL_REQUIRED",
      execution_acknowledgement: {},
      observed_state: {},
      verification_result: "NOT_RUN",
      adapter_proof: { policy_reason: "cross_person_assignment" },
      created_at: "2026-08-28T12:00:00Z",
      updated_at: "2026-08-28T12:00:00Z",
      error_category: null,
    };
    const actionResponse = {
      ...response,
      answer: "This action requires explicit confirmation before execution.",
      human_response: {
        human_summary:
          "I understand the change. It needs your confirmation first.",
        situation_type: "UNCERTAIN",
        current_state: "The action is waiting for approval.",
        next_step: "Confirm only if you want Reflow to execute it.",
        truth_boundary: "No action has been taken yet.",
        suggestions: [],
      },
      evidence: [],
      facts: [],
      intent: {
        ...response.intent,
        intent_type: "ACT",
        subject: "JIRA",
        fact_ids: [],
        target: {
          authority: "JIRA",
          resource_type: "ISSUE",
          resource_identifier: "API-42",
        },
        requested_operations: pendingAction.operations,
      },
      provenance: "OPERATOR_ACTION",
      action: pendingAction,
    };
    const verified = {
      ...pendingAction,
      lifecycle: "VERIFIED",
      expected_state: { assignee_display_name: "Srishti" },
      execution_acknowledgement: { assignee: "accepted" },
      observed_state: { assignee_display_name: "Srishti" },
      verification_result: "PASSED",
      adapter_proof: { comparison: "PASSED", difference_count: "0" },
      updated_at: "2026-08-28T12:01:00Z",
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(actionResponse), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(verified), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetcher);
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <OperatorConversation
            incidentId="incident-abc"
            objectiveTitle="Ship Release V2"
            live
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Ask Reflow"), {
      target: { value: "Assign API-42 to Srishti" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ask Reflow/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Confirm and execute/ }),
    );
    expect(await screen.findByText("VERIFIED")).toBeInTheDocument();
    expect(
      screen.getByText(/assignee_display_name: Srishti/),
    ).toBeInTheDocument();
    expect(fetcher.mock.calls[1][0]).toBe(
      `/api/v1/operator/actions/${pendingAction.operator_action_id}/approve`,
    );
  });
});

describe("the composer's auxiliary control", () => {
  const composer = () =>
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <OperatorConversation
            incidentId="incident-abc"
            objectiveTitle="Ship Release V2"
            live
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );

  it("keeps dictation only while the request is empty, and the call always", () => {
    composer();
    expect(
      screen.getByRole("button", { name: "Dictate a request" }),
    ).toBeInTheDocument();
    // The live call is a capability, not a composer control: it does not come and
    // go with the field, because a reader has to be able to find it at any moment.
    expect(
      screen.getByRole("button", { name: /Talk to Reflow/ }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Ask Reflow"), {
      target: { value: "Why did Recovery 1 fail?" },
    });

    // Mid-request the field's own slot becomes the clear control.
    expect(
      screen.queryByRole("button", { name: "Dictate a request" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear request" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Talk to Reflow/ }),
    ).toBeInTheDocument();
  });

  it("clears the request and returns the composer to its empty state", () => {
    composer();
    const field = screen.getByLabelText("Ask Reflow") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "Move the demo event" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear request" }));
    expect(field.value).toBe("");
    expect(
      screen.getByRole("button", { name: "Dictate a request" }),
    ).toBeInTheDocument();
  });
});

describe("sending during dictation", () => {
  it("keeps Ask Reflow closed for the whole take and opens it on the transcript", async () => {
    // The real component's rule, not a stand-in: an interim transcript is a guess in
    // progress, and it must not be submittable by an accidental click or Enter.
    const dictation = await import("../voice/useDictation");
    const state = {
      status: "LISTENING" as const,
      interim: "move the demo ev",
      level: 0.3,
      elapsedSeconds: 2,
      error: null,
    };
    const spy = vi.spyOn(dictation, "useDictation").mockReturnValue({
      state,
      start: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
      dismiss: vi.fn(),
    } as unknown as ReturnType<typeof dictation.useDictation>);

    const view = render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <OperatorConversation
            incidentId="incident-abc"
            objectiveTitle="Ship Release V2"
            live
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /Ask Reflow/ })).toBeDisabled();
    view.unmount();

    // The take has finished and its finalized text is in the field.
    spy.mockReturnValue({
      state: { ...state, status: "IDLE", interim: "" },
      start: vi.fn(),
      stop: vi.fn(),
      cancel: vi.fn(),
      dismiss: vi.fn(),
    } as unknown as ReturnType<typeof dictation.useDictation>);
    render(
      <MemoryRouter>
        <VoiceLaunchProvider>
          <OperatorConversation
            incidentId="incident-abc"
            objectiveTitle="Ship Release V2"
            live
          />
        </VoiceLaunchProvider>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Ask Reflow"), {
      target: { value: "Move the demo event by one hour." },
    });
    expect(screen.getByRole("button", { name: /Ask Reflow/ })).toBeEnabled();
    spy.mockRestore();
  });
});

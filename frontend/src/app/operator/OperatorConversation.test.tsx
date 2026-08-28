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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const response = {
  agents: [
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
        <OperatorConversation incidentId="incident-abc" live />
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
        <OperatorConversation incidentId="incident-abc" live />
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
        <OperatorConversation incidentId="incident-abc" live={false} />
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
        <OperatorConversation incidentId="incident-abc" live />
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
        <OperatorConversation incidentId="incident-abc" live />
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

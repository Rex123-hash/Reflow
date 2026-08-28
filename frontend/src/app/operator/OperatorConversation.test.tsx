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
    expect(JSON.parse(String(options.body))).toEqual({
      incident_id: "incident-abc",
      message: "Why did Recovery 1 fail?",
    });
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

  it("contains transport/contract failures and preserves no-action language", async () => {
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
      expect(screen.getByRole("alert")).toHaveTextContent("No action occurred"),
    );
  });
});

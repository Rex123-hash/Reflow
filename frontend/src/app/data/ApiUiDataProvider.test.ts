import { describe, expect, it, vi } from "vitest";
import overview from "./fixtures/overview.json";
import recovery from "./fixtures/recovery-restored.json";
import { ApiUiDataProvider } from "./ApiUiDataProvider";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init,
  });
}

describe("ApiUiDataProvider", () => {
  it("invokes the default browser fetch without the provider as receiver", async () => {
    let provider: ApiUiDataProvider;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = function (this: unknown) {
      expect(this).not.toBe(provider);
      return Promise.resolve(jsonResponse(overview));
    } as typeof fetch;
    try {
      provider = new ApiUiDataProvider({ mode: "live" });
      await provider.getOverview();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("parses the deployed OpenAPI contract and reports live provenance", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(overview, { headers: { ETag: 'W/"16"' } }),
    );
    const provider = new ApiUiDataProvider({
      mode: "live",
      fetcher: fetcher as unknown as typeof fetch,
    });
    const result = await provider.getOverview();
    expect(result.data.current_priority?.incident_id).toBe(
      "incident-0fc3af5b0bd1ad847aea",
    );
    expect(result.provenance).toEqual({
      kind: "api",
      live: true,
      label: "Live workspace",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/ui/overview",
      expect.objectContaining({ credentials: "same-origin", method: "GET" }),
    );
  });

  it("sends If-None-Match and reuses the validated resource on 304", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(overview, { headers: { ETag: 'W/"16"' } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const provider = new ApiUiDataProvider({
      mode: "guest",
      fetcher: fetcher as unknown as typeof fetch,
    });
    const first = await provider.getOverview();
    const second = await provider.getOverview();
    expect(second.data).toBe(first.data);
    const secondHeaders = fetcher.mock.calls[1][1]?.headers as Headers;
    expect(secondHeaders.get("If-None-Match")).toBe('W/"16"');
    expect(second.provenance.label).toBe("Demo workspace · Read only");
  });

  it("rejects malformed presentation data instead of rendering guesses", async () => {
    const provider = new ApiUiDataProvider({
      mode: "live",
      fetcher: vi.fn(async () =>
        jsonResponse({ revision: 16 }),
      ) as unknown as typeof fetch,
    });
    await expect(provider.getOverview()).rejects.toMatchObject({
      code: "backend_infrastructure_unavailable",
      status: 502,
    });
  });

  it("preserves bounded API error semantics", async () => {
    const provider = new ApiUiDataProvider({
      mode: "live",
      fetcher: vi.fn(async () =>
        jsonResponse(
          {
            detail: {
              code: "resource_not_found",
              message: "No recovery exists for this incident.",
            },
          },
          { status: 404 },
        ),
      ) as unknown as typeof fetch,
    });
    await expect(provider.getRecoveryCase("missing")).rejects.toMatchObject({
      code: "resource_not_found",
      status: 404,
    });
  });

  it("renders canonical contradiction and restoration without unsupported claims", async () => {
    const provider = new ApiUiDataProvider({
      mode: "live",
      fetcher: vi.fn(async () =>
        jsonResponse(recovery),
      ) as unknown as typeof fetch,
    });
    const result = await provider.getRecoveryCase(
      "incident-0fc3af5b0bd1ad847aea",
    );
    expect(result.data.attempts.map((attempt) => attempt.status)).toEqual([
      "FAILED",
      "COMPLETED",
    ]);
    expect(result.data.verifications[0].invariants[0]).toMatchObject({
      invariant_id: "release-validation-green",
      expected: "true",
      observed: "false",
    });
    expect(result.data.verifications[1].invariants).toHaveLength(6);
    expect(JSON.stringify(result.data)).not.toContain("required_work_assigned");
  });
});

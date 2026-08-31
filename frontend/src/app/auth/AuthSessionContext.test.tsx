import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  clearProductSession: vi.fn(),
  continueAsGuest: vi.fn(),
  continueWithGoogle: vi.fn(),
}));

vi.mock("./firebaseClient", () => auth);

const { AuthBoundary } = await import("./AuthSessionContext");

const guestSession = {
  mode: "guest",
  workspace_label: "Demo workspace · Read only",
  email: null,
  display_name: null,
  read_only: true,
};

const liveSession = {
  mode: "live",
  workspace_label: "Live workspace",
  email: "operator@example.com",
  display_name: "Operator",
  read_only: false,
};

function response(status: number, body?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

beforeEach(() => {
  auth.clearProductSession.mockReset();
  auth.continueAsGuest.mockReset().mockResolvedValue(undefined);
  auth.continueWithGoogle.mockReset().mockResolvedValue(undefined);
  window.history.replaceState({}, "", "/app/overview");
});

afterEach(() => vi.unstubAllGlobals());

describe("workspace access", () => {
  it("shows first-class Google and Demo Workspace choices after a missing session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(401)));
    render(<AuthBoundary>workspace</AuthBoundary>);

    expect(
      await screen.findByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Explore Demo Workspace" }),
    ).toBeVisible();
    expect(screen.getByText(/No Google account required/i)).toBeVisible();
    expect(auth.continueWithGoogle).not.toHaveBeenCalled();
  });

  it("preserves the existing Google path", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { ...guestSession, mode: "live" }));
    vi.stubGlobal("fetch", fetch);
    render(<AuthBoundary>workspace</AuthBoundary>);

    fireEvent.click(
      await screen.findByRole("button", { name: "Continue with Google" }),
    );
    await waitFor(() =>
      expect(auth.continueWithGoogle).toHaveBeenCalledTimes(1),
    );
    expect(auth.continueAsGuest).not.toHaveBeenCalled();
  });

  it("enters the server-recognized demo session without Google", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, guestSession));
    vi.stubGlobal("fetch", fetch);
    render(<AuthBoundary>workspace</AuthBoundary>);

    fireEvent.click(
      await screen.findByRole("button", { name: "Explore Demo Workspace" }),
    );
    expect(await screen.findByText("workspace")).toBeVisible();
    expect(auth.continueAsGuest).toHaveBeenCalledTimes(1);
    expect(auth.continueWithGoogle).not.toHaveBeenCalled();
  });

  it("uses an explicit Live Demo link as one-shot anonymous-session consent", async () => {
    window.history.replaceState({}, "", "/app?demo=1");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, guestSession));
    vi.stubGlobal("fetch", fetch);
    render(<AuthBoundary>workspace</AuthBoundary>);

    expect(await screen.findByText("workspace")).toBeVisible();
    expect(auth.continueAsGuest).toHaveBeenCalledTimes(1);
    expect(auth.continueWithGoogle).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  it("sends Open workspace from guest into the live Google path", async () => {
    window.history.replaceState({}, "", "/app/overview?access=live");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, guestSession))
      .mockResolvedValueOnce(response(200, liveSession));
    vi.stubGlobal("fetch", fetch);
    render(<AuthBoundary>workspace</AuthBoundary>);

    const google = await screen.findByRole("button", {
      name: "Continue with Google",
    });
    expect(
      screen.queryByRole("button", { name: /Demo Workspace/i }),
    ).toBeNull();
    expect(auth.clearProductSession).toHaveBeenCalledTimes(1);
    expect(auth.continueAsGuest).not.toHaveBeenCalled();
    fireEvent.click(google);
    expect(await screen.findByText("workspace")).toBeVisible();
    expect(auth.continueWithGoogle).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("");
  });

  it("resumes an existing live session when Open workspace is requested", async () => {
    window.history.replaceState({}, "", "/app/overview?access=live");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(200, liveSession)),
    );
    render(<AuthBoundary>workspace</AuthBoundary>);

    expect(await screen.findByText("workspace")).toBeVisible();
    expect(auth.clearProductSession).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  it("switches an existing live session to guest when Live Demo is requested", async () => {
    window.history.replaceState({}, "", "/app?demo=1");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, liveSession))
      .mockResolvedValueOnce(response(200, guestSession));
    vi.stubGlobal("fetch", fetch);
    render(<AuthBoundary>workspace</AuthBoundary>);

    expect(await screen.findByText("workspace")).toBeVisible();
    expect(auth.continueAsGuest).toHaveBeenCalledTimes(1);
    expect(auth.continueWithGoogle).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });
});

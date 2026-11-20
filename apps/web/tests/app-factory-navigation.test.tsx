import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";
import { type HostApiBridge, installFactoryHost } from "../src/runtime/factoryHost";
import { jsonResponse, notFoundResponse, resetAppTestHarness } from "./test-utils/appTestHarness";

const mockShellRequests = () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/terminal-snapshots") && method === "GET") {
      return jsonResponse([]);
    }
    if (url.endsWith("/api/github/summary") && method === "GET") {
      return jsonResponse({
        status: "unavailable",
        source: "none",
        fetchedAt: "2026-02-27T12:00:00.000Z",
        commitsPerDay: [],
      });
    }
    if (url.includes("/api/analytics/usage-heatmap") && method === "GET") {
      return jsonResponse({ days: [], projects: [], models: [] });
    }
    if (url.endsWith("/api/ui-state") && method === "GET") {
      return jsonResponse({});
    }
    return notFoundResponse();
  });
};

const factoryBridge = (): { bridge: HostApiBridge; handle: ReturnType<typeof vi.fn> } => {
  const handle = vi.fn(async (request: unknown) => {
    if (
      typeof request === "object" &&
      request !== null &&
      "kind" in request &&
      request.kind === "jobs.list"
    ) {
      return {
        ok: true,
        data: [
          {
            id: "demo",
            title: "Demo job",
            workflowId: "factory",
            stage: "ship",
            round: 1,
            roundLimit: 3,
            commit: null,
          },
        ],
      };
    }
    if (
      typeof request === "object" &&
      request !== null &&
      "kind" in request &&
      request.kind === "workflows.list"
    ) {
      return {
        ok: true,
        data: [
          {
            id: "factory",
            name: "Factory",
            stages: [{ id: "ship", moves: [{ to: "ready" }] }],
          },
        ],
      };
    }
    if (
      typeof request === "object" &&
      request !== null &&
      "kind" in request &&
      request.kind === "scheduler.status"
    ) {
      return { ok: true, data: { enabled: false, running: [], lastPlan: null } };
    }
    return { ok: true, data: [] };
  });
  return { bridge: { handle, subscribe: () => () => undefined }, handle };
};

describe("App factory navigation", () => {
  afterEach(() => {
    cleanup();
    installFactoryHost(null);
    resetAppTestHarness();
  });

  it("opens the factory view and runs an action through the injected host", async () => {
    mockShellRequests();
    const { bridge, handle } = factoryBridge();
    installFactoryHost(bridge);

    render(<App />);
    await screen.findByRole("navigation", { name: "Primary navigation" });

    fireEvent.click(screen.getByRole("button", { name: /Factory/i }));
    expect(await screen.findByLabelText("Factory primary view")).toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText("Commit locally for Demo job"));

    await waitFor(() => {
      expect(handle).toHaveBeenCalledWith({
        kind: "action.run",
        actionId: "job.commit_local",
        input: { id: "demo" },
      });
    });
  });

  it("supports the number-eight shortcut", async () => {
    mockShellRequests();
    const { bridge } = factoryBridge();
    installFactoryHost(bridge);

    render(<App />);
    await screen.findByRole("navigation", { name: "Primary navigation" });
    fireEvent.keyDown(window, { key: "8" });

    expect(await screen.findByLabelText("Factory primary view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Factory/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

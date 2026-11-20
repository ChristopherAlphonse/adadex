import { describe, expect, it, vi } from "vitest";

import {
  createEmptyFactoryHost,
  createFactoryHost,
  createHostApiFactoryHost,
  type HostApiBridge,
  installFactoryHost,
} from "../src/runtime/factoryHost";

const job = {
  id: "demo",
  title: "Demo",
  workflowId: "factory",
  stage: "ship",
  round: 1,
  roundLimit: 3,
  reviewers: [],
  flags: {},
  approvals: {},
  commit: null,
  worktree: "/tmp/demo",
};

const workflow = {
  id: "factory",
  name: "Factory",
  origin: "preset",
  initial: "shape",
  initialRound: 0,
  stages: [{ id: "ship", hint: "commit", moves: [{ to: "ready" }] }],
};

const dataFor = (kind: string): unknown => {
  if (kind === "jobs.list") return [job];
  if (kind === "workflows.list") return [workflow];
  if (kind === "approvals.list") {
    return [{ approvalId: "approval-1", actionId: "job.advance", reason: "needs a decision" }];
  }
  if (kind === "processes.list") {
    return [
      {
        processId: "p-1",
        label: "claude -p",
        startedAt: "2026-11-19T12:00:00.000Z",
      },
    ];
  }
  return null;
};

const createBridge = (): { bridge: HostApiBridge; handle: ReturnType<typeof vi.fn> } => {
  const handle = vi.fn(async (request: unknown) => {
    const kind =
      typeof request === "object" &&
      request !== null &&
      "kind" in request &&
      typeof request.kind === "string"
        ? request.kind
        : "";
    return { ok: true, data: dataFor(kind) };
  });
  return { bridge: { handle, subscribe: vi.fn(() => () => undefined) }, handle };
};

describe("factory host bridge", () => {
  it("sends host requests and parses the responses", async () => {
    const { bridge, handle } = createBridge();
    const host = createHostApiFactoryHost(bridge);

    expect(await host.listJobs()).toEqual([
      {
        id: "demo",
        title: "Demo",
        workflowId: "factory",
        stage: "ship",
        round: 1,
        roundLimit: 3,
        commit: null,
        worktree: "/tmp/demo",
      },
    ]);
    expect(await host.listWorkflows()).toEqual([
      { id: "factory", name: "Factory", stages: [{ id: "ship", moves: [{ to: "ready" }] }] },
    ]);
    expect(await host.listApprovals()).toEqual([
      { approvalId: "approval-1", actionId: "job.advance", reason: "needs a decision" },
    ]);
    expect(await host.listProcesses()).toEqual([
      { processId: "p-1", label: "claude -p", startedAt: "2026-11-19T12:00:00.000Z" },
    ]);

    await host.runAction("job.advance", { id: "demo", to: "ready" });
    await host.respondApproval("approval-1", true);
    await host.killProcess("p-1");

    expect(handle).toHaveBeenCalledWith({
      kind: "action.run",
      actionId: "job.advance",
      input: { id: "demo", to: "ready" },
    });
    expect(handle).toHaveBeenCalledWith({
      kind: "approval.respond",
      approvalId: "approval-1",
      approved: true,
    });
    expect(handle).toHaveBeenCalledWith({ kind: "process.kill", processId: "p-1" });
  });

  it("surfaces host errors instead of treating them as data", async () => {
    const bridge: HostApiBridge = {
      handle: async () => ({ ok: false, errors: ["not allowed", "no job"] }),
      subscribe: () => () => undefined,
    };
    const host = createHostApiFactoryHost(bridge);

    await expect(host.listJobs()).rejects.toThrow("not allowed; no job");
  });

  it("uses the injected bridge when the preload has installed one", () => {
    const { bridge } = createBridge();
    installFactoryHost(bridge);
    try {
      expect(createFactoryHost().isAvailable()).toBe(true);
    } finally {
      installFactoryHost(null);
    }
    expect(createFactoryHost().isAvailable()).toBe(false);
    expect(createEmptyFactoryHost().isAvailable()).toBe(false);
  });
});

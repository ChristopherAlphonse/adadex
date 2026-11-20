import { isObjectValue, isString } from "@adadex/core";
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
      isObjectValue(request) &&
      request !== null &&
      "kind" in request &&
      isString(request.kind)
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

  it("reads the loop status, and treats a host without a loop as null", async () => {
    const withLoop = createHostApiFactoryHost({
      handle: async () => ({ ok: true, data: { enabled: true, running: [], lastPlan: null } }),
      subscribe: () => () => undefined,
    });

    const withoutLoop = createHostApiFactoryHost({
      handle: async () => ({ ok: false, errors: ["the unattended loop is not available"] }),
      subscribe: () => () => undefined,
    });

    const handle = vi.fn(async () => ({ ok: true, data: { enabled: false } }));
    const toggled = createHostApiFactoryHost({ handle, subscribe: () => () => undefined });

    await expect(withLoop.getLoop()).resolves.toBe(true);
    await expect(withoutLoop.getLoop()).resolves.toBeNull();
    await toggled.setLoop(true);
    expect(handle).toHaveBeenCalledWith({ kind: "scheduler.set", enabled: true });
  });

  it("reads the checks command, and treats a host without project settings as null", async () => {
    const handle = vi.fn(async () => ({ ok: true, data: { checks: "npm test" } }));
    const host = createHostApiFactoryHost({ handle, subscribe: () => () => undefined });

    const without = createHostApiFactoryHost({
      handle: async () => ({ ok: false, errors: ["project settings are not available"] }),
      subscribe: () => () => undefined,
    });

    await expect(host.getChecks()).resolves.toBe("npm test");
    await expect(without.getChecks()).resolves.toBeNull();
    await host.setChecks("npm run check");
    expect(handle).toHaveBeenCalledWith({ kind: "project.set", checks: "npm run check" });
  });

  it("reads roles, logs and the audit check, and treats missing roles or logs as null", async () => {
    const handle = vi.fn(async (request: unknown) => {
      const kind = (/* SAFETY: preceding checks establish the invariant this assertion encodes. */ request as { kind: string }).kind;

      if (kind === "roles.list")
        return {
          ok: true,
          data: [{ id: "builder", name: "Builder", origin: "preset", tools: [] }],
        };

      if (kind === "logs.query")
        return {
          ok: true,
          data: [
            { id: 3, ts: "2026-11-19T12:00:00Z", level: "info", source: "app", message: "hi" },
          ],
        };

      if (kind === "audit.verify") return { ok: true, data: { ok: true, entries: 4 } };

      return { ok: true, data: null };
    });

    const host = createHostApiFactoryHost({ handle, subscribe: () => () => undefined });

    const without = createHostApiFactoryHost({
      handle: async () => ({ ok: false, errors: ["not available"] }),
      subscribe: () => () => undefined,
    });

    const roles = await host.listRoles();
    expect(roles?.[0]).toMatchObject({ id: "builder", origin: "preset" });
    expect(roles?.[0]?.definition).toMatchObject({ tools: [] });
    expect((await host.listLogs())?.[0]?.message).toBe("hi");
    expect(handle).toHaveBeenCalledWith({ kind: "logs.query", limit: 50 });
    await expect(host.verifyAudit("j1")).resolves.toEqual({ ok: true, entries: 4 });
    await host.saveRole({ id: "x" });
    expect(handle).toHaveBeenCalledWith({ kind: "roles.save", role: { id: "x" } });
    await expect(without.listRoles()).resolves.toBeNull();
    await expect(without.listLogs()).resolves.toBeNull();
  });

  it("uses Electron's request/onEvent bridge when that is what the preload exposes", async () => {
    const request = vi.fn(async () => ({ ok: true, data: [] }));
    Object.assign(window, {
      adadex: { request, onEvent: vi.fn(() => () => undefined) },
    });

    try {
      const host = createFactoryHost();
      expect(host.isAvailable()).toBe(true);
      expect(await host.listJobs()).toEqual([]);
      expect(request).toHaveBeenCalledWith({ kind: "jobs.list" });
    } finally {
      delete (/* SAFETY: preceding checks establish the invariant this assertion encodes. */ window as { adadex?: unknown }).adadex;
    }
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

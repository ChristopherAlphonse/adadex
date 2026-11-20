import { describe, expect, it, vi } from "vitest";

import { recoverPersistedSessions } from "../src/terminalRuntime/sessionRecovery";
import type { PersistedTerminal } from "../src/terminalRuntime/types";

const terminal = (overrides: Partial<PersistedTerminal> = {}): PersistedTerminal => ({
  terminalId: "agent-1",
  coordinationId: "agent-1",
  coordinationName: "agent-1",
  createdAt: "2026-11-19T12:00:00.000Z",
  workspaceMode: "shared",
  ...overrides,
});

describe("recoverPersistedSessions", () => {
  it("marks interrupted sessions stopped with restart_pending and clears dead process fields", () => {
    const running = terminal({
      lifecycleState: "running",
      processId: 4321,
      startedAt: "2026-11-19T13:00:00.000Z",
      exitCode: 0,
      exitSignal: "SIGKILL",
    });

    const terminals = new Map([["agent-1", running]]);

    const result = recoverPersistedSessions({
      terminals,
      now: "2026-11-19T13:05:00.000Z",
      isProcessAlive: () => false,
    });

    expect(result.recoveredTerminalIds).toEqual(["agent-1"]);
    expect(result.orphanedTerminalIds).toEqual([]);
    expect(running.lifecycleState).toBe("stopped");
    expect(running.lifecycleReason).toBe("restart_pending");
    expect(running.lifecycleUpdatedAt).toBe("2026-11-19T13:05:00.000Z");
    expect(running.processId).toBeUndefined();
    expect(running.startedAt).toBeUndefined();
    expect(running.endedAt).toBeUndefined();
    expect(running.exitCode).toBeUndefined();
    expect(running.exitSignal).toBeUndefined();
  });

  it("keeps the persisted prompt so the next attach resumes the same work", () => {
    const running = terminal({
      lifecycleState: "running",
      initialPrompt: "Fix the failing tests.",
      initialInputDraft: "Draft context",
      agentProvider: "kiro",
    });

    const terminals = new Map([["agent-1", running]]);

    recoverPersistedSessions({
      terminals,
      now: "2026-11-19T13:05:00.000Z",
      isProcessAlive: () => false,
    });

    expect(running.initialPrompt).toBe("Fix the failing tests.");
    expect(running.initialInputDraft).toBe("Draft context");
    expect(running.agentProvider).toBe("kiro");
  });

  it("leaves terminals that already ended untouched", () => {
    const stopped = terminal({ lifecycleState: "stopped", lifecycleReason: "operator_stop" });

    const exited = terminal({
      terminalId: "agent-2",
      coordinationId: "agent-2",
      lifecycleState: "exited",
      exitCode: 0,
    });

    const registered = terminal({
      terminalId: "agent-3",
      coordinationId: "agent-3",
      lifecycleState: "registered",
    });

    const terminals = new Map([
      ["agent-1", stopped],
      ["agent-2", exited],
      ["agent-3", registered],
    ]);

    const isProcessAlive = vi.fn(() => false);

    const result = recoverPersistedSessions({
      terminals,
      now: "2026-11-19T13:05:00.000Z",
      isProcessAlive,
    });

    expect(result.recoveredTerminalIds).toEqual([]);
    expect(stopped.lifecycleState).toBe("stopped");
    expect(stopped.lifecycleReason).toBe("operator_stop");
    expect(exited.lifecycleState).toBe("exited");
    expect(exited.exitCode).toBe(0);
    expect(registered.lifecycleState).toBe("registered");
    expect(isProcessAlive).not.toHaveBeenCalled();
  });

  it("keeps a still-running orphan stale instead of treating it as resumable", () => {
    const running = terminal({ lifecycleState: "running", processId: 4321 });
    const terminals = new Map([["agent-1", running]]);

    const result = recoverPersistedSessions({
      terminals,
      now: "2026-11-19T13:05:00.000Z",
      isProcessAlive: () => true,
    });

    expect(result.recoveredTerminalIds).toEqual([]);
    expect(result.orphanedTerminalIds).toEqual(["agent-1"]);
    expect(running.lifecycleState).toBe("stale");
    expect(running.lifecycleReason).toBe("orphaned_process");
    expect(running.processId).toBe(4321);
  });
});

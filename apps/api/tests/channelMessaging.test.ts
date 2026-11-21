import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createChannelMessaging } from "../src/terminalRuntime/channelMessaging";
import type { PersistedTerminal, TerminalSession } from "../src/terminalRuntime/types";

const terminal = (terminalId: string): PersistedTerminal => ({
  terminalId,
  coordinationId: terminalId,
  coordinationName: terminalId,
  createdAt: "2026-11-19T12:00:00.000Z",
  workspaceMode: "shared",
});

const session = (agentState: TerminalSession["agentState"]): TerminalSession =>
  /* SAFETY: preceding checks establish the invariant this assertion encodes. */ ({
    agentState,
  }) as TerminalSession;

describe("createChannelMessaging", () => {
  const temporaryDirectories: string[] = [];

  const harness = () => {
    const directory = mkdtempSync(join(tmpdir(), "adadex-channel-messaging-test-"));
    temporaryDirectories.push(directory);
    const messagesPath = join(directory, "state", "channel-messages.json");

    const terminals = new Map([
      ["agent-1", terminal("agent-1")],
      ["agent-2", terminal("agent-2")],
    ]);

    const sessions = new Map<string, TerminalSession>();
    const writeInput = vi.fn(() => true);
    const create = () => createChannelMessaging({ terminals, sessions, writeInput, messagesPath });

    return { messagesPath, terminals, sessions, writeInput, create };
  };

  afterEach(() => {
    for (const directory of temporaryDirectories) {
      rmSync(directory, { recursive: true, force: true });
    }

    temporaryDirectories.length = 0;
  });

  it("persists pending messages so a restart can still list them", () => {
    const first = harness();
    const sent = first.create().sendChannelMessage("agent-2", "agent-1", "please review");

    expect(sent).not.toBeNull();
    const restarted = harnessWithPath(first.messagesPath);
    expect(restarted.listChannelMessages("agent-2")).toEqual([sent]);
    expect(restarted.listChannelMessages("agent-1")).toEqual([]);
  });

  it("persists the delivered flag so a message is not delivered twice after restart", () => {
    const h = harness();
    h.sessions.set("agent-2", session("idle"));

    const first = h.create();
    first.sendChannelMessage("agent-2", "agent-1", "hello");
    expect(h.writeInput).toHaveBeenCalledTimes(1);

    const restarted = createChannelMessaging({
      terminals: h.terminals,
      sessions: h.sessions,
      writeInput: h.writeInput,
      messagesPath: h.messagesPath,
    });

    const listed = restarted.listChannelMessages("agent-2");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.delivered).toBe(true);
    expect(restarted.deliverChannelMessages("agent-2")).toBe(0);
    expect(h.writeInput).toHaveBeenCalledTimes(1);
  });

  it("delivers all pending messages as one prompt injection", () => {
    const h = harness();
    h.sessions.set("agent-2", session("processing"));

    const messaging = h.create();
    messaging.sendChannelMessage("agent-2", "agent-1", "first");
    messaging.sendChannelMessage("agent-2", "agent-3", "second");
    expect(h.writeInput).not.toHaveBeenCalled();

    h.sessions.set("agent-2", session("idle"));
    expect(messaging.deliverChannelMessages("agent-2")).toBe(2);
    expect(h.writeInput).toHaveBeenCalledWith(
      "agent-2",
      "[Channel message from agent-1]: first\n[Channel message from agent-3]: second\r",
    );
  });

  it("keeps message ids unique across a restart", () => {
    const h = harness();
    const firstId = h.create().sendChannelMessage("agent-2", "agent-1", "first")?.messageId;

    const secondId = harnessWithPath(h.messagesPath).sendChannelMessage(
      "agent-2",
      "agent-1",
      "second",
    )?.messageId;

    expect(firstId).toBeTruthy();
    expect(secondId).toBeTruthy();
    expect(secondId).not.toBe(firstId);
  });

  it("does not queue a message for an unknown terminal", () => {
    const h = harness();
    const messaging = h.create();

    expect(messaging.sendChannelMessage("missing", "agent-1", "hello")).toBeNull();
    expect(messaging.listChannelMessages("missing")).toEqual([]);
  });
});

const harnessWithPath = (messagesPath: string) => {
  const terminals = new Map([
    ["agent-1", terminal("agent-1")],
    ["agent-2", terminal("agent-2")],
  ]);

  return createChannelMessaging({
    terminals,
    sessions: new Map(),
    writeInput: () => true,
    messagesPath,
  });
};

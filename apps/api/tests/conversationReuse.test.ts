import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  listConversationSessions,
  storeAgentTranscriptTurns,
  transcriptFilenameForSession,
} from "../src/terminalRuntime/conversations";
import { allocateTerminalId } from "../src/terminalRuntime/terminalViews";

const dirs: string[] = [];

const makeDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "adx-reuse-"));
  dirs.push(dir);

  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const saveTurn = (dir: string) =>
  storeAgentTranscriptTurns(dir, "terminal-4", [
    { turnId: "t1", role: "user", content: "hello", startedAt: "a", endedAt: "a" },
  ]);

const event = (n: number, fields: Record<string, string>) =>
  JSON.stringify({
    eventId: `e${n}`,
    sessionId: "terminal-4",
    coordinationId: "chat-test",
    timestamp: `2026-11-22T13:0${n}:00.000Z`,
    ...fields,
  });

describe("a terminal id that was used before", () => {
  it("does not report a session as ended once a later run has started", () => {
    const dir = makeDir();

    const lines = [
      event(1, { type: "session_start" }),
      event(2, { type: "input_submit", submitId: "s1", text: "first run" }),
      event(2, { type: "output_chunk", chunkId: "c1", text: "answer one" }),
      event(3, { type: "session_end", reason: "pty_exit" }),
      event(4, { type: "session_start" }),
      event(5, { type: "input_submit", submitId: "s2", text: "second run" }),
      event(5, { type: "output_chunk", chunkId: "c2", text: "answer two" }),
    ];

    writeFileSync(join(dir, transcriptFilenameForSession("terminal-4")), `${lines.join("\n")}\n`);
    saveTurn(dir);

    const [summary] = listConversationSessions(dir);

    expect(summary?.sessionId).toBe("terminal-4");
    expect(summary?.endedAt).toBeNull();
    expect(summary?.startedAt).toBe("2026-11-22T13:04:00.000Z");
  });

  it("still reports an ended session as ended", () => {
    const dir = makeDir();

    const lines = [
      event(1, { type: "session_start" }),
      event(2, { type: "input_submit", submitId: "s1", text: "hello" }),
      event(2, { type: "output_chunk", chunkId: "c1", text: "hi there" }),
      event(3, { type: "session_end", reason: "pty_exit" }),
    ];

    writeFileSync(join(dir, transcriptFilenameForSession("terminal-4")), `${lines.join("\n")}\n`);
    saveTurn(dir);

    expect(listConversationSessions(dir)[0]?.endedAt).toBe("2026-11-22T13:03:00.000Z");
  });

  it("is skipped when a new terminal id is allocated", () => {
    const taken = new Set(["terminal-1", "terminal-2"]);

    const id = allocateTerminalId(
      new Map(),
      new Map(),
      () => false,
      (candidate) => taken.has(candidate),
    );

    expect(id).toBe("terminal-3");
  });
});

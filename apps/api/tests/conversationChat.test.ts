import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  readChatMessages,
  storeAgentTranscriptTurns,
  storeChatMessages,
} from "../src/terminalRuntime/conversations";

const dirs: string[] = [];

const makeDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "adx-chat-"));
  dirs.push(dir);

  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("readChatMessages", () => {
  it("returns null when nothing is stored", () => {
    expect(readChatMessages(makeDir(), "s1")).toBeNull();
  });

  it("prefers stored structured messages", () => {
    const dir = makeDir();
    storeChatMessages(dir, "s1", [
      { id: "m1", role: "assistant", timestamp: null, blocks: [{ kind: "text", text: "hi" }] },
    ]);
    expect(readChatMessages(dir, "s1")?.[0]?.id).toBe("m1");
  });

  it("falls back to flat turns for providers without a transcript (OpenCode, Kiro)", () => {
    const dir = makeDir();
    storeAgentTranscriptTurns(dir, "s2", [
      { turnId: "t1", role: "user", content: "yo", startedAt: "a", endedAt: "a" },
    ]);
    expect(readChatMessages(dir, "s2")).toEqual([
      { id: "t1", role: "user", timestamp: "a", blocks: [{ kind: "text", text: "yo" }] },
    ]);
  });
});

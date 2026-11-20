import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createHookProcessor } from "../src/terminalRuntime/hookProcessor";

describe("claude hook install", () => {
  it("writes grouped hooks to .claude/settings.local.json and is idempotent", () => {
    const dir = mkdtempSync(join(tmpdir(), "adadex-claude-"));
    const { installHooksInDirectory } = createHookProcessor({
      terminals: new Map(),
      sessions: new Map(),
      transcriptDirectoryPath: dir,
      getApiBaseUrl: () => "http://127.0.0.1:1",
      persistRegistry: () => {},
      deliverChannelMessages: () => 0,
      releaseSessionKeepAlive: () => false,
    });
    installHooksInDirectory(dir, "claude");
    installHooksInDirectory(dir, "claude");
    const { hooks } = JSON.parse(readFileSync(join(dir, ".claude", "settings.local.json"), "utf8"));
    expect(hooks.Stop).toHaveLength(1);
    expect(hooks.PostToolUse[0].matcher).toBe("Write|Edit|MultiEdit");
  });
});

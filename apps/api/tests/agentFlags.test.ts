import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseTerminalAgentFlags } from "../src/createApiServer/terminalParsers";
import { loadTerminalRegistry } from "../src/terminalRuntime/registry";

describe("parseTerminalAgentFlags", () => {
  it("accepts safe model and effort and ignores empty ones", () => {
    expect(parseTerminalAgentFlags({ agentModel: "claude-opus-5-5", agentEffort: "high" })).toEqual(
      {
        agentModel: "claude-opus-5-5",
        agentEffort: "high",
        error: null,
      },
    );
    expect(parseTerminalAgentFlags({ agentModel: "", agentEffort: null })).toEqual({
      agentModel: undefined,
      agentEffort: undefined,
      error: null,
    });
    expect(parseTerminalAgentFlags(null).error).toBeNull();
  });

  it("rejects a value that could run a command in the shell", () => {
    const result = parseTerminalAgentFlags({ agentModel: "x; rm -rf /" });

    expect(result.error).toMatch(/agentModel/);
    expect(result.agentModel).toBeUndefined();
    expect(parseTerminalAgentFlags({ agentEffort: "$(id)" }).error).toMatch(/agentEffort/);
  });
});

describe("registry keeps launch flags", () => {
  it("loads a safe model and drops an unsafe effort", () => {
    const dir = mkdtempSync(join(tmpdir(), "adx-reg-"));
    const path = join(dir, "coordinations.json");

    try {
      writeFileSync(
        path,
        JSON.stringify({
          version: 3,
          terminals: [
            {
              terminalId: "terminal-1",
              coordinationId: "c1",
              coordinationName: "C1",
              createdAt: "2026-11-22T00:00:00.000Z",
              workspaceMode: "shared",
              agentProvider: "claude",
              agentModel: "claude-opus-5-5",
              agentEffort: "$(id)",
            },
          ],
          uiState: {},
        }),
      );

      const terminal = loadTerminalRegistry(path).terminals.get("terminal-1");

      expect(terminal?.agentModel).toBe("claude-opus-5-5");
      expect(terminal?.agentEffort).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

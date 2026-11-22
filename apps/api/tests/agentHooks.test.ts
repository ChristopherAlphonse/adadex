import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { renderOpenCodePlugin } from "../src/terminalRuntime/agentHooks";
import { createHookProcessor } from "../src/terminalRuntime/hookProcessor";

type HookProcessorDeps = Parameters<typeof createHookProcessor>[0];

const createProcessor = (
  dir: string,
  apiBaseUrl = "http://127.0.0.1:1",
  overrides: Partial<HookProcessorDeps> = {},
) =>
  createHookProcessor({
    terminals: new Map(),
    sessions: new Map(),
    transcriptDirectoryPath: dir,
    getApiBaseUrl: () => apiBaseUrl,
    persistRegistry: () => {},
    deliverChannelMessages: () => 0,
    releaseSessionKeepAlive: () => false,
    ...overrides,
  });

const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));

describe("agent hook install", () => {
  it("writes grouped Claude Code hooks to an Adadex-owned file and leaves the project's settings alone", () => {
    const dir = mkdtempSync(join(tmpdir(), "adadex-claude-"));
    const { installHooksInDirectory } = createProcessor(dir);

    installHooksInDirectory(dir, "claude");
    installHooksInDirectory(dir, "claude");
    const { hooks } = readJson(join(dir, ".adadex", "hooks", "claude.settings.json"));

    expect(hooks.Stop).toHaveLength(1);
    expect(hooks.Notification).toHaveLength(1);
    expect(hooks.PostToolUse).toBeUndefined();
    expect(existsSync(join(dir, ".claude"))).toBe(false);
    expect(existsSync(join(dir, ".kiro"))).toBe(false);
  });

  it("removes only Adadex's entries from the project's old settings and keeps the user's own", () => {
    const dir = mkdtempSync(join(tmpdir(), "adadex-claude-"));
    mkdirSync(join(dir, ".claude"));

    const adadexStop = {
      matcher: "*",
      hooks: [{ type: "command", command: "curl -s -X POST http://x/api/hooks/stop" }],
    };

    writeFileSync(
      join(dir, ".claude", "settings.local.json"),
      JSON.stringify({
        model: "opus",
        hooks: {
          Stop: [{ matcher: "*", hooks: [{ type: "command", command: "say done" }] }, adadexStop],
          Notification: [
            {
              matcher: "*",
              hooks: [{ type: "command", command: "curl http://x/api/hooks/notification" }],
            },
          ],
        },
      }),
    );

    createProcessor(dir).installHooksInDirectory(dir, "claude");
    const settings = readJson(join(dir, ".claude", "settings.local.json"));

    expect(settings.model).toBe("opus");
    expect(settings.hooks.Stop).toHaveLength(1);
    expect(JSON.stringify(settings.hooks.Stop)).toContain("say done");
    expect(settings.hooks.Notification).toBeUndefined();
  });

  it("writes Kiro hooks without a Notification trigger and replaces stale copies", () => {
    const dir = mkdtempSync(join(tmpdir(), "adadex-kiro-"));
    const file = join(dir, ".kiro", "hooks", "adadex.json");

    createProcessor(dir, "http://127.0.0.1:1").installHooksInDirectory(dir, "kiro");
    createProcessor(dir, "http://127.0.0.1:2").installHooksInDirectory(dir, "kiro");
    const { hooks } = readJson(file);

    expect(hooks.map((hook: { trigger: string }) => hook.trigger)).toEqual([
      "SessionStart",
      "UserPromptSubmit",
      "PreToolUse",
      "Stop",
    ]);
    expect(JSON.stringify(hooks)).not.toContain("127.0.0.1:1");
  });

  it("writes an OpenCode plugin that targets the API and only acts inside Adadex sessions", () => {
    const dir = mkdtempSync(join(tmpdir(), "adadex-opencode-"));

    createProcessor(dir, "http://127.0.0.1:9999").installHooksInDirectory(dir, "opencode");
    const source = readFileSync(join(dir, ".opencode", "plugins", "adadex.ts"), "utf8");

    expect(source).toContain('const API_BASE_URL = "http://127.0.0.1:9999";');
    expect(source).toContain('if (ADADEX_SESSION_ID === "") return;');
    expect(existsSync(join(dir, ".claude"))).toBe(false);
    expect(existsSync(join(dir, ".kiro"))).toBe(false);
  });

  it("renders an OpenCode plugin that is valid TypeScript", () => {
    const { diagnostics } = ts.transpileModule(renderOpenCodePlugin("http://127.0.0.1:1"), {
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });

    expect(diagnostics ?? []).toEqual([]);
  });
});

describe("stop hook", () => {
  it("delivers queued channel messages even when the agent sends no transcript (OpenCode)", () => {
    const dir = mkdtempSync(join(tmpdir(), "adadex-stop-"));
    const delivered: string[] = [];

    const { handleHook } = createProcessor(dir, undefined, {
      // SAFETY: the stop hook only checks that the session id is registered.
      sessions: new Map([["terminal-1", {} as never]]),
      deliverChannelMessages: (terminalId) => {
        delivered.push(terminalId);

        return 1;
      },
    });

    handleHook("stop", { session_id: "ses_1", cwd: dir }, "terminal-1");

    expect(delivered).toEqual(["terminal-1"]);
  });
});

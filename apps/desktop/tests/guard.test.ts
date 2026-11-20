import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BUILD_POLICY, REVIEW_POLICY , isString} from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createClaudeCodeProvider } from "../src/agents/claudeCodeProvider";
import { type GuardDecide, guardSettings, startGuardHost } from "../src/agents/guardHost";
import { createToolGuard, resolveReal } from "../src/host/toolGuard";
import { createApprovalBroker } from "../src/ipc/approvalBroker";

const HOOK = join(import.meta.dirname, "../src/agents/guard-hook.mjs");

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "adx-guard-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const runHook = (
  socket: string,
  event: unknown,
  timeout = 5,
): Promise<{ code: number | null; stderr: string }> =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [HOOK, socket, String(timeout)], {
      stdio: ["pipe", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (c) => {
      stderr += c;
    });
    child.on("close", (code) => resolve({ code, stderr }));
    child.stdin.end(isString(event) ? event : JSON.stringify(event));
  });

describe("the hook script", () => {
  it("exits 0 when the app allows, and 2 with the reason when it does not", async () => {
    const decide: GuardDecide = async (e) =>
      (/* SAFETY: preceding checks establish the invariant this assertion encodes. */ e as { tool_name: string }).tool_name === "Read"
        ? { allow: true }
        : { allow: false, reason: "nope" };

    const host = await startGuardHost(join(dir, "g.sock"), decide);

    try {
      expect((await runHook(join(dir, "g.sock"), { tool_name: "Read", tool_input: {} })).code).toBe(
        0,
      );
      const refused = await runHook(join(dir, "g.sock"), { tool_name: "Bash", tool_input: {} });
      expect(refused.code).toBe(2);
      expect(refused.stderr).toContain("nope");
    } finally {
      await host.close();
    }
  });

  it("blocks when the app is not running, when the call is not JSON, and when the policy throws", async () => {
    expect(
      (await runHook(join(dir, "missing.sock"), { tool_name: "Read", tool_input: {} })).code,
    ).toBe(2);

    const host = await startGuardHost(join(dir, "g.sock"), async () => {
      throw new Error("boom");
    });

    try {
      expect((await runHook(join(dir, "g.sock"), "not json")).code).toBe(2);
      const r = await runHook(join(dir, "g.sock"), { tool_name: "Read", tool_input: {} });
      expect(r.code).toBe(2);
      expect(r.stderr).toContain("could not decide");
    } finally {
      await host.close();
    }
  });

  it("blocks when the app takes too long to answer", async () => {
    const host = await startGuardHost(join(dir, "g.sock"), () => new Promise(() => {}));

    try {
      const r = await runHook(join(dir, "g.sock"), { tool_name: "Read", tool_input: {} }, 0.2);
      expect(r.code).toBe(2);
      expect(r.stderr).toContain("did not answer in time");
    } finally {
      await host.close();
    }
  });
});

describe("tool guard", () => {
  const guard = (policy = BUILD_POLICY, answer = true) => {
    const asked: string[] = [];
    const log: string[] = [];

    const broker = createApprovalBroker((p) => {
      asked.push(p.actionId);
      queueMicrotask(() => broker.respond(p.approvalId, answer));
    });

    return { decide: createToolGuard(policy, broker.gate, (l) => log.push(l)), asked, log };
  };

  const bash = (command: string) => ({ tool_name: "Bash", tool_input: { command }, cwd: dir });

  it("allows what the policy allows, refuses a push, and tells the agent why", async () => {
    const { decide } = guard();
    expect(await decide(bash("npm test"))).toEqual({ allow: true });
    const r = await decide(bash("git push origin main"));
    expect(r.allow).toBe(false);
    expect(!r.allow && r.reason).toContain("is denied");
  });

  it("turns an ask into an approval card, and a person's no is a refusal", async () => {
    const yes = guard(BUILD_POLICY, true);
    expect(await yes.decide(bash("git commit -m x"))).toEqual({ allow: true });
    expect(yes.asked).toEqual(["tool:Bash"]);
    const no = guard(BUILD_POLICY, false);
    const r = await no.decide(bash("git commit -m x"));
    expect(!r.allow && r.reason).toContain("a person did not approve it");
  });

  it("refuses a write to a protected file, however the path is written", async () => {
    const { decide } = guard();

    for (const file_path of [".env", "./.github/workflows/ci.yml", "sub/../.husky/pre-commit"]) {
      expect(
        (await decide({ tool_name: "Write", tool_input: { file_path }, cwd: dir })).allow,
      ).toBe(false);
    }

    expect(
      (await decide({ tool_name: "Write", tool_input: { file_path: "src/app.ts" }, cwd: dir }))
        .allow,
    ).toBe(true);
  });

  it("sees through a symlink that points into a protected folder", async () => {
    await mkdir(join(dir, ".github"), { recursive: true });
    await symlink(join(dir, ".github"), join(dir, "innocent"));
    const { decide } = guard();
    expect(
      (await decide({ tool_name: "Write", tool_input: { file_path: "innocent/ci.yml" }, cwd: dir }))
        .allow,
    ).toBe(false);
  });

  it("denies a call it cannot read", async () => {
    expect((await guard().decide({ nonsense: true })).allow).toBe(false);
  });

  it("resolves a path that does not exist yet by its nearest real folder", async () => {
    await writeFile(join(dir, "a"), "x");
    expect(resolveReal(dir, "newdir/new.txt")).toMatch(/newdir\/new\.txt$/);
  });
});

describe("provider and the guard", () => {
  const base = {
    command: "claude",
    bridgePath: "/x/bridge.mjs",
    cwd: dir,
    tempDir: async () => join(dir, "run"),
  };

  const child = () => ({
    stdout: new (require("node:stream").PassThrough)(),
    onExit: () => {},
    kill: () => {},
  });

  it("refuses to let an agent use its own tools without a guard", async () => {
    const provider = createClaudeCodeProvider({ ...base, allowedTools: ["Bash"], spawn: child });
    await expect(provider.start({ goal: "g", contextFiles: [] })).rejects.toThrow("needs a guard");
  });

  it("installs the hook settings when a guard is given", async () => {
    let args: readonly string[] = [];

    const provider = createClaudeCodeProvider({
      ...base,
      allowedTools: ["Bash"],
      guard: { decide: async () => ({ allow: true }), hookPath: HOOK },
      spawn: (_c, a) => {
        args = a;

        return child();
      },
    });

    const session = await provider.start({ goal: "g", contextFiles: [] });
    const settingsPath = args[args.indexOf("--settings") + 1] ?? "";

    const settings = JSON.parse(
      await (await import("node:fs/promises")).readFile(settingsPath, "utf8"),
    );

    expect(settings.hooks.PreToolUse[0].matcher).toBe("*");
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toContain("guard-hook.mjs");
    expect(args[args.indexOf("--allowedTools") + 1]).toContain("Bash");
    await session.stop();
  });

  it("builds settings that run the hook with the socket and a timeout", () => {
    const s = /* SAFETY: preceding checks establish the invariant this assertion encodes. */ guardSettings("/h.mjs", "/s.sock", 30) as {
      hooks: { PreToolUse: { hooks: { command: string; timeout: number }[] }[] };
    };

    expect(s.hooks.PreToolUse[0]?.hooks[0]?.command).toContain('"/h.mjs" "/s.sock" 30');
    expect(s.hooks.PreToolUse[0]?.hooks[0]?.timeout).toBe(35);
  });
});

void REVIEW_POLICY;

import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";

import {
  asRecord,
  createActionRegistry,
  FACTORY_ACTIONS,
  isBoolean,
  isNumber,
  isString,
  type ParsedValue,
  runAgent,
} from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAsyncQueue } from "../src/agents/asyncQueue";
import { type BridgeCall, startBridgeHost } from "../src/agents/bridgeHost";
import {
  ADADEX_TOOL,
  type AgentChild,
  buildPrompt,
  createClaudeCodeProvider,
  eventsFromLine,
} from "../src/agents/claudeCodeProvider";
import { spawnAgent } from "../src/agents/spawnAgent";
import { createActionHost } from "../src/host/actionHost";

const BRIDGE = join(import.meta.dirname, "../src/agents/mcp-bridge.mjs");

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "adx-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

interface RpcTextContent {
  readonly text: string;
}

interface RpcTool {
  readonly name: string;
}

interface RpcServerInfo {
  readonly name: string;
}

interface RpcError {
  readonly code: number;
}

interface RpcResult {
  readonly isError?: boolean;
  readonly content?: readonly RpcTextContent[];
  readonly serverInfo?: RpcServerInfo;
  readonly tools?: readonly RpcTool[];
}

interface RpcReply {
  readonly id: number;
  readonly result?: RpcResult;
  readonly error?: RpcError;
}

/** Validates one JSON-RPC reply line from the bridge before a test reads any field. */
const isRpcReply = <T>(value: T): value is T & RpcReply => {
  const reply = asRecord(value);

  if (reply === null || !isNumber(reply.id)) return false;

  const result = asRecord(reply.result);

  if (reply.result !== undefined && result === null) return false;

  if (result !== null) {
    if (result.isError !== undefined && !isBoolean(result.isError)) return false;

    if (result.content !== undefined) {
      if (!Array.isArray(result.content)) return false;

      if (!result.content.every((item) => isString(asRecord(item)?.text))) return false;
    }

    if (result.serverInfo !== undefined && !isString(asRecord(result.serverInfo)?.name))
      return false;

    if (result.tools !== undefined) {
      if (!Array.isArray(result.tools)) return false;

      if (!result.tools.every((item) => isString(asRecord(item)?.name))) return false;
    }
  }

  if (reply.error !== undefined && !isNumber(asRecord(reply.error)?.code)) return false;

  return true;
};

/** Speaks MCP to a bridge process the way Claude Code would. */
const mcpClient = (child: ChildProcess) => {
  const waiting = new Map<number, (reply: RpcReply) => void>();

  // SAFETY: the bridge is spawned with piped stdio, so stdout is a readable stream.
  createInterface({ input: child.stdout as NodeJS.ReadableStream }).on("line", (line) => {
    // SAFETY: the bridge writes exactly one JSON-RPC reply per line.
    const raw = JSON.parse(line) as ParsedValue;

    if (isRpcReply(raw)) waiting.get(raw.id)?.(raw);
  });

  let id = 0;

  return (method: string, params: ParsedValue = {}): Promise<RpcReply> =>
    new Promise((resolve) => {
      const n = ++id;
      waiting.set(n, resolve);
      child.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", id: n, method, params })}\n`);
    });
};

describe("async queue", () => {
  it("delivers items in order whether pushed before or after the reader waits, and ends on close", async () => {
    const q = createAsyncQueue<number>();
    q.push(1);
    const it = q[Symbol.asyncIterator]();
    expect((await it.next()).value).toBe(1);
    const pending = it.next();
    q.push(2);
    expect((await pending).value).toBe(2);
    const last = it.next();
    q.close();
    expect((await last).done).toBe(true);
  });
});

describe("reading Claude Code output", () => {
  it("turns assistant text into messages and the result into done, and ignores everything else", () => {
    const assistant = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "hello" }, { type: "tool_use" }] },
    });

    expect(eventsFromLine(assistant)).toEqual([{ type: "message", text: "hello" }]);
    expect(eventsFromLine(JSON.stringify({ type: "result", result: "all done" }))).toEqual([
      { type: "done", summary: "all done" },
    ]);
    expect(eventsFromLine('{"type":"system"}')).toEqual([]);
    expect(eventsFromLine("not json")).toEqual([]);
  });

  it("puts the goal and the context files in the prompt", () => {
    expect(buildPrompt({ goal: "ship it", contextFiles: ["CONTEXT.md", "spec.md"] })).toBe(
      "ship it\nRead these files first for context:\n- CONTEXT.md\n- spec.md",
    );
    expect(buildPrompt({ goal: "ship it", contextFiles: [] })).toBe("ship it");
  });
});

describe("mcp bridge", () => {
  it("answers the MCP handshake, lists one tool, and forwards a call to the app and back", async () => {
    const calls: BridgeCall[] = [];
    const host = await startBridgeHost(join(dir, "b.sock"), (c) => calls.push(c));

    const bridge = spawn(process.execPath, [BRIDGE, join(dir, "b.sock")], {
      stdio: ["pipe", "pipe", "ignore"],
    });

    const rpc = mcpClient(bridge);

    try {
      const init = await rpc("initialize", { protocolVersion: "2025-06-18" });

      expect(init.result?.serverInfo?.name).toBe("adadex");

      const list = await rpc("tools/list");

      expect(list.result?.tools?.map((t) => t.name)).toEqual(["adadex_action"]);

      const answer = rpc("tools/call", {
        name: "adadex_action",
        arguments: { actionId: "job.advance", input: { id: "j1", to: "spec" } },
      });

      while (calls.length === 0) await new Promise((r) => setTimeout(r, 5));

      const forwarded = calls[0];

      expect(forwarded).toMatchObject({ actionId: "job.advance", input: { id: "j1", to: "spec" } });

      if (forwarded === undefined) throw new Error("the bridge never forwarded the call");

      host.reply(forwarded.callId, '{"status":"ok"}', false);

      const res = await answer;

      expect(res.result?.content?.[0]?.text).toBe('{"status":"ok"}');
      expect(res.result?.isError).toBe(false);
    } finally {
      bridge.kill();
      await host.close();
    }
  });

  it("refuses a call without an actionId and an unknown method", async () => {
    const host = await startBridgeHost(join(dir, "b.sock"), () => {});

    const bridge = spawn(process.execPath, [BRIDGE, join(dir, "b.sock")], {
      stdio: ["pipe", "pipe", "ignore"],
    });

    const rpc = mcpClient(bridge);

    try {
      const bad = await rpc("tools/call", { name: "adadex_action", arguments: {} });

      expect(bad.result?.isError).toBe(true);

      const unknown = await rpc("nope");

      expect(unknown.error?.code).toBe(-32601);
    } finally {
      bridge.kill();
      await host.close();
    }
  });
});

const fakeChild = () => {
  const stdout = new PassThrough();
  let exit: (code: number | null) => void = () => {};

  let killed = false;

  const child: AgentChild = {
    stdout,
    onExit: (cb) => (exit = cb),
    kill: () => {
      killed = true;
      exit(null);
    },
  };

  return { child, stdout, finish: (code = 0) => exit(code), wasKilled: () => killed };
};

describe("claude code provider", () => {
  const options = (over: Partial<Parameters<typeof createClaudeCodeProvider>[0]> = {}) => ({
    command: "claude",
    bridgePath: BRIDGE,
    cwd: dir,
    tempDir: async () => join(dir, "run"),
    ...over,
  });

  it("starts claude headless with only the adadex tool, strict MCP config, and the caller's extras", async () => {
    const f = fakeChild();
    let seen: { command: string; args: readonly string[] } | undefined;

    const provider = createClaudeCodeProvider({
      ...options({ extraArgs: ["--settings", "guard.json"] }),
      spawn: (command, args) => {
        seen = { command, args };

        return f.child;
      },
    });

    const session = await provider.start({ goal: "do it", contextFiles: [] });
    const args = seen?.args ?? [];
    expect(seen?.command).toBe("claude");
    expect(args).toContain("--strict-mcp-config");
    expect(args[args.indexOf("--allowedTools") + 1]).toBe(ADADEX_TOOL);
    expect(args.slice(-2)).toEqual(["--settings", "guard.json"]);

    const cfg = JSON.parse(
      // SAFETY: the provider always writes a path immediately after --mcp-config.
      await readFile(args[args.indexOf("--mcp-config") + 1] as string, "utf8"),
    );

    expect(cfg.mcpServers.adadex.args[0]).toBe(BRIDGE);
    await session.stop();
  });

  it("reports done when claude exits without a result", async () => {
    const f = fakeChild();
    const provider = createClaudeCodeProvider({ ...options(), spawn: () => f.child });
    const session = await provider.start({ goal: "g", contextFiles: [] });
    const it = session.events()[Symbol.asyncIterator]();
    f.finish(1);
    expect((await it.next()).value).toEqual({ type: "done", summary: "" });
    await session.stop();
  });

  it("stop kills the child and removes the run folder", async () => {
    const f = fakeChild();
    const provider = createClaudeCodeProvider({ ...options(), spawn: () => f.child });
    const session = await provider.start({ goal: "g", contextFiles: [] });
    await session.stop();
    expect(f.wasKilled()).toBe(true);
    await expect(readFile(join(dir, "run", "mcp.json"))).rejects.toThrow("ENOENT");
  });
});

describe("the whole chain: agent, bridge, host, registry", () => {
  const chain = async (confirmed: string[], ran: string[]) => {
    const registry = createActionRegistry(FACTORY_ACTIONS);
    const events: string[] = [];

    const host = createActionHost({
      registry,
      executor: {
        execute: async (id) => {
          ran.push(id);

          return { ran: id };
        },
      },
      confirm: async (title) => {
        confirmed.push(title);

        return true;
      },
      askApproval: { request: async () => true },
      emit: (e) => events.push(e.type),
    });

    let client: ((m: string, p?: ParsedValue) => Promise<RpcReply>) | undefined;
    let bridge: ChildProcess | undefined;
    const f = fakeChild();

    const provider = createClaudeCodeProvider({
      command: "claude",
      bridgePath: BRIDGE,
      cwd: dir,
      tempDir: async () => join(dir, "chain"),
      spawn: (_c, args) => {
        // SAFETY: the provider always passes a path after --mcp-config.
        const cfgPath = args[args.indexOf("--mcp-config") + 1] as string;
        void readFile(cfgPath, "utf8").then((text) => {
          // SAFETY: the provider writes the bridge config with this command and args shape.
          const server = JSON.parse(text).mcpServers.adadex as { command: string; args: string[] };
          bridge = spawn(server.command, server.args, { stdio: ["pipe", "pipe", "ignore"] });
          client = mcpClient(bridge);
        });

        return f.child;
      },
    });

    return {
      host,
      registry,
      events,
      provider,
      getClient: () => client,
      kill: () => bridge?.kill(),
      finish: f.finish,
      stdout: f.stdout,
    };
  };

  const ready = async (
    get: () => ((m: string, p?: ParsedValue) => Promise<RpcReply>) | undefined,
  ) => {
    for (;;) {
      const found = get();

      if (found !== undefined) return found;
      await new Promise((r) => setTimeout(r, 5));
    }
  };

  it("runs a free action for the agent but never a human-only one, and never shows a dialog", async () => {
    const confirmed: string[] = [];
    const ran: string[] = [];
    const c = await chain(confirmed, ran);

    const run = runAgent(
      { provider: c.provider, registry: c.registry, ...c.host.agentPorts() },
      { goal: "g", contextFiles: [] },
    );

    const rpc = await ready(c.getClient);
    await rpc("initialize", {});

    const advance = await rpc("tools/call", {
      name: "adadex_action",
      arguments: { actionId: "job.advance", input: { id: "j1", to: "spec" } },
    });

    expect(advance.result?.isError).toBe(false);
    expect(JSON.parse(advance.result?.content?.[0]?.text ?? "{}").status).toBe("ok");

    const commit = await rpc("tools/call", {
      name: "adadex_action",
      arguments: { actionId: "job.commit_local", input: { id: "j1" } },
    });

    expect(commit.result?.isError).toBe(true);
    expect(JSON.parse(commit.result?.content?.[0]?.text ?? "{}").status).toBe("needs-human-click");

    const push = await rpc("tools/call", {
      name: "adadex_action",
      arguments: { actionId: "git.push", input: {} },
    });

    expect(push.result?.isError).toBe(true);

    c.stdout.write(`${JSON.stringify({ type: "result", result: "finished" })}\n`);
    const result = await run;
    c.kill();
    expect(result.summary).toBe("finished");
    expect(ran).toEqual(["job.advance"]);
    expect(confirmed).toEqual([]);
    expect(c.events).toContain("needs-click");
    expect(result.calls.map((x) => x.outcome.status)).toEqual([
      "ok",
      "needs-human-click",
      "denied",
    ]);
  });
});

describe("spawnAgent", () => {
  it("kills the agent's whole process group, including what it started", async () => {
    const child = spawnAgent("sh", ["-c", "sleep 30 & echo $!; wait"], dir);

    const first = await new Promise<string>((resolve) =>
      createInterface({ input: child.stdout }).once("line", resolve),
    );

    const grandchild = Number(first);
    expect(() => process.kill(grandchild, 0)).not.toThrow();
    child.kill();

    for (let i = 0; i < 100; i++) {
      try {
        process.kill(grandchild, 0);
      } catch {
        return;
      }

      await new Promise((r) => setTimeout(r, 20));
    }

    throw new Error("the grandchild survived");
  });
});

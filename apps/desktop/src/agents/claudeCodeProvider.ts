import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type {
  ActionOutcome,
  AgentEvent,
  AgentProvider,
  AgentRunRequest,
  AgentSession,
} from "@adadex/core";
import { createAsyncQueue } from "./asyncQueue";
import { type BridgeHost, startBridgeHost } from "./bridgeHost";

/** The few things the provider needs from a child process, so tests can fake it. */
export interface AgentChild {
  readonly stdout: NodeJS.ReadableStream;
  onExit(cb: (code: number | null) => void): void;
  kill(): void;
}
export type SpawnAgent = (command: string, args: readonly string[], cwd: string) => AgentChild;

export interface ClaudeCodeOptions {
  readonly spawn: SpawnAgent;
  /** Path to the `claude` executable. */
  readonly command: string;
  /** Absolute path to `mcp-bridge.mjs`. */
  readonly bridgePath: string;
  readonly cwd: string;
  /** Extra Claude Code flags the caller wants, such as `--settings <file>` to install the guard hooks. */
  readonly extraArgs?: readonly string[];
  /** Tools the agent may use besides the adadex tool. Empty by default: the agent can only call actions. */
  readonly allowedTools?: readonly string[];
  readonly tempDir?: () => Promise<string>;
}

export const ADADEX_TOOL = "mcp__adadex__adadex_action";

const INSTRUCTIONS =
  "You work through the adadex app. To move a job or run a gate, call the adadex_action tool. " +
  "Some actions need a person to click. When the result says needs-human-click, say so and stop.";

export const buildPrompt = (request: AgentRunRequest): string =>
  [
    request.goal,
    request.contextFiles.length > 0
      ? `\nRead these files first for context:\n${request.contextFiles.map((f) => `- ${f}`).join("\n")}`
      : "",
  ].join("");

const outcomeText = (outcome: ActionOutcome): { text: string; isError: boolean } => ({
  text: JSON.stringify(outcome),
  isError: outcome.status !== "ok",
});

/** Reads Claude Code's stream-json lines and turns them into agent events. */
export const eventsFromLine = (line: string): AgentEvent[] => {
  let msg: {
    type?: string;
    message?: { content?: { type?: string; text?: string }[] };
    result?: string;
  };
  try {
    msg = JSON.parse(line);
  } catch {
    return [];
  }
  if (msg.type === "assistant") {
    return (msg.message?.content ?? [])
      .filter((c) => c.type === "text" && typeof c.text === "string" && c.text !== "")
      .map((c): AgentEvent => ({ type: "message", text: c.text as string }));
  }
  if (msg.type === "result")
    return [{ type: "done", summary: typeof msg.result === "string" ? msg.result : "" }];
  return [];
};

/**
 * Runs Claude Code headless. Its own tools are off unless the caller allows them, and every workflow
 * action goes through one MCP tool back to the app, so the registry and policy decide.
 */
export const createClaudeCodeProvider = (options: ClaudeCodeOptions): AgentProvider => ({
  id: "claude-code",
  async start(request): Promise<AgentSession> {
    const dir = await (options.tempDir ?? (() => mkdtemp(join(tmpdir(), "adadex-agent-"))))();
    await mkdir(dir, { recursive: true });
    const socketPath = join(dir, "bridge.sock");
    const configPath = join(dir, "mcp.json");
    const queue = createAsyncQueue<AgentEvent>();

    const host: BridgeHost = await startBridgeHost(socketPath, (call) =>
      queue.push({
        type: "action",
        callId: call.callId,
        actionId: call.actionId,
        input: call.input,
      }),
    );
    await writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          adadex: { command: process.execPath, args: [options.bridgePath, socketPath] },
        },
      }),
    );

    const args = [
      "-p",
      buildPrompt(request),
      "--output-format",
      "stream-json",
      "--verbose",
      "--mcp-config",
      configPath,
      "--strict-mcp-config",
      "--allowedTools",
      [ADADEX_TOOL, ...(options.allowedTools ?? [])].join(","),
      "--append-system-prompt",
      INSTRUCTIONS,
      ...(options.extraArgs ?? []),
    ];
    const child = options.spawn(options.command, args, options.cwd);

    let sawDone = false;
    createInterface({ input: child.stdout }).on("line", (line) => {
      for (const event of eventsFromLine(line)) {
        if (event.type === "done") sawDone = true;
        queue.push(event);
      }
    });
    child.onExit(() => {
      if (!sawDone) queue.push({ type: "done", summary: "" });
      queue.close();
    });

    let stopped = false;
    return {
      events: () => queue,
      async respond(callId, outcome) {
        const { text, isError } = outcomeText(outcome);
        host.reply(callId, text, isError);
      },
      async stop() {
        if (stopped) return;
        stopped = true;
        child.kill();
        queue.close();
        await host.close();
        await rm(dir, { recursive: true, force: true });
      },
    };
  },
});

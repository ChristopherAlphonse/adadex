import { execFile } from "node:child_process";

import type { AgentEvent, AgentProvider, AgentSession } from "@adadex/core";
import { asNumber, asRecord, asString } from "@adadex/core";

import { createAsyncQueue } from "./asyncQueue";
import { buildPrompt } from "./claudeCodeProvider";

/** Runs the `ghostex` CLI. Injected so tests can fake it. `stdout` and `stderr` are both returned. */
export type RunGhostex = (
  args: readonly string[],
) => Promise<{ stdout: string; stderr: string; code: number }>;

export interface GhostexOptions {
  readonly run: RunGhostex;
  /** A Ghostex agent id, such as "claude" or "opencode" (see `ghostex agents types`). Kiro must be enabled in Ghostex first. */
  readonly agentId: string;
  /** Folder the agent works in. It is opened in Ghostex as a project if it is not one already. */
  readonly cwd: string;
  readonly model?: string;
  readonly effort?: string;
  /** Start an agent that is turned off in Ghostex's Settings > Agents (Kiro is off by default). */
  readonly allowHidden?: boolean;
  /**
   * A regex the agent's terminal shows once it is ready for input. The prompt is sent only after it appears, so
   * text typed during startup is not lost. Defaults to Kiro's input box for "kiro"; other agents need none.
   */
  readonly readyText?: string;
  /** How long to wait for the reply. Ghostex's own default is 600 seconds. */
  readonly replyTimeoutSeconds?: number;
  /**
   * Press Enter on the agent's "Trust this folder?" prompt. Off by default: trusting a folder is the caller's
   * decision. When off, a folder the agent does not trust yet makes `start` fail with Ghostex's message.
   */
  readonly acceptFolderTrust?: boolean;
  /** Pause between starting the reply wait and sending the prompt, so the wait anchors before the reply. */
  readonly settleMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export const runGhostexCli: RunGhostex = (args) =>
  new Promise((resolve) => {
    execFile("ghostex", [...args], { maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ stdout, stderr, code: error ? (asNumber(error.code) ?? 1) : 0 });
    });
  });

const parseJson = (stdout: string) => {
  try {
    return asRecord(JSON.parse(stdout));
  } catch {
    return null;
  }
};

const optionalFlag = (flag: string, value: string | undefined): string[] =>
  value ? [flag, value] : [];

const failure = (what: string, result: { stdout: string; stderr: string }) =>
  new Error(`ghostex ${what}: ${(result.stderr || result.stdout).trim()}`);

const findProjectId = async (run: RunGhostex, cwd: string): Promise<string | null> => {
  const listed = parseJson((await run(["projects", "--json"])).stdout);
  const projects = Array.isArray(listed?.projects) ? listed.projects : [];

  for (const project of projects) {
    const record = asRecord(project);

    if (record && asString(record.path) === cwd) {
      return asString(record.projectId);
    }
  }

  return null;
};

const ensureProject = async (
  run: RunGhostex,
  cwd: string,
  sleep: (ms: number) => Promise<void>,
): Promise<string> => {
  const existing = await findProjectId(run, cwd);

  if (existing) {
    return existing;
  }

  const opened = await run(["open", cwd]);

  if (opened.code !== 0) {
    throw failure(`could not open ${cwd}`, opened);
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await sleep(500);
    const id = await findProjectId(run, cwd);

    if (id) {
      return id;
    }
  }

  throw new Error(`ghostex did not register ${cwd} as a project`);
};

const KIRO_READY_TEXT = "ask a question or describe a task";

const READY_TIMEOUT_SECONDS = 90;

const KIRO_TURN_DONE = "Credits: turn";

/**
 * Ghostex cannot read Kiro v3 conversations (its chat reader sees no rows), so the reply is taken from the
 * terminal: the lines between the echoed prompt and Kiro's "Credits" footer, without the leading bullet.
 */
const lastIndexWhere = (
  lines: string[],
  test: (line: string, index: number) => boolean,
): number => {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (test(lines[index] ?? "", index)) {
      return index;
    }
  }

  return -1;
};

export const extractKiroReply = (screen: string, prompt: string): string => {
  const lines = screen.split("\n");
  const footer = lastIndexWhere(lines, (line) => line.includes(KIRO_TURN_DONE));
  const firstPromptLine = prompt.split("\n")[0]?.trim() ?? "";

  const echo = lastIndexWhere(
    lines,
    (line, index) => index < footer && firstPromptLine !== "" && line.trim() === firstPromptLine,
  );

  if (footer < 0 || echo < 0) {
    return "";
  }

  return lines
    .slice(echo + 1, footer)
    .map((line) => line.replace(/^\s*•\s?/, "").trimEnd())
    .join("\n")
    .trim();
};

const waitForKiroReply = async (
  run: RunGhostex,
  ref: string,
  prompt: string,
  timeoutSeconds: number,
): Promise<string> => {
  const done = await run([
    "wait-for-text",
    ref,
    KIRO_TURN_DONE,
    "--timeout-seconds",
    String(timeoutSeconds),
  ]);

  if (done.code !== 0) {
    return "";
  }

  return extractKiroReply((await run(["read-text", ref])).stdout, prompt);
};

const TRUST_PROMPT = /trust this folder/i;

const NOT_RUNNING_YET = /not running/i;

const START_RETRIES = 30;

/** Sends the prompt, retrying while the agent is still starting up. */
const sendWhenReady = async (
  run: RunGhostex,
  ref: string,
  prompt: string,
  sleep: (ms: number) => Promise<void>,
) => {
  let sent = await run(["send-session-chat-message", ref, prompt]);

  for (let attempt = 0; attempt < START_RETRIES; attempt += 1) {
    if (sent.code === 0 || !NOT_RUNNING_YET.test(sent.stdout + sent.stderr)) {
      break;
    }

    await sleep(1000);
    sent = await run(["send-session-chat-message", ref, prompt]);
  }

  return sent;
};

/**
 * Runs one turn on any agent Ghostex supports. Ghostex owns the terminal, the chat and the sandbox; this
 * opens the folder, starts the agent, sends the prompt, waits for the reply and closes the session.
 * It uses the verbs that work from outside a Ghostex session (`create-agent`, `send-session-chat-message`,
 * `agents wait-reply`, `kill`). Workflow actions are not available through this provider: the agent has no
 * adadex MCP tool, so `respond` does nothing and no `action` event is sent.
 */
export const createGhostexProvider = (options: GhostexOptions): AgentProvider => ({
  id: `ghostex:${options.agentId}`,
  async start(request): Promise<AgentSession> {
    const { run } = options;
    const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    const projectId = await ensureProject(run, options.cwd, sleep);

    const created = await run([
      "create-agent",
      options.agentId,
      "--project-id",
      projectId,
      ...optionalFlag("--model", options.model),
      ...optionalFlag("--effort", options.effort),
      ...(options.allowHidden ? ["--allow-hidden"] : []),
    ]);

    const ref = asString(asRecord(parseJson(created.stdout)?.session)?.globalRef);

    if (created.code !== 0 || !ref) {
      throw failure(`could not start ${options.agentId}`, created);
    }

    const queue = createAsyncQueue<AgentEvent>();
    let stopped = false;

    const prompt = buildPrompt(request);
    const isKiro = options.agentId === "kiro";

    const waiting = isKiro
      ? null
      : run([
          "agents",
          "wait-reply",
          ref,
          "--json",
          ...(options.replyTimeoutSeconds
            ? ["--timeout", String(options.replyTimeoutSeconds)]
            : []),
        ]);

    await sleep(options.settleMs ?? 1500);

    const readyText = options.readyText ?? (isKiro ? KIRO_READY_TEXT : undefined);

    if (readyText) {
      const ready = await run([
        "wait-for-text",
        ref,
        readyText,
        "--timeout-seconds",
        String(READY_TIMEOUT_SECONDS),
      ]);

      if (ready.code !== 0) {
        await run(["kill", ref]);
        throw failure(`${options.agentId} never became ready for input`, ready);
      }
    }

    let sent = await sendWhenReady(run, ref, prompt, sleep);

    if (options.acceptFolderTrust && TRUST_PROMPT.test(sent.stdout + sent.stderr)) {
      await run(["send-key", ref, "enter"]);
      await sleep(options.settleMs ?? 1500);
      sent = await sendWhenReady(run, ref, prompt, sleep);
    }

    if (sent.code !== 0) {
      await run(["kill", ref]);
      throw failure("could not send the prompt", sent);
    }

    const replyPromise = waiting
      ? waiting.then((waited) => asString(parseJson(waited.stdout)?.reply) ?? "")
      : waitForKiroReply(run, ref, prompt, options.replyTimeoutSeconds ?? 600);

    void replyPromise.then((reply) => {
      if (reply && !stopped) {
        queue.push({ type: "message", text: reply });
      }

      queue.push({ type: "done", summary: reply });
      queue.close();
    });

    return {
      events: () => queue,
      async respond() {},
      async stop() {
        if (stopped) {
          return;
        }

        stopped = true;
        await run(["kill", ref]);
      },
    };
  },
});

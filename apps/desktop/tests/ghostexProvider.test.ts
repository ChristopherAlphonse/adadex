import { describe, expect, it } from "vitest";

import {
  type RunGhostex,
  createGhostexProvider,
  extractKiroReply,
} from "../src/agents/ghostexProvider";

const collect = async (session: { events(): AsyncIterable<unknown> }) => {
  const out: unknown[] = [];

  for await (const event of session.events()) {
    out.push(event);
  }

  return out;
};

const ok = (stdout: string) => ({ stdout, stderr: "", code: 0 });

type Script = {
  projects?: string[];
  send?: { stdout: string; stderr: string; code: number }[];
  create?: string;
};

const fake = (calls: string[][], script: Script = {}): RunGhostex => {
  const projects = [...(script.projects ?? ['{"projects":[{"projectId":"P1","path":"/work"}]}'])];
  const sends = [...(script.send ?? [ok('{"ok":true}')])];

  return async (args) => {
    calls.push([...args]);
    const [verb, sub] = args;

    if (verb === "projects") {
      return ok(projects.length > 1 ? (projects.shift() ?? "{}") : (projects[0] ?? "{}"));
    }

    if (verb === "create-agent") {
      return ok(script.create ?? '{"ok":true,"session":{"globalRef":"G1"}}');
    }

    if (verb === "agents" && sub === "wait-reply") {
      return ok('{"ok":true,"reply":"all done"}');
    }

    if (verb === "send-session-chat-message") {
      return sends.shift() ?? ok('{"ok":true}');
    }

    return ok("{}");
  };
};

const base = { cwd: "/work", sleep: async () => {}, settleMs: 0 };

describe("ghostex provider", () => {
  it("starts the agent, sends the prompt, waits for the reply, reports message then done", async () => {
    const calls: string[][] = [];

    const provider = createGhostexProvider({
      ...base,
      run: fake(calls),
      agentId: "opencode",
      model: "m1",
    });

    const session = await provider.start({ goal: "do it", contextFiles: ["CONTEXT.md"] });

    expect(await collect(session)).toEqual([
      { type: "message", text: "all done" },
      { type: "done", summary: "all done" },
    ]);
    expect(provider.id).toBe("ghostex:opencode");
    expect(calls.find((c) => c[0] === "create-agent")).toEqual([
      "create-agent",
      "opencode",
      "--project-id",
      "P1",
      "--model",
      "m1",
    ]);
    expect(calls.find((c) => c[0] === "send-session-chat-message")?.join(" ")).toContain("do it");
    expect(calls.some((c) => c[1] === "wait-reply" && c[2] === "G1")).toBe(true);
  });

  it("opens the folder as a project when it is not one yet", async () => {
    const calls: string[][] = [];

    const run = fake(calls, {
      projects: ['{"projects":[]}', '{"projects":[{"projectId":"P9","path":"/work"}]}'],
    });

    await createGhostexProvider({ ...base, run, agentId: "claude" }).start({
      goal: "g",
      contextFiles: [],
    });

    expect(calls.some((c) => c[0] === "open" && c[1] === "/work")).toBe(true);
    expect(calls.find((c) => c[0] === "create-agent")).toContain("P9");
  });

  it("fails with ghostex's message when the agent cannot be created", async () => {
    const run = fake([], { create: '{"ok":false}' });

    await expect(
      createGhostexProvider({ ...base, run, agentId: "claude" }).start({
        goal: "x",
        contextFiles: [],
      }),
    ).rejects.toThrow(/could not start claude/);
  });

  it("does not trust the folder unless asked", async () => {
    const calls: string[][] = [];

    const trust = {
      stdout: "Trust this folder?. Answer it in chat before sending.",
      stderr: "",
      code: 1,
    };

    const run = fake(calls, { send: [trust] });

    await expect(
      createGhostexProvider({ ...base, run, agentId: "claude" }).start({
        goal: "x",
        contextFiles: [],
      }),
    ).rejects.toThrow(/Trust this folder/);
    expect(calls.some((c) => c[0] === "send-key")).toBe(false);
    expect(calls.some((c) => c[0] === "kill")).toBe(true);
  });

  it("presses Enter on the trust prompt and retries when acceptFolderTrust is set", async () => {
    const calls: string[][] = [];

    const trust = {
      stdout: "Trust this folder?. Answer it in chat before sending.",
      stderr: "",
      code: 1,
    };

    const run = fake(calls, { send: [trust, ok('{"ok":true}')] });

    const session = await createGhostexProvider({
      ...base,
      run,
      agentId: "claude",
      acceptFolderTrust: true,
    }).start({
      goal: "x",
      contextFiles: [],
    });

    expect(calls.filter((c) => c[0] === "send-session-chat-message")).toHaveLength(2);
    expect(calls.some((c) => c[0] === "send-key" && c[2] === "enter")).toBe(true);
    await collect(session);
  });

  it("retries the send while the agent is still starting", async () => {
    const calls: string[][] = [];
    const starting = { stdout: "", stderr: "The agent in this session is not running", code: 1 };
    const run = fake(calls, { send: [starting, starting, ok('{"ok":true}')] });

    const session = await createGhostexProvider({ ...base, run, agentId: "claude" }).start({
      goal: "x",
      contextFiles: [],
    });

    expect(calls.filter((c) => c[0] === "send-session-chat-message")).toHaveLength(3);
    await collect(session);
  });

  it("passes --allow-hidden for agents turned off in Ghostex, such as kiro", async () => {
    const calls: string[][] = [];

    await createGhostexProvider({
      ...base,
      run: fake(calls),
      agentId: "kiro",
      allowHidden: true,
    }).start({
      goal: "g",
      contextFiles: [],
    });

    expect(calls.find((c) => c[0] === "create-agent")).toContain("--allow-hidden");
  });

  it("waits for kiro's input box before sending the prompt", async () => {
    const calls: string[][] = [];

    await createGhostexProvider({ ...base, run: fake(calls), agentId: "kiro" }).start({
      goal: "g",
      contextFiles: [],
    });

    const verbs = calls.map((c) => c[0]);

    expect(verbs.indexOf("wait-for-text")).toBeGreaterThan(-1);
    expect(verbs.indexOf("wait-for-text")).toBeLessThan(verbs.indexOf("send-session-chat-message"));
  });

  it("kills the session on stop, once", async () => {
    const calls: string[][] = [];

    const session = await createGhostexProvider({
      ...base,
      run: fake(calls),
      agentId: "claude",
    }).start({
      goal: "g",
      contextFiles: [],
    });

    await session.stop();
    await session.stop();
    expect(calls.filter((c) => c[0] === "kill")).toEqual([["kill", "G1"]]);
  });
});

describe("extractKiroReply", () => {
  const screen = [
    "▸ What's new",
    "  Reply with exactly the single word: pong.",
    "",
    "• pong",
    "",
    "▸ Credits: turn 0.02 • session 0.02 | Time: 1s",
    "›  ask a question or describe a task ↵",
  ].join("\n");

  it("returns the text between the echoed prompt and the Credits footer", () => {
    expect(extractKiroReply(screen, "Reply with exactly the single word: pong.")).toBe("pong");
  });

  it("returns empty when the turn has not finished", () => {
    expect(extractKiroReply("› ask a question", "anything")).toBe("");
  });
});

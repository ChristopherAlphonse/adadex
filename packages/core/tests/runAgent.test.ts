import { describe, expect, it } from "vitest";

import { createActionRegistry } from "../src/application/actionRegistry";
import { runAgent } from "../src/application/runAgent";
import { FACTORY_ACTIONS } from "../src/domain/action";
import type { ActionExecutor, ApprovalGate } from "../src/ports/ActionPorts";
import type { AgentEvent, AgentProvider, AgentSession } from "../src/ports/AgentProvider";

const registry = createActionRegistry([
  ...FACTORY_ACTIONS,
  { id: "demo.ask", title: "Demo ask", touches: ["process"], class: "ask", parse: (i) => i },
]);

const scripted = (events: AgentEvent[]) => {
  const responses: { callId: string; outcome: unknown }[] = [];
  let stopped = false;

  const session: AgentSession = {
    events: async function* () {
      for (const e of events) yield e;
    },
    respond: async (callId, outcome) => {
      responses.push({ callId, outcome });
    },
    stop: async () => {
      stopped = true;
    },
  };

  const provider: AgentProvider = { id: "fake", start: async () => session };

  return { provider, responses, wasStopped: () => stopped };
};

const executor = (calls: { id: string; input: unknown }[], fail = false): ActionExecutor => ({
  execute: async (id, input) => {
    calls.push({ id, input });

    if (fail) throw new Error("boom");

    return { done: id };
  },
});

const gate = (answer: boolean, asked: string[] = []): ApprovalGate => ({
  request: async (id) => {
    asked.push(id);

    return answer;
  },
});

const act = (callId: string, actionId: string, input: unknown): AgentEvent => ({
  type: "action",
  callId,
  actionId,
  input,
});

const request = { goal: "ship it", contextFiles: ["CONTEXT.md"] };

describe("runAgent", () => {
  it("runs a free action the agent asks for and tells the agent the result", async () => {
    const s = scripted([
      act("c1", "job.advance", { id: "j1", to: "spec" }),
      { type: "done", summary: "ok" },
    ]);

    const calls: { id: string; input: unknown }[] = [];

    const out = await runAgent(
      { provider: s.provider, registry, executor: executor(calls), approvals: gate(true) },
      request,
    );

    expect(calls).toEqual([{ id: "job.advance", input: { id: "j1", to: "spec" } }]);
    expect(s.responses[0]).toEqual({
      callId: "c1",
      outcome: { status: "ok", output: { done: "job.advance" } },
    });
    expect(out.summary).toBe("ok");
  });

  it("waits for approval on an ask action, then runs it once approved", async () => {
    const s = scripted([act("c1", "demo.ask", "x"), { type: "done", summary: "" }]);
    const calls: { id: string; input: unknown }[] = [];
    const asked: string[] = [];
    await runAgent(
      { provider: s.provider, registry, executor: executor(calls), approvals: gate(true, asked) },
      request,
    );
    expect(asked).toEqual(["demo.ask"]);
    expect(calls).toHaveLength(1);
  });

  it("does not run an ask action that is declined", async () => {
    const s = scripted([act("c1", "demo.ask", "x"), { type: "done", summary: "" }]);
    const calls: { id: string; input: unknown }[] = [];
    await runAgent(
      { provider: s.provider, registry, executor: executor(calls), approvals: gate(false) },
      request,
    );
    expect(calls).toHaveLength(0);
    expect(s.responses[0]?.outcome).toEqual({ status: "denied", reason: "not approved" });
  });

  it("never runs a human-only action for an agent and never asks it as an approval", async () => {
    const s = scripted([
      act("c1", "job.commit_local", { id: "j1" }),
      { type: "done", summary: "" },
    ]);

    const calls: { id: string; input: unknown }[] = [];
    const asked: string[] = [];
    await runAgent(
      { provider: s.provider, registry, executor: executor(calls), approvals: gate(true, asked) },
      request,
    );
    expect(calls).toHaveLength(0);
    expect(asked).toHaveLength(0);
    expect(s.responses[0]?.outcome).toMatchObject({ status: "needs-human-click" });
  });

  it("tells the caller when an agent asks for a human-only action", async () => {
    const s = scripted([
      act("c1", "job.commit_local", { id: "j1" }),
      { type: "done", summary: "" },
    ]);

    const seen: string[] = [];
    await runAgent(
      {
        provider: s.provider,
        registry,
        executor: executor([]),
        approvals: gate(true),
        onNeedsHumanClick: (id) => seen.push(id),
      },
      request,
    );
    expect(seen).toEqual(["job.commit_local"]);
  });

  it("refuses an unknown action, such as a push", async () => {
    const s = scripted([act("c1", "git.push", {}), { type: "done", summary: "" }]);
    const calls: { id: string; input: unknown }[] = [];
    await runAgent(
      { provider: s.provider, registry, executor: executor(calls), approvals: gate(true) },
      request,
    );
    expect(calls).toHaveLength(0);
    expect(s.responses[0]?.outcome).toMatchObject({ status: "denied" });
  });

  it("reports an executor failure to the agent instead of crashing the run", async () => {
    const s = scripted([
      act("c1", "job.run_gate", { id: "j1" }),
      { type: "done", summary: "after" },
    ]);

    const out = await runAgent(
      { provider: s.provider, registry, executor: executor([], true), approvals: gate(true) },
      request,
    );

    expect(s.responses[0]?.outcome).toEqual({ status: "error", message: "boom" });
    expect(out.summary).toBe("after");
  });

  it("records every call in a transcript", async () => {
    const s = scripted([
      act("c1", "job.advance", { id: "j1", to: "spec" }),
      act("c2", "git.push", {}),
      { type: "done", summary: "" },
    ]);

    const out = await runAgent(
      { provider: s.provider, registry, executor: executor([]), approvals: gate(true) },
      request,
    );

    expect(out.calls.map((c) => [c.actionId, c.outcome.status])).toEqual([
      ["job.advance", "ok"],
      ["git.push", "denied"],
    ]);
  });

  it("stops the session when the events end without a done", async () => {
    const s = scripted([act("c1", "job.advance", { id: "j1", to: "spec" })]);

    const out = await runAgent(
      { provider: s.provider, registry, executor: executor([]), approvals: gate(true) },
      request,
    );

    expect(s.wasStopped()).toBe(true);
    expect(out.summary).toBe("");
  });
});

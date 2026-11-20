import {
  type ActionExecutor,
  type AgentEvent,
  type AgentProvider,
  createActionRegistry,
  FACTORY_ACTIONS,
  type ParsedValue,
  runAgent,
} from "@adadex/core";
import { describe, expect, it } from "vitest";

import { createActionHost, type HostEvent } from "../src/host/actionHost";

const setup = (opts: { confirm?: boolean; approve?: boolean } = {}) => {
  const ran: { id: string; input: ParsedValue }[] = [];
  const events: HostEvent[] = [];
  const confirmed: string[] = [];

  const executor: ActionExecutor = {
    execute: async (id, input) => {
      ran.push({ id, input });

      return { ok: id };
    },
  };

  const host = createActionHost({
    registry: createActionRegistry(FACTORY_ACTIONS),
    executor,
    confirm: async (title) => {
      confirmed.push(title);

      return opts.confirm ?? true;
    },
    askApproval: { request: async () => opts.approve ?? true },
    emit: (e) => events.push(e),
  });

  return { host, ran, events, confirmed };
};

describe("fromUi", () => {
  it("runs a free action on a button press without a dialog", async () => {
    const { host, ran, confirmed } = setup();
    const r = await host.fromUi("job.advance", { id: "j1", to: "spec" });
    expect(r).toEqual({ status: "ok", output: { ok: "job.advance" } });
    expect(ran).toHaveLength(1);
    expect(confirmed).toHaveLength(0);
  });

  it("shows a native confirmation for a human-only action, and runs it only when confirmed", async () => {
    const yes = setup({ confirm: true });
    expect((await yes.host.fromUi("job.commit_local", { id: "j1" })).status).toBe("ok");
    expect(yes.confirmed).toEqual(["Commit locally"]);

    const no = setup({ confirm: false });
    expect(await no.host.fromUi("job.commit_local", { id: "j1" })).toEqual({ status: "declined" });
    expect(no.ran).toHaveLength(0);
  });

  it("checks the input before asking the person to confirm anything it cannot run", async () => {
    const { host, ran } = setup();
    const r = await host.fromUi("job.approve_spec", { id: "Bad Id" });
    expect(r.status).toBe("denied");
    expect(ran).toHaveLength(0);
  });

  it("denies an unknown action", async () => {
    expect((await setup().host.fromUi("git.push", {})).status).toBe("denied");
  });

  it("reports an executor failure as an error result", async () => {
    const host = createActionHost({
      registry: createActionRegistry(FACTORY_ACTIONS),
      executor: {
        execute: async () => {
          throw new Error("refused: spec.md missing");
        },
      },
      confirm: async () => true,
      askApproval: { request: async () => true },
      emit: () => {},
    });

    expect(await host.fromUi("job.advance", { id: "j1", to: "build" })).toEqual({
      status: "error",
      message: "refused: spec.md missing",
    });
  });
});

describe("agent calls through the host", () => {
  const provider = (events: AgentEvent[]): AgentProvider => {
    const responses: unknown[] = [];

    return {
      id: "fake",
      start: async () => ({
        events: async function* () {
          for (const e of events) yield e;
        },
        respond: async (_id, outcome) => {
          responses.push(outcome);
        },
        stop: async () => {},
      }),
    };
  };

  const call = (callId: string, actionId: string, input: ParsedValue): AgentEvent => ({
    type: "action",
    callId,
    actionId,
    input,
  });

  it("lets an agent advance a job, and records the call", async () => {
    const { host, ran, events } = setup();
    const ports = host.agentPorts();
    await runAgent(
      {
        provider: provider([
          call("1", "job.advance", { id: "j1", to: "spec" }),
          { type: "done", summary: "" },
        ]),
        registry: createActionRegistry(FACTORY_ACTIONS),
        ...ports,
      },
      { goal: "g", contextFiles: [] },
    );
    expect(ran).toHaveLength(1);
    expect(events.some((e) => e.type === "ran" && e.caller === "agent")).toBe(true);
  });

  it("never runs a human-only action for an agent, never shows a dialog, and tells the UI to show the button", async () => {
    const { host, ran, events, confirmed } = setup();
    const ports = host.agentPorts();
    await runAgent(
      {
        provider: provider([
          call("1", "job.commit_local", { id: "j1" }),
          { type: "done", summary: "" },
        ]),
        registry: createActionRegistry(FACTORY_ACTIONS),
        ...ports,
      },
      { goal: "g", contextFiles: [] },
    );
    expect(ran).toHaveLength(0);
    expect(confirmed).toHaveLength(0);
    expect(events).toContainEqual({
      type: "needs-click",
      actionId: "job.commit_local",
      reason: "Commit locally needs a human click",
    });
  });

  it("the agent executor refuses a human-only action even if called directly", async () => {
    const { host, ran } = setup();
    await expect(
      host.agentPorts().executor.execute("job.commit_local", { id: "j1" }),
    ).rejects.toThrow(/not available to an agent/);
    expect(ran).toHaveLength(0);
  });
});

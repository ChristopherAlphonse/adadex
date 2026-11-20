import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createActionRegistry, FACTORY_ACTIONS, factoryBuildPreset, runAgent } from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadMachineConfig } from "../src/config/machineConfig";
import { createActionHost, type HostEvent } from "../src/host/actionHost";
import { createApprovalBroker } from "../src/ipc/approvalBroker";
import { type ProcessPort, parseRequest } from "../src/ipc/contract";
import { createHostApi } from "../src/ipc/hostApi";
import { createJobExecutor } from "../src/jobs/jobActions";
import { createJobStore } from "../src/jobs/jobStore";
import { createWorkflowStore } from "../src/workflows/workflowStore";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "adadex-ipc-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("parseRequest: the UI is untrusted", () => {
  it("accepts well-formed requests", () => {
    expect(parseRequest({ kind: "jobs.list" })).toEqual({
      ok: true,
      request: { kind: "jobs.list" },
    });
    expect(
      parseRequest({ kind: "action.run", actionId: "job.advance", input: { id: "j1" } }).ok,
    ).toBe(true);
    expect(parseRequest({ kind: "approval.respond", approvalId: "a1", approved: true }).ok).toBe(
      true,
    );
    expect(parseRequest({ kind: "approvals.list" }).ok).toBe(true);
    expect(parseRequest({ kind: "processes.list" }).ok).toBe(true);
    expect(parseRequest({ kind: "process.kill", processId: "p-1" }).ok).toBe(true);
    expect(parseRequest({ kind: "process.kill" }).ok).toBe(false);
  });

  it("rejects non-objects, unknown kinds and missing or oversized fields", () => {
    expect(parseRequest(null)).toEqual({ ok: false, error: "a request needs a kind" });
    expect(parseRequest("x").ok).toBe(false);
    expect(parseRequest({ kind: "rm -rf" })).toEqual({
      ok: false,
      error: "unknown request rm -rf",
    });
    expect(parseRequest({ kind: "jobs.create", workflowId: "factory", id: "j1" })).toEqual({
      ok: false,
      error: "jobs.create needs title",
    });
    expect(parseRequest({ kind: "action.run", actionId: "x".repeat(500) }).ok).toBe(false);
    expect(parseRequest({ kind: "approval.respond", approvalId: "a1", approved: "yes" }).ok).toBe(
      false,
    );
    expect(parseRequest({ kind: "workflows.save" }).ok).toBe(false);
  });
});

describe("approval broker", () => {
  it("holds a request until answered, answers it once, and declines the rest on quit", async () => {
    const seen: string[] = [];
    const broker = createApprovalBroker((p) => seen.push(p.approvalId));
    const first = broker.gate.request("demo.ask", "needs ok");
    const second = broker.gate.request("demo.ask", "needs ok");
    expect(broker.pending().map((p) => p.approvalId)).toEqual(["approval-1", "approval-2"]);
    expect(broker.respond("approval-1", true)).toBe(true);
    expect(await first).toBe(true);
    expect(broker.respond("approval-1", true)).toBe(false);
    broker.declineAll();
    expect(await second).toBe(false);
    expect(seen).toEqual(["approval-1", "approval-2"]);
  });
});

const build = (confirmAnswer = true, processes?: ProcessPort) => {
  const events: HostEvent[] = [];
  const confirmed: string[] = [];

  const registry = createActionRegistry([
    ...FACTORY_ACTIONS,
    { id: "demo.ask", title: "Demo ask", touches: ["process"], class: "ask", parse: (i) => i },
  ]);

  const workflows = createWorkflowStore(join(root, "wf"));
  const jobs = createJobStore(join(root, "state"));

  const broker = createApprovalBroker((p) =>
    events.push({ type: "approval-requested", actionId: p.actionId, reason: p.reason }),
  );

  const executor = createJobExecutor({
    store: jobs,
    workflows: { factory: factoryBuildPreset },
    runEffect: async () => {},
    actor: () => "human",
  });

  const host = createActionHost({
    registry,
    executor: {
      execute: (id, input) =>
        id === "demo.ask" ? Promise.resolve({ ran: id }) : executor.execute(id, input),
    },
    confirm: async (title) => {
      confirmed.push(title);

      return confirmAnswer;
    },
    askApproval: broker.gate,
    emit: (e) => events.push(e),
  });

  const configPath = join(root, "machine.json");

  const api = createHostApi({
    workflows,
    jobs,
    host,
    approvals: broker,
    ...(processes === undefined ? {} : { processes }),
    loadConfig: () => loadMachineConfig(configPath),
    configPath,
    roundLimit: 3,
  });

  return { api, events, confirmed, broker, registry, host };
};

describe("host api", () => {
  it("never throws on garbage and says what was wrong", async () => {
    const { api } = build();
    expect(await api.handle(42)).toEqual({ ok: false, errors: ["a request needs a kind"] });
    expect(
      await api.handle({ kind: "jobs.create", workflowId: "nope", id: "j1", title: "t" }),
    ).toEqual({ ok: false, errors: ["no workflow nope"] });
  });

  it("lists approvals and processes and kills a process through the injected port", async () => {
    const processes: ProcessPort = {
      list: vi.fn(async () => [
        {
          processId: "p-1",
          label: "claude -p",
          startedAt: "2026-11-19T12:00:00.000Z",
        },
      ]),
      kill: vi.fn(async () => undefined),
    };

    const { api, broker } = build(true, processes);
    const waiting = broker.gate.request("demo.ask", "needs ok");

    expect(await api.handle({ kind: "approvals.list" })).toEqual({
      ok: true,
      data: [{ approvalId: "approval-1", actionId: "demo.ask", reason: "needs ok" }],
    });
    expect(await api.handle({ kind: "processes.list" })).toEqual({
      ok: true,
      data: [
        {
          processId: "p-1",
          label: "claude -p",
          startedAt: "2026-11-19T12:00:00.000Z",
        },
      ],
    });
    expect(await api.handle({ kind: "process.kill", processId: "p-1" })).toEqual({
      ok: true,
      data: null,
    });
    expect(processes.kill).toHaveBeenCalledWith("p-1");
    broker.respond("approval-1", false);
    expect(await waiting).toBe(false);
  });

  it("reports that process control is unavailable when no port is injected", async () => {
    const { api } = build();
    expect(await api.handle({ kind: "processes.list" })).toEqual({ ok: true, data: [] });
    expect(await api.handle({ kind: "process.kill", processId: "p-1" })).toEqual({
      ok: false,
      errors: ["process control is not available"],
    });
  });

  it("lists the presets, saves a user workflow, forks and removes it, and refuses to touch a preset", async () => {
    const { api } = build();

    const names = async () =>
      (/* SAFETY: preceding checks establish the invariant this assertion encodes. */ (await api.handle({ kind: "workflows.list" })) as { data: { id: string }[] }).data.map(
        (w) => w.id,
      );

    expect(await names()).toEqual(["factory", "factory-review"]);

    const fork = await api.handle({
      kind: "workflows.fork",
      fromId: "factory",
      newId: "mine",
      name: "Mine",
    });

    expect(fork.ok).toBe(true);
    expect(await names()).toEqual(["factory", "factory-review", "mine"]);
    expect((await api.handle({ kind: "workflows.remove", id: "factory" })).ok).toBe(false);
    expect((await api.handle({ kind: "workflows.remove", id: "mine" })).ok).toBe(true);
    const bad = await api.handle({ kind: "workflows.save", workflow: { id: "x" } });
    expect(bad.ok === false && bad.errors.length).toBeGreaterThan(1);
  });

  it("creates a job from a workflow and runs actions on it, with a refusal reaching the UI as an error", async () => {
    const { api } = build();
    expect(
      (
        await api.handle({
          kind: "jobs.create",
          workflowId: "factory",
          id: "j1",
          title: "Add login",
        })
      ).ok,
    ).toBe(true);

    const refused = await api.handle({
      kind: "action.run",
      actionId: "job.advance",
      input: { id: "j1", to: "spec" },
    });

    expect(refused).toEqual({ ok: false, errors: ["shape.md needs STATUS: READY"] });

    const jobs = /* SAFETY: preceding checks establish the invariant this assertion encodes. */ (await api.handle({ kind: "jobs.list" })) as {
      data: { id: string; stage: string }[];
    };

    expect(jobs.data.map((j) => [j.id, j.stage])).toEqual([["j1", "shape"]]);
  });

  it("a human-only action from the UI shows a native confirmation, and declining stops it", async () => {
    const yes = build(true);
    await yes.api.handle({ kind: "jobs.create", workflowId: "factory", id: "j1", title: "t" });
    await yes.api.handle({ kind: "action.run", actionId: "job.unblock", input: { id: "j1" } });
    expect(yes.confirmed).toEqual(["Unblock a parked job"]);
    const no = build(false);

    const r = await no.api.handle({
      kind: "action.run",
      actionId: "job.unblock",
      input: { id: "j1" },
    });

    expect(r).toEqual({ ok: false, errors: ["declined"] });
  });

  it("an agent's ask action waits for the UI to approve it, and the UI cannot approve a human-only action", async () => {
    const { api, events, broker, registry, host } = build();
    let seenOutcome: unknown;

    const provider = {
      id: "fake",
      start: async () => ({
        events: async function* () {
          yield { type: "action" as const, callId: "1", actionId: "demo.ask", input: {} };
          yield {
            type: "action" as const,
            callId: "2",
            actionId: "job.commit_local",
            input: { id: "j1" },
          };
          yield { type: "done" as const, summary: "" };
        },
        respond: async (id: string, outcome: unknown) => {
          if (id === "1") seenOutcome = outcome;
        },
        stop: async () => {},
      }),
    };

    const running = runAgent(
      { provider, registry, ...host.agentPorts() },
      { goal: "g", contextFiles: [] },
    );

    while (broker.pending().length === 0) await new Promise((r) => setTimeout(r, 5));
    const id = broker.pending()[0]?.approvalId ?? "";
    expect(await api.handle({ kind: "approval.respond", approvalId: id, approved: true })).toEqual({
      ok: true,
      data: null,
    });
    const result = await running;
    expect(seenOutcome).toMatchObject({ status: "ok" });
    expect(result.calls[1]?.outcome.status).toBe("needs-human-click");
    expect(events.some((e) => e.type === "needs-click")).toBe(true);
    expect(
      (await api.handle({ kind: "approval.respond", approvalId: id, approved: true })).ok,
    ).toBe(false);
  });

  it("saves machine config and resolves a workflow's skills against it", async () => {
    const { api } = build();
    expect((await api.handle({ kind: "config.get" })).ok).toBe(true);
    const bad = await api.handle({ kind: "config.set", config: { skillSources: [{ name: "a" }] } });
    expect(bad.ok).toBe(false);

    const good = await api.handle({
      kind: "config.set",
      config: {
        skillSources: [{ name: "mine", dir: join(root, "none") }],
        skillMap: { "prd-mode": "acme" },
      },
    });

    expect(good.ok).toBe(true);

    const resolved = /* SAFETY: preceding checks establish the invariant this assertion encodes. */ (await api.handle({ kind: "skills.resolve", workflowId: "factory" })) as {
      data: { stageId: string; via: string; skill: unknown }[];
    };

    expect(resolved.data.find((r) => r.stageId === "spec")).toMatchObject({
      via: "map",
      skill: null,
    });
  });
});

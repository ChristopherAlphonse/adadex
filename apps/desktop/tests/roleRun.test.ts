import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  type AgentEvent,
  BUILD_POLICY,
  createActionRegistry,
  FACTORY_ACTIONS,
  factoryBuildPreset,
  REVIEW_POLICY,
  type WorkflowJob,
} from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GuardDecide } from "../src/agents/guardHost";
import { createApp } from "../src/app/createApp";
import { createRoleStore, missingRoles } from "../src/roles/roleStore";
import { createRoleRunner, type ProviderRequest } from "../src/runs/roleRunner";
import { createScheduler } from "../src/runs/scheduler";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "adadex-roles-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

type Script = (api: {
  decide: GuardDecide;
  cwd: string;
  jobDir: string;
  probe: (name: string, value: unknown) => void;
}) => AsyncGenerator<AgentEvent>;

const world = async (script: Script) => {
  const project = join(root, "project");
  const dataDir = join(root, "data");
  await mkdir(project, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  execFileSync("git", ["init", "-b", "main"], { cwd: project });
  const probes: Record<string, unknown> = {};
  const outcomes: unknown[] = [];
  const events: string[] = [];

  const declineAll = () =>
    queueMicrotask(() => {
      for (const p of app.approvals.pending()) app.approvals.respond(p.approvalId, false);
    });

  const app: ReturnType<typeof createApp> = createApp({
    projectRoot: project,
    dataDir,
    confirm: async () => false,
    emit: (e) => {
      events.push(e.type);

      if (e.type === "approval-requested") declineAll();
    },
    bridgePath: "/unused",
    hookPath: "/unused",
    makeProvider: (req: ProviderRequest) => ({
      id: "fake",
      start: async () => ({
        events: () =>
          script({
            decide: req.decide,
            cwd: req.cwd,
            jobDir: join(project, ".adadex", "factory", "jobs", "j1"),
            probe: (n, v) => {
              probes[n] = v;
            },
          }),
        respond: async (_id, outcome) => {
          outcomes.push(outcome);
        },
        stop: async () => {},
      }),
    }),
  });

  return { app, project, dataDir, probes, outcomes, events };
};

type World = Awaited<ReturnType<typeof world>>;

/** Put a job at a stage the way the app would: the new record, then an audit line that vouches for it. */
const place = async (w: World, stage: string, over: Partial<WorkflowJob> = {}) => {
  const job = await w.app.jobs.create(factoryBuildPreset, "j1", "t", 3);
  await w.app.jobs.save({ ...job, stage, round: 1, ...over });
  await w.app.jobs.audit({ actor: "system", action: "place", jobId: "j1", detail: stage });
};

const tool = (name: string, input: Record<string, unknown>, cwd: string) => ({
  tool_name: name,
  tool_input: input,
  cwd,
});

const act = (callId: string, actionId: string, input: unknown): AgentEvent => ({
  type: "action",
  callId,
  actionId,
  input,
});

const kind = async (d: GuardDecide, e: unknown) => ((await d(e)).allow ? "allow" : "deny");

describe("an agent works in the role of its stage, and only that", () => {
  it("a builder can write its own document and code, and nothing that is another role's or the app's", async () => {
    const w = await world(async function* ({ decide, cwd, jobDir, probe }) {
      probe(
        "buildDoc",
        await kind(decide, tool("Write", { file_path: join(jobDir, "build.md") }, cwd)),
      );
      probe(
        "code",
        await kind(decide, tool("Write", { file_path: join(cwd, "src", "a.ts") }, cwd)),
      );

      for (const f of [
        "spec.md",
        "uat.md",
        "pr-body.md",
        "round-1/review-code.md",
        "round-1/checks.md",
        "audit.log",
        "job.json",
      ]) {
        probe(f, await kind(decide, tool("Write", { file_path: join(jobDir, f) }, cwd)));
      }

      probe("push", await kind(decide, tool("Bash", { command: "git push origin main" }, cwd)));
      probe(
        "ci",
        await kind(
          decide,
          tool("Write", { file_path: join(cwd, ".github", "workflows", "ci.yml") }, cwd),
        ),
      );
      probe("webfetch", await kind(decide, tool("WebFetch", { url: "x" }, cwd)));
      yield { type: "done", summary: "ok" };
    });

    await place(w, "build");
    const result = await w.app.runStage("j1");
    expect(result.binding.roleId).toBe("builder");
    expect(w.probes).toMatchObject({ buildDoc: "allow", code: "allow", push: "deny", ci: "deny" });

    for (const f of [
      "spec.md",
      "uat.md",
      "pr-body.md",
      "round-1/review-code.md",
      "round-1/checks.md",
      "audit.log",
      "job.json",
    ])
      expect(w.probes[f], f).toBe("deny");
  });

  it("the actions it asks for are limited to its role: it can advance to gate, and nothing else, human-only actions included", async () => {
    const w = await world(async function* () {
      yield act("1", "job.advance", { id: "j1", to: "gate" });
      yield act("2", "job.advance", { id: "j1", to: "ready" });
      yield act("3", "job.advance", { id: "j1", to: "review" });
      yield act("4", "job.run_gate", { id: "j1" });
      yield act("5", "job.commit_local", { id: "j1" });
      yield act("6", "job.approve_spec", { id: "j1" });
      yield act("7", "role.set", { role: "verifier" });
      yield act("8", "git.push", {});
      yield { type: "done", summary: "" };
    });

    await place(w, "build");
    await writeFile(join(w.app.jobs.jobDir("j1"), "build.md"), "STATUS: READY\n");
    await w.app.runStage("j1");
    expect(w.outcomes.map((o) => (/* SAFETY: preceding checks establish the invariant this assertion encodes. */ o as { status: string }).status)).toEqual([
      "ok",
      "denied",
      "denied",
      "denied",
      "denied",
      "denied",
      "denied",
      "denied",
    ]);
    expect((await w.app.jobs.load("j1")).stage).toBe("gate");
  });

  it("a reviewer cannot change code or rewrite the build notes, but can write its verdict", async () => {
    const w = await world(async function* ({ decide, cwd, jobDir, probe }) {
      probe("code", await kind(decide, tool("Edit", { file_path: join(cwd, "src", "a.ts") }, cwd)));
      probe(
        "verdict",
        await kind(
          decide,
          tool("Write", { file_path: join(jobDir, "round-1", "review-code.md") }, cwd),
        ),
      );
      probe(
        "build",
        await kind(decide, tool("Write", { file_path: join(jobDir, "build.md") }, cwd)),
      );
      probe("fmt", await kind(decide, tool("Bash", { command: "prettier --write src" }, cwd)));
      probe("read", await kind(decide, tool("Bash", { command: "git diff HEAD" }, cwd)));
      yield { type: "done", summary: "" };
    });

    await place(w, "review");
    const result = await w.app.runStage("j1");
    expect(result.binding.roleId).toBe("reviewer");
    expect(w.probes).toEqual({
      code: "deny",
      verdict: "allow",
      build: "deny",
      fmt: "deny",
      read: "allow",
    });
  });

  it("the role comes from the stage, so an agent that moves a job cannot pick the role that works next", async () => {
    const w = await world(async function* () {
      yield act("1", "job.advance", { id: "j1", to: "gate" });
      yield { type: "done", summary: "" };
    });

    await place(w, "build");
    await writeFile(join(w.app.jobs.jobDir("j1"), "build.md"), "STATUS: READY\n");
    const first = await w.app.runStage("j1");
    expect(first.binding.roleId).toBe("builder");
    const second = await w.app.runStage("j1");
    expect(second.binding.roleId).toBe("gatekeeper");
    expect(Object.isFrozen(second.binding)).toBe(true);
  });

  it("refuses a stage with no role, a role that does not exist, and a finished job", async () => {
    const w = await world(async function* () {
      yield { type: "done", summary: "" };
    });

    await place(w, "build");

    const noRole = {
      ...factoryBuildPreset,
      id: "norole",
      stages: factoryBuildPreset.stages.map((s) =>
        s.id === "build" ? { ...s, role: undefined } : s,
      ),
    };

    const ghost = {
      ...factoryBuildPreset,
      id: "ghost",
      stages: factoryBuildPreset.stages.map((s) =>
        s.id === "build" ? { ...s, role: "nobody" } : s,
      ),
    };

    await w.app.workflows.save(noRole);
    await w.app.workflows.save(ghost);

    for (const [id, message] of [
      ["norole", "has no role"],
      ["ghost", "which does not exist"],
    ] as const) {
      const job = await w.app.jobs.load("j1");
      await w.app.jobs.save({ ...job, workflowId: id });
      await w.app.jobs.audit({ actor: "system", action: "sync", jobId: "j1", detail: id });
      await expect(w.app.runStage("j1")).rejects.toThrow(message);
    }

    const job = await w.app.jobs.load("j1");
    await w.app.jobs.save({ ...job, workflowId: "factory", stage: "ready" });
    await w.app.jobs.audit({ actor: "system", action: "sync", jobId: "j1", detail: "ready" });
    await expect(w.app.runStage("j1")).rejects.toThrow("no agent works");
  });

  it("writes the run, the role and every call into the tamper-evident log", async () => {
    const w = await world(async function* () {
      yield act("1", "job.advance", { id: "j1", to: "gate" });
      yield act("2", "job.advance", { id: "j1", to: "ready" });
      yield { type: "done", summary: "" };
    });

    await place(w, "build");
    await writeFile(join(w.app.jobs.jobDir("j1"), "build.md"), "STATUS: READY\n");
    const { binding } = await w.app.runStage("j1");
    const log = await w.app.jobs.readAudit("j1");
    const mine = log.filter((l) => l.runId === binding.runId);
    expect(mine.map((l) => `${l.action}:${l.role}`)).toEqual([
      "run-start:builder",
      "call:builder",
      "call:builder",
      "run-end:builder",
    ]);
    expect(mine.map((l) => l.detail)).toEqual([
      "builder at build",
      "job.advance: ok",
      "job.advance: denied",
      "build -> gate",
    ]);
    expect(await w.app.jobs.verify("j1")).toMatchObject({ ok: true });
  });

  it("refuses to run, and parks the job, when the audit chain or job record was tampered with", async () => {
    const w = await world(async function* () {
      yield { type: "done", summary: "" };
    });

    await place(w, "build");
    const path = join(w.app.jobs.jobDir("j1"), "job.json");
    const record = JSON.parse(await readFile(path, "utf8"));
    await writeFile(path, JSON.stringify({ ...record, round: 99 }));
    await expect(w.app.runStage("j1")).rejects.toThrow("integrity check failed");
    const after = JSON.parse(await readFile(path, "utf8"));
    expect(after.stage).toBe("needs-human");
    expect(after.note).toContain("the job record was changed outside the app");
  });
});

describe("limits", () => {
  const tiny = {
    id: "tiny",
    name: "Tiny",
    actions: ["job.advance"],
    advanceTo: ["gate"],
    tools: ["Read", "Write"],
    writeDocs: ["notes.md"],
    editsCode: false,
    limits: { maxActions: 2, maxSeconds: 30 },
  };

  it("stops a run that uses more actions than its role allows, and refuses the extra ones", async () => {
    const w = await world(async function* ({ decide, cwd }) {
      const answers: boolean[] = [];

      for (let i = 0; i < 4; i++)
        answers.push((await decide(tool("Read", { file_path: join(cwd, "a") }, cwd))).allow);
      w.probes.answers = answers;
      yield { type: "done", summary: "" };
    });

    expect((await w.app.roles.save(tiny)).ok).toBe(true);

    const mini = {
      id: "mini",
      name: "Mini",
      initial: "work",
      stages: [
        { id: "work", role: "tiny", hint: "x", moves: [{ to: "done" }] },
        { id: "done", hint: "x", terminal: true, moves: [] },
      ],
    };

    expect((await w.app.workflows.save(mini)).ok).toBe(true);
    const job = await w.app.jobs.create(/* SAFETY: preceding checks establish the invariant this assertion encodes. */ (await w.app.workflows.get("mini")) as never, "j1", "t", 3);
    void job;
    const result = await w.app.runStage("j1");
    expect(w.probes.answers).toEqual([true, true, false, false]);
    expect(result.limited).toBe("actions");
    expect((await w.app.jobs.readAudit("j1")).some((l) => l.action === "limit")).toBe(true);
  });

  it("stops a run that runs too long", async () => {
    const w = await world(async function* () {
      yield { type: "done", summary: "" };
    });

    await w.app.roles.save(tiny);

    const mini = {
      id: "mini",
      name: "Mini",
      initial: "work",
      stages: [
        { id: "work", role: "tiny", hint: "x", moves: [{ to: "done" }] },
        { id: "done", hint: "x", terminal: true, moves: [] },
      ],
    };

    await w.app.workflows.save(mini);
    await w.app.jobs.create(/* SAFETY: preceding checks establish the invariant this assertion encodes. */ (await w.app.workflows.get("mini")) as never, "j1", "t", 3);
    const timers: (() => void)[] = [];
    let stopped = false;

    const runner = createRoleRunner({
      store: w.app.jobs,
      workflows: (id) => w.app.workflows.get(id),
      roles: w.app.roles,
      registry: createActionRegistry(FACTORY_ACTIONS),
      host: w.app.host,
      approvals: w.app.approvals,
      basePolicy: (r) => (r.editsCode ? BUILD_POLICY : REVIEW_POLICY),
      protectedLocations: [],
      cwdOf: () => root,
      setTimer: (fn) => {
        timers.push(fn);

        return timers.length;
      },
      clearTimer: () => {},
      makeProvider: () => ({
        id: "slow",
        start: async () => ({
          events: async function* () {
            timers[0]?.();
            await Promise.resolve();
            yield { type: "done" as const, summary: "" };
          },
          respond: async () => {},
          stop: async () => {
            stopped = true;
          },
        }),
      }),
    });

    const result = await runner.run("j1");
    expect(result.limited).toBe("time");
    expect(stopped).toBe(true);
  });
});

describe("the unattended loop", () => {
  const mk = async () => {
    const w = await world(async function* () {
      yield { type: "done", summary: "" };
    });

    const auto = { ...factoryBuildPreset, id: "auto", name: "Auto", unattended: true };
    await w.app.workflows.save(auto);

    for (const id of ["a", "b"]) {
      const job = await w.app.jobs.create(auto, id, id, 3);
      await w.app.jobs.save({ ...job, stage: "build", round: 1 });
      await w.app.jobs.audit({ actor: "system", action: "place", jobId: id, detail: "build" });
    }

    return w;
  };

  const result = (stageAfter: string) => ({
    binding: { runId: "r", roleId: "builder", jobId: "x", stageId: "build", startedAt: "" },
    stageAfter,
    summary: "",
    actions: 0,
  });

  it("is off until a person starts it, and stop turns it off", () => {
    const sched = createScheduler({
      store: /* SAFETY: preceding checks establish the invariant this assertion encodes. */ null as never,
      workflows: () => undefined,
      runStage: async () => result("build"),
      concurrency: 1,
      stallLimit: 2,
      setInterval: () => 1,
      clearInterval: () => {},
    });

    expect(sched.status().enabled).toBe(false);
    sched.start(1000);
    expect(sched.status().enabled).toBe(true);
    sched.stop();
    expect(sched.status().enabled).toBe(false);
  });

  it("starts at most the concurrency limit, and the rest wait for a free slot", async () => {
    const w = await mk();
    const started: string[] = [];

    const sched = createScheduler({
      store: w.app.jobs,
      workflows: (id) => w.app.workflows.get(id),
      runStage: async (id) => {
        started.push(id);

        return result("gate");
      },
      concurrency: 1,
      stallLimit: 2,
    });

    const plan = await sched.tick();
    await sched.idle();
    expect(plan.start).toHaveLength(1);
    expect(plan.skip.map((s) => s.reason)).toEqual(["waiting for a free slot"]);
    expect(started).toHaveLength(1);
  });

  it("parks a job on a person after runs that moved nothing, instead of looping", async () => {
    const w = await mk();

    const sched = createScheduler({
      store: w.app.jobs,
      workflows: (id) => w.app.workflows.get(id),
      runStage: async () => result("build"),
      concurrency: 2,
      stallLimit: 2,
    });

    await sched.tick();
    await sched.idle();
    await sched.tick();
    await sched.idle();
    const plan = await sched.tick();
    expect(plan.park.map((p) => p.jobId).sort()).toEqual(["a", "b"]);
    const a = await w.app.jobs.load("a");
    expect(a.stage).toBe("needs-human");
    expect(a.note).toContain("2 runs in a row ended at build");
    expect((await w.app.jobs.verify("a")).ok).toBe(true);
    expect((await sched.tick()).start).toEqual([]);
  });

  it("counts a refused run as a run that moved nothing", async () => {
    const w = await mk();

    const sched = createScheduler({
      store: w.app.jobs,
      workflows: (id) => w.app.workflows.get(id),
      runStage: async () => {
        throw new Error("refused");
      },
      concurrency: 2,
      stallLimit: 1,
    });

    await sched.tick();
    await sched.idle();
    expect((await sched.tick()).park.length).toBe(2);
  });
});

describe("role store", () => {
  const registry = createActionRegistry(FACTORY_ACTIONS);

  const mine = {
    id: "my-role",
    name: "Mine",
    actions: ["job.advance"],
    advanceTo: ["gate"],
    tools: ["Read"],
    writeDocs: ["n.md"],
    editsCode: false,
    limits: { maxActions: 10, maxSeconds: 60 },
  };

  it("lists presets first, saves a valid user role, and protects presets", async () => {
    const store = createRoleStore(join(root, "roles"), registry);
    expect((await store.list()).map((r) => r.id).slice(0, 2)).toEqual(["shaper", "planner"]);
    expect((await store.save(mine)).ok).toBe(true);
    expect((await store.get("my-role"))?.origin).toBe("user");
    expect((await store.save({ ...mine, id: "builder" })).ok).toBe(false);
    expect((await store.remove("builder")).ok).toBe(false);
    expect((await store.remove("my-role")).ok).toBe(true);
  });

  it("refuses a role that grants a human-only action, and ignores a file on disk that does", async () => {
    const store = createRoleStore(join(root, "roles"), registry);
    expect((await store.save({ ...mine, actions: ["job.commit_local"] })).ok).toBe(false);
    await mkdir(join(root, "roles"), { recursive: true });
    await writeFile(
      join(root, "roles", "evil.json"),
      JSON.stringify({ ...mine, id: "evil", actions: ["job.advance", "job.commit_local"] }),
    );
    await writeFile(join(root, "roles", "broken.json"), "{nope");
    expect((await store.list()).some((r) => r.id === "evil" || r.id === "broken")).toBe(false);
  });

  it("reports workflow stages that name a role that does not exist", async () => {
    const store = createRoleStore(join(root, "roles"), registry);
    const known = new Set((await store.list()).map((r) => r.id));
    expect(missingRoles(factoryBuildPreset, known)).toEqual([]);

    const bad = {
      ...factoryBuildPreset,
      stages: factoryBuildPreset.stages.map((s) =>
        s.id === "build" ? { ...s, role: "ghost" } : s,
      ),
    };

    expect(missingRoles(bad, known)).toEqual(["ghost"]);
  });
});

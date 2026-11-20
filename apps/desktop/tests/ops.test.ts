import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { factoryBuildPreset } from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app/createApp";
import { parseRequest } from "../src/ipc/contract";
import { createProcessRegistry } from "../src/runs/processRegistry";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "adadex-ops-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("process registry", () => {
  it("lists what is running with when it started, keeps finished ones for a while, and stops one on request", async () => {
    let n = 0;
    const clock = () => new Date(Date.UTC(2026, 10, 19, 0, 0, n++));
    const reg = createProcessRegistry(clock, () => `p${n}`);
    const killed: string[] = [];
    const a = reg.register("Builder on j1", () => killed.push("a"));
    reg.register("checks: npm test", () => killed.push("b"));
    expect((await reg.list()).map((p) => p.label)).toEqual(["Builder on j1", "checks: npm test"]);
    await reg.kill(a.processId);
    expect(killed).toEqual(["a"]);
    a.done();
    const after = await reg.list();
    expect(after[0]?.endedAt).toBeDefined();
    expect(after[1]?.endedAt).toBeUndefined();
    await expect(reg.kill(a.processId)).rejects.toThrow("already ended");
    await expect(reg.kill("nope")).rejects.toThrow("no such process");
  });

  it("stops everything still running on quit, and only that", () => {
    const reg = createProcessRegistry();
    const killed: string[] = [];
    reg.register("a", () => killed.push("a"));
    reg.register("b", () => killed.push("b")).done();
    reg.killAll();
    expect(killed).toEqual(["a"]);
  });

  it("forgets the oldest finished entries so the list does not grow forever", async () => {
    const reg = createProcessRegistry();
    for (let i = 0; i < 40; i++) reg.register(`p${i}`, () => {}).done();
    expect((await reg.list()).length).toBe(20);
  });
});

describe("new requests are checked before anything acts", () => {
  it("accepts roles and scheduler requests, and rejects malformed ones", () => {
    expect(parseRequest({ kind: "roles.list" }).ok).toBe(true);
    expect(parseRequest({ kind: "roles.remove", id: "my-role" }).ok).toBe(true);
    expect(parseRequest({ kind: "roles.save", role: {} }).ok).toBe(true);
    expect(parseRequest({ kind: "roles.save" }).ok).toBe(false);
    expect(parseRequest({ kind: "scheduler.status" }).ok).toBe(true);
    expect(parseRequest({ kind: "scheduler.set", enabled: true }).ok).toBe(true);
    expect(parseRequest({ kind: "scheduler.set", enabled: "yes" }).ok).toBe(false);
    expect(parseRequest({ kind: "scheduler.set" }).ok).toBe(false);
    expect(parseRequest({ kind: "project.get" }).ok).toBe(true);
    expect(parseRequest({ kind: "project.set", checks: "npm test" }).ok).toBe(true);
    expect(parseRequest({ kind: "project.set", checks: 1 }).ok).toBe(false);
  });
});

const boot = async (confirmAnswer: boolean, checks = "true", name = "w") => {
  const project = join(root, name, "project");
  const dataDir = join(root, name, "data");
  await mkdir(project, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  const git = (...args: string[]) => execFileSync("git", args, { cwd: project, env });
  git("init", "-b", "main");
  git("config", "user.email", "t@example.invalid");
  git("config", "user.name", "t");
  await writeFile(join(project, "a.txt"), "1");
  git("add", "-A");
  git("commit", "-m", "init");
  await writeFile(join(dataDir, "project.json"), JSON.stringify({ checks, baseBranch: "main" }));
  const confirmed: string[] = [];
  const app = createApp({
    projectRoot: project,
    dataDir,
    confirm: async (title) => {
      confirmed.push(title);
      return confirmAnswer;
    },
    emit: () => {},
    bridgePath: "/unused",
    hookPath: "/unused",
  });
  return { app, confirmed };
};

describe("the unattended loop is turned on only by a person", () => {
  it("starts off, needs the native dialog to turn on, stays off when declined, and turns off without one", async () => {
    const declined = await boot(false);
    const status = async (w: typeof declined) =>
      ((await w.app.api.handle({ kind: "scheduler.status" })) as { data: { enabled: boolean } })
        .data.enabled;
    expect(await status(declined)).toBe(false);
    expect(await declined.app.api.handle({ kind: "scheduler.set", enabled: true })).toEqual({
      ok: false,
      errors: ["declined"],
    });
    expect(declined.confirmed).toEqual(["Let agents work unattended?"]);
    expect(await status(declined)).toBe(false);

    const accepted = await boot(true, "true", "second");
    expect((await accepted.app.api.handle({ kind: "scheduler.set", enabled: true })).ok).toBe(true);
    expect(await status(accepted)).toBe(true);
    const before = accepted.confirmed.length;
    expect((await accepted.app.api.handle({ kind: "scheduler.set", enabled: false })).ok).toBe(
      true,
    );
    expect(accepted.confirmed.length).toBe(before);
    expect(await status(accepted)).toBe(false);
    await accepted.app.shutdown();
  });
});

describe("the checks command is set only by a person", () => {
  it("shows the command in the native dialog, keeps the other gate settings, and refuses bad or declined input", async () => {
    const declined = await boot(false, "true");
    const checks = async (w: typeof declined) =>
      ((await w.app.api.handle({ kind: "project.get" })) as { data: { checks: string } }).data
        .checks;
    expect(await checks(declined)).toBe("true");
    expect(await declined.app.api.handle({ kind: "project.set", checks: "npm test" })).toEqual({
      ok: false,
      errors: ["declined"],
    });
    expect(await checks(declined)).toBe("true");
    for (const bad of ["", "   ", "npm test\nrm -rf /", "x".repeat(2001)]) {
      expect((await declined.app.api.handle({ kind: "project.set", checks: bad })).ok).toBe(false);
    }
    expect(declined.confirmed).toEqual(["Set the project's checks command?"]);

    const accepted = await boot(true, "true", "second");
    expect((await accepted.app.api.handle({ kind: "project.set", checks: "npm test" })).ok).toBe(
      true,
    );
    expect(await checks(accepted)).toBe("npm test");
    const file = JSON.parse(await readFile(join(root, "second", "data", "project.json"), "utf8"));
    expect(file).toEqual({ checks: "npm test", baseBranch: "main" });
  });
});

describe("roles through the request layer", () => {
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

  it("lists the presets, saves a valid role, refuses one that grants a human-only action, and protects presets", async () => {
    const { app } = await boot(true);
    const ids = async () =>
      ((await app.api.handle({ kind: "roles.list" })) as { data: { id: string }[] }).data.map(
        (r) => r.id,
      );
    expect((await ids()).slice(0, 2)).toEqual(["shaper", "planner"]);
    expect((await app.api.handle({ kind: "roles.save", role: mine })).ok).toBe(true);
    expect(await ids()).toContain("my-role");
    const bad = await app.api.handle({
      kind: "roles.save",
      role: { ...mine, id: "evil", actions: ["job.commit_local"] },
    });
    expect(bad.ok === false && bad.errors[0]).toContain("cannot be granted");
    expect((await app.api.handle({ kind: "roles.remove", id: "builder" })).ok).toBe(false);
    expect((await app.api.handle({ kind: "roles.remove", id: "my-role" })).ok).toBe(true);
  });
});

describe("processes the app starts show up and can be stopped", () => {
  it("lists a running check and stops it on request, and the gate then fails", async () => {
    const { app } = await boot(true, "sleep 30");
    const job = await app.jobs.create(factoryBuildPreset, "j1", "t", 3);
    await app.jobs.save({ ...job, stage: "gate", round: 1 });
    await app.jobs.audit({ actor: "system", action: "place", jobId: "j1", detail: "gate" });

    const gate = app.api.handle({
      kind: "action.run",
      actionId: "job.run_gate",
      input: { id: "j1" },
    });
    let listed: { processId: string; label: string; endedAt?: string }[] = [];
    for (let i = 0; i < 100 && listed.length === 0; i++) {
      listed = ((await app.api.handle({ kind: "processes.list" })) as { data: typeof listed }).data;
      if (listed.length === 0) await new Promise((r) => setTimeout(r, 20));
    }
    expect(listed.map((p) => p.label)).toEqual(["checks: sleep 30"]);
    expect(
      await app.api.handle({ kind: "process.kill", processId: listed[0]?.processId ?? "" }),
    ).toEqual({ ok: true, data: null });
    expect(await gate).toEqual({ ok: true, data: { gate: "FAIL" } });
    const after = ((await app.api.handle({ kind: "processes.list" })) as { data: typeof listed })
      .data;
    expect(after[0]?.endedAt).toBeDefined();
    expect((await app.api.handle({ kind: "process.kill", processId: "nope" })).ok).toBe(false);
  });

  it("quitting stops a check that is still running", async () => {
    const { app } = await boot(true, "sleep 30");
    const job = await app.jobs.create(factoryBuildPreset, "j1", "t", 3);
    await app.jobs.save({ ...job, stage: "gate", round: 1 });
    await app.jobs.audit({ actor: "system", action: "place", jobId: "j1", detail: "gate" });
    const gate = app.api.handle({
      kind: "action.run",
      actionId: "job.run_gate",
      input: { id: "j1" },
    });
    for (
      let i = 0;
      i < 100 &&
      ((await app.api.handle({ kind: "processes.list" })) as { data: unknown[] }).data.length === 0;
      i++
    )
      await new Promise((r) => setTimeout(r, 20));
    const started = Date.now();
    await app.shutdown();
    expect(await gate).toEqual({ ok: true, data: { gate: "FAIL" } });
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

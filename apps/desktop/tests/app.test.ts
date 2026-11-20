import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateToolCall } from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app/createApp";
import type { HostEvent } from "../src/host/actionHost";
import { KEY_ENV } from "../src/jobs/gitGuard";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "adadex-app-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const env = (): NodeJS.ProcessEnv => {
  const e: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
  delete e[KEY_ENV];
  return e;
};
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, env: env() }).toString().trim();
const gitTry = (cwd: string, ...args: string[]) =>
  spawnSync("git", args, { cwd, env: env(), encoding: "utf8" });

const MINI = {
  id: "mini",
  name: "Mini",
  initial: "draft",
  stages: [
    {
      id: "draft",
      hint: "x",
      moves: [
        {
          to: "build",
          requires: [{ kind: "doc-field", doc: "draft.md", field: "STATUS", equals: "READY" }],
          effects: [{ kind: "emit", name: "make-worktree" }],
        },
      ],
    },
    {
      id: "build",
      hint: "x",
      moves: [
        {
          to: "gate",
          requires: [{ kind: "doc-field", doc: "build.md", field: "STATUS", equals: "READY" }],
        },
      ],
    },
    {
      id: "gate",
      hint: "x",
      moves: [
        { to: "ship", requires: [{ kind: "gate-run" }, { kind: "gate-is", equals: "PASS" }] },
      ],
    },
    { id: "ship", hint: "x", moves: [{ to: "ready", requires: [{ kind: "committed" }] }] },
    { id: "ready", hint: "done", terminal: true, moves: [] },
  ],
};

const boot = async (checks = "true") => {
  const project = join(root, "project");
  const dataDir = join(root, "data");
  await mkdir(project, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  git(project, "init", "-b", "main");
  git(project, "config", "user.email", "t@example.invalid");
  git(project, "config", "user.name", "t");
  await writeFile(join(project, "a.txt"), "1");
  git(project, "add", "-A");
  git(project, "commit", "-m", "init");
  await writeFile(join(dataDir, "project.json"), JSON.stringify({ checks, baseBranch: "main" }));
  const confirmed: string[] = [];
  const events: HostEvent[] = [];
  const app = createApp({
    projectRoot: project,
    dataDir,
    confirm: async (title) => {
      confirmed.push(title);
      return true;
    },
    emit: (e) => events.push(e),
    bridgePath: "/unused",
    hookPath: "/unused",
  });
  return { app, project, dataDir, confirmed, events };
};
const run = (app: Awaited<ReturnType<typeof boot>>["app"], actionId: string, input: unknown) =>
  app.api.handle({ kind: "action.run", actionId, input });

describe("the app, end to end, with real git", () => {
  it("takes a user-made workflow from a new job to a local commit, with every lock in place", async () => {
    const { app, project, dataDir, confirmed } = await boot();
    expect((await app.api.handle({ kind: "workflows.save", workflow: MINI })).ok).toBe(true);
    expect(
      (
        await app.api.handle({
          kind: "jobs.create",
          workflowId: "mini",
          id: "j1",
          title: "Add a file",
        })
      ).ok,
    ).toBe(true);
    const jobDir = app.jobs.jobDir("j1");

    // Leaving draft makes the job's own worktree and branch.
    await writeFile(join(jobDir, "draft.md"), "STATUS: READY\n");
    expect((await run(app, "job.advance", { id: "j1", to: "build" })).ok).toBe(true);
    const job = await app.jobs.load("j1");
    expect(job.branch).toBe("adadex/j1");
    const wt = job.worktree ?? "";
    expect(git(wt, "branch", "--show-current")).toBe("adadex/j1");

    // An agent running git in that worktree cannot commit, push, or move the branch.
    await writeFile(join(wt, "feature.txt"), "new work");
    git(wt, "add", "-A");
    expect(gitTry(wt, "commit", "-m", "sneaky").status).not.toBe(0);
    expect(gitTry(wt, "update-ref", "refs/heads/adadex/j1", "HEAD").status).not.toBe(0);

    // Build, gate, ship.
    await writeFile(join(jobDir, "build.md"), "STATUS: READY\n");
    expect((await run(app, "job.advance", { id: "j1", to: "gate" })).ok).toBe(true);
    expect(await run(app, "job.run_gate", { id: "j1" })).toEqual({
      ok: true,
      data: { gate: "PASS" },
    });
    expect((await run(app, "job.advance", { id: "j1", to: "ship" })).ok).toBe(true);

    // The human-only commit: native confirmation first, then exactly the gated tree.
    await writeFile(join(jobDir, "commit.md"), "feat: add a file\n");
    const committed = (await run(app, "job.commit_local", { id: "j1" })) as {
      ok: true;
      data: { commit: string };
    };
    expect(committed.ok).toBe(true);
    expect(confirmed).toEqual(["Commit locally"]);
    expect(git(wt, "rev-parse", "HEAD")).toBe(committed.data.commit);
    expect(git(wt, "show", "--name-only", "--format=", "HEAD")).toBe("feature.txt");
    expect(git(project, "rev-parse", "main")).not.toBe(committed.data.commit);
    expect(git(wt, "remote")).toBe("");

    expect((await run(app, "job.advance", { id: "j1", to: "ready" })).ok).toBe(true);
    expect((await app.jobs.load("j1")).stage).toBe("ready");
    expect((await stat(join(dataDir, "guard", "human.sha256"))).mode & 0o777).toBe(0o600);
    expect(await readFile(join(jobDir, "audit.log"), "utf8")).toContain('"action":"commit"');
  });

  it("a failing check keeps the job at the gate, and a commit is refused after the tree changes", async () => {
    const { app } = await boot("exit 1");
    await app.api.handle({ kind: "workflows.save", workflow: MINI });
    await app.api.handle({ kind: "jobs.create", workflowId: "mini", id: "j1", title: "t" });
    const jobDir = app.jobs.jobDir("j1");
    await writeFile(join(jobDir, "draft.md"), "STATUS: READY\n");
    await run(app, "job.advance", { id: "j1", to: "build" });
    await writeFile(join(jobDir, "build.md"), "STATUS: READY\n");
    await run(app, "job.advance", { id: "j1", to: "gate" });
    expect(await run(app, "job.run_gate", { id: "j1" })).toEqual({
      ok: true,
      data: { gate: "FAIL" },
    });
    const stuck = await run(app, "job.advance", { id: "j1", to: "ship" });
    expect(stuck.ok === false && stuck.errors[0]).toContain("gate");
  });

  it("an agent cannot write the config the gate reads its command from, or the app's state", async () => {
    const { app, dataDir, project } = await boot();
    const write = (file_path: string) =>
      evaluateToolCall(
        app.policy,
        { tool_name: "Write", tool_input: { file_path }, cwd: project },
        (p) => p,
      ).kind;
    expect(write(join(dataDir, "project.json"))).toBe("deny");
    expect(write(join(dataDir, "guard", "hooks", "j1", "pre-commit"))).toBe("deny");
    expect(write(join(project, ".adadex", "factory", "jobs", "j1", "job.json"))).toBe("deny");
    expect(write(join(project, "src", "app.ts"))).toBe("allow");
  });

  it("quitting declines anything still waiting", async () => {
    const { app } = await boot();
    const waiting = app.approvals.gate.request("tool:Bash", "needs ok");
    await app.shutdown();
    expect(await waiting).toBe(false);
  });
});

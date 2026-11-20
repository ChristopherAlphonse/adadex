import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { factoryBuildPreset, type WorkflowJob } from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GateConfig, GitPort } from "../src/jobs/gatePorts";
import { createJobExecutor } from "../src/jobs/jobActions";
import { createJobStore } from "../src/jobs/jobStore";
import { nodeCheckRunner, nodeGit } from "../src/jobs/nodeGate";
import { writeGate } from "./helpers/attest";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "adadex-commit-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const config: GateConfig = {
  checks: "true",
  timeoutMs: 5000,
  baseBranch: "main",
  protectedPaths: [],
};

interface Fake {
  tree: string;
  head: string;
  base: string;
  files: string[];
  commitOk: boolean;
  calls: string[];
}
const fakeGit = (f: Fake): GitPort => ({
  changedFiles: async () => f.files,
  fingerprint: async () => f.tree,
  head: async () => f.head,
  mergeBase: async () => f.base,
  stageAll: async () => {
    f.calls.push("add");
  },
  commit: async () => {
    f.calls.push("commit");
    f.head = "newcommit";
    return f.commitOk ? { ok: true, output: "" } : { ok: false, output: "hook said no" };
  },
});

const setup = async (
  over: Partial<Fake> = {},
  doc: { message?: string; gate?: string; tree?: string; stage?: string } = {},
) => {
  const f: Fake = {
    tree: "t1",
    head: "base1",
    base: "base1",
    files: ["src/a.ts"],
    commitOk: true,
    calls: [],
    ...over,
  };
  const store = createJobStore(root);
  const job = await store.create(factoryBuildPreset, "j1", "t", 3);
  await store.save({ ...job, stage: doc.stage ?? "ship", round: 1, worktree: root } as WorkflowJob);
  const dir = store.jobDir("j1");
  await mkdir(join(dir, "round-1"), { recursive: true });
  if (doc.message !== "")
    await writeFile(join(dir, "commit.md"), doc.message ?? "feat: add login\n");
  await writeGate(store, "j1", 1, (doc.gate ?? "PASS") as "PASS" | "FAIL", doc.tree ?? "t1");
  const executor = createJobExecutor({
    store,
    workflows: { factory: factoryBuildPreset },
    runEffect: async () => {},
    actor: () => "human",
    commit: { git: fakeGit(f), config: async () => config, cwdOf: () => root },
  });
  return { f, store, executor };
};
const commit = (e: { execute: (id: string, input: unknown) => Promise<unknown> }) =>
  e.execute("job.commit_local", { id: "j1" });

describe("job.commit_local: every refusal", () => {
  it("commits when everything checks out, and records the commit", async () => {
    const { f, store, executor } = await setup();
    expect(await commit(executor)).toEqual({ commit: "newcommit" });
    expect(f.calls).toEqual(["add", "commit"]);
    expect((await store.load("j1")).commit).toBe("newcommit");
    expect(
      (await store.readAudit("j1")).some((l) => l.actor === "human" && l.action === "commit"),
    ).toBe(true);
  });

  it("refuses a second commit", async () => {
    const { executor } = await setup();
    await commit(executor);
    await expect(commit(executor)).rejects.toThrow("already committed");
  });

  it("refuses at a stage that does not commit", async () => {
    const { executor, f } = await setup({}, { stage: "build" });
    await expect(commit(executor)).rejects.toThrow("does not commit");
    expect(f.calls).toEqual([]);
  });

  it("refuses with no commit message", async () => {
    const { executor } = await setup({}, { message: "" });
    await expect(commit(executor)).rejects.toThrow("commit.md missing or empty");
  });

  it("refuses without a passing gate", async () => {
    const { executor } = await setup({}, { gate: "FAIL" });
    await expect(commit(executor)).rejects.toThrow("no passing gate");
  });

  it("refuses when the tree changed after the gate", async () => {
    const { executor, f } = await setup({ tree: "edited-after" });
    await expect(commit(executor)).rejects.toThrow("working tree changed since the gate passed");
    expect(f.calls).toEqual([]);
  });

  it("refuses when someone committed on the job's branch behind the app's back", async () => {
    const { executor, f } = await setup({ head: "sneaky" });
    await expect(commit(executor)).rejects.toThrow(
      "commits on the job's branch that the app did not make",
    );
    expect(f.calls).toEqual([]);
  });

  it("refuses a protected path, and surfaces a git refusal", async () => {
    const protectedRun = await setup({ files: [".github/workflows/ci.yml"] });
    await expect(commit(protectedRun.executor)).rejects.toThrow(
      "protected paths touched: .github/workflows/ci.yml",
    );
  });

  it("reports why git refused, and records no commit", async () => {
    const { executor, store } = await setup({ commitOk: false });
    await expect(commit(executor)).rejects.toThrow("git commit refused: hook said no");
    expect((await store.load("j1")).commit).toBeNull();
  });
});

describe("job.commit_local with real git", () => {
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", args, {
      cwd,
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    })
      .toString()
      .trim();

  const repo = async () => {
    const work = join(root, "work");
    await mkdir(work, { recursive: true });
    git(work, "init", "-b", "main");
    git(work, "config", "user.email", "t@example.invalid");
    git(work, "config", "user.name", "t");
    await writeFile(join(work, "a.txt"), "1");
    git(work, "add", "-A");
    git(work, "commit", "-m", "init");
    git(work, "switch", "-c", "feature");
    const store = createJobStore(join(root, "state"));
    const job = await store.create(factoryBuildPreset, "j1", "t", 3);
    await store.save({ ...job, stage: "ship", round: 1, worktree: root } as WorkflowJob);
    await writeFile(join(store.jobDir("j1"), "commit.md"), "feat: real commit\n");
    const executor = createJobExecutor({
      store,
      workflows: { factory: factoryBuildPreset },
      runEffect: async () => {},
      actor: () => "human",
      gate: {
        runner: nodeCheckRunner,
        git: nodeGit,
        config: async () => config,
        cwdOf: () => work,
      },
      commit: { git: nodeGit, config: async () => config, cwdOf: () => work },
    });
    return { work, store, executor };
  };

  it("commits exactly what the gate checked, and leaves no remote and no push", async () => {
    const { work, store, executor } = await repo();
    await writeFile(join(work, "a.txt"), "2");
    await writeFile(join(work, "new.txt"), "n");
    const tree = await nodeGit.fingerprint(work);
    await writeGate(store, "j1", 1, "PASS", tree);
    const { commit: sha } = (await commit(executor)) as { commit: string };
    expect(git(work, "rev-parse", "HEAD")).toBe(sha);
    expect(git(work, "log", "-1", "--format=%s")).toBe("feat: real commit");
    expect(git(work, "show", "--name-only", "--format=", "HEAD").split("\n").sort()).toEqual([
      "a.txt",
      "new.txt",
    ]);
    expect(git(work, "remote")).toBe("");
    expect(git(work, "for-each-ref", "refs/remotes")).toBe("");
  });

  it("refuses when an untracked file was edited after the gate", async () => {
    const { work, store, executor } = await repo();
    await writeFile(join(work, "new.txt"), "before");
    const tree = await nodeGit.fingerprint(work);
    await writeGate(store, "j1", 1, "PASS", tree);
    await writeFile(join(work, "new.txt"), "after the gate");
    await expect(commit(executor)).rejects.toThrow("working tree changed since the gate passed");
    expect(git(work, "log", "--oneline").split("\n")).toHaveLength(1);
  });
});

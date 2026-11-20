import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { factoryBuildPreset, type WorkflowJob } from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CheckResult, GateConfig } from "../src/jobs/gatePorts";
import { createJobExecutor } from "../src/jobs/jobActions";
import { createJobStore } from "../src/jobs/jobStore";
import { nodeCheckRunner, nodeGit } from "../src/jobs/nodeGate";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "adadex-gate-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const baseConfig: GateConfig = {
  checks: "npm test",
  timeoutMs: 5000,
  baseBranch: "main",
  protectedPaths: [],
};

const setup = async (
  over: {
    result?: CheckResult;
    files?: string[];
    config?: Partial<GateConfig>;
    stage?: string;
  } = {},
) => {
  const store = createJobStore(root);
  const job = await store.create(factoryBuildPreset, "j1", "t", 3);
  await store.save(/* SAFETY: preceding checks establish the invariant this assertion encodes. */ { ...job, stage: over.stage ?? "gate", round: 1 } as WorkflowJob);
  const commands: string[] = [];

  const executor = createJobExecutor({
    store,
    workflows: { factory: factoryBuildPreset },
    runEffect: async () => {},
    actor: () => "agent",
    gate: {
      runner: {
        run: async (c) => {
          commands.push(c);

          return over.result ?? { code: 0, timedOut: false, output: "all good" };
        },
      },
      git: {
        changedFiles: async () => over.files ?? ["src/app.ts"],
        fingerprint: async () => "abc123",
        head: async () => "h",
        mergeBase: async () => "h",
        stageAll: async () => {},
        commit: async () => ({ ok: true, output: "" }),
      },
      config: async () => ({ ...baseConfig, ...over.config }),
      cwdOf: () => root,
    },
  });

  return { store, executor, commands };
};

const checks = async (store: { jobDir: (id: string) => string }) =>
  readFile(join(store.jobDir("j1"), "round-1", "checks.md"), "utf8");

describe("job.run_gate", () => {
  it("runs the checks and records PASS where the engine reads it", async () => {
    const { store, executor, commands } = await setup();
    expect(await executor.execute("job.run_gate", { id: "j1" })).toEqual({ gate: "PASS" });
    expect(commands).toEqual(["npm test"]);
    const text = await checks(store);
    expect(text).toContain("GATE: PASS");
    expect(text).toContain("TREE: abc123");
    expect(text).toContain("$ npm test\nall good");
  });

  it("records FAIL on a failing command, and the failure lets the job rebuild", async () => {
    const { executor } = await setup({ result: { code: 1, timedOut: false, output: "1 failed" } });
    expect(await executor.execute("job.run_gate", { id: "j1" })).toEqual({ gate: "FAIL" });
    expect(await executor.execute("job.advance", { id: "j1", to: "build" })).toMatchObject({
      stage: "build",
      round: 2,
    });
  });

  it("a passing gate lets the job go to review, and not back to build", async () => {
    const { executor } = await setup();
    await executor.execute("job.run_gate", { id: "j1" });
    await expect(executor.execute("job.advance", { id: "j1", to: "build" })).rejects.toThrow(
      "gate passed, nothing to rebuild",
    );
    expect(await executor.execute("job.advance", { id: "j1", to: "review" })).toMatchObject({
      stage: "review",
    });
  });

  it("fails without running anything when a protected file was touched", async () => {
    const { store, executor, commands } = await setup({
      files: ["src/app.ts", ".github/workflows/ci.yml", ".env"],
    });

    expect(await executor.execute("job.run_gate", { id: "j1" })).toEqual({
      gate: "FAIL",
      reason: "protected paths touched: .github/workflows/ci.yml, .env",
    });
    expect(commands).toEqual([]);
    expect(await checks(store)).toContain("REASON: protected paths touched");
  });

  it("also protects patterns the project adds", async () => {
    const { executor } = await setup({
      files: ["deploy/prod.yml"],
      config: { protectedPaths: ["deploy/**"] },
    });

    expect(await executor.execute("job.run_gate", { id: "j1" })).toMatchObject({ gate: "FAIL" });
  });

  it("fails with a reason on a timeout", async () => {
    const { executor } = await setup({
      result: { code: null, timedOut: true, output: "" },
      config: { timeoutMs: 2000 },
    });

    expect(await executor.execute("job.run_gate", { id: "j1" })).toEqual({
      gate: "FAIL",
      reason: "checks timed out after 2s",
    });
  });

  it("refuses when the stage has no gate", async () => {
    const { executor } = await setup({ stage: "build" });
    await expect(executor.execute("job.run_gate", { id: "j1" })).rejects.toThrow("has no gate");
  });

  it("refuses when no checks are configured", async () => {
    const { executor } = await setup({ config: { checks: "  " } });
    await expect(executor.execute("job.run_gate", { id: "j1" })).rejects.toThrow("set `checks`");
  });

  it("audits every gate run", async () => {
    const { store, executor } = await setup();
    await executor.execute("job.run_gate", { id: "j1" });
    expect((await store.readAudit("j1")).map((l) => l.action)).toContain("gate");
  });
});

describe("nodeCheckRunner", () => {
  it("reports the exit code and the output", async () => {
    expect(await nodeCheckRunner.run("echo hi; exit 0", root, 5000)).toEqual({
      code: 0,
      timedOut: false,
      output: "hi\n",
    });
    const fail = await nodeCheckRunner.run("echo oops >&2; exit 3", root, 5000);
    expect(fail.code).toBe(3);
    expect(fail.output).toContain("oops");
  });

  it("kills the command and what it started when it runs too long", async () => {
    const started = Date.now();
    const r = await nodeCheckRunner.run("sleep 30 & sleep 30", root, 150);
    expect(r.timedOut).toBe(true);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("keeps only the tail of long output", async () => {
    const r = await nodeCheckRunner.run("yes line | head -c 20000", root, 5000);
    expect(r.output.length).toBe(4000);
  });
});

describe("nodeGit", () => {
  it("lists committed, edited and new files, and fingerprints the tree", async () => {
    const run = (...args: string[]) =>
      execFileSync("git", args, {
        cwd: root,
        env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
      });

    run("init", "-b", "main");
    run("config", "user.email", "t@example.invalid");
    run("config", "user.name", "t");
    await writeFile(join(root, "a.txt"), "1");
    run("add", "-A");
    run("commit", "-m", "init");
    run("switch", "-c", "feature");
    await mkdir(join(root, ".github"), { recursive: true });
    await writeFile(join(root, ".github", "ci.yml"), "x");
    run("add", "-A");
    run("commit", "-m", "ci");
    await writeFile(join(root, "a.txt"), "2");
    await writeFile(join(root, "new.txt"), "n");
    expect([...(await nodeGit.changedFiles(root, "main"))].sort()).toEqual([
      ".github/ci.yml",
      "a.txt",
      "new.txt",
    ]);
    const before = await nodeGit.fingerprint(root);
    await writeFile(join(root, "a.txt"), "3");
    expect(await nodeGit.fingerprint(root)).not.toBe(before);
  });
});

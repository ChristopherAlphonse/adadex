import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRESET_ROLES, type WorkflowJob } from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildProfile,
  defaultDenyRead,
  gitDirOf,
  regexEscape,
  type SandboxPlan,
  sandboxAvailable,
  sandboxSpawn,
} from "../src/agents/sandbox";
import { sandboxPlan } from "../src/runs/roleRunner";

let root: string;
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "adadex-sandbox-")));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const role = (id: string) => {
  const r = PRESET_ROLES.find((x) => x.id === id);
  if (!r) throw new Error(id);
  return r;
};
const job = (over: Partial<WorkflowJob> = {}): WorkflowJob => ({
  id: "j1",
  title: "t",
  workflowId: "factory",
  stage: "build",
  round: 1,
  roundLimit: 3,
  reviewers: [],
  flags: {},
  approvals: {},
  commit: null,
  ...over,
});

describe("sandbox profile", () => {
  const plan: SandboxPlan = {
    writable: ["/a b"],
    denyWrite: ["/a b/keep"],
    denyWriteRegex: ["^/a b/x\\.md$"],
    denyRead: ["/secret"],
  };

  it("starts open, closes writes, opens the writable folders, then closes the protected files, in that order", () => {
    const lines = buildProfile(plan).split("\n");
    expect(lines[0]).toBe("(version 1)");
    expect(lines.indexOf("(deny file-write*)")).toBeLessThan(
      lines.findIndex((l) => l.startsWith("(allow file-write*")),
    );
    expect(lines.findIndex((l) => l.startsWith("(allow file-write*"))).toBeLessThan(
      lines.findIndex((l) => l.includes("literal")),
    );
    expect(buildProfile(plan)).toContain('(deny file-read* (subpath "/secret"))');
  });

  it("refuses a path that could break out of the profile", () => {
    expect(() => buildProfile({ ...plan, writable: ['/x")(allow default'] })).toThrow(
      "cannot go in a sandbox profile",
    );
    expect(() => buildProfile({ ...plan, denyRead: ["/x\n(allow default)"] })).toThrow();
  });

  it("runs the agent through sandbox-exec with the profile first", () => {
    let seen: { command: string; args: readonly string[] } | undefined;
    sandboxSpawn((command, args) => {
      seen = { command, args };
      return { stdout: null as never, onExit: () => {}, kill: () => {} };
    }, "P")("claude", ["-p", "hi"], "/w");
    expect(seen).toEqual({
      command: "/usr/bin/sandbox-exec",
      args: ["-p", "P", "claude", "-p", "hi"],
    });
  });

  it("keeps credentials out of reach by default", () => {
    const denied = defaultDenyRead("/home/me");
    expect(denied).toContain("/home/me/.ssh");
    expect(denied).toContain("/home/me/.aws");
  });

  it("escapes a path for use in a pattern", () => {
    expect(regexEscape("/a.b/(c)")).toBe("/a\\.b/\\(c\\)");
  });
});

describe("what each role may write", () => {
  it("a builder may write its worktree, its git folder and its job folder, and may not touch the commit lock", async () => {
    const wt = join(root, "project", ".adadex", "worktrees", "j1");
    const gitdir = join(root, "project", ".git", "worktrees", "j1");
    await mkdir(wt, { recursive: true });
    await mkdir(gitdir, { recursive: true });
    await writeFile(join(wt, ".git"), `gitdir: ${gitdir}\n`);
    expect(gitDirOf(wt)).toBe(gitdir);
    const plan = sandboxPlan(
      role("builder"),
      job({ worktree: wt }),
      join(root, "state", "jobs", "j1"),
      wt,
      [join(root, "data")],
    );
    expect(plan.writable).toEqual(
      expect.arrayContaining([join(root, "state", "jobs", "j1"), wt, gitdir]),
    );
    expect(plan.denyWrite).toEqual(
      expect.arrayContaining([
        join(root, "state", "jobs", "j1", "job.json"),
        join(wt, ".git"),
        join(gitdir, "config"),
        join(gitdir, "config.worktree"),
      ]),
    );
    expect(plan.denyRead).toEqual([join(root, "data")]);
  });

  it("a reviewer may write its job folder and nothing in the code", () => {
    const plan = sandboxPlan(
      role("reviewer"),
      job(),
      join(root, "jobs", "j1"),
      join(root, "wt"),
      [],
    );
    expect(plan.writable).toEqual([join(root, "jobs", "j1")]);
  });
});

const run = (plan: SandboxPlan, command: string) =>
  spawnSync("/usr/bin/sandbox-exec", ["-p", buildProfile(plan), "sh", "-c", command], {
    encoding: "utf8",
  });

describe.skipIf(!sandboxAvailable())("the real operating system sandbox", () => {
  const setup = async () => {
    const jobDir = join(root, "state", "jobs", "j1");
    const wt = join(root, "project", ".adadex", "worktrees", "j1");
    const gitdir = join(root, "project", ".git", "worktrees", "j1");
    const data = join(root, "data");
    for (const d of [jobDir, join(jobDir, "round-1"), wt, gitdir, data])
      await mkdir(d, { recursive: true });
    await writeFile(join(wt, ".git"), `gitdir: ${gitdir}\n`);
    await writeFile(join(gitdir, "config.worktree"), "[core]\n\thooksPath = /guarded\n");
    await writeFile(join(data, "adadex.db"), "secret");
    await writeFile(join(jobDir, "job.json"), "{}");
    const plan = (r: string) => sandboxPlan(role(r), job({ worktree: wt }), jobDir, wt, [data]);
    return { jobDir, wt, gitdir, data, plan };
  };

  it("lets a builder write code and its notes, and blocks everything an allowed program could try elsewhere", async () => {
    const { jobDir, wt, gitdir, data, plan } = await setup();
    const p = plan("builder");
    expect(run(p, `echo x > ${wt}/a.ts && echo y > ${jobDir}/build.md`).status).toBe(0);
    for (const blocked of [
      `echo x > ${root}/outside.txt`,
      `echo x > ${jobDir}/job.json`,
      `echo x > ${jobDir}/round-1/checks.md`,
      `echo x > ${gitdir}/config.worktree`,
      `echo x > ${gitdir}/config`,
      `echo x > ${wt}/.git`,
      `echo x > ${data}/adadex.db`,
    ]) {
      expect(run(p, blocked).status, blocked).not.toBe(0);
    }
    expect(await readFile(join(gitdir, "config.worktree"), "utf8")).toContain(
      "hooksPath = /guarded",
    );
    expect(await readFile(join(jobDir, "job.json"), "utf8")).toBe("{}");
  });

  it("keeps the app's data folder unreadable, so logs and keys cannot be read even with an allowed cat", async () => {
    const { data, plan } = await setup();
    expect(run(plan("builder"), `cat ${data}/adadex.db`).status).not.toBe(0);
    expect(run(plan("builder"), `ls ${data}`).status).not.toBe(0);
  });

  it("a reviewer cannot write code at all, but can write its job folder", async () => {
    const { jobDir, wt, plan } = await setup();
    const p = plan("reviewer");
    expect(run(p, `echo x > ${wt}/a.ts`).status).not.toBe(0);
    expect(run(p, `echo v > ${jobDir}/round-1/review-code.md`).status).toBe(0);
    expect(run(p, `echo v > ${jobDir}/round-1/checks.md`).status).not.toBe(0);
  });

  it("can still read the code and run ordinary commands", async () => {
    const { wt, plan } = await setup();
    await writeFile(join(wt, "a.ts"), "hello");
    const r = run(plan("reviewer"), `cat ${wt}/a.ts`);
    expect(r.stdout).toBe("hello");
  });
});

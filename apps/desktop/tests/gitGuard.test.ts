import { execFileSync, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BUILD_POLICY, evaluateToolCall } from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { withProtectedLocations } from "../src/host/protectedLocations";
import { createHumanKey, installGitGuard, KEY_ENV } from "../src/jobs/gitGuard";
import { nodeGit } from "../src/jobs/nodeGate";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "adadex-hooks-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const cleanEnv = () => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };

  delete env[KEY_ENV];

  return env;
};

const git = (cwd: string, args: string[], env: NodeJS.ProcessEnv = cleanEnv()) =>
  spawnSync("git", args, { cwd, env, encoding: "utf8" });

const must = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, env: cleanEnv() }).toString().trim();

const setup = async (repoHook?: string) => {
  const repo = join(root, "repo");
  await mkdir(repo, { recursive: true });
  must(repo, "init", "-b", "main");
  must(repo, "config", "user.email", "t@example.invalid");
  must(repo, "config", "user.name", "t");
  await writeFile(join(repo, "a.txt"), "1");
  must(repo, "add", "-A");
  must(repo, "commit", "-m", "init");

  if (repoHook !== undefined) {
    await writeFile(join(repo, ".git", "hooks", "pre-commit"), repoHook);
    await chmod(join(repo, ".git", "hooks", "pre-commit"), 0o755);
  }

  const wt = join(root, "wt");
  must(repo, "worktree", "add", "-b", "adadex/j1", wt);
  const key = createHumanKey();
  const hooksDir = join(root, "state", "hooks");
  const hashFile = join(root, "state", "human.sha256");
  await installGitGuard({
    worktree: wt,
    hooksDir,
    hashFile,
    hash: key.hash,
    branchPrefix: "adadex/",
  });
  const bare = join(root, "remote.git");
  must(root, "init", "--bare", bare);
  must(wt, "remote", "add", "origin", bare);

  return { repo, wt, key, hashFile };
};

describe("git guard", () => {
  it("blocks a commit with no key and with a wrong key, and lets the real key through", async () => {
    const { wt, key } = await setup();
    await writeFile(join(wt, "a.txt"), "2");
    must(wt, "add", "-A");
    const none = git(wt, ["commit", "-m", "x"]);
    expect(none.status).not.toBe(0);
    expect(none.stderr).toContain("needs a person to press the button");
    expect(git(wt, ["commit", "-m", "x"], { ...cleanEnv(), [KEY_ENV]: "guess" }).status).not.toBe(
      0,
    );
    expect(git(wt, ["commit", "-m", "x"], { ...cleanEnv(), [KEY_ENV]: key.key }).status).toBe(0);
    expect(must(wt, "log", "-1", "--format=%s")).toBe("x");
  });

  it("blocks a push with no key, so work cannot leave the machine even if a shell gets through", async () => {
    const { wt, key } = await setup();
    const blocked = git(wt, ["push", "origin", "adadex/j1"]);
    expect(blocked.status).not.toBe(0);
    expect(must(root, "--git-dir", join(root, "remote.git"), "for-each-ref")).toBe("");
    void key;
  });

  it("blocks moving the job's branch without the key (update-ref, reset, amend), and allows other branches", async () => {
    const { wt, key } = await setup();
    expect(git(wt, ["update-ref", "refs/heads/adadex/j1", "HEAD"]).status).not.toBe(0);
    expect(git(wt, ["update-ref", "refs/heads/other", "HEAD"]).status).toBe(0);
    expect(
      git(wt, ["update-ref", "refs/heads/adadex/j1", "HEAD"], { ...cleanEnv(), [KEY_ENV]: key.key })
        .status,
    ).toBe(0);
  });

  it("still runs the repo's own pre-commit hook, and a failing one still blocks the human's commit", async () => {
    const pass = await setup('#!/bin/sh\necho ran > "$(git rev-parse --git-dir)/hook-ran"\n');
    await writeFile(join(pass.wt, "a.txt"), "2");
    must(pass.wt, "add", "-A");
    expect(
      git(pass.wt, ["commit", "-m", "x"], { ...cleanEnv(), [KEY_ENV]: pass.key.key }).status,
    ).toBe(0);
    const marker = must(pass.wt, "rev-parse", "--git-dir");
    expect(await readFile(join(marker, "hook-ran"), "utf8").catch(() => "")).toBe("ran\n");
  });

  it("a repo hook that fails blocks the commit even with the key", async () => {
    const { wt, key } = await setup("#!/bin/sh\necho lint failed >&2\nexit 1\n");
    await writeFile(join(wt, "a.txt"), "2");
    must(wt, "add", "-A");
    const r = git(wt, ["commit", "-m", "x"], { ...cleanEnv(), [KEY_ENV]: key.key });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("lint failed");
  });

  it("keeps the hash private to the owner and never writes the key itself", async () => {
    const { hashFile, key } = await setup();
    expect((await stat(hashFile)).mode & 0o777).toBe(0o600);
    expect(await readFile(hashFile, "utf8")).toBe(`${key.hash}\n`);
    expect(await readFile(hashFile, "utf8")).not.toContain(key.key);
  });

  it("the app's own commit (with the key only on that call) goes through nodeGit", async () => {
    const { wt, key } = await setup();
    await writeFile(join(wt, "msg.txt"), "feat: from the app\n");
    await writeFile(join(wt, "a.txt"), "3");
    await nodeGit.stageAll(wt);
    const noKey = await nodeGit.commit(wt, join(wt, "msg.txt"));
    expect(noKey.ok).toBe(false);
    const withKey = await nodeGit.commit(wt, join(wt, "msg.txt"), { [KEY_ENV]: key.key });
    expect(withKey.ok).toBe(true);
    expect(must(wt, "log", "-1", "--format=%s")).toBe("feat: from the app");
  });
});

describe("protected locations", () => {
  it("denies an agent writing the config the gate reads its checks command from", () => {
    const policy = withProtectedLocations(BUILD_POLICY, [
      "/home/me/.adadex/machine.json",
      "/home/me/.adadex/state",
    ]);

    const write = (p: string) =>
      evaluateToolCall(
        policy,
        { tool_name: "Write", tool_input: { file_path: p }, cwd: "/x" },
        (r) => r,
      ).kind;

    expect(write("/home/me/.adadex/machine.json")).toBe("deny");
    expect(write("/home/me/.adadex/state/hooks/pre-commit")).toBe("deny");
    expect(write("/home/me/project/src/app.ts")).toBe("allow");
  });
});

import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { CheckRunner, GitPort } from "./gatePorts";

const run = promisify(execFile);
const TAIL = 4000;

/** Runs the check command through the shell in its own process group, and kills the whole group on timeout. */
export const nodeCheckRunner: CheckRunner = {
  run: (command, cwd, timeoutMs, onStart) =>
    new Promise((resolve) => {
      const child = spawn("sh", ["-c", command], {
        cwd,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      onStart?.(() => {
        try {
          if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
        } catch {
          // Already gone.
        }
      });
      let output = "";
      let timedOut = false;
      const take = (chunk: Buffer) => {
        output = (output + chunk.toString()).slice(-TAIL);
      };
      child.stdout.on("data", take);
      child.stderr.on("data", take);
      const timer = setTimeout(() => {
        timedOut = true;
        try {
          if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
        } catch {
          // Already gone.
        }
      }, timeoutMs);
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ code: timedOut ? null : code, timedOut, output });
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        resolve({ code: null, timedOut: false, output: String(e.message) });
      });
    }),
};

const git = async (cwd: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> =>
  (await run("git", args, { cwd, env: env ?? process.env, maxBuffer: 16 * 1024 * 1024 })).stdout;
const lines = (text: string): string[] => text.split("\n").filter((l) => l !== "");

export const nodeGit: GitPort = {
  async changedFiles(cwd, base) {
    const committed = await git(cwd, ["diff", "--name-only", `${base}...HEAD`]).catch(() => "");
    const working = await git(cwd, ["diff", "--name-only", "HEAD"]).catch(() => "");
    const untracked = await git(cwd, ["ls-files", "--others", "--exclude-standard"]).catch(
      () => "",
    );
    return [...new Set([...lines(committed), ...lines(working), ...lines(untracked)])];
  },
  /** Hash the working tree through a scratch index, so the real index is never touched. */
  async fingerprint(cwd) {
    const dir = await mkdtemp(join(tmpdir(), "adadex-index-"));
    const env = { ...process.env, GIT_INDEX_FILE: join(dir, "index") };
    try {
      await git(cwd, ["read-tree", "HEAD"], env);
      await git(cwd, ["add", "-A"], env);
      return (await git(cwd, ["write-tree"], env)).trim();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
  async head(cwd) {
    return (await git(cwd, ["rev-parse", "HEAD"])).trim();
  },
  async mergeBase(cwd, base) {
    return (await git(cwd, ["merge-base", "HEAD", base])).trim();
  },
  async stageAll(cwd) {
    await git(cwd, ["add", "-A"]);
  },
  async commit(cwd, messageFile, env) {
    try {
      await git(cwd, ["commit", "-F", messageFile], env ? { ...process.env, ...env } : undefined);
      return { ok: true, output: "" };
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string; message?: string };
      return {
        ok: false,
        output: `${err.stdout ?? ""}${err.stderr ?? ""}`.trim().slice(-600) || String(err.message),
      };
    }
  },
};

import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import type { CheckRunner, GitPort } from "./gatePorts";

const run = promisify(execFile);
const TAIL = 4000;

/** Runs the check command through the shell in its own process group, and kills the whole group on timeout. */
export const nodeCheckRunner: CheckRunner = {
  run: (command, cwd, timeoutMs) =>
    new Promise((resolve) => {
      const child = spawn("sh", ["-c", command], {
        cwd,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
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

const git = async (cwd: string, args: string[]): Promise<string> =>
  (await run("git", args, { cwd, maxBuffer: 16 * 1024 * 1024 })).stdout;
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
  async fingerprint(cwd) {
    const head = await git(cwd, ["rev-parse", "HEAD"]).catch(() => "none");
    const diff = await git(cwd, ["diff", "HEAD"]).catch(() => "");
    const untracked = await git(cwd, ["ls-files", "--others", "--exclude-standard"]).catch(
      () => "",
    );
    return createHash("sha256")
      .update(head)
      .update(diff)
      .update(untracked)
      .digest("hex")
      .slice(0, 16);
  },
};

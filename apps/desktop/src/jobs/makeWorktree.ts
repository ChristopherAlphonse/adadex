import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { WorkflowJob } from "@adadex/core";

import { installGitGuard } from "./gitGuard";

const run = promisify(execFile);

export interface MakeWorktree {
  readonly projectRoot: string;
  /** Folder for generated hooks and the key hash. Must be outside every worktree. */
  readonly guardDir: string;
  readonly hash: string;
  readonly baseBranch: string;
  readonly branchPrefix: string;
}

/**
 * Give a job its own worktree on its own branch, with the commit and push lock installed before an agent can
 * touch it. Returns the path and branch so they can be saved on the job.
 */
export const makeWorktree = async (
  o: MakeWorktree,
  job: WorkflowJob,
): Promise<{ worktree: string; branch: string }> => {
  if (job.worktree !== undefined) return { worktree: job.worktree, branch: job.branch ?? "" };
  const branch = `${o.branchPrefix}${job.id}`;
  const worktree = join(o.projectRoot, ".adadex", "worktrees", job.id);
  await mkdir(join(o.projectRoot, ".adadex", "worktrees"), { recursive: true });
  await run("git", ["worktree", "add", "-b", branch, worktree, o.baseBranch], {
    cwd: o.projectRoot,
  });
  await installGitGuard({
    worktree,
    hooksDir: join(o.guardDir, "hooks", job.id),
    hashFile: join(o.guardDir, "human.sha256"),
    hash: o.hash,
    branchPrefix: o.branchPrefix,
  });
  return { worktree, branch };
};

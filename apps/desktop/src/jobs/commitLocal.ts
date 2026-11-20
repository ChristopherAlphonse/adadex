import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  findProtectedHits,
  PROTECTED_FLOOR,
  stageOf,
  type WorkflowDefinition,
  type WorkflowJob,
} from "@adadex/core";
import { attestedGate } from "./attestedGate";
import type { GateConfig, GitPort } from "./gatePorts";
import { KEY_ENV } from "./gitGuard";
import type { JobStore } from "./jobStore";
import { findWorkflow, type WorkflowLookup } from "./workflowLookup";

export interface CommitDeps {
  readonly store: JobStore;
  readonly workflows: WorkflowLookup;
  readonly git: GitPort;
  readonly config: () => Promise<GateConfig>;
  readonly cwdOf: (job: WorkflowJob) => string;
  /** The human key, so the commit hook lets this one commit through. Only this git call gets it. */
  readonly humanKey?: string;
}

/** A stage may commit when one of its moves needs a commit to have been made. */
const hasCommitMove = (def: WorkflowDefinition, stageId: string): boolean =>
  stageOf(def, stageId)?.moves.some((m) => m.requires?.some((c) => c.kind === "committed")) ??
  false;

const text = (path: string): Promise<string | null> => readFile(path, "utf8").catch(() => null);

/**
 * Commit a job's work locally, and nothing else. Runs only after a human click (the action host makes sure).
 * It commits exactly what the gate checked, in the job's own folder, and has no way to push.
 */
export const commitLocal = async (deps: CommitDeps, jobId: string): Promise<{ commit: string }> => {
  const job = await deps.store.load(jobId);
  const def = await findWorkflow(deps.workflows, job.workflowId);
  if (!hasCommitMove(def, job.stage))
    throw new Error(`${job.id} is at ${job.stage}, which does not commit`);
  if (job.commit !== null) throw new Error("already committed");

  const dir = deps.store.jobDir(job.id);
  const message = await text(join(dir, "commit.md"));
  if (message === null || message.trim() === "") throw new Error("commit.md missing or empty");

  const cwd = deps.cwdOf(job);
  const config = await deps.config();
  const gate = await attestedGate(deps.store, job);
  if (gate?.gate !== "PASS") throw new Error("no passing gate in this round");
  if (gate.tree !== (await deps.git.fingerprint(cwd))) {
    throw new Error("working tree changed since the gate passed, rerun the gate");
  }

  const head = await deps.git.head(cwd);
  if (head !== (await deps.git.mergeBase(cwd, config.baseBranch))) {
    throw new Error("commits on the job's branch that the app did not make");
  }
  const hits = findProtectedHits(await deps.git.changedFiles(cwd, config.baseBranch), [
    ...PROTECTED_FLOOR,
    ...config.protectedPaths,
  ]);
  if (hits.length > 0) throw new Error(`protected paths touched: ${hits.join(", ")}`);

  await deps.git.stageAll(cwd);
  const result = await deps.git.commit(
    cwd,
    join(dir, "commit.md"),
    deps.humanKey === undefined ? undefined : { [KEY_ENV]: deps.humanKey },
  );
  if (!result.ok) throw new Error(`git commit refused: ${result.output}`);

  const commit = await deps.git.head(cwd);
  await deps.store.save({ ...job, commit });
  await deps.store.audit({ actor: "human", action: "commit", jobId: job.id, detail: commit });
  return { commit };
};

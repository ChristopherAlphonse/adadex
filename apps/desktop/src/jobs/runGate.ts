import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  findProtectedHits,
  PROTECTED_FLOOR,
  stageOf,
  type WorkflowDefinition,
  type WorkflowJob,
} from "@adadex/core";

import type { CheckRunner, GateConfig, GitPort } from "./gatePorts";
import type { JobStore } from "./jobStore";
import { findWorkflow, type WorkflowLookup } from "./workflowLookup";

export interface GateDeps {
  readonly store: JobStore;
  readonly workflows: WorkflowLookup;
  readonly runner: CheckRunner;
  readonly git: GitPort;
  readonly config: () => Promise<GateConfig>;
  /** Where the job's code lives: its worktree, or the project root. */
  readonly cwdOf: (job: WorkflowJob) => string;
  /** Paths to leave out of the changed-file check for this folder: the app's own state, when the folder is the project root. */
  readonly ignore?: (cwd: string) => readonly string[];
  readonly actor: "human" | "agent";
}

export interface GateResult {
  readonly gate: "PASS" | "FAIL";
  readonly reason?: string;
}

/** A stage may run the gate when one of its moves looks at the gate result. */
const hasGateMove = (def: WorkflowDefinition, stageId: string): boolean =>
  stageOf(def, stageId)?.moves.some((m) =>
    m.requires?.some((c) => c.kind === "gate-run" || c.kind === "gate-is"),
  ) ?? false;

const record = async (
  deps: GateDeps,
  job: WorkflowJob,
  result: GateResult,
  tree: string,
  tail: string,
): Promise<GateResult> => {
  const dir = join(deps.store.jobDir(job.id), `round-${job.round}`);
  await mkdir(dir, { recursive: true });
  const head = `GATE: ${result.gate}\nTREE: ${tree}\n${result.reason ? `REASON: ${result.reason}\n` : ""}`;
  await writeFile(join(dir, "checks.md"), `${head}\n${tail}\n`);
  await deps.store.audit({
    actor: deps.actor,
    action: "gate",
    jobId: job.id,
    detail: result.gate + (result.reason ? ` (${result.reason})` : ""),
    data: { round: job.round, gate: result.gate, tree },
  });
  return result;
};

/**
 * Run the project's checks for a job and record the result where the engine reads it. A change that touches a
 * protected file fails the gate without running anything, so a build cannot loosen its own checks.
 */
export const runGate = async (deps: GateDeps, jobId: string): Promise<GateResult> => {
  const job = await deps.store.load(jobId);
  const def = await findWorkflow(deps.workflows, job.workflowId);
  if (!hasGateMove(def, job.stage)) throw new Error(`${job.id} is ${job.stage}, which has no gate`);

  const config = await deps.config();
  if (config.checks.trim() === "") throw new Error("set `checks` in the project config");
  const cwd = deps.cwdOf(job);
  const tree = await deps.git.fingerprint(cwd);

  const changed = await deps.git.changedFiles(cwd, config.baseBranch);
  const own = new Set(findProtectedHits(changed, deps.ignore?.(cwd) ?? []));
  const hits = findProtectedHits(
    changed.filter((f) => !own.has(f)),
    [...PROTECTED_FLOOR, ...config.protectedPaths],
  );
  if (hits.length > 0) {
    return record(
      deps,
      job,
      { gate: "FAIL", reason: `protected paths touched: ${hits.join(", ")}` },
      tree,
      "",
    );
  }

  const r = await deps.runner.run(config.checks, cwd, config.timeoutMs);
  const tail = `$ ${config.checks}\n${r.output}`;
  if (r.timedOut) {
    return record(
      deps,
      job,
      { gate: "FAIL", reason: `checks timed out after ${Math.round(config.timeoutMs / 1000)}s` },
      tree,
      tail,
    );
  }
  return record(deps, job, { gate: r.code === 0 ? "PASS" : "FAIL" }, tree, tail);
};

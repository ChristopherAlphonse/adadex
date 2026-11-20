import {
  type ActionExecutor,
  advanceJob,
  approve,
  NEEDS_HUMAN,
  type WorkflowDefinition,
  type WorkflowJob,
} from "@adadex/core";
import type { JobStore } from "./jobStore";
import { readFacts } from "./readFacts";
import { type GateDeps, runGate } from "./runGate";

export interface JobActionDeps {
  readonly store: JobStore;
  readonly workflows: Readonly<Record<string, WorkflowDefinition>>;
  /** Runs a named effect from a move, such as creating the worktree. Unknown names are ignored. */
  readonly runEffect: (name: string, job: WorkflowJob) => Promise<void>;
  readonly actor: (actionId: string) => "human" | "agent";
  /** Needed for `job.run_gate`. Leave it out and that action reports it has no executor. */
  readonly gate?: Omit<GateDeps, "store" | "workflows" | "actor">;
}

const definitionOf = (deps: JobActionDeps, job: WorkflowJob): WorkflowDefinition => {
  const def = deps.workflows[job.workflowId];
  if (!def) throw new Error(`job ${job.id} uses unknown workflow ${job.workflowId}`);
  return def;
};

const field = (input: unknown, key: string): string =>
  String((input as Record<string, unknown>)[key]);

/** Executors for the job actions. Input is already validated by the action's own parser. */
export const createJobExecutor = (deps: JobActionDeps): ActionExecutor => ({
  async execute(actionId, input) {
    const { store } = deps;
    const job = await store.load(field(input, "id"));
    const actor = deps.actor(actionId);

    if (actionId === "job.run_gate") {
      if (!deps.gate) throw new Error("no executor for job.run_gate");
      return runGate({ ...deps.gate, store, workflows: deps.workflows, actor }, job.id);
    }

    if (actionId === "job.advance") {
      const def = definitionOf(deps, job);
      const facts = await readFacts(store.jobDir(job.id), job);
      const to = field(input, "to");
      const result = advanceJob(def, job, to, facts);
      if (!result.ok) {
        await store.audit({
          actor,
          action: "advance-refused",
          jobId: job.id,
          detail: `${job.stage} -> ${to}: ${result.reason}`,
        });
        throw new Error(result.reason);
      }
      await store.save(result.job);
      await store.audit({
        actor,
        action: "advance",
        jobId: job.id,
        detail: `${job.stage} -> ${result.job.stage}`,
      });
      for (const name of result.effects) await deps.runEffect(name, result.job);
      return { stage: result.job.stage, round: result.job.round };
    }

    if (actionId === "job.approve_spec") {
      const facts = await readFacts(store.jobDir(job.id), job);
      const hash = facts.hashes?.spec;
      if (hash === undefined) throw new Error("spec.md missing");
      await store.save(approve(job, "spec", hash));
      await store.audit({ actor, action: "approve-spec", jobId: job.id, detail: hash });
      return { approved: hash };
    }

    if (actionId === "job.unblock") {
      if (job.stage !== NEEDS_HUMAN || job.parkedFrom === undefined)
        throw new Error(`${job.id} is not parked`);
      await store.save({ ...job, stage: job.parkedFrom });
      await store.audit({
        actor,
        action: "unblock",
        jobId: job.id,
        detail: `back to ${job.parkedFrom}`,
      });
      return { stage: job.parkedFrom };
    }

    throw new Error(`no executor for ${actionId}`);
  },
});

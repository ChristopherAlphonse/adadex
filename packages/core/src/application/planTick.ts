import {
  NEEDS_HUMAN,
  stageOf,
  type WorkflowDefinition,
  type WorkflowJob,
} from "../domain/workflow";

export interface TickCandidate {
  readonly job: WorkflowJob;
  readonly def: WorkflowDefinition;
  /** How many runs in a row ended with the job still at the same stage. */
  readonly stalls: number;
}

export interface TickConfig {
  /** Most agents running at once. */
  readonly concurrency: number;
  /** Park a job after this many runs that moved nothing. */
  readonly stallLimit: number;
}

export interface TickPlan {
  readonly start: readonly { jobId: string; stageId: string; roleId: string }[];
  readonly park: readonly { jobId: string; reason: string }[];
  readonly skip: readonly { jobId: string; reason: string }[];
}

/**
 * Decide what the unattended loop does next. Pure: it starts a run only for a job at a stage that has a role, never
 * for a job held for a person, never twice for the same job, and never past the concurrency limit. A job that
 * keeps ending where it began is parked on a person instead of looping.
 */
export const planTick = (
  candidates: readonly TickCandidate[],
  running: ReadonlySet<string>,
  config: TickConfig,
): TickPlan => {
  const start: { jobId: string; stageId: string; roleId: string }[] = [];
  const park: { jobId: string; reason: string }[] = [];
  const skip: { jobId: string; reason: string }[] = [];
  let free = Math.max(0, config.concurrency - running.size);

  // Finish what is furthest along first.
  const depth = (c: TickCandidate): number => c.def.stages.findIndex((s) => s.id === c.job.stage);
  const ordered = [...candidates].sort(
    (a, b) => depth(b) - depth(a) || a.job.id.localeCompare(b.job.id),
  );

  for (const { job, def, stalls } of ordered) {
    const stage = stageOf(def, job.stage);
    if (running.has(job.id)) skip.push({ jobId: job.id, reason: "already running" });
    else if (job.stage === NEEDS_HUMAN || stage?.terminal === true || !stage)
      skip.push({ jobId: job.id, reason: "held for a person" });
    else if (def.unattended !== true)
      skip.push({ jobId: job.id, reason: `workflow ${def.id} is not set to run unattended` });
    else if (stage.role === undefined)
      skip.push({
        jobId: job.id,
        reason: `stage ${stage.id} has no role, so it waits for a person`,
      });
    else if (stalls >= config.stallLimit)
      park.push({ jobId: job.id, reason: `${stalls} runs in a row ended at ${stage.id}` });
    else if (free <= 0) skip.push({ jobId: job.id, reason: "waiting for a free slot" });
    else {
      start.push({ jobId: job.id, stageId: stage.id, roleId: stage.role });
      free -= 1;
    }
  }
  return { start, park, skip };
};

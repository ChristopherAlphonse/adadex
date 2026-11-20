import { planTick, type TickPlan, type WorkflowJob } from "@adadex/core";
import type { JobStore } from "../jobs/jobStore";
import { parkJob } from "../jobs/parkJob";
import { findWorkflow, type WorkflowLookup } from "../jobs/workflowLookup";
import type { RunResult } from "./roleRunner";

export interface SchedulerDeps {
  readonly store: JobStore;
  readonly workflows: WorkflowLookup;
  readonly runStage: (jobId: string) => Promise<RunResult>;
  readonly concurrency: number;
  readonly stallLimit: number;
  readonly setInterval?: (fn: () => void, ms: number) => unknown;
  readonly clearInterval?: (handle: unknown) => void;
}

export interface SchedulerStatus {
  readonly enabled: boolean;
  readonly running: readonly string[];
  readonly lastPlan: TickPlan | null;
}

/**
 * The unattended loop. It starts an agent only at a stage that has a role, one run per job, up to the concurrency
 * limit, and parks a job that keeps ending where it began. It is off until a person turns it on, and it has no
 * way to give a run more than the role of the stage. Turning it on is a decision for the UI, never for an agent.
 */
export const createScheduler = (deps: SchedulerDeps) => {
  const running = new Map<string, Promise<void>>();
  const stalls = new Map<string, number>();
  let enabled = false;
  let timer: unknown;
  let lastPlan: TickPlan | null = null;

  const launch = (jobId: string, stageId: string): void => {
    const done = deps
      .runStage(jobId)
      .then((r) => {
        stalls.set(jobId, r.stageAfter === stageId ? (stalls.get(jobId) ?? 0) + 1 : 0);
      })
      .catch(async () => {
        // A refused or failed run counts as a run that moved nothing, so a broken job cannot loop.
        stalls.set(jobId, (stalls.get(jobId) ?? 0) + 1);
      })
      .finally(() => running.delete(jobId));
    running.set(jobId, done);
  };

  const tick = async (): Promise<TickPlan> => {
    const jobs: WorkflowJob[] = [...(await deps.store.list())];
    const candidates = await Promise.all(
      jobs.map(async (job) => ({
        job,
        def: await findWorkflow(deps.workflows, job.workflowId),
        stalls: stalls.get(job.id) ?? 0,
      })),
    );
    const plan = planTick(candidates, new Set(running.keys()), {
      concurrency: deps.concurrency,
      stallLimit: deps.stallLimit,
    });
    for (const p of plan.park) {
      const job = jobs.find((j) => j.id === p.jobId);
      if (job) await parkJob(deps.store, job, p.reason);
      stalls.delete(p.jobId);
    }
    for (const s of plan.start) launch(s.jobId, s.stageId);
    lastPlan = plan;
    return plan;
  };

  return {
    tick,
    /** Resolves when every run that is going has finished. */
    idle: async (): Promise<void> => {
      while (running.size > 0) await Promise.allSettled([...running.values()]);
    },
    start(intervalMs: number): void {
      enabled = true;
      timer ??= (deps.setInterval ?? ((fn, ms) => setInterval(fn, ms)))(
        () => void tick().catch(() => undefined),
        intervalMs,
      );
    },
    stop(): void {
      enabled = false;
      if (timer !== undefined)
        (deps.clearInterval ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>)))(timer);
      timer = undefined;
    },
    status: (): SchedulerStatus => ({ enabled, running: [...running.keys()], lastPlan }),
  };
};

export type Scheduler = ReturnType<typeof createScheduler>;

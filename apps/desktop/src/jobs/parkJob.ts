import { NEEDS_HUMAN, type WorkflowJob } from "@adadex/core";

import type { JobStore } from "./jobStore";

/** Hand a job to a person, with the reason. Only the app does this: an agent has no action that parks a job on its own authority. */
export const parkJob = async (
  store: JobStore,
  job: WorkflowJob,
  reason: string,
): Promise<WorkflowJob> => {
  if (job.stage === NEEDS_HUMAN) return job;
  const parked: WorkflowJob = { ...job, stage: NEEDS_HUMAN, parkedFrom: job.stage, note: reason };
  await store.save(parked);
  await store.audit({ actor: "system", action: "park", jobId: job.id, detail: reason });
  return parked;
};

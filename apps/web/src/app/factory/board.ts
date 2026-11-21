import type { FactoryActionInput, FactoryJob, FactoryWorkflow } from "../../runtime/factoryHost";

export interface FactoryAction {
  readonly id: string;
  readonly label: string;
  readonly input: FactoryActionInput;
  readonly isHuman: boolean;
}

export interface FactoryBoardJob {
  readonly job: FactoryJob;
  readonly actions: readonly FactoryAction[];
}

export interface FactoryBoardColumn {
  readonly id: string;
  readonly title: string;
  readonly jobs: readonly FactoryBoardJob[];
}

export interface FactoryBoard {
  readonly columns: readonly FactoryBoardColumn[];
  readonly placedJobs: number;
}

const stageTitle = (workflow: FactoryWorkflow | undefined, stageId: string): string => {
  const stage = workflow?.stages.find((candidate) => candidate.id === stageId);

  return stage?.title ?? stageId;
};

const actionsForJob = (
  job: FactoryJob,
  workflow: FactoryWorkflow | undefined,
): readonly FactoryAction[] => {
  const actions: FactoryAction[] = [];
  const jobInput = { id: job.id };

  if (job.parkedFrom !== undefined) {
    actions.push({ id: "job.unblock", label: "Unblock", input: jobInput, isHuman: true });
  }

  if (job.stage === "spec") {
    actions.push({ id: "job.approve_spec", label: "Approve spec", input: jobInput, isHuman: true });
  }

  if (job.stage === "ship") {
    actions.push({
      id: "job.commit_local",
      label: "Commit locally",
      input: jobInput,
      isHuman: true,
    });
  }

  const stage = workflow?.stages.find((candidate) => candidate.id === job.stage);

  for (const move of stage?.moves ?? []) {
    actions.push({
      id: "job.advance",
      label: `Move to ${stageTitle(workflow, move.to)}`,
      input: { id: job.id, to: move.to },
      isHuman: false,
    });
  }

  if (job.stage === "gate" || job.stage === "polish") {
    actions.push({ id: "job.run_gate", label: "Run checks", input: jobInput, isHuman: false });
  }

  if (job.worktree === undefined) {
    actions.push({
      id: "job.open_worktree",
      label: "Open worktree",
      input: jobInput,
      isHuman: false,
    });
  }

  return actions;
};

export const buildFactoryBoard = (
  jobs: readonly FactoryJob[],
  workflows: readonly FactoryWorkflow[],
): FactoryBoard => {
  const workflowById = new Map(workflows.map((workflow) => [workflow.id, workflow]));
  const titles = new Map<string, string>();
  const stageIds: string[] = [];

  for (const workflow of workflows) {
    for (const stage of workflow.stages) {
      if (!titles.has(stage.id)) {
        titles.set(stage.id, stage.title ?? stage.id);
        stageIds.push(stage.id);
      }
    }
  }

  const jobsByStage = new Map<string, FactoryBoardJob[]>();

  for (const job of jobs) {
    if (!titles.has(job.stage)) {
      titles.set(job.stage, job.stage);
      stageIds.push(job.stage);
    }

    const list = jobsByStage.get(job.stage);

    const entry: FactoryBoardJob = {
      job,
      actions: actionsForJob(job, workflowById.get(job.workflowId)),
    };

    if (list === undefined) {
      jobsByStage.set(job.stage, [entry]);
    } else {
      list.push(entry);
    }
  }

  const columns = stageIds.map((id) => ({
    id,
    title: titles.get(id) ?? id,
    jobs: jobsByStage.get(id) ?? [],
  }));

  return { columns, placedJobs: jobs.length };
};

export const formatElapsed = (startedAt: string, nowMs: number = Date.now()): string => {
  const startedMs = new Date(startedAt).getTime();

  if (!Number.isFinite(startedMs) || nowMs < startedMs) return "unknown";
  const totalSeconds = Math.floor((nowMs - startedMs) / 1000);

  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);

  if (minutes < 60) return `${minutes}m ${totalSeconds % 60}s`;

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

import { randomUUID } from "node:crypto";

import {
  type ActionRegistry,
  type AgentProvider,
  type AgentSession,
  authorizeForRole,
  type PolicyRules,
  policyForRole,
  type RoleDefinition,
  type RunBinding,
  runAgent,
  type WorkflowJob,
} from "@adadex/core";

import type { GuardDecide } from "../agents/guardHost";
import { gitDirOf, regexEscape, type SandboxPlan } from "../agents/sandbox";
import type { ActionHost } from "../host/actionHost";
import { withProtectedLocations } from "../host/protectedLocations";
import { createToolGuard, resolveReal } from "../host/toolGuard";
import type { ApprovalBroker } from "../ipc/approvalBroker";
import type { JobStore } from "../jobs/jobStore";
import { parkJob } from "../jobs/parkJob";
import { findWorkflow, type WorkflowLookup } from "../jobs/workflowLookup";
import type { Logger } from "../logs/logger";

export interface ProviderRequest {
  /** What the agent process may write and read at the operating system level, under the policy. */
  readonly sandbox: SandboxPlan;
  /** What to show in the process list, such as "Builder on j1". */
  readonly label: string;
  readonly cwd: string;
  readonly tools: readonly string[];
  readonly decide: GuardDecide;
}

export interface RoleRunnerDeps {
  readonly store: JobStore;
  readonly workflows: WorkflowLookup;
  readonly roles: { get(id: string): Promise<RoleDefinition | undefined> };
  readonly registry: ActionRegistry;
  readonly host: ActionHost;
  readonly approvals: ApprovalBroker;
  /** The base policy for a role: building for roles that edit code, review otherwise. */
  readonly basePolicy: (role: RoleDefinition) => PolicyRules;
  /** Places no agent may write, such as the machine's data folder. */
  readonly protectedLocations: readonly string[];
  readonly makeProvider: (request: ProviderRequest) => AgentProvider;
  readonly cwdOf: (job: WorkflowJob) => string;
  readonly logger?: Logger;
  readonly newRunId?: () => string;
  readonly now?: () => Date;
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

export interface RunResult {
  readonly binding: RunBinding;
  readonly stageAfter: string;
  readonly summary: string;
  readonly actions: number;
  /** Set when the run was stopped for using up its budget. */
  readonly limited?: "actions" | "time";
}

/**
 * Run an agent on a job, in the role of the job's current stage. The role is read from the workflow a person wrote,
 * bound to the run before it starts, and frozen: no action, tool or file the agent can reach changes it. Every
 * call is written to the audit chain with the role and run, and the run stops when it uses its budget.
 */
export const createRoleRunner = (deps: RoleRunnerDeps) => {
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(/* SAFETY: preceding checks establish the invariant this assertion encodes. */ h as ReturnType<typeof setTimeout>));
  const now = deps.now ?? (() => new Date());

  return {
    async run(jobId: string): Promise<RunResult> {
      const job = await deps.store.load(jobId);

      const intact = await deps.store.verify(jobId);

      if (!intact.ok) {
        deps.logger?.log("error", "integrity", `integrity check failed: ${intact.reason}`, {
          jobId,
        });
        await parkJob(deps.store, job, `integrity check failed: ${intact.reason}`);
        throw new Error(`integrity check failed: ${intact.reason}`);
      }

      const def = await findWorkflow(deps.workflows, job.workflowId);
      const stage = def.stages.find((s) => s.id === job.stage);

      if (!stage || stage.terminal === true)
        throw new Error(`${job.id} is at ${job.stage}, which no agent works`);

      if (stage.role === undefined)
        throw new Error(`stage ${stage.id} has no role, so it waits for a person`);
      const role = await deps.roles.get(stage.role);

      if (!role)
        throw new Error(`stage ${stage.id} names role ${stage.role}, which does not exist`);

      const binding: RunBinding = Object.freeze({
        runId: (deps.newRunId ?? randomUUID)(),
        roleId: role.id,
        jobId: job.id,
        stageId: stage.id,
        startedAt: now().toISOString(),
      });

      // The guard compares real paths (symlinks resolved), so every folder a rule names must be a real path too,
      // or a rule for /var/x would never match a write to /private/var/x.
      const policy = withProtectedLocations(
        policyForRole(deps.basePolicy(role), role, {
          jobDir: resolveReal("/", deps.store.jobDir(job.id)),
        }),
        deps.protectedLocations.map((l) => resolveReal("/", l)),
      );

      const who = { role: role.id, runId: binding.runId } as const;
      const ctx = { jobId: job.id, runId: binding.runId, role: role.id };
      deps.logger?.log("info", "run", `run started: ${role.id} at ${stage.id}`, ctx);
      await deps.store.audit({
        actor: "system",
        action: "run-start",
        jobId: job.id,
        detail: `${role.id} at ${stage.id}`,
        ...who,
      });

      let calls = 0;
      let limited: RunResult["limited"];
      let current: AgentSession | undefined;

      const stop = async (why: "actions" | "time"): Promise<void> => {
        limited ??= why;
        deps.logger?.log("warn", "run", `run stopped: ${why} budget used`, ctx);
        await deps.store.audit({
          actor: "system",
          action: "limit",
          jobId: job.id,
          detail: `stopped: ${why} budget used`,
          ...who,
        });
        await current?.stop();
      };

      const inner = createToolGuard(policy, deps.approvals.gate, (line) =>
        deps.logger?.log("warn", "guard", line, ctx),
      );

      const decide: GuardDecide = async (event) => {
        calls += 1;

        if (calls > role.limits.maxActions) {
          void stop("actions");

          return {
            allow: false,
            reason: `role ${role.id} used its ${role.limits.maxActions} actions`,
          };
        }

        return inner(event);
      };

      const provider = deps.makeProvider({
        sandbox: sandboxPlan(
          role,
          job,
          deps.store.jobDir(job.id),
          deps.cwdOf(job),
          deps.protectedLocations,
        ),
        label: `${role.name} on ${job.id}`,
        cwd: deps.cwdOf(job),
        tools: role.tools,
        decide,
      });

      const tracked: AgentProvider = {
        id: provider.id,
        start: async (request) => {
          current = await provider.start(request);

          return current;
        },
      };

      const ports = deps.host.agentPorts();
      const timer = setTimer(() => void stop("time"), role.limits.maxSeconds * 1000);
      let summary = "";

      try {
        const result = await runAgent(
          {
            provider: tracked,
            registry: deps.registry,
            executor: ports.executor,
            approvals: ports.approvals,
            onNeedsHumanClick: ports.onNeedsHumanClick,
            authorize: (id, input, approved) =>
              authorizeForRole(deps.registry, role, id, input, approved),
          },
          {
            goal: `You are working as the ${role.name} at the ${stage.id} stage of job ${job.id}. Its documents are in ${deps.store.jobDir(job.id)}. ${stage.hint}`,
            contextFiles: [],
          },
        );

        summary = result.summary;

        for (const c of result.calls) {
          await deps.store.audit({
            actor: "agent",
            action: "call",
            jobId: job.id,
            detail: `${c.actionId}: ${c.outcome.status}`,
            ...who,
          });
        }
      } finally {
        clearTimer(timer);
      }

      const after = await deps.store.load(job.id);
      deps.logger?.log("info", "run", `run ended: ${stage.id} -> ${after.stage}`, ctx);
      await deps.store.audit({
        actor: "system",
        action: "run-end",
        jobId: job.id,
        detail: `${stage.id} -> ${after.stage}`,
        ...who,
      });

      return {
        binding,
        stageAfter: after.stage,
        summary,
        actions: calls,
        ...(limited ? { limited } : {}),
      };
    },
  };
};

/**
 * The second lock behind the tool policy, at the operating system: the agent process may write its job folder, and
 * the worktree only if its role edits code. It may never write the job record, the gate result, or the git settings that
 * hold the commit lock, and it may not read the app's data folder.
 */
export const sandboxPlan = (
  role: RoleDefinition,
  job: WorkflowJob,
  jobDir: string,
  cwd: string,
  dataFolders: readonly string[],
): SandboxPlan => {
  const real = (p: string): string => resolveReal("/", p);
  const jobReal = real(jobDir);
  const cwdReal = real(cwd);
  const gitDir = job.worktree === undefined ? undefined : gitDirOf(cwdReal);

  return {
    writable: [jobReal, ...(role.editsCode ? [cwdReal, ...(gitDir ? [real(gitDir)] : [])] : [])],
    denyWrite: [
      `${jobReal}/job.json`,
      `${cwdReal}/.git`,
      ...(gitDir ? [`${real(gitDir)}/config`, `${real(gitDir)}/config.worktree`] : []),
    ],
    denyWriteRegex: [
      `^${regexEscape(jobReal)}/(.*/)?checks\\.md$`,
      `^${regexEscape(cwdReal)}/\\.git/`,
    ],
    denyRead: dataFolders.map(real),
  };
};

export type RoleRunner = ReturnType<typeof createRoleRunner>;

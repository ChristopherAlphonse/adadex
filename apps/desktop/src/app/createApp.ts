import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type AgentProvider,
  type AgentSession,
  BUILD_POLICY,
  createActionRegistry,
  FACTORY_ACTIONS,
  type PolicyRules,
  runAgent,
  type WorkflowJob,
} from "@adadex/core";
import { createClaudeCodeProvider, type SpawnAgent } from "../agents/claudeCodeProvider";
import { spawnAgent } from "../agents/spawnAgent";
import { loadMachineConfig } from "../config/machineConfig";
import {
  type ActionHost,
  createActionHost,
  type HostEvent,
  type NativeConfirm,
} from "../host/actionHost";
import { withProtectedLocations } from "../host/protectedLocations";
import { createToolGuard } from "../host/toolGuard";
import { type ApprovalBroker, createApprovalBroker } from "../ipc/approvalBroker";
import { createHostApi, type HostApi } from "../ipc/hostApi";
import type { GateConfig } from "../jobs/gatePorts";
import { createHumanKey } from "../jobs/gitGuard";
import { createJobExecutor } from "../jobs/jobActions";
import { createJobStore, type JobStore } from "../jobs/jobStore";
import { makeWorktree } from "../jobs/makeWorktree";
import { nodeCheckRunner, nodeGit } from "../jobs/nodeGate";
import { createWorkflowStore, type WorkflowStore } from "../workflows/workflowStore";

export interface AppOptions {
  /** The project being worked on. Its git repo gets the job worktrees. */
  readonly projectRoot: string;
  /** Per-machine data (config, user workflows, generated hooks). Kept outside every worktree. */
  readonly dataDir: string;
  /** The native OS dialog. In Electron this is `dialog.showMessageBox`; the UI cannot press it. */
  readonly confirm: NativeConfirm;
  readonly emit: (event: HostEvent) => void;
  readonly branchPrefix?: string;
  readonly spawn?: SpawnAgent;
  readonly claudeCommand?: string;
  readonly bridgePath: string;
  readonly hookPath: string;
}

export interface App {
  readonly api: HostApi;
  readonly host: ActionHost;
  readonly jobs: JobStore;
  readonly workflows: WorkflowStore;
  readonly approvals: ApprovalBroker;
  readonly policy: PolicyRules;
  /** Run an agent on a job: its own tools are allowed, behind the policy and the approval cards. */
  runAgentOnJob(jobId: string, goal: string): Promise<{ summary: string }>;
  /** Stop every running agent and decline anything waiting, so quitting leaves nothing running. */
  shutdown(): Promise<void>;
}

const DEFAULT_CHECKS: GateConfig = {
  checks: "",
  timeoutMs: 30 * 60 * 1000,
  baseBranch: "main",
  protectedPaths: [],
};

/**
 * Wire everything: the stores, the human key (in memory only), the policy with protected locations, the action
 * host, the git guard and the request layer. Electron's main process only has to call this and forward messages.
 */
export const createApp = (options: AppOptions): App => {
  const stateDir = join(options.projectRoot, ".adadex", "factory");
  const configPath = join(options.dataDir, "machine.json");
  const guardDir = join(options.dataDir, "guard");
  const prefix = options.branchPrefix ?? "adadex/";
  const humanKey = createHumanKey();
  const sessions = new Set<AgentSession>();

  const jobs = createJobStore(stateDir);
  const workflows = createWorkflowStore(join(options.dataDir, "workflows"));
  const gateConfig = async (): Promise<GateConfig> => {
    const raw = (await loadProjectChecks(join(options.dataDir, "project.json"))) ?? {};
    return { ...DEFAULT_CHECKS, ...raw };
  };
  const cwdOf = (job: WorkflowJob): string => job.worktree ?? options.projectRoot;
  const registry = createActionRegistry(FACTORY_ACTIONS);

  const approvals = createApprovalBroker((p) =>
    options.emit({ type: "approval-requested", actionId: p.actionId, reason: p.reason }),
  );

  const executor = createJobExecutor({
    store: jobs,
    workflows: (id) => workflows.get(id),
    actor: (actionId) => (registry.get(actionId)?.class === "human" ? "human" : "agent"),
    runEffect: async (name, job) => {
      if (name !== "make-worktree") return;
      const config = await gateConfig();
      const made = await makeWorktree(
        {
          projectRoot: options.projectRoot,
          guardDir,
          hash: humanKey.hash,
          baseBranch: config.baseBranch,
          branchPrefix: prefix,
        },
        job,
      );
      await jobs.save({ ...job, ...made });
    },
    gate: { runner: nodeCheckRunner, git: nodeGit, config: gateConfig, cwdOf },
    commit: { git: nodeGit, config: gateConfig, cwdOf, humanKey: humanKey.key },
  });

  const host = createActionHost({
    registry,
    executor,
    confirm: options.confirm,
    askApproval: approvals.gate,
    emit: options.emit,
  });

  const policy = withProtectedLocations(BUILD_POLICY, [options.dataDir, stateDir]);
  const api = createHostApi({
    workflows,
    jobs,
    host,
    approvals,
    loadConfig: () => loadMachineConfig(configPath),
    configPath,
    roundLimit: 3,
  });

  return {
    api,
    host,
    jobs,
    workflows,
    approvals,
    policy,
    async runAgentOnJob(jobId, goal) {
      const job = await jobs.load(jobId);
      const inner = createClaudeCodeProvider({
        command: options.claudeCommand ?? "claude",
        bridgePath: options.bridgePath,
        cwd: cwdOf(job),
        spawn: options.spawn ?? spawnAgent,
        allowedTools: ["Read", "Grep", "Glob", "Edit", "Write", "Bash"],
        guard: { hookPath: options.hookPath, decide: createToolGuard(policy, approvals.gate) },
      });
      const provider: AgentProvider = {
        id: inner.id,
        start: async (request) => {
          const session = await inner.start(request);
          sessions.add(session);
          return {
            ...session,
            stop: async () => {
              sessions.delete(session);
              await session.stop();
            },
          };
        },
      };
      const ports = host.agentPorts();
      const result = await runAgent(
        { provider, registry, ...ports },
        { goal, contextFiles: [join(jobs.jobDir(jobId), "spec.md")] },
      );
      return { summary: result.summary };
    },
    async shutdown() {
      approvals.declineAll();
      await Promise.all([...sessions].map((s) => s.stop()));
    },
  };
};

/** The project's `checks` command and gate limits, read from the machine's data folder, never from the repo an agent edits. */
const loadProjectChecks = async (path: string): Promise<Partial<GateConfig> | null> => {
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as Partial<GateConfig>;
    return {
      ...(typeof raw.checks === "string" ? { checks: raw.checks } : {}),
      ...(typeof raw.timeoutMs === "number" ? { timeoutMs: raw.timeoutMs } : {}),
      ...(typeof raw.baseBranch === "string" ? { baseBranch: raw.baseBranch } : {}),
      ...(Array.isArray(raw.protectedPaths)
        ? { protectedPaths: raw.protectedPaths.filter((p) => typeof p === "string") }
        : {}),
    };
  } catch {
    return null;
  }
};

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type AgentProvider,
  type AgentSession,
  BUILD_POLICY,
  createActionRegistry,
  FACTORY_ACTIONS,
  type PolicyRules,
  REVIEW_POLICY,
  type WorkflowJob,
} from "@adadex/core";
import { createClaudeCodeProvider, type SpawnAgent } from "../agents/claudeCodeProvider";
import {
  buildProfile,
  defaultDenyRead,
  defaultWritable,
  sandboxAvailable,
  sandboxSpawn,
} from "../agents/sandbox";
import { spawnAgent } from "../agents/spawnAgent";
import { loadMachineConfig } from "../config/machineConfig";
import {
  type ActionHost,
  createActionHost,
  type HostEvent,
  type NativeConfirm,
} from "../host/actionHost";
import { withProtectedLocations } from "../host/protectedLocations";
import { resolveReal } from "../host/toolGuard";
import { type ApprovalBroker, createApprovalBroker } from "../ipc/approvalBroker";
import { createHostApi, type HostApi } from "../ipc/hostApi";
import type { CheckRunner, GateConfig } from "../jobs/gatePorts";
import { createHumanKey } from "../jobs/gitGuard";
import { createJobExecutor } from "../jobs/jobActions";
import { createJobStore, type JobStore } from "../jobs/jobStore";
import { makeWorktree } from "../jobs/makeWorktree";
import { nodeCheckRunner, nodeGit } from "../jobs/nodeGate";
import { createFileAnchors } from "../logs/anchors";
import { type LogDb, openLogDb } from "../logs/logDb";
import { createLogger, type Logger } from "../logs/logger";
import { createFileSigner, type KeyProtector, type Signer } from "../logs/signer";
import { createRoleStore, type RoleStore } from "../roles/roleStore";
import { createProcessRegistry } from "../runs/processRegistry";
import { createRoleRunner, type ProviderRequest, type RunResult } from "../runs/roleRunner";
import { createScheduler, type Scheduler } from "../runs/scheduler";
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
  /** How agents are started. The default runs Claude Code; tests pass a fake. */
  readonly makeProvider?: (request: ProviderRequest) => AgentProvider;
  /** Most agents at once, and how many runs that move nothing before a job is parked. */
  readonly concurrency?: number;
  readonly stallLimit?: number;
  /** Operational events older than this are deleted at start. The audit chain is never pruned. */
  readonly logRetentionDays?: number;
  /** Wraps the audit signing key for storage. Electron passes the operating system keychain. */
  readonly keyProtector?: KeyProtector;
  /** Called when the app starts or stops having agents or checks running, so the shell can keep the machine awake. */
  readonly onBusyChange?: (busy: boolean) => void;
  /**
   * Run each agent process in an operating system sandbox. `required` (the default) refuses to start an agent where
   * there is no sandbox. `off` is for development only.
   */
  readonly sandbox?: "required" | "off";
}

export interface App {
  readonly api: HostApi;
  readonly host: ActionHost;
  readonly jobs: JobStore;
  readonly workflows: WorkflowStore;
  readonly approvals: ApprovalBroker;
  readonly policy: PolicyRules;
  readonly roles: RoleStore;
  /** The machine's local log database: the audit chain and the operational events. */
  readonly logs: Logger;
  readonly logDb: LogDb;
  /** The unattended loop. Off until a person starts it. */
  readonly scheduler: Scheduler;
  /**
   * Run one agent on a job, in the role of the job's current stage and no other. There is no way to run an agent
   * without a role or to pick a different one.
   */
  runStage(jobId: string): Promise<RunResult>;
  /** Stop every running agent and decline anything waiting, so quitting leaves nothing running. */
  shutdown(): Promise<void>;
  /** Close the log database. Call once, after `shutdown`, when nothing more will be written. */
  close(): void;
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
  let running = 0;
  const processes = createProcessRegistry(undefined, undefined, (event, info) => {
    logs.log(event === "kill" ? "warn" : "info", "process", `${event}: ${info.label}`, {
      data: { processId: info.processId },
    });
    if (event === "start") {
      running += 1;
      if (running === 1) options.onBusyChange?.(true);
    } else if (event === "end") {
      running -= 1;
      if (running === 0) options.onBusyChange?.(false);
    }
  });
  // The project's checks show up in the process list too, and can be stopped from there.
  const checkRunner: CheckRunner = {
    run: (command, cwd, timeoutMs, onStart) => {
      let handle: { done(): void } | undefined;
      return nodeCheckRunner
        .run(command, cwd, timeoutMs, (kill) => {
          handle = processes.register(`checks: ${command}`, kill);
          onStart?.(kill);
        })
        .finally(() => handle?.done());
    },
  };

  const logDb = openLogDb(join(options.dataDir, "logs", "adadex.db"));
  const project = createHash("sha256").update(options.projectRoot).digest("hex").slice(0, 16);
  const logs = createLogger(logDb, project);
  logs.prune(options.logRetentionDays ?? 90);
  logs.log("info", "app", "app started");
  const signer: Signer = createFileSigner(join(options.dataDir, "keys"), options.keyProtector);
  const anchors = createFileAnchors(join(options.dataDir, "anchors", "audit-anchors.log"));
  const jobs = createJobStore(stateDir, undefined, { db: logDb, project, signer, anchors });
  const workflows = createWorkflowStore(join(options.dataDir, "workflows"));
  const gateConfig = async (): Promise<GateConfig> => {
    const raw = (await loadProjectChecks(join(options.dataDir, "project.json"))) ?? {};
    return { ...DEFAULT_CHECKS, ...raw };
  };
  const cwdOf = (job: WorkflowJob): string => job.worktree ?? options.projectRoot;
  const registry = createActionRegistry(FACTORY_ACTIONS);

  const emit = (event: HostEvent): void => {
    if (event.type === "ran") {
      logs.log(
        event.outcome.status === "ok" ? "info" : "warn",
        "action",
        `${event.caller} ran ${event.actionId}: ${event.outcome.status}`,
      );
    } else if (event.type === "needs-click") {
      logs.log("info", "action", `${event.actionId} needs a human click`);
    } else {
      logs.log("info", "approval", `approval requested for ${event.actionId}: ${event.reason}`);
    }
    options.emit(event);
  };
  const broker = createApprovalBroker((p) =>
    emit({ type: "approval-requested", actionId: p.actionId, reason: p.reason }),
  );
  const approvals: ApprovalBroker = {
    ...broker,
    respond: (approvalId, approved) => {
      const found = broker.respond(approvalId, approved);
      logs.log(
        found ? "info" : "warn",
        "approval",
        `${approved ? "approved" : "declined"} ${approvalId}${found ? "" : " (not waiting)"}`,
      );
      return found;
    },
  };

  const executor = createJobExecutor({
    store: jobs,
    workflows: (id) => workflows.get(id),
    roundLimit: 3,
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
      await jobs.audit({ actor: "system", action: "worktree", jobId: job.id, detail: made.branch });
    },
    gate: {
      runner: checkRunner,
      git: nodeGit,
      config: gateConfig,
      cwdOf,
      // At the project root the app's own folders show up as untracked files. In a worktree they must not.
      ignore: (cwd) =>
        cwd === options.projectRoot ? [".adadex/factory/**", ".adadex/worktrees/**"] : [],
    },
    commit: { git: nodeGit, config: gateConfig, cwdOf, humanKey: humanKey.key },
  });

  const host = createActionHost({
    registry,
    executor,
    confirm: options.confirm,
    askApproval: approvals.gate,
    emit,
  });

  const policy = withProtectedLocations(BUILD_POLICY, [resolveReal("/", options.dataDir)]);
  const roles = createRoleStore(join(options.dataDir, "roles"), registry);

  const defaultProvider = (request: ProviderRequest): AgentProvider => {
    const base = options.spawn ?? spawnAgent;
    let spawn = base;
    if ((options.sandbox ?? "required") === "required") {
      if (!sandboxAvailable())
        throw new Error(
          "no operating system sandbox is available on this machine, so no agent is started",
        );
      const plan = request.sandbox;
      spawn = sandboxSpawn(
        base,
        buildProfile({
          ...plan,
          writable: [...defaultWritable(), ...plan.writable],
          denyRead: [...defaultDenyRead(), ...plan.denyRead],
        }),
      );
    }
    return createClaudeCodeProvider({
      command: options.claudeCommand ?? "claude",
      bridgePath: options.bridgePath,
      cwd: request.cwd,
      spawn: (command, args, cwd) => {
        const child = spawn(command, args, cwd);
        const handle = processes.register(request.label, () => child.kill());
        child.onExit(() => handle.done());
        return child;
      },
      allowedTools: [...request.tools],
      guard: { hookPath: options.hookPath, decide: request.decide },
    });
  };
  const trackedProvider = (request: ProviderRequest): AgentProvider => {
    const inner = (options.makeProvider ?? defaultProvider)(request);
    return {
      id: inner.id,
      start: async (r) => {
        const session = await inner.start(r);
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
  };
  const runner = createRoleRunner({
    logger: logs,
    store: jobs,
    workflows: (id) => workflows.get(id),
    roles,
    registry,
    host,
    approvals,
    basePolicy: (role) => (role.editsCode ? BUILD_POLICY : REVIEW_POLICY),
    protectedLocations: [options.dataDir],
    makeProvider: trackedProvider,
    cwdOf,
  });
  const scheduler = createScheduler({
    store: jobs,
    workflows: (id) => workflows.get(id),
    runStage: (jobId) => runner.run(jobId),
    concurrency: options.concurrency ?? 1,
    stallLimit: options.stallLimit ?? 2,
    onPlan: (plan) =>
      logs.log("info", "scheduler", `started ${plan.start.length}, parked ${plan.park.length}`, {
        data: { start: plan.start, park: plan.park },
      }),
  });
  const api = createHostApi({
    workflows,
    jobs,
    host,
    approvals,
    processes,
    roles,
    logs,
    scheduler,
    confirm: options.confirm,
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
    roles,
    logs,
    logDb,
    scheduler,
    runStage: (jobId) => runner.run(jobId),
    async shutdown() {
      scheduler.stop();
      processes.killAll();
      logs.log("info", "app", "app stopping");
      approvals.declineAll();
      await Promise.all([...sessions].map((s) => s.stop()));
    },
    close() {
      logDb.close();
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

/**
 * The renderer side of the factory host. The host owns execution: every button in the board sends a
 * request here and the host decides whether it is allowed to run.
 */

export interface FactoryWorkflowStage {
  readonly id: string;
  readonly title?: string;
  readonly moves: readonly { readonly to: string }[];
}

export interface FactoryWorkflow {
  readonly id: string;
  readonly name: string;
  readonly stages: readonly FactoryWorkflowStage[];
}

export interface FactoryJob {
  readonly id: string;
  readonly title: string;
  readonly workflowId: string;
  readonly stage: string;
  readonly round: number;
  readonly roundLimit: number;
  readonly commit: string | null;
  readonly parkedFrom?: string;
  readonly worktree?: string;
}

export interface FactoryApproval {
  readonly approvalId: string;
  readonly actionId: string;
  readonly reason: string;
}

export interface FactoryProcess {
  readonly processId: string;
  readonly label: string;
  readonly startedAt: string;
  readonly endedAt?: string;
}

export interface FactoryHost {
  isAvailable(): boolean;
  listJobs(): Promise<readonly FactoryJob[]>;
  listWorkflows(): Promise<readonly FactoryWorkflow[]>;
  listApprovals(): Promise<readonly FactoryApproval[]>;
  listProcesses(): Promise<readonly FactoryProcess[]>;
  runAction(actionId: string, input: Readonly<Record<string, unknown>>): Promise<void>;
  respondApproval(approvalId: string, approved: boolean): Promise<void>;
  killProcess(processId: string): Promise<void>;
  /** Whether the unattended loop is on, or null when this host has no loop. */
  getLoop(): Promise<boolean | null>;
  /** Turning the loop on needs the user's yes in a native dialog the page cannot press. */
  setLoop(enabled: boolean): Promise<void>;
  /** The gate's checks command, or null when this host has no project settings. */
  getChecks(): Promise<string | null>;
  /** Saving needs the user's yes in a native dialog that shows the command. */
  setChecks(command: string): Promise<void>;
  /** Called for every host event. Returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void;
}

/** Test seam and the shape used when a preload adapts the request/response API. */
export interface HostApiBridge {
  handle(request: unknown): Promise<unknown>;
  subscribe(listener: (event: unknown) => void): () => void;
}

/** The shape Electron's preload exposes today as `window.adadex`. */
export interface ElectronAdadexBridge {
  request(request: unknown): Promise<unknown>;
  onEvent(listener: (event: unknown) => void): () => void;
}

type HostBridge = HostApiBridge | ElectronAdadexBridge;

interface HostTransport {
  send(request: unknown): Promise<unknown>;
  listen(listener: (event: unknown) => void): () => void;
}

const toTransport = (bridge: HostBridge): HostTransport => ({
  send: (request) => ("handle" in bridge ? bridge.handle(request) : bridge.request(request)),
  listen: (listener) =>
    "subscribe" in bridge ? bridge.subscribe(listener) : bridge.onEvent(listener),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const readNumber = (record: Record<string, unknown>, key: string): number | undefined => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const parseJob = (raw: unknown): FactoryJob => {
  if (!isRecord(raw)) throw new Error("host returned an invalid job");
  const id = readString(raw, "id");
  const title = readString(raw, "title");
  const workflowId = readString(raw, "workflowId");
  const stage = readString(raw, "stage");
  const round = readNumber(raw, "round");
  const roundLimit = readNumber(raw, "roundLimit");
  if (id === undefined || title === undefined || workflowId === undefined || stage === undefined) {
    throw new Error("host returned a job without an id, title, workflow or stage");
  }
  if (round === undefined || roundLimit === undefined) {
    throw new Error("host returned a job without round information");
  }
  const commitValue = raw.commit;
  if (commitValue !== null && typeof commitValue !== "string") {
    throw new Error("host returned an invalid job commit");
  }
  const optional: { parkedFrom?: string; worktree?: string } = {};
  const parkedFrom = readString(raw, "parkedFrom");
  if (parkedFrom !== undefined) optional.parkedFrom = parkedFrom;
  const worktree = readString(raw, "worktree");
  if (worktree !== undefined) optional.worktree = worktree;
  return { id, title, workflowId, stage, round, roundLimit, commit: commitValue, ...optional };
};

const parseWorkflow = (raw: unknown): FactoryWorkflow => {
  if (!isRecord(raw)) throw new Error("host returned an invalid workflow");
  const id = readString(raw, "id");
  const name = readString(raw, "name");
  if (id === undefined || name === undefined) {
    throw new Error("host returned a workflow without an id or name");
  }
  if (!Array.isArray(raw.stages)) throw new Error("host returned a workflow without stages");
  const stages = raw.stages.map((stageValue): FactoryWorkflowStage => {
    if (!isRecord(stageValue)) throw new Error("host returned an invalid stage");
    const stageId = readString(stageValue, "id");
    if (stageId === undefined) throw new Error("host returned a stage without an id");
    if (!Array.isArray(stageValue.moves)) throw new Error("host returned a stage without moves");
    const moves = stageValue.moves.map((moveValue) => {
      if (!isRecord(moveValue)) throw new Error("host returned an invalid move");
      const to = readString(moveValue, "to");
      if (to === undefined) throw new Error("host returned a move without a target stage");
      return { to };
    });
    const title = readString(stageValue, "title");
    return title === undefined ? { id: stageId, moves } : { id: stageId, title, moves };
  });
  return { id, name, stages };
};

const parseApproval = (raw: unknown): FactoryApproval => {
  if (!isRecord(raw)) throw new Error("host returned an invalid approval");
  const approvalId = readString(raw, "approvalId");
  const actionId = readString(raw, "actionId");
  const reason = readString(raw, "reason");
  if (approvalId === undefined || actionId === undefined || reason === undefined) {
    throw new Error("host returned an incomplete approval");
  }
  return { approvalId, actionId, reason };
};

const parseProcess = (raw: unknown): FactoryProcess => {
  if (!isRecord(raw)) throw new Error("host returned an invalid process");
  const processId = readString(raw, "processId");
  const label = readString(raw, "label");
  const startedAt = readString(raw, "startedAt");
  if (processId === undefined || label === undefined || startedAt === undefined) {
    throw new Error("host returned an incomplete process");
  }
  const optional: { endedAt?: string } = {};
  const endedAt = readString(raw, "endedAt");
  if (endedAt !== undefined) optional.endedAt = endedAt;
  return { processId, label, startedAt, ...optional };
};

const parseList = <T>(raw: unknown, parse: (item: unknown) => T): readonly T[] => {
  if (!Array.isArray(raw)) throw new Error("host returned an invalid list");
  return raw.map(parse);
};

const unwrap = (raw: unknown): unknown => {
  if (!isRecord(raw)) throw new Error("host returned an invalid response");
  if (raw.ok === true) return raw.data;
  if (raw.ok === false && Array.isArray(raw.errors)) {
    const messages = raw.errors.filter((error): error is string => typeof error === "string");
    throw new Error(messages.join("; ") || "host request failed");
  }
  throw new Error("host returned an invalid response");
};

export const createHostApiFactoryHost = (bridge: HostBridge): FactoryHost => {
  const transport = toTransport(bridge);
  const send = async (kind: string, fields: Record<string, unknown>): Promise<unknown> =>
    unwrap(await transport.send({ kind, ...fields }));

  return {
    isAvailable: () => true,
    listJobs: async () => parseList(await send("jobs.list", {}), parseJob),
    listWorkflows: async () => parseList(await send("workflows.list", {}), parseWorkflow),
    listApprovals: async () => parseList(await send("approvals.list", {}), parseApproval),
    listProcesses: async () => parseList(await send("processes.list", {}), parseProcess),
    runAction: async (actionId, input) => {
      await send("action.run", { actionId, input });
    },
    respondApproval: async (approvalId, approved) => {
      await send("approval.respond", { approvalId, approved });
    },
    killProcess: async (processId) => {
      await send("process.kill", { processId });
    },
    getLoop: async () => {
      const raw = await transport.send({ kind: "scheduler.status" });
      if (!isRecord(raw) || raw.ok !== true) return null;
      if (!isRecord(raw.data) || typeof raw.data.enabled !== "boolean") {
        throw new Error("host returned an invalid loop status");
      }
      return raw.data.enabled;
    },
    setLoop: async (enabled) => {
      await send("scheduler.set", { enabled });
    },
    getChecks: async () => {
      const raw = await transport.send({ kind: "project.get" });
      if (!isRecord(raw) || raw.ok !== true) return null;
      if (!isRecord(raw.data) || typeof raw.data.checks !== "string") {
        throw new Error("host returned invalid project settings");
      }
      return raw.data.checks;
    },
    setChecks: async (checks) => {
      await send("project.set", { checks });
    },
    subscribe: (onChange) => transport.listen(() => onChange()),
  };
};

export const createEmptyFactoryHost = (): FactoryHost => ({
  isAvailable: () => false,
  listJobs: async () => [],
  listWorkflows: async () => [],
  listApprovals: async () => [],
  listProcesses: async () => [],
  runAction: async () => undefined,
  respondApproval: async () => undefined,
  killProcess: async () => undefined,
  getLoop: async () => null,
  setLoop: async () => undefined,
  getChecks: async () => null,
  setChecks: async () => undefined,
  subscribe: () => () => undefined,
});

const isBridge = (value: unknown): value is HostBridge => {
  if (!isRecord(value)) return false;
  const hasRequestApi = typeof value.request === "function" && typeof value.onEvent === "function";
  const hasHandleApi = typeof value.handle === "function" && typeof value.subscribe === "function";
  return hasRequestApi || hasHandleApi;
};

/** Test seam: lets a component test install a host without an Electron preload. */
export const installFactoryHost = (bridge: HostBridge | null): void => {
  if (bridge === null) {
    delete (window as { adadexFactoryHost?: HostBridge }).adadexFactoryHost;
    return;
  }
  (window as { adadexFactoryHost?: HostBridge }).adadexFactoryHost = bridge;
};

export const createFactoryHost = (): FactoryHost => {
  if (typeof window === "undefined") return createEmptyFactoryHost();
  const injected: unknown = (window as { adadexFactoryHost?: unknown }).adadexFactoryHost;
  if (isBridge(injected)) return createHostApiFactoryHost(injected);

  const electron: unknown = (window as { adadex?: unknown }).adadex;
  return isBridge(electron) ? createHostApiFactoryHost(electron) : createEmptyFactoryHost();
};

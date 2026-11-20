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
  /** Called for every host event. Returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void;
}

/** Injected by Electron's preload before the web app loads. */
export interface HostApiBridge {
  handle(request: unknown): Promise<unknown>;
  subscribe(listener: (event: unknown) => void): () => void;
}

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

export const createHostApiFactoryHost = (bridge: HostApiBridge): FactoryHost => {
  const send = async (kind: string, fields: Record<string, unknown>): Promise<unknown> =>
    unwrap(await bridge.handle({ kind, ...fields }));

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
    subscribe: (onChange) => bridge.subscribe(() => onChange()),
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
  subscribe: () => () => undefined,
});

const isBridge = (value: unknown): value is HostApiBridge =>
  isRecord(value) && typeof value.handle === "function" && typeof value.subscribe === "function";

/** Test seam: lets a component test install a host without an Electron preload. */
export const installFactoryHost = (bridge: HostApiBridge | null): void => {
  if (bridge === null) {
    delete (window as { adadexFactoryHost?: HostApiBridge }).adadexFactoryHost;
    return;
  }
  (window as { adadexFactoryHost?: HostApiBridge }).adadexFactoryHost = bridge;
};

export const createFactoryHost = (): FactoryHost => {
  if (typeof window === "undefined") return createEmptyFactoryHost();
  const candidate: unknown = (window as { adadexFactoryHost?: unknown }).adadexFactoryHost;
  return isBridge(candidate) ? createHostApiFactoryHost(candidate) : createEmptyFactoryHost();
};

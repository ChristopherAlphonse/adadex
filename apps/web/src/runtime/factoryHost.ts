import {
  isBoolean,
  isFunctionValue,
  isNumber,
  isObjectValue,
  isString,
  type ParsedRecord,
  type ParsedValue,
} from "@adadex/core";
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

/** Inputs attached to factory actions; the host owns any further validation. */
export type FactoryActionInput = Readonly<Record<string, string>>;

/** A role as the host stores it. `definition` is the whole record, so it can be edited and saved back. */
export interface FactoryRole {
  readonly id: string;
  readonly name: string;
  readonly origin: "preset" | "user";
  readonly definition: ParsedRecord;
}

export interface FactoryLogEvent {
  readonly id: number;
  readonly ts: string;
  readonly level: string;
  readonly source: string;
  readonly message: string;
  readonly jobId?: string;
}

export type FactoryAuditCheck =
  | { readonly ok: true; readonly entries: number }
  | { readonly ok: false; readonly reason: string };

export interface FactoryHost {
  isAvailable(): boolean;
  listJobs(): Promise<readonly FactoryJob[]>;
  listWorkflows(): Promise<readonly FactoryWorkflow[]>;
  listApprovals(): Promise<readonly FactoryApproval[]>;
  listProcesses(): Promise<readonly FactoryProcess[]>;
  runAction(actionId: string, input: FactoryActionInput): Promise<void>;
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
  /** Null when this host has no roles. */
  listRoles(): Promise<readonly FactoryRole[] | null>;
  /** Saving needs the user's yes in a native dialog. The host validates the role. */
  saveRole(role: ParsedRecord): Promise<void>;
  removeRole(id: string): Promise<void>;
  /** The newest events first, or null when this host has no logs. */
  listLogs(): Promise<readonly FactoryLogEvent[] | null>;
  verifyAudit(jobId: string): Promise<FactoryAuditCheck>;
  /** Called for every host event. Returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void;
}

/** Test seam and the shape used when a preload adapts the request/response API. */
export interface HostApiBridge {
  handle(request: ParsedValue): Promise<ParsedValue>;
  subscribe(listener: (event: ParsedValue) => void): () => void;
}

/** The shape Electron's preload exposes today as `window.adadex`. */
export interface ElectronAdadexBridge {
  request(request: ParsedValue): Promise<ParsedValue>;
  onEvent(listener: (event: ParsedValue) => void): () => void;
}

type HostBridge = HostApiBridge | ElectronAdadexBridge;

declare global {
  interface Window {
    adadexFactoryHost?: HostBridge;
    adadex?: unknown;
  }
}

interface HostTransport {
  send(request: ParsedValue): Promise<ParsedValue>;
  listen(listener: (event: ParsedValue) => void): () => void;
}

/** Fields the renderer may place on a host request envelope. */
type FactoryRequestFields = {
  readonly actionId?: string;
  readonly approvalId?: string;
  readonly approved?: boolean;
  readonly checks?: string;
  readonly enabled?: boolean;
  readonly id?: string;
  readonly input?: FactoryActionInput;
  readonly jobId?: string;
  readonly processId?: string;
  readonly role?: ParsedRecord;
};

type OptionalJobFields = { parkedFrom?: string; worktree?: string };

type OptionalProcessFields = { endedAt?: string };

type MutableLogEvent = {
  id: number;
  ts: string;
  level: string;
  source: string;
  message: string;
  jobId?: string;
};

const toTransport = (bridge: HostBridge): HostTransport => ({
  send: (request) => ("handle" in bridge ? bridge.handle(request) : bridge.request(request)),
  listen: (listener) =>
    "subscribe" in bridge ? bridge.subscribe(listener) : bridge.onEvent(listener),
});

const isRecord = <T>(value: T): value is T & ParsedRecord =>
  isObjectValue(value) && value !== null && !Array.isArray(value);

const readString = (record: ParsedRecord, key: string): string | undefined => {
  const value = record[key];

  return isString(value) && value.length > 0 ? value : undefined;
};

const readNumber = (record: ParsedRecord, key: string): number | undefined => {
  const value = record[key];

  return isNumber(value) && Number.isFinite(value) ? value : undefined;
};

const parseJob = (raw: ParsedValue): FactoryJob => {
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

  if (commitValue !== null && !isString(commitValue)) {
    throw new Error("host returned an invalid job commit");
  }

  const optional: OptionalJobFields = {};
  const parkedFrom = readString(raw, "parkedFrom");

  if (parkedFrom !== undefined) optional.parkedFrom = parkedFrom;
  const worktree = readString(raw, "worktree");

  if (worktree !== undefined) optional.worktree = worktree;

  return { id, title, workflowId, stage, round, roundLimit, commit: commitValue, ...optional };
};

const parseWorkflow = (raw: ParsedValue): FactoryWorkflow => {
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

const parseApproval = (raw: ParsedValue): FactoryApproval => {
  if (!isRecord(raw)) throw new Error("host returned an invalid approval");
  const approvalId = readString(raw, "approvalId");
  const actionId = readString(raw, "actionId");
  const reason = readString(raw, "reason");

  if (approvalId === undefined || actionId === undefined || reason === undefined) {
    throw new Error("host returned an incomplete approval");
  }

  return { approvalId, actionId, reason };
};

const parseProcess = (raw: ParsedValue): FactoryProcess => {
  if (!isRecord(raw)) throw new Error("host returned an invalid process");
  const processId = readString(raw, "processId");
  const label = readString(raw, "label");
  const startedAt = readString(raw, "startedAt");

  if (processId === undefined || label === undefined || startedAt === undefined) {
    throw new Error("host returned an incomplete process");
  }

  const optional: OptionalProcessFields = {};
  const endedAt = readString(raw, "endedAt");

  if (endedAt !== undefined) optional.endedAt = endedAt;

  return { processId, label, startedAt, ...optional };
};

const parseRole = (raw: ParsedValue): FactoryRole => {
  if (!isRecord(raw)) throw new Error("host returned an invalid role");
  const id = readString(raw, "id");
  const name = readString(raw, "name");
  const origin = raw.origin;

  if (id === undefined || name === undefined || (origin !== "preset" && origin !== "user")) {
    throw new Error("host returned a role without an id, name or origin");
  }

  return { id, name, origin, definition: raw };
};

const parseLogEvent = (raw: ParsedValue): FactoryLogEvent => {
  if (!isRecord(raw)) throw new Error("host returned an invalid log event");
  const id = readNumber(raw, "id");
  const ts = readString(raw, "ts");
  const level = readString(raw, "level");
  const source = readString(raw, "source");
  const message = readString(raw, "message");

  if (
    id === undefined ||
    ts === undefined ||
    level === undefined ||
    source === undefined ||
    message === undefined
  ) {
    throw new Error("host returned an incomplete log event");
  }

  const event: MutableLogEvent = { id, ts, level, source, message };
  const jobId = readString(raw, "jobId");

  if (jobId !== undefined) {
    event.jobId = jobId;
  }

  return event;
};

const parseAuditCheck = (raw: ParsedValue): FactoryAuditCheck => {
  if (isRecord(raw) && raw.ok === true && isNumber(raw.entries)) {
    return { ok: true, entries: raw.entries };
  }

  if (isRecord(raw) && raw.ok === false && isString(raw.reason)) {
    return { ok: false, reason: raw.reason };
  }

  throw new Error("host returned an invalid audit check");
};

const parseList = <T>(raw: ParsedValue, parse: (item: ParsedValue) => T): readonly T[] => {
  if (!Array.isArray(raw)) throw new Error("host returned an invalid list");

  return raw.map(parse);
};

const unwrap = (raw: ParsedValue): ParsedValue => {
  if (!isRecord(raw)) throw new Error("host returned an invalid response");

  if (raw.ok === true) return raw.data ?? null;

  if (raw.ok === false && Array.isArray(raw.errors)) {
    const messages = raw.errors.filter((error): error is string => isString(error));
    throw new Error(messages.join("; ") || "host request failed");
  }

  throw new Error("host returned an invalid response");
};

export const createHostApiFactoryHost = (bridge: HostBridge): FactoryHost => {
  const transport = toTransport(bridge);

  const send = async (kind: string, fields: FactoryRequestFields): Promise<ParsedValue> =>
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

      if (!isRecord(raw.data) || !isBoolean(raw.data.enabled)) {
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

      if (!isRecord(raw.data) || !isString(raw.data.checks)) {
        throw new Error("host returned invalid project settings");
      }

      return raw.data.checks;
    },
    setChecks: async (checks) => {
      await send("project.set", { checks });
    },
    listRoles: async () => {
      const raw = await transport.send({ kind: "roles.list" });

      return isRecord(raw) && raw.ok === true ? parseList(raw.data ?? null, parseRole) : null;
    },
    saveRole: async (role) => {
      await send("roles.save", { role });
    },
    removeRole: async (id) => {
      await send("roles.remove", { id });
    },
    listLogs: async () => {
      const raw = await transport.send({ kind: "logs.query", limit: 50 });

      return isRecord(raw) && raw.ok === true ? parseList(raw.data ?? null, parseLogEvent) : null;
    },
    verifyAudit: async (jobId) => parseAuditCheck(await send("audit.verify", { jobId })),
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
  listRoles: async () => null,
  saveRole: async () => undefined,
  removeRole: async () => undefined,
  listLogs: async () => null,
  verifyAudit: async () => ({ ok: false, reason: "the factory host is not connected" }),
  subscribe: () => () => undefined,
});

const isBridge = (value: unknown): value is HostBridge => {
  if (!isRecord(value)) return false;
  const hasRequestApi = isFunctionValue(value.request) && isFunctionValue(value.onEvent);
  const hasHandleApi = isFunctionValue(value.handle) && isFunctionValue(value.subscribe);

  return hasRequestApi || hasHandleApi;
};

/** Test seam: lets a component test install a host without an Electron preload. */
export const installFactoryHost = (bridge: HostBridge | null): void => {
  if (bridge === null) {
    delete window.adadexFactoryHost;

    return;
  }

  window.adadexFactoryHost = bridge;
};

export const createFactoryHost = (): FactoryHost => {
  if (typeof window === "undefined") return createEmptyFactoryHost();

  const injected: unknown = window.adadexFactoryHost;

  if (isBridge(injected)) return createHostApiFactoryHost(injected);

  const electron: unknown = window.adadex;

  return isBridge(electron) ? createHostApiFactoryHost(electron) : createEmptyFactoryHost();
};

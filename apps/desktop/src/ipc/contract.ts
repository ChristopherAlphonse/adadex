import {
  asNumber,
  asRecord,
  asString,
  isBoolean,
  isString,
  type ParsedRecord,
  type ParsedValue,
} from "@adadex/core";

/**
 * Everything the UI can ask the host to do. The UI is untrusted input (it is web content), so every request is
 * checked by `parseRequest` before anything acts on it. Electron's main process will only forward to this layer.
 */
export type HostRequest =
  | { readonly kind: "workflows.list" }
  | { readonly kind: "workflows.save"; readonly workflow: ParsedValue }
  | {
      readonly kind: "workflows.fork";
      readonly fromId: string;
      readonly newId: string;
      readonly name: string;
    }
  | { readonly kind: "workflows.remove"; readonly id: string }
  | { readonly kind: "jobs.list" }
  | {
      readonly kind: "jobs.create";
      readonly workflowId: string;
      readonly id: string;
      readonly title: string;
    }
  | { readonly kind: "action.run"; readonly actionId: string; readonly input: ParsedValue }
  | { readonly kind: "approval.respond"; readonly approvalId: string; readonly approved: boolean }
  | { readonly kind: "approvals.list" }
  | { readonly kind: "processes.list" }
  | { readonly kind: "process.kill"; readonly processId: string }
  | { readonly kind: "skills.resolve"; readonly workflowId: string }
  | { readonly kind: "roles.list" }
  | { readonly kind: "roles.save"; readonly role: ParsedValue }
  | { readonly kind: "roles.remove"; readonly id: string }
  | { readonly kind: "scheduler.status" }
  | {
      readonly kind: "logs.query";
      readonly jobId?: string;
      readonly runId?: string;
      readonly role?: string;
      readonly level?: "debug" | "info" | "warn" | "error";
      readonly limit?: number;
    }
  | { readonly kind: "audit.verify"; readonly jobId: string }
  | { readonly kind: "scheduler.set"; readonly enabled: boolean }
  | { readonly kind: "config.get" }
  | { readonly kind: "config.set"; readonly config: ParsedValue }
  | { readonly kind: "project.get" }
  | { readonly kind: "project.set"; readonly checks: string };

/** A process the operator may inspect or kill from the board. */
export interface HostProcess {
  readonly processId: string;
  readonly label: string;
  readonly startedAt: string;
  readonly endedAt?: string;
}

/** Injected by Electron main; the host itself never starts or signals processes. */
export interface ProcessPort {
  list(): Promise<readonly HostProcess[]>;
  kill(processId: string): Promise<void>;
}

export type HostResponse =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly errors: readonly string[] };

export type ParsedRequest =
  | { readonly ok: true; readonly request: HostRequest }
  | { readonly ok: false; readonly error: string };

const text = (v: ParsedValue | undefined): v is string =>
  isString(v) && v !== "" && v.length <= 200;

/** Reads a field the STRING_FIELDS loop has already validated. */
const fieldText = (record: ParsedRecord, key: string): string => asString(record[key]) ?? "";

type RequestKind = HostRequest["kind"];

const REQUEST_KINDS: readonly RequestKind[] = [
  "workflows.list",
  "workflows.save",
  "workflows.fork",
  "workflows.remove",
  "jobs.list",
  "jobs.create",
  "action.run",
  "approval.respond",
  "approvals.list",
  "processes.list",
  "process.kill",
  "skills.resolve",
  "roles.list",
  "roles.save",
  "roles.remove",
  "scheduler.status",
  "logs.query",
  "audit.verify",
  "scheduler.set",
  "config.get",
  "config.set",
  "project.get",
  "project.set",
];

const isRequestKind = (v: ParsedValue | undefined): v is RequestKind =>
  v !== undefined && REQUEST_KINDS.some((kind) => kind === v);

type StringFieldMap = Readonly<Partial<Record<RequestKind, readonly string[]>>>;

const STRING_FIELDS = {
  "workflows.fork": ["fromId", "newId", "name"],
  "workflows.remove": ["id"],
  "jobs.create": ["workflowId", "id", "title"],
  "action.run": ["actionId"],
  "approval.respond": ["approvalId"],
  "process.kill": ["processId"],
  "skills.resolve": ["workflowId"],
  "roles.remove": ["id"],
  "audit.verify": ["jobId"],
} satisfies StringFieldMap;

const stringFieldsFor = (kind: RequestKind): readonly string[] =>
  Object.entries(STRING_FIELDS).find(([name]) => name === kind)?.[1] ?? [];

const NO_FIELDS: ReadonlySet<string> = new Set([
  "workflows.list",
  "jobs.list",
  "approvals.list",
  "processes.list",
  "config.get",
  "roles.list",
  "scheduler.status",
  "project.get",
]);

const LEVELS = ["debug", "info", "warn", "error"] as const;

type LogLevel = (typeof LEVELS)[number];

const isLogLevel = (v: ParsedValue | undefined): v is LogLevel =>
  v !== undefined && LEVELS.some((level) => level === v);

interface LogsQueryDraft {
  kind: "logs.query";
  jobId?: string;
  runId?: string;
  role?: string;
  level?: LogLevel;
  limit?: number;
}

/** The UI's JSON is parsed here; downstream code only sees a checked `HostRequest`. */
export const parseRequest = (raw: ParsedValue): ParsedRequest => {
  const record = asRecord(raw);

  if (record === null) return { ok: false, error: "a request needs a kind" };
  const parsedKind = asString(record.kind);

  if (parsedKind === null) return { ok: false, error: "a request needs a kind" };

  if (!isRequestKind(parsedKind)) return { ok: false, error: `unknown request ${parsedKind}` };

  const kind = parsedKind;

  if (NO_FIELDS.has(kind))
    // SAFETY: NO_FIELDS lists exactly the HostRequest variants that carry no extra fields.
    return { ok: true, request: { kind } as HostRequest };

  const stringFields = stringFieldsFor(kind);

  for (const field of stringFields) {
    if (!text(record[field])) return { ok: false, error: `${kind} needs ${field}` };
  }

  switch (kind) {
    case "workflows.save":
      return record.workflow === undefined
        ? { ok: false, error: "workflows.save needs workflow" }
        : { ok: true, request: { kind, workflow: record.workflow } };
    case "config.set":
      return record.config === undefined
        ? { ok: false, error: "config.set needs config" }
        : { ok: true, request: { kind, config: record.config } };
    case "project.set":
      return isString(record.checks)
        ? { ok: true, request: { kind, checks: record.checks } }
        : { ok: false, error: "project.set needs checks" };
    case "logs.query": {
      const q: LogsQueryDraft = { kind: "logs.query" };

      for (const f of ["jobId", "runId", "role"] as const) {
        const value = record[f];

        if (value === undefined) continue;

        if (!text(value)) return { ok: false, error: `logs.query ${f} must be text` };
        q[f] = value;
      }

      if (record.level !== undefined) {
        if (!isLogLevel(record.level))
          return { ok: false, error: "logs.query level must be debug, info, warn or error" };
        q.level = record.level;
      }

      if (record.limit !== undefined) {
        const limit = asNumber(record.limit);

        if (limit === null || !Number.isInteger(limit) || limit < 1 || limit > 1000)
          return { ok: false, error: "logs.query limit must be a whole number from 1 to 1000" };
        q.limit = limit;
      }

      return { ok: true, request: q };
    }

    case "audit.verify":
      return { ok: true, request: { kind, jobId: fieldText(record, "jobId") } };
    case "roles.save":
      return record.role === undefined
        ? { ok: false, error: "roles.save needs role" }
        : { ok: true, request: { kind, role: record.role } };
    case "scheduler.set":
      return isBoolean(record.enabled)
        ? { ok: true, request: { kind, enabled: record.enabled } }
        : { ok: false, error: "scheduler.set needs enabled as true or false" };
    case "approval.respond":
      return isBoolean(record.approved)
        ? {
            ok: true,
            request: {
              kind,
              approvalId: fieldText(record, "approvalId"),
              approved: record.approved,
            },
          }
        : { ok: false, error: "approval.respond needs approved as true or false" };
    case "workflows.fork":
      return {
        ok: true,
        request: {
          kind,
          fromId: fieldText(record, "fromId"),
          newId: fieldText(record, "newId"),
          name: fieldText(record, "name"),
        },
      };
    case "workflows.remove":
      return { ok: true, request: { kind, id: fieldText(record, "id") } };
    case "jobs.create":
      return {
        ok: true,
        request: {
          kind,
          workflowId: fieldText(record, "workflowId"),
          id: fieldText(record, "id"),
          title: fieldText(record, "title"),
        },
      };
    case "action.run":
      return {
        ok: true,
        request: {
          kind,
          actionId: fieldText(record, "actionId"),
          input: record.input ?? null,
        },
      };
    case "process.kill":
      return { ok: true, request: { kind, processId: fieldText(record, "processId") } };
    case "skills.resolve":
      return { ok: true, request: { kind, workflowId: fieldText(record, "workflowId") } };
    case "roles.remove":
      return { ok: true, request: { kind, id: fieldText(record, "id") } };
    case "approvals.list":
    case "processes.list":
      return { ok: true, request: { kind } };
    default:
      return { ok: false, error: `unknown request ${kind}` };
  }
};

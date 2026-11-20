/**
 * Everything the UI can ask the host to do. The UI is untrusted input (it is web content), so every request is
 * checked by `parseRequest` before anything acts on it. Electron's main process will only forward to this layer.
 */
export type HostRequest =
  | { readonly kind: "workflows.list" }
  | { readonly kind: "workflows.save"; readonly workflow: unknown }
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
  | { readonly kind: "action.run"; readonly actionId: string; readonly input: unknown }
  | { readonly kind: "approval.respond"; readonly approvalId: string; readonly approved: boolean }
  | { readonly kind: "approvals.list" }
  | { readonly kind: "processes.list" }
  | { readonly kind: "process.kill"; readonly processId: string }
  | { readonly kind: "skills.resolve"; readonly workflowId: string }
  | { readonly kind: "roles.list" }
  | { readonly kind: "roles.save"; readonly role: unknown }
  | { readonly kind: "roles.remove"; readonly id: string }
  | { readonly kind: "scheduler.status" }
  | { readonly kind: "scheduler.set"; readonly enabled: boolean }
  | { readonly kind: "config.get" }
  | { readonly kind: "config.set"; readonly config: unknown };

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

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v !== "" && v.length <= 200;

const STRING_FIELDS: Readonly<Record<string, readonly string[]>> = {
  "workflows.fork": ["fromId", "newId", "name"],
  "workflows.remove": ["id"],
  "jobs.create": ["workflowId", "id", "title"],
  "action.run": ["actionId"],
  "approval.respond": ["approvalId"],
  "process.kill": ["processId"],
  "skills.resolve": ["workflowId"],
  "roles.remove": ["id"],
};
const NO_FIELDS = new Set([
  "workflows.list",
  "jobs.list",
  "approvals.list",
  "processes.list",
  "config.get",
  "roles.list",
  "scheduler.status",
]);

export const parseRequest = (raw: unknown): ParsedRequest => {
  if (!isObj(raw) || typeof raw.kind !== "string")
    return { ok: false, error: "a request needs a kind" };
  const kind = raw.kind;

  if (NO_FIELDS.has(kind)) return { ok: true, request: { kind } as HostRequest };
  for (const field of STRING_FIELDS[kind] ?? []) {
    if (!text(raw[field])) return { ok: false, error: `${kind} needs ${field}` };
  }
  switch (kind) {
    case "workflows.save":
      return "workflow" in raw
        ? { ok: true, request: { kind, workflow: raw.workflow } }
        : { ok: false, error: "workflows.save needs workflow" };
    case "config.set":
      return "config" in raw
        ? { ok: true, request: { kind, config: raw.config } }
        : { ok: false, error: "config.set needs config" };
    case "roles.save":
      return "role" in raw
        ? { ok: true, request: { kind, role: raw.role } }
        : { ok: false, error: "roles.save needs role" };
    case "scheduler.set":
      return typeof raw.enabled === "boolean"
        ? { ok: true, request: { kind, enabled: raw.enabled } }
        : { ok: false, error: "scheduler.set needs enabled as true or false" };
    case "approval.respond":
      return typeof raw.approved === "boolean"
        ? { ok: true, request: raw as unknown as HostRequest }
        : { ok: false, error: "approval.respond needs approved as true or false" };
    case "workflows.fork":
    case "workflows.remove":
    case "jobs.create":
    case "action.run":
    case "approvals.list":
    case "processes.list":
    case "process.kill":
    case "skills.resolve":
    case "roles.remove":
      return { ok: true, request: raw as unknown as HostRequest };
    default:
      return { ok: false, error: `unknown request ${kind}` };
  }
};

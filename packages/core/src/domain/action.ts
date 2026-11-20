/** What an action can reach. `git-remote` is never allowed in the registry. */
export type ActionTouch = "fs" | "git" | "git-remote" | "process" | "network";

/**
 * free: an agent may run it.
 * ask: runs once someone approves it.
 * human: only a human click runs it. An agent can request it but never run it.
 */
export type ActionClass = "free" | "ask" | "human";

export interface ActionDef<I = unknown> {
  readonly id: string;
  readonly title: string;
  readonly touches: readonly ActionTouch[];
  readonly class: ActionClass;
  /** Validates and narrows raw input. Throws with a readable message when it is wrong. */
  readonly parse: (input: unknown) => I;
}

export interface HumanClick {
  readonly actionId: string;
}

/**
 * Who is calling. A `human` caller with a click must be built by the shell's main process from a
 * real user gesture. Core only checks the shape, so no other layer may construct one.
 */
export type ActionContext =
  | { readonly caller: "agent"; readonly approvedActionId?: string }
  | { readonly caller: "human"; readonly humanClick?: HumanClick };

export type AuthorizeResult<I = unknown> =
  | { readonly kind: "run"; readonly input: I }
  | { readonly kind: "ask"; readonly reason: string }
  | { readonly kind: "needs-human-click"; readonly reason: string }
  | { readonly kind: "deny"; readonly reason: string };

const JOB_ID = /^[a-z0-9][a-z0-9-]*$/;

const asRecord = (input: unknown): Record<string, unknown> => {
  if (typeof input !== "object" || input === null) throw new Error("expected an object");
  return input as Record<string, unknown>;
};

const jobId = (value: unknown): string => {
  if (typeof value !== "string" || !JOB_ID.test(value))
    throw new Error("job id must match [a-z0-9][a-z0-9-]*");
  return value;
};

const parseJobRef = (input: unknown): { id: string } => ({ id: jobId(asRecord(input).id) });

const parseAdvance = (input: unknown): { id: string; to: string } => {
  const r = asRecord(input);
  if (typeof r.to !== "string" || r.to === "") throw new Error("expected a target stage");
  return { id: jobId(r.id), to: r.to };
};

/** The factory pipeline's actions as data. Execution is the runtime's job. */
export const FACTORY_ACTIONS: readonly ActionDef[] = [
  {
    id: "job.advance",
    title: "Advance a job to a stage",
    touches: ["fs"],
    class: "free",
    parse: parseAdvance,
  },
  {
    id: "job.run_gate",
    title: "Run the checks gate",
    touches: ["process", "fs"],
    class: "free",
    parse: parseJobRef,
  },
  {
    id: "job.open_worktree",
    title: "Open the job's worktree",
    touches: ["git", "fs"],
    class: "free",
    parse: parseJobRef,
  },
  {
    id: "job.approve_spec",
    title: "Approve the spec",
    touches: ["fs"],
    class: "human",
    parse: parseJobRef,
  },
  {
    id: "job.commit_local",
    title: "Commit locally",
    touches: ["git"],
    class: "human",
    parse: parseJobRef,
  },
  {
    id: "job.unblock",
    title: "Unblock a parked job",
    touches: ["fs"],
    class: "human",
    parse: parseJobRef,
  },
];

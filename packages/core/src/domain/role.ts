/** The tools an agent may be given. Network tools are not on this list, so a role can never be granted one. */
export const ROLE_TOOLS = ["Read", "Grep", "Glob", "Edit", "Write", "MultiEdit", "Bash"] as const;

export type RoleTool = (typeof ROLE_TOOLS)[number];

export interface RoleLimits {
  /** Most actions an agent in this role may call in one run. */
  readonly maxActions: number;
  /** Longest one run may last. */
  readonly maxSeconds: number;
}

/**
 * What an agent is allowed to do, decided by a person and fixed for the whole run. A role grants capabilities
 * and nothing else: it cannot grant a human-only action, relax a deny rule, or reach a protected file.
 */
export interface RoleDefinition {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  /** `preset` ships with the app. `user` was made by a person. */
  readonly origin: "preset" | "user";
  /** Actions it may call. Never includes a human-only action. */
  readonly actions: readonly string[];
  /** Actions that normally ask a person, which this role may run without asking. A subset of `actions`. */
  readonly autoApprove?: readonly string[];
  /** The stages it may move a job to with `job.advance`. */
  readonly advanceTo: readonly string[];
  readonly tools: readonly RoleTool[];
  /** Extra shell commands it may run, on top of the base policy. Deny and ask rules still win. */
  readonly allowShell?: readonly string[];
  /** Documents in the job's folder it may write, as globs relative to that folder. Everything else there is read-only. */
  readonly writeDocs: readonly string[];
  /** Whether it may change files in the job's worktree. */
  readonly editsCode: boolean;
  readonly limits: RoleLimits;
}

/** Facts about one run, fixed when it starts. An agent has no action that changes any of it. */
export interface RunBinding {
  readonly runId: string;
  readonly roleId: string;
  readonly jobId: string;
  readonly stageId: string;
  readonly startedAt: string;
}

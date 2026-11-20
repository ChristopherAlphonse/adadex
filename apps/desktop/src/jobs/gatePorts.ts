export interface CheckResult {
  /** Exit code, or null when the command was killed. */
  readonly code: number | null;
  readonly timedOut: boolean;
  /** Combined stdout and stderr, already cut to the tail. */
  readonly output: string;
}

/** Runs the project's check command. The real one starts it in its own process group and kills it on timeout. */
export interface CheckRunner {
  run(command: string, cwd: string, timeoutMs: number): Promise<CheckResult>;
}

/**
 * What the gate and the commit need from git. There is deliberately no push and no remote operation here,
 * so nothing built on this port can publish work.
 */
export interface GitPort {
  /** Files changed on the job's branch since `base`, plus uncommitted changes. */
  changedFiles(cwd: string, base: string): Promise<readonly string[]>;
  /** The git tree hash of everything in the working tree, so a commit can tell if it changed after the gate. */
  fingerprint(cwd: string): Promise<string>;
  head(cwd: string): Promise<string>;
  /** The commit where the job's branch left `base`. */
  mergeBase(cwd: string, base: string): Promise<string>;
  stageAll(cwd: string): Promise<void>;
  /** Commit the staged changes with the message in a file. */
  commit(
    cwd: string,
    messageFile: string,
    env?: NodeJS.ProcessEnv,
  ): Promise<{ ok: boolean; output: string }>;
}

export interface GateConfig {
  readonly checks: string;
  readonly timeoutMs: number;
  readonly baseBranch: string;
  /** Extra protected patterns on top of the built-in floor. */
  readonly protectedPaths: readonly string[];
}

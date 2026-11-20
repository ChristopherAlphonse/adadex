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

/** What the gate needs from git. */
export interface GitPort {
  /** Files changed on the job's branch since `base`, plus uncommitted changes. */
  changedFiles(cwd: string, base: string): Promise<readonly string[]>;
  /** A short fingerprint of the working tree, so a later commit can tell if it changed after the gate. */
  fingerprint(cwd: string): Promise<string>;
}

export interface GateConfig {
  readonly checks: string;
  readonly timeoutMs: number;
  readonly baseBranch: string;
  /** Extra protected patterns on top of the built-in floor. */
  readonly protectedPaths: readonly string[];
}

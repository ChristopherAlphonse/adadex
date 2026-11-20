import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { SpawnAgent } from "./claudeCodeProvider";

const SANDBOX_EXEC = "/usr/bin/sandbox-exec";

/** The operating system's sandbox is only there on macOS today. */
export const sandboxAvailable = (): boolean =>
  process.platform === "darwin" && existsSync(SANDBOX_EXEC);

export interface SandboxPlan {
  /** Folders the process may write. Everything else on disk is read-only to it. */
  readonly writable: readonly string[];
  /** Files inside a writable folder that it still may not write. */
  readonly denyWrite: readonly string[];
  /** Same, by pattern (a regular expression over the whole path). */
  readonly denyWriteRegex: readonly string[];
  /** Folders it may not even read. */
  readonly denyRead: readonly string[];
}

/** Credentials and the app's own data. No agent needs them, and an allowed `cat` could otherwise send them anywhere. */
export const defaultDenyRead = (home: string = homedir()): readonly string[] =>
  [
    ".ssh",
    ".aws",
    ".gnupg",
    ".kube",
    ".config/gcloud",
    ".config/gh",
    ".netrc",
    ".docker/config.json",
  ].map((p) => join(home, p));

/** Places every agent may write whatever its role: scratch space, its own settings, and package caches. */
export const defaultWritable = (home: string = homedir()): readonly string[] => [
  "/dev",
  "/private/tmp",
  "/private/var/folders",
  join(home, ".claude"),
  join(home, ".claude.json"),
  join(home, ".npm"),
  join(home, "Library", "Caches"),
];

const quote = (path: string): string => {
  if (/["\n\r\0]/.test(path))
    throw new Error(`a path with a quote or a newline cannot go in a sandbox profile: ${path}`);

  return `"${path.replaceAll("\\", "\\\\")}"`;
};

/** A pattern goes in as written: its backslashes are the regular expression's own, so they are not doubled. */
const quotePattern = (pattern: string): string => {
  if (/["\n\r\0]/.test(pattern))
    throw new Error(
      `a pattern with a quote or a newline cannot go in a sandbox profile: ${pattern}`,
    );

  return `"${pattern}"`;
};

/** Escape a path so it can sit inside a regular expression. */
export const regexEscape = (path: string): string => path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A macOS sandbox profile. Later rules win, so it starts open, closes all writes, opens the writable folders, and then
 * closes the protected files again. Everything it cannot see inside (a build tool, `npm test`) is held to the same rules.
 */
export const buildProfile = (plan: SandboxPlan): string =>
  [
    "(version 1)",
    "(allow default)",
    "(deny file-write*)",
    `(allow file-write* ${plan.writable.map((p) => `(subpath ${quote(p)})`).join(" ")})`,
    ...plan.denyWrite.map((p) => `(deny file-write* (literal ${quote(p)}))`),
    ...plan.denyWriteRegex.map((r) => `(deny file-write* (regex #${quotePattern(r)}))`),
    ...plan.denyRead.map((p) => `(deny file-read* (subpath ${quote(p)}))`),
  ].join("\n");

/** Start the agent inside the sandbox instead of directly. */
export const sandboxSpawn =
  (inner: SpawnAgent, profile: string): SpawnAgent =>
  (command, args, cwd) =>
    inner(SANDBOX_EXEC, ["-p", profile, command, ...args], cwd);

/** The git directory a worktree points at, read from its `.git` file. */
export const gitDirOf = (worktree: string): string | undefined => {
  try {
    const m = /^gitdir:\s*(.+)$/m.exec(readFileSync(join(worktree, ".git"), "utf8"));

    return m?.[1]?.trim();
  } catch {
    return undefined;
  }
};

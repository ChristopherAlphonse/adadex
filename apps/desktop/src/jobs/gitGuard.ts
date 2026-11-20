import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const git = async (cwd: string, args: string[]): Promise<string> =>
  (await run("git", args, { cwd })).stdout.trim();

const quote = (s: string): string => `'${s.replaceAll("'", `'\\''`)}'`;

export interface HumanKey {
  /** Lives only in the app's memory. Never written to disk, never in an agent's environment. */
  readonly key: string;
  readonly hash: string;
}

export const createHumanKey = (): HumanKey => {
  const key = randomBytes(32).toString("hex");

  return { key, hash: createHash("sha256").update(key).digest("hex") };
};

export const KEY_ENV = "ADADEX_HUMAN_KEY";

const MESSAGE = "adadex policy: this needs a person to press the button in the app";

const head = (hashFile: string): string => `#!/bin/sh
human_ok() {
  [ -n "$${KEY_ENV}" ] || return 1
  want=$(cat ${quote(hashFile)} 2>/dev/null) || return 1
  [ -n "$want" ] || return 1
  got=$(printf %s "$${KEY_ENV}" | { sha256sum 2>/dev/null || shasum -a 256; } | cut -d' ' -f1)
  [ "$got" = "$want" ]
}
`;

/** The three hooks that matter, each followed by the repo's own hook of the same name so its checks still run. */
const guarded = (hashFile: string, branchPrefix: string): Record<string, string> => ({
  "pre-commit": `${head(hashFile)}human_ok || { echo "${MESSAGE}" >&2; exit 1; }\nunset ${KEY_ENV}\n`,
  "pre-push": `${head(hashFile)}in=$(cat)\nhuman_ok || { echo "${MESSAGE}" >&2; exit 1; }\nunset ${KEY_ENV}\n`,
  "reference-transaction": `${head(hashFile)}in=$(cat)
if [ "$1" = "prepared" ] && ! human_ok; then
  printf '%s\\n' "$in" | while read old new ref; do
    case "$ref" in refs/heads/${branchPrefix}*) if [ "$new" != "0000000000000000000000000000000000000000" ]; then exit 1; fi;; esac
  done
  rc=$?
  [ $rc -eq 0 ] || { echo "${MESSAGE}" >&2; exit $rc; }
fi
unset ${KEY_ENV}
`,
});

export interface InstallGitGuard {
  readonly worktree: string;
  /** Where the generated hooks go. Outside the worktree, so the agent's edits cannot reach them. */
  readonly hooksDir: string;
  /** Holds the key's hash. Outside the worktree too. */
  readonly hashFile: string;
  readonly hash: string;
  /** Updates to branches under this prefix need the key. */
  readonly branchPrefix: string;
}

const isExecutable = async (path: string): Promise<boolean> => {
  const s = await stat(path).catch(() => null);

  return s?.isFile() === true && (s.mode & 0o111) !== 0;
};

/**
 * Make `git commit`, `git push` and updates to the job's branch fail in this worktree unless the human key is
 * present. This is the second lock behind the tool policy: it holds even if an agent finds another way to run git.
 */
export const installGitGuard = async (o: InstallGitGuard): Promise<void> => {
  await mkdir(o.hooksDir, { recursive: true });
  await writeFile(o.hashFile, `${o.hash}\n`, { mode: 0o600 });
  await chmod(o.hashFile, 0o600);

  const common = await git(o.worktree, ["rev-parse", "--git-common-dir"]);
  const configured = await git(o.worktree, ["config", "core.hooksPath"]).catch(() => "");
  const base = resolve(o.worktree, common);

  const original = configured
    ? isAbsolute(configured)
      ? configured
      : resolve(o.worktree, configured)
    : join(base, "hooks");

  const names = new Set<string>();

  for (const name of await readdir(original).catch(() => /* SAFETY: preceding checks establish the invariant this assertion encodes. */ [] as string[])) {
    if (await isExecutable(join(original, name))) names.add(name);
  }

  const mine = guarded(o.hashFile, o.branchPrefix);

  for (const name of new Set([...names, ...Object.keys(mine)])) {
    const target = quote(join(original, name));
    let body = mine[name] ?? "#!/bin/sh\n";

    if (names.has(name)) {
      body +=
        name === "reference-transaction" || name === "pre-push"
          ? `printf '%s\\n' "$in" | ${target} "$@"\n`
          : `exec ${target} "$@"\n`;
    }

    await writeFile(join(o.hooksDir, name), body, { mode: 0o755 });
    await chmod(join(o.hooksDir, name), 0o755);
  }

  await git(o.worktree, ["config", "extensions.worktreeConfig", "true"]);
  await git(o.worktree, ["config", "--worktree", "core.hooksPath", o.hooksDir]);
};

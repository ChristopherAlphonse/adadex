import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { GitClient } from "./types";

export const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const runGitCommand = (cwd: string, args: string[]): string =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  }).trim();

const readOptionalGitCommand = (cwd: string, args: string[]) => {
  try {
    return runGitCommand(cwd, args);
  } catch {
    return null;
  }
};

const isExitCode = (error: unknown, exitCode: number) => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const errorWithStatus = error as { status?: unknown };
  return errorWithStatus.status === exitCode;
};

const CONFLICT_MARKERS = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

const parseChangedFile = (line: string) => {
  const payload = line.slice(3).trim();
  if (!payload) {
    return null;
  }

  const renameMarker = " -> ";
  const renameIndex = payload.indexOf(renameMarker);
  if (renameIndex === -1) {
    return payload;
  }

  return payload.slice(renameIndex + renameMarker.length).trim();
};

const parseDiffNumstatLineCounts = (
  numstatOutput: string,
): { insertedLineCount: number; deletedLineCount: number } =>
  numstatOutput
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .reduce(
      (totals, line) => {
        const [rawInserted, rawDeleted] = line.split("\t");
        const parsedInserted = Number.parseInt(rawInserted ?? "0", 10);
        const parsedDeleted = Number.parseInt(rawDeleted ?? "0", 10);
        return {
          insertedLineCount:
            totals.insertedLineCount + (Number.isFinite(parsedInserted) ? parsedInserted : 0),
          deletedLineCount:
            totals.deletedLineCount + (Number.isFinite(parsedDeleted) ? parsedDeleted : 0),
        };
      },
      { insertedLineCount: 0, deletedLineCount: 0 },
    );

const runGhCommand = (cwd: string, args: string[]): string =>
  execFileSync("gh", args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  }).trim();

const readErrorDetails = (error: unknown) => {
  if (typeof error !== "object" || error === null) {
    return "";
  }

  const errorWithStreams = error as { stderr?: unknown; message?: unknown };
  const stderr =
    typeof errorWithStreams.stderr === "string"
      ? errorWithStreams.stderr
      : Buffer.isBuffer(errorWithStreams.stderr)
        ? errorWithStreams.stderr.toString("utf8")
        : "";
  if (stderr.trim().length > 0) {
    return stderr.trim();
  }

  return typeof errorWithStreams.message === "string" ? errorWithStreams.message : "";
};

const readGhFailureMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null) {
    const errorWithCode = error as { code?: unknown };
    if (errorWithCode.code === "ENOENT") {
      return "GitHub CLI not found. Install `gh` and run `gh auth login`.";
    }
  }

  const details = readErrorDetails(error).toLowerCase();
  if (details.includes("not logged in")) {
    return "GitHub CLI is not authenticated. Run `gh auth login`.";
  }
  if (details.includes("error connecting to api.github.com")) {
    return "Unable to reach api.github.com from this environment.";
  }
  return null;
};

const isNoPullRequestError = (error: unknown) => {
  const details = readErrorDetails(error).toLowerCase();
  return (
    details.includes("no pull requests found") ||
    details.includes("could not find any pull requests") ||
    details.includes("no open pull requests")
  );
};

const parsePullRequestPayload = (
  payload: unknown,
): {
  number: number;
  url: string;
  title: string;
  baseRef: string;
  headRef: string;
  state: "OPEN" | "MERGED" | "CLOSED";
  isDraft: boolean;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  mergeStateStatus: string | null;
} => {
  if (payload === null || payload === undefined || typeof payload !== "object") {
    throw new Error("Invalid PR payload from gh.");
  }

  const record = payload as Record<string, unknown>;
  const number = Number.parseInt(String(record.number ?? ""), 10);
  const url = typeof record.url === "string" ? record.url : "";
  const title = typeof record.title === "string" ? record.title : "";
  const baseRef = typeof record.baseRefName === "string" ? record.baseRefName : "";
  const headRef = typeof record.headRefName === "string" ? record.headRefName : "";
  const stateRaw = typeof record.state === "string" ? record.state.toUpperCase() : "";
  const mergeableRaw = typeof record.mergeable === "string" ? record.mergeable.toUpperCase() : "";

  const state =
    stateRaw === "OPEN" || stateRaw === "MERGED" || stateRaw === "CLOSED" ? stateRaw : "OPEN";
  const mergeable =
    mergeableRaw === "MERGEABLE" || mergeableRaw === "CONFLICTING" || mergeableRaw === "UNKNOWN"
      ? mergeableRaw
      : "UNKNOWN";

  if (!Number.isFinite(number) || url.length === 0 || title.length === 0) {
    throw new Error("Missing PR fields from gh.");
  }

  return {
    number,
    url,
    title,
    baseRef,
    headRef,
    state,
    isDraft: Boolean(record.isDraft),
    mergeable,
    mergeStateStatus: typeof record.mergeStateStatus === "string" ? record.mergeStateStatus : null,
  };
};

const readPullRequestWithGh = (cwd: string, args: string[]) => {
  const output = runGhCommand(cwd, [
    "pr",
    "view",
    ...args,
    "--json",
    "number,url,title,state,isDraft,baseRefName,headRefName,mergeable,mergeStateStatus",
  ]);
  return parsePullRequestPayload(JSON.parse(output));
};

export const createDefaultGitClient = (): GitClient => ({
  assertAvailable() {
    try {
      execFileSync("git", ["--version"], { stdio: "ignore" });
    } catch (error) {
      throw new Error(`git is required for worktree tentacles: ${toErrorMessage(error)}`);
    }
  },

  isRepository(cwd) {
    try {
      const output = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
        cwd,
        encoding: "utf8",
        stdio: "pipe",
      });
      return output.trim() === "true";
    } catch {
      return false;
    }
  },

  addWorktree({ cwd, path, branchName, baseRef }) {
    mkdirSync(dirname(path), { recursive: true });
    execFileSync("git", ["worktree", "add", "-b", branchName, path, baseRef], {
      cwd,
      stdio: "pipe",
    });
  },

  removeWorktree({ cwd, path }) {
    execFileSync("git", ["worktree", "remove", "--force", path], {
      cwd,
      stdio: "pipe",
    });
  },

  removeBranch({ cwd, branchName }) {
    const output = execFileSync(
      "git",
      ["branch", "--list", "--format=%(refname:short)", branchName],
      {
        cwd,
        encoding: "utf8",
        stdio: "pipe",
      },
    );
    const existingBranches = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (!existingBranches.includes(branchName)) {
      return;
    }

    execFileSync("git", ["branch", "-D", branchName], {
      cwd,
      stdio: "pipe",
    });
  },

  readWorktreeStatus({ cwd }) {
    const branchName = runGitCommand(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const hasHeadCommit = readOptionalGitCommand(cwd, ["rev-parse", "--verify", "HEAD"]) !== null;
    const upstreamBranchName = readOptionalGitCommand(cwd, [
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{upstream}",
    ]);
    const porcelain = readOptionalGitCommand(cwd, ["status", "--porcelain"]) ?? "";
    const statusLines = porcelain
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);
    const changedFiles = statusLines
      .map((line) => parseChangedFile(line))
      .filter((line): line is string => Boolean(line));
    const hasConflicts = statusLines.some((line) => CONFLICT_MARKERS.has(line.slice(0, 2)));
    const lineDiffNumstat = hasHeadCommit
      ? (readOptionalGitCommand(cwd, ["diff", "--numstat", "HEAD", "--"]) ?? "")
      : [
          readOptionalGitCommand(cwd, ["diff", "--numstat", "--cached", "--"]) ?? "",
          readOptionalGitCommand(cwd, ["diff", "--numstat", "--"]) ?? "",
        ]
          .filter((line) => line.length > 0)
          .join("\n");
    const { insertedLineCount, deletedLineCount } = parseDiffNumstatLineCounts(lineDiffNumstat);

    let aheadCount = 0;
    let behindCount = 0;
    if (upstreamBranchName) {
      const counts = runGitCommand(cwd, [
        "rev-list",
        "--left-right",
        "--count",
        `${upstreamBranchName}...HEAD`,
      ]);
      const [rawBehind, rawAhead] = counts.split(/\s+/);
      const parsedBehind = Number.parseInt(rawBehind ?? "0", 10);
      const parsedAhead = Number.parseInt(rawAhead ?? "0", 10);
      behindCount = Number.isFinite(parsedBehind) ? parsedBehind : 0;
      aheadCount = Number.isFinite(parsedAhead) ? parsedAhead : 0;
    }

    const remoteHead = readOptionalGitCommand(cwd, [
      "symbolic-ref",
      "--quiet",
      "--short",
      "refs/remotes/origin/HEAD",
    ]);
    const defaultBaseBranchName = remoteHead?.startsWith("origin/")
      ? remoteHead.slice("origin/".length)
      : null;

    return {
      branchName,
      upstreamBranchName,
      isDirty: statusLines.length > 0,
      aheadCount,
      behindCount,
      insertedLineCount,
      deletedLineCount,
      hasConflicts,
      changedFiles,
      defaultBaseBranchName,
    };
  },

  commitAll({ cwd, message }) {
    execFileSync("git", ["add", "--all"], {
      cwd,
      stdio: "pipe",
    });
    try {
      execFileSync("git", ["diff", "--cached", "--quiet"], {
        cwd,
        stdio: "pipe",
      });
      throw new Error("No local changes to commit.");
    } catch (error) {
      if (!isExitCode(error, 1)) {
        if (error instanceof Error && error.message === "No local changes to commit.") {
          throw error;
        }
        throw new Error(`Unable to prepare commit: ${toErrorMessage(error)}`);
      }
    }

    execFileSync("git", ["commit", "-m", message], {
      cwd,
      stdio: "pipe",
    });
  },

  pushCurrentBranch({ cwd }) {
    const upstreamBranchName = readOptionalGitCommand(cwd, [
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{upstream}",
    ]);

    if (upstreamBranchName) {
      execFileSync("git", ["push"], {
        cwd,
        stdio: "pipe",
      });
      return;
    }

    execFileSync("git", ["push", "--set-upstream", "origin", "HEAD"], {
      cwd,
      stdio: "pipe",
    });
  },

  syncWithBase({ cwd, baseRef }) {
    execFileSync("git", ["fetch", "origin", baseRef], {
      cwd,
      stdio: "pipe",
    });
    execFileSync("git", ["rebase", `origin/${baseRef}`], {
      cwd,
      stdio: "pipe",
    });
  },

  readCurrentBranchPullRequest({ cwd }) {
    try {
      return readPullRequestWithGh(cwd, []);
    } catch (error) {
      if (isNoPullRequestError(error)) {
        return null;
      }

      const ghFailureMessage = readGhFailureMessage(error);
      if (ghFailureMessage) {
        throw new Error(ghFailureMessage);
      }

      throw new Error(`Unable to read pull request: ${toErrorMessage(error)}`);
    }
  },

  createPullRequest({ cwd, title, body, baseRef, headRef }) {
    try {
      const url = runGhCommand(cwd, [
        "pr",
        "create",
        "--title",
        title,
        "--body",
        body,
        "--base",
        baseRef,
        "--head",
        headRef,
      ]);
      if (url.length === 0) {
        throw new Error("GitHub CLI did not return a pull request URL.");
      }
      return readPullRequestWithGh(cwd, [url]);
    } catch (error) {
      const ghFailureMessage = readGhFailureMessage(error);
      if (ghFailureMessage) {
        throw new Error(ghFailureMessage);
      }

      throw new Error(`Unable to create pull request: ${toErrorMessage(error)}`);
    }
  },

  mergeCurrentBranchPullRequest({ cwd, strategy }) {
    try {
      const strategyArg =
        strategy === "merge" ? "--merge" : strategy === "rebase" ? "--rebase" : "--squash";
      runGhCommand(cwd, ["pr", "merge", strategyArg, "--delete-branch=false"]);
    } catch (error) {
      const ghFailureMessage = readGhFailureMessage(error);
      if (ghFailureMessage) {
        throw new Error(ghFailureMessage);
      }
      throw new Error(`Unable to merge pull request: ${toErrorMessage(error)}`);
    }
  },
});

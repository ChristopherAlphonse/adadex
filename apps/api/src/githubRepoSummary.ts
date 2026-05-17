import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type {
  GitHubCommitPoint,
  GitHubRecentCommit,
  GitHubRepoSummarySnapshot,
} from "@adadex/core";

const execFileAsync = promisify(execFile);
const COMMIT_SERIES_DAYS = 30;
const RECENT_COMMIT_LIMIT = 50;
const GITHUB_REPOSITORY_QUERY =
  "query($owner:String!,$name:String!){repository(owner:$owner,name:$name){nameWithOwner stargazerCount issues(states:OPEN){totalCount} pullRequests(states:OPEN){totalCount}}}";

type CommandResult = {
  stdout: string;
  stderr: string;
};

type RunCommand = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
  },
) => Promise<CommandResult>;

export type { GitHubRepoSummarySnapshot };

type GitHubRepoSummaryDependencies = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  runCommand?: RunCommand;
};

const unavailableSnapshot = (now: Date, message: string): GitHubRepoSummarySnapshot => ({
  status: "unavailable",
  fetchedAt: now.toISOString(),
  source: "none",
  message,
});

const errorSnapshot = (now: Date, message: string): GitHubRepoSummarySnapshot => ({
  status: "error",
  fetchedAt: now.toISOString(),
  source: "none",
  message,
});

const defaultRunCommand: RunCommand = async (command, args, options) => {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 4,
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

const normalizeRepository = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed.includes("/")) {
    return null;
  }
  const [owner, name] = trimmed.split("/");
  if (!owner || !name) {
    return null;
  }
  return `${owner}/${name}`;
};

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const buildDailySeries = (now: Date): string[] => {
  const endDate = new Date(now);
  endDate.setUTCHours(0, 0, 0, 0);
  const dates: string[] = [];
  for (let i = COMMIT_SERIES_DAYS - 1; i >= 0; i -= 1) {
    const day = new Date(endDate);
    day.setUTCDate(endDate.getUTCDate() - i);
    dates.push(toIsoDate(day));
  }
  return dates;
};

const readGhAuthenticationFailure = (error: unknown) => {
  if (typeof error !== "object" || !error) {
    return null;
  }

  const errorWithCode = error as { code?: unknown; stderr?: unknown; message?: unknown };
  if (errorWithCode.code === "ENOENT") {
    return "GitHub CLI not found. Install `gh` and run `gh auth login`.";
  }

  const stderr =
    typeof errorWithCode.stderr === "string"
      ? errorWithCode.stderr.toLowerCase()
      : typeof errorWithCode.message === "string"
        ? errorWithCode.message.toLowerCase()
        : "";

  if (stderr.includes("not logged in")) {
    return "GitHub CLI is not authenticated. Run `gh auth login`.";
  }

  if (stderr.includes("error connecting to api.github.com")) {
    return "Unable to reach api.github.com from this environment.";
  }

  return null;
};

const readRepository = async (runCommand: RunCommand, cwd: string, env: NodeJS.ProcessEnv) => {
  const { stdout } = await runCommand(
    "gh",
    ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
    {
      cwd,
      env,
    },
  );

  return normalizeRepository(stdout);
};

const readRepositoryStats = async (
  runCommand: RunCommand,
  cwd: string,
  env: NodeJS.ProcessEnv,
  repository: string,
) => {
  const [owner, name] = repository.split("/");
  const { stdout } = await runCommand(
    "gh",
    [
      "api",
      "graphql",
      "-f",
      `query=${GITHUB_REPOSITORY_QUERY}`,
      "-F",
      `owner=${owner}`,
      "-F",
      `name=${name}`,
    ],
    {
      cwd,
      env,
    },
  );

  const parsed = JSON.parse(stdout) as {
    data?: {
      repository?: {
        nameWithOwner?: unknown;
        stargazerCount?: unknown;
        issues?: { totalCount?: unknown } | null;
        pullRequests?: { totalCount?: unknown } | null;
      } | null;
    };
  };

  const repo = parsed.data?.repository;
  if (!repo || typeof repo !== "object") {
    throw new Error("repository_not_found");
  }

  const stargazerCount = Number.parseInt(String(repo.stargazerCount ?? "0"), 10);
  const openIssueCount = Number.parseInt(String(repo.issues?.totalCount ?? "0"), 10);
  const openPullRequestCount = Number.parseInt(String(repo.pullRequests?.totalCount ?? "0"), 10);
  return {
    stargazerCount: Number.isFinite(stargazerCount) ? stargazerCount : 0,
    openIssueCount: Number.isFinite(openIssueCount) ? openIssueCount : 0,
    openPullRequestCount: Number.isFinite(openPullRequestCount) ? openPullRequestCount : 0,
  };
};

const readCommitSeries = async (
  runCommand: RunCommand,
  cwd: string,
  env: NodeJS.ProcessEnv,
  now: Date,
) => {
  const dates = buildDailySeries(now);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  if (!startDate || !endDate) {
    return [];
  }

  const { stdout } = await runCommand(
    "git",
    [
      "log",
      `--since=${startDate} 00:00:00`,
      `--until=${endDate} 23:59:59`,
      "--date=short",
      "--pretty=format:%ad",
    ],
    {
      cwd,
      env,
    },
  );

  const countsByDate = stdout
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .reduce<Map<string, number>>((acc, date) => {
      acc.set(date, (acc.get(date) ?? 0) + 1);
      return acc;
    }, new Map());

  return dates.map<GitHubCommitPoint>((date) => ({
    date,
    count: countsByDate.get(date) ?? 0,
  }));
};

const parseRecentCommit = (
  entry: string,
): Omit<GitHubRecentCommit, "filesChanged" | "insertions" | "deletions"> | null => {
  const [
    rawHash,
    rawShortHash,
    rawAuthorName,
    rawAuthorEmail,
    rawAuthoredAt,
    rawBody,
    ...subjectParts
  ] = entry.split("\u001f").map((part) => part.trim());
  const rawSubject = subjectParts.join("\u001f").trim();

  if (!rawHash || !rawShortHash || !rawAuthorName || !rawAuthoredAt || !rawSubject) {
    return null;
  }

  const authoredAtMs = Date.parse(rawAuthoredAt);

  return {
    hash: rawHash,
    shortHash: rawShortHash,
    subject: rawSubject,
    authorName: rawAuthorName,
    authorEmail: rawAuthorEmail ?? "",
    authoredAt: Number.isFinite(authoredAtMs)
      ? new Date(authoredAtMs).toISOString()
      : rawAuthoredAt,
    body: rawBody ?? "",
  };
};

type DiffStat = { filesChanged: number; insertions: number; deletions: number };

const parseShortStat = (line: string): DiffStat => {
  const files = line.match(/(\d+)\s+files?\s+changed/);
  const ins = line.match(/(\d+)\s+insertions?\(\+\)/);
  const del = line.match(/(\d+)\s+deletions?\(-\)/);
  return {
    filesChanged: files?.[1] ? Number.parseInt(files[1], 10) : 0,
    insertions: ins?.[1] ? Number.parseInt(ins[1], 10) : 0,
    deletions: del?.[1] ? Number.parseInt(del[1], 10) : 0,
  };
};

const readCommitDiffStats = async (
  runCommand: RunCommand,
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<Map<string, DiffStat>> => {
  const { stdout } = await runCommand(
    "git",
    ["log", `-${RECENT_COMMIT_LIMIT}`, "--pretty=format:%H", "--shortstat"],
    { cwd, env },
  );

  const map = new Map<string, DiffStat>();
  const lines = stdout.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (!line || line.includes("changed")) {
      continue;
    }
    // line is a hash; the next non-empty line may be the shortstat
    const hash = line;
    const nextLine = lines[i + 1]?.trim() ?? "";
    if (nextLine.includes("changed")) {
      map.set(hash, parseShortStat(nextLine));
      i += 1;
    } else {
      map.set(hash, { filesChanged: 0, insertions: 0, deletions: 0 });
    }
  }
  return map;
};

const readRecentCommits = async (runCommand: RunCommand, cwd: string, env: NodeJS.ProcessEnv) => {
  const [formatResult, diffStats] = await Promise.all([
    runCommand(
      "git",
      [
        "log",
        `-${RECENT_COMMIT_LIMIT}`,
        "--date=iso-strict",
        "--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%b%x1f%s%x1e",
      ],
      { cwd, env },
    ),
    readCommitDiffStats(runCommand, cwd, env),
  ]);

  return formatResult.stdout
    .split("\u001e")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const commit = parseRecentCommit(entry);
      if (!commit) {
        return null;
      }
      const stat = diffStats.get(commit.hash);
      return {
        ...commit,
        filesChanged: stat?.filesChanged ?? 0,
        insertions: stat?.insertions ?? 0,
        deletions: stat?.deletions ?? 0,
      };
    })
    .filter((commit): commit is GitHubRecentCommit => commit !== null)
    .slice(0, RECENT_COMMIT_LIMIT);
};

export const readGithubRepoSummary = async (
  dependencies: GitHubRepoSummaryDependencies = {},
): Promise<GitHubRepoSummarySnapshot> => {
  const now = dependencies.now?.() ?? new Date();
  const cwd = dependencies.cwd ?? process.cwd();
  const env = dependencies.env ?? process.env;
  const runCommand = dependencies.runCommand ?? defaultRunCommand;

  let repository: string | null = null;
  try {
    repository = await readRepository(runCommand, cwd, env);
  } catch (error) {
    const knownFailure = readGhAuthenticationFailure(error);
    if (knownFailure) {
      return unavailableSnapshot(now, knownFailure);
    }
    return errorSnapshot(now, "Unable to resolve the current GitHub repository.");
  }

  if (!repository) {
    return unavailableSnapshot(now, "Unable to determine repository from current workspace.");
  }

  try {
    const [stats, commitsPerDay, recentCommits] = await Promise.all([
      readRepositoryStats(runCommand, cwd, env, repository),
      readCommitSeries(runCommand, cwd, env, now),
      readRecentCommits(runCommand, cwd, env),
    ]);

    return {
      status: "ok",
      fetchedAt: now.toISOString(),
      source: "gh-cli",
      repo: repository,
      stargazerCount: stats.stargazerCount,
      openIssueCount: stats.openIssueCount,
      openPullRequestCount: stats.openPullRequestCount,
      commitsPerDay,
      recentCommits,
    };
  } catch (error) {
    const knownFailure = readGhAuthenticationFailure(error);
    if (knownFailure) {
      return unavailableSnapshot(now, knownFailure);
    }

    const errorWithCode = error as { code?: unknown };
    if (errorWithCode?.code === "ENOENT") {
      return unavailableSnapshot(now, "Required command-line tools are not available.");
    }

    return errorSnapshot(now, "Unable to collect GitHub repository summary.");
  }
};

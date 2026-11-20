import { execFileSync } from "node:child_process";

export type StartupPrerequisiteSeverity = "error" | "warning";

export type StartupPrerequisiteIssue = {
  command: string;
  severity: StartupPrerequisiteSeverity;
  summary: string;
  guidance: string;
};

export type StartupPrerequisiteAvailability = Record<
  "kiro" | "claude" | "opencode" | "git" | "gh" | "curl",
  boolean
>;

export type StartupPrerequisiteReport = {
  availability: StartupPrerequisiteAvailability;
  errors: StartupPrerequisiteIssue[];
  warnings: StartupPrerequisiteIssue[];
};

type CommandAvailabilityChecker = (command: string) => boolean;

type CommandAvailabilityOptions = {
  platform?: NodeJS.Platform;
  execFileSyncImpl?: typeof execFileSync;
};

const resolveLookupCommand = (platform: NodeJS.Platform) =>
  platform === "win32"
    ? { file: "where", args: [] as string[] }
    : { file: "which", args: [] as string[] };

export const isCommandAvailable = (
  command: string,
  options: CommandAvailabilityOptions = {},
): boolean => {
  const lookup = resolveLookupCommand(options.platform ?? process.platform);

  try {
    (options.execFileSyncImpl ?? execFileSync)(lookup.file, [...lookup.args, command], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

export const collectStartupPrerequisiteReport = (
  isAvailable: CommandAvailabilityChecker = (command) => isCommandAvailable(command),
): StartupPrerequisiteReport => {
  const availability: StartupPrerequisiteAvailability = {
    kiro: isAvailable("kiro-cli"),
    claude: isAvailable("claude"),
    opencode: isAvailable("opencode"),
    git: isAvailable("git"),
    gh: isAvailable("gh"),
    curl: isAvailable("curl"),
  };

  const errors: StartupPrerequisiteIssue[] = [];
  const warnings: StartupPrerequisiteIssue[] = [];

  if (!availability.kiro && !availability.claude && !availability.opencode) {
    warnings.push({
      command: "kiro-cli",
      severity: "warning",
      summary: "No agent CLI found (`kiro-cli`, `claude`, or `opencode`).",
      guidance:
        "Install at least one agent CLI: Claude Code, OpenCode, or Kiro CLI (curl -fsSL https://cli.kiro.dev/install | bash).",
    });
  }

  if (!availability.git) {
    warnings.push({
      command: "git",
      severity: "warning",
      summary: "`git` is not installed.",
      guidance:
        "Worktree terminals and git lifecycle actions are unavailable. Install Git to enable branch/worktree flows.",
    });
  }

  if (!availability.gh) {
    warnings.push({
      command: "gh",
      severity: "warning",
      summary: "`gh` is not installed.",
      guidance:
        "GitHub pull request features are unavailable. Install GitHub CLI and run `gh auth login` to enable PR actions.",
    });
  }

  if (!availability.curl) {
    warnings.push({
      command: "curl",
      severity: "warning",
      summary: "`curl` is not installed.",
      guidance:
        "Agent hook command callbacks for SessionStart, UserPromptSubmit, and Stop are unavailable. Install curl to restore full hook delivery.",
    });
  }

  return { availability, errors, warnings };
};

export const formatStartupPrerequisiteReport = (report: StartupPrerequisiteReport): string[] => {
  if (report.errors.length === 0 && report.warnings.length === 0) {
    return [];
  }

  const lines = ["Adadex startup preflight:"];

  for (const issue of report.errors) {
    lines.push(`  Error: ${issue.summary}`);
    lines.push(`    ${issue.guidance}`);
  }

  for (const issue of report.warnings) {
    lines.push(`  Warning: ${issue.summary}`);
    lines.push(`    ${issue.guidance}`);
  }

  return lines;
};

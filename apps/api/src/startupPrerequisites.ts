import { execFileSync } from "node:child_process";

import type { TerminalAgentProvider } from "@adadex/core";

import { TERMINAL_BOOTSTRAP_COMMANDS } from "./terminalRuntime/constants";

export type StartupPrerequisiteSeverity = "error" | "warning";

export type StartupPrerequisiteIssue = {
  command: string;
  severity: StartupPrerequisiteSeverity;
  summary: string;
  guidance: string;
};

export type StartupPrerequisiteAvailability = Record<
  TerminalAgentProvider | "git" | "gh" | "curl",
  boolean
>;

export type StartupPrerequisiteReport = {
  availability: StartupPrerequisiteAvailability;
  errors: StartupPrerequisiteIssue[];
  warnings: StartupPrerequisiteIssue[];
};

const agentCli = (key: TerminalAgentProvider, name: string, install: string) => ({
  key,
  name,
  install,
  binary: TERMINAL_BOOTSTRAP_COMMANDS[key],
});

export const DEFAULT_AGENT_CLI = agentCli(
  "claude",
  "Claude Code",
  "curl -fsSL https://claude.ai/install.sh | bash",
);

/** The agent CLIs Adadex can drive, in the order they are suggested. */
export const AGENT_CLIS = [
  DEFAULT_AGENT_CLI,
  agentCli("opencode", "OpenCode", "curl -fsSL https://opencode.ai/install | bash"),
  agentCli("kiro", "Kiro CLI", "curl -fsSL https://cli.kiro.dev/install | bash"),
];

export const AGENT_CLI_INSTALL_GUIDANCE = `Install at least one agent CLI: ${AGENT_CLIS.map(
  (cli) => `${cli.name} (\`${cli.install}\`)`,
).join(", ")}.`;

type CommandAvailabilityChecker = (command: string) => boolean;

type CommandAvailabilityOptions = {
  platform?: NodeJS.Platform;
  execFileSyncImpl?: typeof execFileSync;
};

const resolveLookupCommand = (platform: NodeJS.Platform) =>
  platform === "win32"
    ? {
        file: "where",
        args: /* SAFETY: preceding checks establish the invariant this assertion encodes. */ [] as string[],
      }
    : {
        file: "which",
        args: /* SAFETY: preceding checks establish the invariant this assertion encodes. */ [] as string[],
      };

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
    claude: isAvailable(TERMINAL_BOOTSTRAP_COMMANDS.claude),
    opencode: isAvailable(TERMINAL_BOOTSTRAP_COMMANDS.opencode),
    kiro: isAvailable(TERMINAL_BOOTSTRAP_COMMANDS.kiro),
    git: isAvailable("git"),
    gh: isAvailable("gh"),
    curl: isAvailable("curl"),
  };

  const errors: StartupPrerequisiteIssue[] = [];
  const warnings: StartupPrerequisiteIssue[] = [];

  if (!AGENT_CLIS.some((cli) => availability[cli.key])) {
    warnings.push({
      command: DEFAULT_AGENT_CLI.binary,
      severity: "warning",
      summary: `No agent CLI found (${AGENT_CLIS.map((cli) => `\`${cli.binary}\``).join(", ")}).`,
      guidance: AGENT_CLI_INSTALL_GUIDANCE,
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

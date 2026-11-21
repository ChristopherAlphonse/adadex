import { describe, expect, it } from "vitest";

import {
  collectStartupPrerequisiteReport,
  formatStartupPrerequisiteReport,
  isCommandAvailable,
} from "../src/startupPrerequisites";

describe("startup prerequisites", () => {
  it("passes cleanly when every prerequisite is installed", () => {
    const report = collectStartupPrerequisiteReport(() => true);

    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(formatStartupPrerequisiteReport(report)).toEqual([]);
  });

  it("warns when no agent CLI is installed", () => {
    const report = collectStartupPrerequisiteReport((command) => command === "git");

    expect(report.errors).toEqual([]);
    expect(report.warnings.map((issue) => issue.command)).toEqual(["claude", "gh", "curl"]);
    expect(report.warnings[0]?.summary).toBe(
      "No agent CLI found (`claude`, `opencode`, `kiro-cli`).",
    );
  });

  it.each(["claude", "opencode", "kiro-cli"])(
    "does not warn about the agent CLI when only %s is installed",
    (agentBinary) => {
      const report = collectStartupPrerequisiteReport((command) => command === agentBinary);

      expect(report.errors).toEqual([]);
      expect(report.warnings.map((issue) => issue.command)).toEqual(["git", "gh", "curl"]);
    },
  );

  it("formats the remaining warnings for optional integrations", () => {
    const report = collectStartupPrerequisiteReport((command) => command === "claude");

    expect(formatStartupPrerequisiteReport(report)).toEqual([
      "Adadex startup preflight:",
      "  Warning: `git` is not installed.",
      "    Worktree terminals and git lifecycle actions are unavailable. Install Git to enable branch/worktree flows.",
      "  Warning: `gh` is not installed.",
      "    GitHub pull request features are unavailable. Install GitHub CLI and run `gh auth login` to enable PR actions.",
      "  Warning: `curl` is not installed.",
      "    Agent hook command callbacks for SessionStart, UserPromptSubmit, and Stop are unavailable. Install curl to restore full hook delivery.",
    ]);
  });

  it("uses where on Windows and which elsewhere when checking commands", () => {
    const calls: Array<{ file: string; args: string[] }> = [];

    const windowsAvailable = isCommandAvailable("kiro-cli", {
      platform: "win32",
      execFileSyncImpl:
        /* SAFETY: preceding checks establish the invariant this assertion encodes. */ ((
          file,
          args,
        ) => {
          calls.push({
            file,
            args: /* SAFETY: preceding checks establish the invariant this assertion encodes. */ args as string[],
          });

          return Buffer.from("");
        }) as typeof import("node:child_process").execFileSync,
    });

    const unixAvailable = isCommandAvailable("kiro-cli", {
      platform: "linux",
      execFileSyncImpl:
        /* SAFETY: preceding checks establish the invariant this assertion encodes. */ ((
          file,
          args,
        ) => {
          calls.push({
            file,
            args: /* SAFETY: preceding checks establish the invariant this assertion encodes. */ args as string[],
          });

          return Buffer.from("");
        }) as typeof import("node:child_process").execFileSync,
    });

    expect(windowsAvailable).toBe(true);
    expect(unixAvailable).toBe(true);
    expect(calls).toEqual([
      { file: "where", args: ["kiro-cli"] },
      { file: "which", args: ["kiro-cli"] },
    ]);
  });
});

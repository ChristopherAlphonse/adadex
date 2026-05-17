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

  it("warns when no coding agent CLI is installed", () => {
    const report = collectStartupPrerequisiteReport((command) => command === "git");

    expect(report.errors).toEqual([]);
    expect(report.warnings.map((issue) => issue.command)).toEqual(["codex", "gh", "curl"]);
  });

  it("warns for degraded optional integrations when codex is available", () => {
    const report = collectStartupPrerequisiteReport((command) => command === "codex");

    expect(report.errors).toEqual([]);
    expect(report.warnings.map((issue) => issue.command)).toEqual(["claude", "git", "gh", "curl"]);
    expect(formatStartupPrerequisiteReport(report)).toEqual([
      "Adadex startup preflight:",
      "  Warning: `claude` is not installed.",
      "    Install Claude Code (`npm install -g @anthropic-ai/claude-code`) to use it as an agent provider.",
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

    const windowsAvailable = isCommandAvailable("codex", {
      platform: "win32",
      execFileSyncImpl: ((file, args) => {
        calls.push({ file, args: args as string[] });
        return Buffer.from("");
      }) as typeof import("node:child_process").execFileSync,
    });

    const unixAvailable = isCommandAvailable("codex", {
      platform: "linux",
      execFileSyncImpl: ((file, args) => {
        calls.push({ file, args: args as string[] });
        return Buffer.from("");
      }) as typeof import("node:child_process").execFileSync,
    });

    expect(windowsAvailable).toBe(true);
    expect(unixAvailable).toBe(true);
    expect(calls).toEqual([
      { file: "where", args: ["codex"] },
      { file: "which", args: ["codex"] },
    ]);
  });
});

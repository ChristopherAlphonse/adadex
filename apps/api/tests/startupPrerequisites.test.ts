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

  it("warns when kiro-cli is not installed", () => {
    const report = collectStartupPrerequisiteReport((command) => command === "git");

    expect(report.errors).toEqual([]);
    expect(report.warnings.map((issue) => issue.command)).toEqual(["kiro-cli", "gh", "curl"]);
  });

  it("passes cleanly for optional integrations when kiro-cli is available", () => {
    const report = collectStartupPrerequisiteReport((command) => command === "kiro-cli");

    expect(report.errors).toEqual([]);
    expect(report.warnings.map((issue) => issue.command)).toEqual(["git", "gh", "curl"]);
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
      execFileSyncImpl: ((file, args) => {
        calls.push({ file, args: args as string[] });
        return Buffer.from("");
      }) as typeof import("node:child_process").execFileSync,
    });

    const unixAvailable = isCommandAvailable("kiro-cli", {
      platform: "linux",
      execFileSyncImpl: ((file, args) => {
        calls.push({ file, args: args as string[] });
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

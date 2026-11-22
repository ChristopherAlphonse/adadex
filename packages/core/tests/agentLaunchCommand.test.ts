import { describe, expect, it } from "vitest";

import { buildAgentLaunchCommand, isSafeAgentFlagValue } from "../src";

describe("buildAgentLaunchCommand", () => {
  it("adds model and effort for claude", () => {
    expect(
      buildAgentLaunchCommand("claude", "claude", { model: "claude-opus-5-5", effort: "high" }),
    ).toBe("claude --model claude-opus-5-5 --effort high");
  });

  it("launches other agents bare", () => {
    expect(buildAgentLaunchCommand("kiro", "kiro-cli", { model: "x", effort: "high" })).toBe(
      "kiro-cli",
    );
    expect(buildAgentLaunchCommand("opencode", "opencode", { model: "x" })).toBe("opencode");
  });

  it("leaves out values that are not safe to type into a shell", () => {
    expect(
      buildAgentLaunchCommand("claude", "claude", { model: "x; rm -rf /", effort: "$(id)" }),
    ).toBe("claude");
    expect(buildAgentLaunchCommand("claude", "claude")).toBe("claude");
  });

  it("accepts ids with dots, colons, slashes and dashes", () => {
    expect(isSafeAgentFlagValue("provider/model-1.5:beta")).toBe(true);
    expect(isSafeAgentFlagValue("")).toBe(false);
    expect(isSafeAgentFlagValue("a b")).toBe(false);
    expect(isSafeAgentFlagValue("a".repeat(81))).toBe(false);
  });
});

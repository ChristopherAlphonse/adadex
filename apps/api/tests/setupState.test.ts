import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readSetupState } from "../src/setupState";

describe("setup state", () => {
  it("reads a check-kiro verification from older versions as check-agent-cli", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "adadex-setup-"));
    mkdirSync(join(stateDir, "state"));
    writeFileSync(
      join(stateDir, "state", "setup.json"),
      JSON.stringify({ version: 1, verifiedSteps: { "check-kiro": "2026-01-01T00:00:00.000Z" } }),
    );

    expect(readSetupState(stateDir).verifiedSteps).toEqual({
      "check-agent-cli": "2026-01-01T00:00:00.000Z",
    });
  });
});

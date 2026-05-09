import { describe, expect, it } from "vitest";

import { retainActiveTerminalEntries, retainActiveTerminalIds } from "../src/app/terminalState";

describe("terminalState helpers", () => {
  it("retains active terminal ids and preserves reference when unchanged", () => {
    const currentTerminalIds = ["orchestration-1", "orchestration-2"];
    const activeTerminalIds = new Set(["orchestration-1", "orchestration-2", "orchestration-3"]);

    const nextTerminalIds = retainActiveTerminalIds(currentTerminalIds, activeTerminalIds);

    expect(nextTerminalIds).toBe(currentTerminalIds);
  });

  it("filters removed terminal ids", () => {
    const currentTerminalIds = ["orchestration-1", "orchestration-2"];
    const activeTerminalIds = new Set(["orchestration-2"]);

    const nextTerminalIds = retainActiveTerminalIds(currentTerminalIds, activeTerminalIds);

    expect(nextTerminalIds).toEqual(["orchestration-2"]);
  });

  it("retains active terminal state entries and preserves reference when unchanged", () => {
    const currentState = {
      "orchestration-1": "idle",
      "orchestration-2": "processing",
    };
    const activeTerminalIds = new Set(["orchestration-1", "orchestration-2"]);

    const nextState = retainActiveTerminalEntries(currentState, activeTerminalIds);

    expect(nextState).toBe(currentState);
  });

  it("filters removed terminal state entries", () => {
    const currentState = {
      "orchestration-1": "idle",
      "orchestration-2": "processing",
    };
    const activeTerminalIds = new Set(["orchestration-2"]);

    const nextState = retainActiveTerminalEntries(currentState, activeTerminalIds);

    expect(nextState).toEqual({
      "orchestration-2": "processing",
    });
  });
});

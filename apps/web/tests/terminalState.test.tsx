import { describe, expect, it } from "vitest";

import { retainActiveTerminalEntries, retainActiveTerminalIds } from "../src/app/terminalState";

describe("terminalState helpers", () => {
  it("retains active terminal ids and preserves reference when unchanged", () => {
    const currentTerminalIds = ["tentacle-1", "tentacle-2"];
    const activeTerminalIds = new Set(["tentacle-1", "tentacle-2", "tentacle-3"]);

    const nextTerminalIds = retainActiveTerminalIds(currentTerminalIds, activeTerminalIds);

    expect(nextTerminalIds).toBe(currentTerminalIds);
  });

  it("filters removed terminal ids", () => {
    const currentTerminalIds = ["tentacle-1", "tentacle-2"];
    const activeTerminalIds = new Set(["tentacle-2"]);

    const nextTerminalIds = retainActiveTerminalIds(currentTerminalIds, activeTerminalIds);

    expect(nextTerminalIds).toEqual(["tentacle-2"]);
  });

  it("retains active terminal state entries and preserves reference when unchanged", () => {
    const currentState = {
      "tentacle-1": "idle",
      "tentacle-2": "processing",
    };
    const activeTerminalIds = new Set(["tentacle-1", "tentacle-2"]);

    const nextState = retainActiveTerminalEntries(currentState, activeTerminalIds);

    expect(nextState).toBe(currentState);
  });

  it("filters removed terminal state entries", () => {
    const currentState = {
      "tentacle-1": "idle",
      "tentacle-2": "processing",
    };
    const activeTerminalIds = new Set(["tentacle-2"]);

    const nextState = retainActiveTerminalEntries(currentState, activeTerminalIds);

    expect(nextState).toEqual({
      "tentacle-2": "processing",
    });
  });
});

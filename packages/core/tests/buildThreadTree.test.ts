import { describe, expect, it } from "vitest";

import { type TerminalSnapshot, buildThreadTree, threadStatusOf } from "../src";

const terminal = (id: string, extra: Partial<TerminalSnapshot> = {}): TerminalSnapshot => ({
  terminalId: id,
  label: id,
  state: "live",
  coordinationId: "c",
  createdAt: "2026-11-22T00:00:00.000Z",
  ...extra,
});

describe("buildThreadTree", () => {
  it("nests children under their listed parent and keeps order", () => {
    const tree = buildThreadTree([
      terminal("parent"),
      terminal("w1", { parentTerminalId: "parent" }),
      terminal("w2", { parentTerminalId: "parent" }),
      terminal("solo"),
    ]);

    expect(tree.map((node) => node.terminalId)).toEqual(["parent", "solo"]);
    expect(tree[0]?.children.map((node) => node.terminalId)).toEqual(["w1", "w2"]);
  });

  it("keeps a child as a root when its parent is not listed or is itself", () => {
    const tree = buildThreadTree([
      terminal("orphan", { parentTerminalId: "gone" }),
      terminal("self", { parentTerminalId: "self" }),
    ]);

    expect(tree.map((node) => node.terminalId)).toEqual(["orphan", "self"]);
  });
});

describe("threadStatusOf", () => {
  it("maps runtime and lifecycle state to what a person reads", () => {
    expect(threadStatusOf(terminal("a", { agentRuntimeState: "waiting_for_user" }))).toBe(
      "needs-you",
    );
    expect(threadStatusOf(terminal("b", { agentRuntimeState: "waiting_for_permission" }))).toBe(
      "needs-you",
    );
    expect(threadStatusOf(terminal("c", { agentRuntimeState: "processing" }))).toBe("working");
    expect(threadStatusOf(terminal("d", { lifecycleState: "exited" }))).toBe("done");
    expect(threadStatusOf(terminal("e", { agentRuntimeState: "idle" }))).toBe("idle");
  });
});
